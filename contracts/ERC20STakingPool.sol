// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Cryptology ERC20StakingPool
/// @author Cryptology SAC
/// @notice Create a staking pool, the rewards are managed by a Staking Manager contract

import "./IERC20StakingPool.sol";
import "@thirdweb-dev/contracts/extension/PermissionsEnumerable.sol";


contract ERC20StakingPool is IERC20StakingPool, PermissionsEnumerable {

}