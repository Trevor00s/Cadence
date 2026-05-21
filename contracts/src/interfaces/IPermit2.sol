// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Minimal subset of canonical Permit2 (AllowanceTransfer) used by Cadence.
/// @dev Full source: https://github.com/Uniswap/permit2
interface IAllowanceTransfer {
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    /// @notice Submit a signed permit message, updating allowance for `owner` to the spender.
    function permit(address owner, PermitSingle memory permitSingle, bytes calldata signature) external;

    /// @notice Transfer approved tokens from one address to another.
    function transferFrom(address from, address to, uint160 amount, address token) external;

    /// @notice Allowance for (owner, token, spender). Returns amount, expiration, nonce.
    function allowance(address user, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce);
}
