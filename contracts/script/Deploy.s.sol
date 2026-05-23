// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";

/// @notice Deploys SubscriptionManager pointed at canonical Permit2.
/// @dev    Permit2 is deployed at the same address on every EVM chain via CREATE2.
///         If Arc does not yet have Permit2 deployed, deploy it first using the
///         canonical CREATE2 factory and the published bytecode from Uniswap.
contract Deploy is Script {
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function run() external returns (SubscriptionManager manager) {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(pk);

        manager = new SubscriptionManager(PERMIT2);
        console2.log("SubscriptionManager:", address(manager));

        vm.stopBroadcast();
    }
}
