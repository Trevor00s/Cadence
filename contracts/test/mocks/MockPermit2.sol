// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAllowanceTransfer} from "../../src/interfaces/IPermit2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal Permit2 stand-in for tests. Skips signature verification.
///         The on-chain Permit2 verifies an EIP-712 sig; here we just trust
///         whatever PermitSingle is passed. Behavioural surface (allowance
///         bookkeeping + transferFrom) matches Uniswap's contract.
contract MockPermit2 is IAllowanceTransfer {
    struct Allowance {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    mapping(address => mapping(address => mapping(address => Allowance))) private _allowance;

    function permit(address owner, PermitSingle memory p, bytes calldata /*signature*/ ) external {
        Allowance storage a = _allowance[owner][p.details.token][p.spender];
        require(p.details.nonce == a.nonce, "bad nonce");
        a.amount = p.details.amount;
        a.expiration = p.details.expiration;
        a.nonce = p.details.nonce + 1;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        Allowance storage a = _allowance[from][token][msg.sender];
        require(block.timestamp <= a.expiration, "expired");
        require(a.amount >= amount, "insufficient allowance");
        unchecked {
            a.amount -= amount;
        }
        require(IERC20(token).transferFrom(from, to, amount), "transfer failed");
    }

    function allowance(address user, address token, address spender)
        external
        view
        returns (uint160, uint48, uint48)
    {
        Allowance memory a = _allowance[user][token][spender];
        return (a.amount, a.expiration, a.nonce);
    }
}
