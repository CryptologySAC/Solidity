/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @author Cryptology SAC

interface IERC20StakingPool {
	/// @dev stakeID - identifier for a stake
	/// @dev amount - amout of tokens staked
	/// @dev rewards - the amount of rewards this stake is generating
	/// @dev startTimestamp - timestamp when the stake was created
	/// @dev duration - time this stake is locked for
	struct Stake {
		uint256 stakeID;
		uint256 amount;
		uint256 rewards;
		uint256 startTimestamp;
		uint256 duration;
	}

	/// @notice Error to revert with when there is an issue opening the StakingPool
	error StakingPoolOpenError(string message, uint256 timestamp);

	/// @notice Error to send when tokens can't be unstacked yet
	error StakeTimeLockedError(
		string message,
		uint256 startTimestamp,
		uint256 duration
	);

	/// @notice Error to revert with when stake does not exist or was already claimed
	error StakeClaimError(Stake stake);

	/// @notice Error to send when trying to create a stake with wrong input
	error StakingTierError();

	/// @notice Error to send when pool is closed.
	error StakingPoolClosedError(string message);

	/// @notice Error to revert with when there is not enough allowance;
	error AllowanceError(string message, address owner);

	/// @notice Error to revert with when there is not enough balance;
	error BalanceError(string message, address owner);

	/// @notice Error to revert with when stake amount is not within the limits;
	error StakeLimitsError(string message, uint256 limit);

	/// @notice event to emit when new stake initiated
	event StakeCreated(
		address indexed staker,
		uint256 stakeID,
		uint256 timestampLocked,
		uint256 duration,
		uint256 amount,
		uint256 rewards
	);

	event UnstakeEvent(address staker, uint256 stakeID);

	event PoolOpened(uint256 timestamp);

	/// @notice set the stakepool to be open starting timestamp
	function openStakePool(uint256 timestamp) external;

	/// @notice is the stakepool open for staking?
	function isStakePoolOpen() external view returns (bool);

	/// @notice How many months has the pool been open
	function stakePoolOpenMonths() external view returns (uint256);

	/// @notice return the total amount of tokens that are staked in the pool
	function getTotalStakedPool() external view returns (uint256);

	/// @notice how much has an account stked
	function getTotalStakedAccount(
		address _account
	) external view returns (uint256);

	/// @notice let msg.sender creat a stake
	function createStake(uint256 _amount, uint8 _tier) external;

	function getAllStakesForUser(
		address account
	) external view returns (Stake[] memory);

	function unstake(uint256 _stakeIndex) external;
}
