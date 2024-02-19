// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Cryptology StakingManager
/// @author Cryptology SAC
/// @notice Manage staking pools

import "./IStakingManager.sol";
import "@thirdweb-dev/contracts/extension/PermissionsEnumerable.sol";

abstract contract StakingManager is IStakingManager, PermissionsEnumerable {}
