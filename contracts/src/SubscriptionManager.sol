// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAllowanceTransfer} from "./interfaces/IPermit2.sol";

/// @title SubscriptionManager
/// @notice Recurring ERC20 pull payments backed by Permit2 AllowanceTransfer.
///         Customer signs one Permit2 allowance; this contract pulls funds on cadence.
///         Each charge splits into two parts: merchant cut and keeper bounty.
///         There is no protocol fee. The merchant decides the bounty.
contract SubscriptionManager is ReentrancyGuard {
    IAllowanceTransfer public immutable permit2;

    struct Plan {
        address merchant;
        address token;
        uint160 amount;
        uint48 period; // seconds between charges
        uint16 bountyBps; // share of each charge paid to the keeper (out of 10_000)
        bool active;
    }

    struct Subscription {
        uint256 planId;
        address subscriber;
        uint48 nextCharge;
        uint48 createdAt;
        bool cancelled;
    }

    uint16 public constant MAX_BOUNTY_BPS = 1_000; // 10%
    uint48 public constant MIN_PERIOD = 1 hours;

    uint256 public nextPlanId;
    uint256 public nextSubId;

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Subscription) public subscriptions;

    event PlanCreated(
        uint256 indexed planId,
        address indexed merchant,
        address indexed token,
        uint160 amount,
        uint48 period,
        uint16 bountyBps
    );
    event PlanDeactivated(uint256 indexed planId);
    event Subscribed(uint256 indexed subId, uint256 indexed planId, address indexed subscriber);
    event Charged(
        uint256 indexed subId,
        uint48 chargedAt,
        uint48 nextChargeAt,
        uint160 amountToMerchant,
        uint160 bountyToKeeper,
        address keeper
    );
    event Cancelled(uint256 indexed subId, address by);

    error PlanInactive();
    error NotDue();
    error AlreadyCancelled();
    error NotSubscriber();
    error NotMerchant();
    error PeriodTooShort();
    error InvalidAmount();
    error BountyTooHigh();

    constructor(address _permit2) {
        permit2 = IAllowanceTransfer(_permit2);
    }

    // ---------------------------------------------------------------------
    // Merchant
    // ---------------------------------------------------------------------

    function createPlan(address token, uint160 amount, uint48 period, uint16 bountyBps)
        external
        returns (uint256 planId)
    {
        if (period < MIN_PERIOD) revert PeriodTooShort();
        if (amount == 0) revert InvalidAmount();
        if (bountyBps > MAX_BOUNTY_BPS) revert BountyTooHigh();

        planId = nextPlanId++;
        plans[planId] = Plan({
            merchant: msg.sender,
            token: token,
            amount: amount,
            period: period,
            bountyBps: bountyBps,
            active: true
        });

        emit PlanCreated(planId, msg.sender, token, amount, period, bountyBps);
    }

    function deactivatePlan(uint256 planId) external {
        Plan storage p = plans[planId];
        if (p.merchant != msg.sender) revert NotMerchant();
        p.active = false;
        emit PlanDeactivated(planId);
    }

    // ---------------------------------------------------------------------
    // Subscriber
    // ---------------------------------------------------------------------

    /// @notice Subscribe to a plan. Submits the customer's Permit2 signature in the same tx
    ///         and immediately executes the first charge. From here, anyone can call `charge`
    ///         once `period` seconds have elapsed.
    function subscribe(
        uint256 planId,
        IAllowanceTransfer.PermitSingle calldata permitSingle,
        bytes calldata signature
    ) external nonReentrant returns (uint256 subId) {
        Plan memory p = plans[planId];
        if (!p.active) revert PlanInactive();

        permit2.permit(msg.sender, permitSingle, signature);

        subId = nextSubId++;
        uint48 nextAt = uint48(block.timestamp) + p.period;
        subscriptions[subId] = Subscription({
            planId: planId,
            subscriber: msg.sender,
            nextCharge: nextAt,
            createdAt: uint48(block.timestamp),
            cancelled: false
        });

        uint160 toMerchant = _executeCharge(msg.sender, p, address(0));
        emit Subscribed(subId, planId, msg.sender);
        emit Charged(subId, uint48(block.timestamp), nextAt, toMerchant, 0, address(0));
    }

    /// @notice Subscribe without submitting a permit. Customer must have already granted
    ///         Permit2 allowance to this contract for the token in question.
    function subscribeWithExistingAllowance(uint256 planId)
        external
        nonReentrant
        returns (uint256 subId)
    {
        Plan memory p = plans[planId];
        if (!p.active) revert PlanInactive();

        subId = nextSubId++;
        uint48 nextAt = uint48(block.timestamp) + p.period;
        subscriptions[subId] = Subscription({
            planId: planId,
            subscriber: msg.sender,
            nextCharge: nextAt,
            createdAt: uint48(block.timestamp),
            cancelled: false
        });

        uint160 toMerchant = _executeCharge(msg.sender, p, address(0));
        emit Subscribed(subId, planId, msg.sender);
        emit Charged(subId, uint48(block.timestamp), nextAt, toMerchant, 0, address(0));
    }

    function cancel(uint256 subId) external {
        Subscription storage s = subscriptions[subId];
        if (s.cancelled) revert AlreadyCancelled();
        if (msg.sender != s.subscriber) revert NotSubscriber();
        s.cancelled = true;
        emit Cancelled(subId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Keeper (permissionless)
    // ---------------------------------------------------------------------

    /// @notice Charge a due subscription. Anyone can call. The caller receives
    ///         `bountyBps` of the charge as a keeper bounty, deducted from the
    ///         merchant's cut.
    function charge(uint256 subId) external nonReentrant {
        Subscription storage s = subscriptions[subId];
        if (s.cancelled) revert AlreadyCancelled();
        if (block.timestamp < s.nextCharge) revert NotDue();

        Plan memory p = plans[s.planId];
        if (!p.active) revert PlanInactive();

        // Advance schedule before any external calls.
        uint48 nextAt = s.nextCharge + p.period;
        s.nextCharge = nextAt;

        uint160 toMerchant = _executeCharge(s.subscriber, p, msg.sender);

        uint160 bounty = uint160((uint256(p.amount) * p.bountyBps) / 10_000);
        emit Charged(subId, uint48(block.timestamp), nextAt, toMerchant, bounty, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    /// @dev Executes the two-way split of a single charge. `keeper == address(0)`
    ///      means this is a first-charge from subscribe(): no bounty is paid because
    ///      there is no keeper, the subscriber themselves triggered it.
    function _executeCharge(address from, Plan memory p, address keeper)
        internal
        returns (uint160 toMerchant)
    {
        uint160 bounty = keeper == address(0)
            ? 0
            : uint160((uint256(p.amount) * p.bountyBps) / 10_000);
        toMerchant = p.amount - bounty;

        permit2.transferFrom(from, p.merchant, toMerchant, p.token);
        if (bounty > 0) {
            permit2.transferFrom(from, keeper, bounty, p.token);
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function isDue(uint256 subId) external view returns (bool) {
        Subscription memory s = subscriptions[subId];
        if (s.cancelled) return false;
        if (block.timestamp < s.nextCharge) return false;
        return plans[s.planId].active;
    }
}
