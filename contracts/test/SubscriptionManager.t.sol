// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {IAllowanceTransfer} from "../src/interfaces/IPermit2.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockPermit2} from "./mocks/MockPermit2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SubscriptionManagerTest is Test {
    SubscriptionManager mgr;
    MockPermit2 permit2;
    MockERC20 usdc;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");

    uint160 constant PRICE = 10e6; // 10 USDC
    uint48 constant PERIOD = 30 days;
    uint16 constant BOUNTY_BPS = 50; // 0.5%

    function setUp() public {
        permit2 = new MockPermit2();
        usdc = new MockERC20("USDC", "USDC", 6);
        mgr = new SubscriptionManager(address(permit2));

        usdc.mint(alice, 1_000e6);

        vm.prank(alice);
        usdc.approve(address(permit2), type(uint256).max);
    }

    function _createDefaultPlan() internal returns (uint256 planId) {
        vm.prank(merchant);
        planId = mgr.createPlan(address(usdc), PRICE, PERIOD, BOUNTY_BPS);
    }

    function _defaultPermit() internal view returns (IAllowanceTransfer.PermitSingle memory) {
        return IAllowanceTransfer.PermitSingle({
            details: IAllowanceTransfer.PermitDetails({
                token: address(usdc),
                amount: type(uint160).max,
                expiration: uint48(block.timestamp + 365 days),
                nonce: 0
            }),
            spender: address(mgr),
            sigDeadline: block.timestamp + 1 hours
        });
    }

    // -----------------------------------------------------------------
    // Plan management
    // -----------------------------------------------------------------

    function test_createPlan() public {
        uint256 planId = _createDefaultPlan();
        assertEq(planId, 0);
        (address m, address t, uint160 a, uint48 p, uint16 b, bool active) = mgr.plans(planId);
        assertEq(m, merchant);
        assertEq(t, address(usdc));
        assertEq(a, PRICE);
        assertEq(p, PERIOD);
        assertEq(b, BOUNTY_BPS);
        assertTrue(active);
    }

    function test_createPlan_revertsOnShortPeriod() public {
        vm.prank(merchant);
        vm.expectRevert(SubscriptionManager.PeriodTooShort.selector);
        mgr.createPlan(address(usdc), PRICE, 30 minutes, BOUNTY_BPS);
    }

    function test_createPlan_revertsOnZeroAmount() public {
        vm.prank(merchant);
        vm.expectRevert(SubscriptionManager.InvalidAmount.selector);
        mgr.createPlan(address(usdc), 0, PERIOD, BOUNTY_BPS);
    }

    function test_createPlan_revertsOnHighBounty() public {
        vm.prank(merchant);
        vm.expectRevert(SubscriptionManager.BountyTooHigh.selector);
        mgr.createPlan(address(usdc), PRICE, PERIOD, 1_001);
    }

    function test_deactivatePlan_onlyMerchant() public {
        uint256 planId = _createDefaultPlan();
        vm.expectRevert(SubscriptionManager.NotMerchant.selector);
        mgr.deactivatePlan(planId);
    }

    function test_deactivatePlan_works() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(merchant);
        mgr.deactivatePlan(planId);
        (,,,,, bool active) = mgr.plans(planId);
        assertFalse(active);
    }

    // -----------------------------------------------------------------
    // Subscribe + first charge
    // -----------------------------------------------------------------

    function test_subscribe_firstChargePulled() public {
        uint256 planId = _createDefaultPlan();
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 merchantBefore = usdc.balanceOf(merchant);

        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        assertEq(subId, 0);
        assertEq(usdc.balanceOf(alice), aliceBefore - PRICE);
        // No keeper bounty on first charge: merchant gets the full PRICE.
        assertEq(usdc.balanceOf(merchant), merchantBefore + PRICE);

        (uint256 pid, address sub, uint48 next,, bool cancelled) = mgr.subscriptions(subId);
        assertEq(pid, planId);
        assertEq(sub, alice);
        assertEq(next, block.timestamp + PERIOD);
        assertFalse(cancelled);
    }

    function test_subscribe_revertsOnInactivePlan() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(merchant);
        mgr.deactivatePlan(planId);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.PlanInactive.selector);
        mgr.subscribe(planId, _defaultPermit(), "");
    }

    // -----------------------------------------------------------------
    // Recurring charge
    // -----------------------------------------------------------------

    function test_charge_afterPeriod_payoutsCorrect() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        uint256 merchantBefore = usdc.balanceOf(merchant);
        uint256 keeperBefore = usdc.balanceOf(keeper);

        vm.warp(block.timestamp + PERIOD);
        vm.prank(keeper);
        mgr.charge(subId);

        uint160 expectedBounty = uint160((uint256(PRICE) * BOUNTY_BPS) / 10_000);
        uint160 expectedMerchant = PRICE - expectedBounty;

        assertEq(usdc.balanceOf(merchant), merchantBefore + expectedMerchant);
        assertEq(usdc.balanceOf(keeper), keeperBefore + expectedBounty);
    }

    function test_charge_revertsBeforeDue() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        vm.prank(keeper);
        vm.expectRevert(SubscriptionManager.NotDue.selector);
        mgr.charge(subId);
    }

    function test_charge_advancesScheduleCalendarStyle() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        uint48 firstNext = uint48(block.timestamp + PERIOD);

        // Late by 5 days: next should still be firstNext + PERIOD, not block.timestamp + PERIOD.
        vm.warp(firstNext + 5 days);
        vm.prank(keeper);
        mgr.charge(subId);

        (,, uint48 nextCharge,,) = mgr.subscriptions(subId);
        assertEq(nextCharge, firstNext + PERIOD);
    }

    function test_charge_catchUpMultiplePeriods() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        uint256 merchantBefore = usdc.balanceOf(merchant);

        // Skip 3 periods.
        vm.warp(block.timestamp + PERIOD * 4);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(keeper);
            mgr.charge(subId);
        }

        uint160 expectedBounty = uint160((uint256(PRICE) * BOUNTY_BPS) / 10_000);
        uint160 expectedMerchantPer = PRICE - expectedBounty;
        assertEq(usdc.balanceOf(merchant), merchantBefore + uint256(expectedMerchantPer) * 3);
    }

    function test_charge_revertsAfterCancel() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        vm.prank(alice);
        mgr.cancel(subId);

        vm.warp(block.timestamp + PERIOD);
        vm.prank(keeper);
        vm.expectRevert(SubscriptionManager.AlreadyCancelled.selector);
        mgr.charge(subId);
    }

    function test_charge_revertsAfterPlanDeactivated() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        vm.prank(merchant);
        mgr.deactivatePlan(planId);

        vm.warp(block.timestamp + PERIOD);
        vm.prank(keeper);
        vm.expectRevert(SubscriptionManager.PlanInactive.selector);
        mgr.charge(subId);
    }

    // -----------------------------------------------------------------
    // Cancel
    // -----------------------------------------------------------------

    function test_cancel_onlySubscriber() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        vm.prank(merchant);
        vm.expectRevert(SubscriptionManager.NotSubscriber.selector);
        mgr.cancel(subId);
    }

    function test_cancel_twice_reverts() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        vm.prank(alice);
        mgr.cancel(subId);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.AlreadyCancelled.selector);
        mgr.cancel(subId);
    }

    // -----------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------

    function test_isDue_lifecycle() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        assertFalse(mgr.isDue(subId));
        vm.warp(block.timestamp + PERIOD);
        assertTrue(mgr.isDue(subId));

        vm.prank(alice);
        mgr.cancel(subId);
        assertFalse(mgr.isDue(subId));
    }

    // -----------------------------------------------------------------
    // Zero bounty path
    // -----------------------------------------------------------------

    function test_charge_zeroBounty_merchantGetsAll() public {
        vm.prank(merchant);
        uint256 planId = mgr.createPlan(address(usdc), PRICE, PERIOD, 0);

        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        uint256 merchantBefore = usdc.balanceOf(merchant);

        vm.warp(block.timestamp + PERIOD);
        vm.prank(keeper);
        mgr.charge(subId);

        assertEq(usdc.balanceOf(merchant), merchantBefore + PRICE);
        assertEq(usdc.balanceOf(keeper), 0);
    }

    function test_charge_twoWaySplit_addsToTotal() public {
        uint256 planId = _createDefaultPlan();
        vm.prank(alice);
        uint256 subId = mgr.subscribe(planId, _defaultPermit(), "");

        uint256 merchantBefore = usdc.balanceOf(merchant);
        uint256 keeperBefore = usdc.balanceOf(keeper);

        vm.warp(block.timestamp + PERIOD);
        vm.prank(keeper);
        mgr.charge(subId);

        uint256 paidToMerchant = usdc.balanceOf(merchant) - merchantBefore;
        uint256 paidToKeeper = usdc.balanceOf(keeper) - keeperBefore;

        // The two outflows must sum to the plan price, exactly.
        assertEq(paidToMerchant + paidToKeeper, PRICE);
    }
}
