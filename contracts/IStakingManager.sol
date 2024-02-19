/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @author Cryptology SAC

interface IStakingManager {
    function getTotalStaked(address _user) external returns (uint256);

    function reachedStakeLimits(address _user) external returns (bool);

    function getTotalStaked() external returns (uint256);
}
