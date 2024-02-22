// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Cryptology ERC20StakingPool
/// @author Cryptology SAC
/// @notice Create a staking pool, the pool is managed by a Staking Manager contract

/**
 * Purpose:
 * The staking program is designed to incentivize token holders to commit their tokens to the fund for varying periods,
 * offering rewards to enhance investment returns and ensure the fund's stability.
 *
 * Staking Tiers:
 * The program features tiers based on staking duration, encouraging longer-term holding with potentially higher rewards for extended lock-up periods.
 * The tiers and corresponding rewards are based on the desired balance between incentivizing long-term holding and maintaining fund liquidity.
 *
 * Minimum Staking Amount:
 * Set at 1,000 tokens to ensure participant engagement is meaningful and manageable.
 *
 * Reward Caps and Limits:
 *
 *  Individual Staking Cap:
 *      Limited to 1% of the total token supply per investor, which equates to 200,000 tokens, to prevent over-concentration and ensure broader participation.
 *
 *  Total Staking Cap:
 *      Capped at 50% of the total token supply, ensuring no more than 10,000,000 tokens are staked at any given time, which helps in maintaining the fund's liquidity.
 *
 *  Annual Reward Pool:
 *      Structured to start with 700,000 tokens for the first two years,
 *      reducing to 500,000 tokens for the 3rd and 4th years, and further to 250,000 tokens for the final year.
 *      This reduction in rewards aligns with the fund's approaching exit strategy and helps in liquidity management.
 */

import './IERC20StakingPool.sol';
import '@thirdweb-dev/contracts/extension/PermissionsEnumerable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './ERC20CryptologyToken.sol';

contract ERC20StakingPool is
	IERC20StakingPool,
	PermissionsEnumerable,
	ReentrancyGuard
{
	using SafeERC20 for IERC20;

	/// @dev A stake is locked for 3 months (Silver tier), 6 months (Gold tier) or 12 months (Platinum tier),
	/// @dev after that it is released with its added rewards as per tier.
	/// @dev annual percentage yield silver:    months 1 to 24: 5.00% | months 25 to 48: 4.00% | months 49 to 60: 3.00% (per lockup period: 1.25% | 1.00% | 0.75%)
	/// @dev annual percentage yield gold:      months 1 to 24: 7.00% | months 25 to 48: 6.00% | months 49 to 60: 5.00% (per lockup period: 3.50% | 3.00% | 2.50%)
	/// @dev annual percentage yield platinum:  months 1 to 24: 9.00% | months 25 to 48: 8.00% | months 49 to 60: 7.00%
	/// @dev rewards are calculated and minted at the moment of staking, that way we keep totalSupply of the token in check with resuls of token staking.
	/// @dev reward tiers are based on the start month of a stake for simplicity.
	/// @dev This implies for a user who stakes tier platinum in month 59 that he get's 7% apy but needs to wait till month 71 to claim the end results of his investment.
	/// @dev timelocked tokens can only be transferred back to the owner after the lockup ends.
	/// @dev after year 5 ends all annual percentage yields are set to 0%

	uint256 internal constant THREE_MONTHS = 3;
	uint256 internal constant SIX_MONTHS = 6;
	uint256 internal constant TWELVE_MONTHS = 12;
	/// @dev Average seconds in a month (30.44 days per month)
	uint256 internal constant AVG_SECONDS_PER_MONTH = 2_630_016; // 30.44 * 24 * 60 * 60

	uint256 public constant MIN_STAKE_AMOUNT = 1_000 * (10 ** 18);
	uint256 public constant MAX_STAKE_AMOUNT_USER = 200_000 * (10 ** 18);
	uint256 public constant MAX_STAKE_AMOUNT_POOL = 10_000_000 * (10 ** 18);

	uint8 constant TIER_SILVER = 0;
	uint8 constant TIER_GOLD = 1;
	uint8 constant TIER_PLATINUM = 2;

	bytes32 public constant STAKEPOOL_ROLE = keccak256('STAKEPOOL_ROLE');

	uint256 private nonce = 0;

	/// @dev Mapping from user address to another mapping of stakeID to Stake
	mapping(address => mapping(uint256 => Stake)) private userStakes;

	/// @dev Additional data structure to keep track of stake IDs for each user
	mapping(address => uint256[]) private userStakeIDs;

	mapping(address => uint256) private userTotalStaked;
	// Define mappings to hold APY values for different durations and start months
	mapping(uint256 => mapping(uint256 => uint256))
		private apyByDurationAndMonth;

	uint256 private totalStakedPool = 0;

	IERC20 public immutable safeToken;
	ERC20CryptologyToken public immutable token;
	address public stakeManager;
	uint256 public timestampPoolOpened = 0;

	constructor(address _tokenAddress) {
		safeToken = IERC20(_tokenAddress);
		token = ERC20CryptologyToken(_tokenAddress);

		// For THREE_MONTHS duration (Silver)
		apyByDurationAndMonth[THREE_MONTHS][24] = 5;
		apyByDurationAndMonth[THREE_MONTHS][48] = 4;
		apyByDurationAndMonth[THREE_MONTHS][60] = 3;

		// For SIX_MONTHS duration (Gold)
		apyByDurationAndMonth[SIX_MONTHS][24] = 7;
		apyByDurationAndMonth[SIX_MONTHS][48] = 6;
		apyByDurationAndMonth[SIX_MONTHS][60] = 5;

		// For TWELVE_MONTHS duration (Platinum)
		apyByDurationAndMonth[TWELVE_MONTHS][24] = 9;
		apyByDurationAndMonth[TWELVE_MONTHS][48] = 8;
		apyByDurationAndMonth[TWELVE_MONTHS][60] = 7;
	}

	/// @notice Open the pool per <timestamp>
	function openStakePool(
		uint256 _timestamp
	) external onlyRole(STAKEPOOL_ROLE) {
		if (timestampPoolOpened > 0) {
			// pool already configured
			revert StakingPoolClosedError(
				'The Stakepool is already configured'
			);
		}

		/// @dev don't open a pool in the past; to avoid trying to open it at input <now()> ,
		/// @dev but that being in the past when the block is forged we open any past timestamp at the current block timestamp
		if (_timestamp <= block.timestamp) {
			_timestamp = block.timestamp;
		}

		/// @dev don't open a pool in the far future ( > 13 weeks away)
		if (_timestamp > block.timestamp + 13 weeks) {
			revert StakingPoolOpenError(
				'The timestamp is too far into the future, maximum allowed: ',
				block.timestamp + 13 weeks
			);
		}
		_openPool(_timestamp);
	}

	/// @notice Check if the stakepool is open or not
	function isStakePoolOpen() external view returns (bool) {
		return _isStakePoolOpen();
	}

	/// @notice How many months has the pool been open
	function stakePoolOpenMonths() external view returns (uint256) {
		return _stakePoolOpenMonths();
	}

	/// @notice How many tokens are currently staked in this pool
	function getTotalStakedPool() external view returns (uint256) {
		return totalStakedPool;
	}

	/// @notice How many tokens does this account have staked
	function getTotalStakedAccount(
		address _account
	) external view returns (uint256) {
		return _getTotalStakedAccount(_account);
	}

	function _openPool(uint256 _timestamp) internal {
		timestampPoolOpened = _timestamp;
		emit PoolOpened(_timestamp);
	}

	/// @dev Stakepool is open for 60 months per specifications
	function _isStakePoolOpen() internal view returns (bool) {
		uint256 currentTime = block.timestamp;
		uint256 poolEndTime = timestampPoolOpened +
			(60 * AVG_SECONDS_PER_MONTH); // 60 months from the opening time

		// Check if the current time is greater than or equal to the pool opening time and less than the pool end time
		return currentTime >= timestampPoolOpened && currentTime < poolEndTime;
	}

	function _getTotalStakedAccount(
		address _account
	) internal view returns (uint256) {
		return userTotalStaked[_account];
	}

	/// @dev Translate a given tier to an amount of months
	function _getDurationForTier(uint8 _tier) internal pure returns (uint256) {
		uint256 _duration;
		if (_tier == TIER_SILVER) {
			_duration = THREE_MONTHS;
		} else if (_tier == TIER_GOLD) {
			_duration = SIX_MONTHS;
		} else if (_tier == TIER_PLATINUM) {
			_duration = TWELVE_MONTHS;
		} else {
			revert StakingTierError();
		}
		return _duration;
	}

	/// @dev How many months has the pool been open for? // TEST for edgecases!
	function _stakePoolOpenMonths() internal view returns (uint256) {
		// Cant check how long the pool is open if it is still closed
		if (!_isStakePoolOpen()) {
			revert StakingPoolClosedError('The stakepool is closed.');
		}

		// this is at least 0
		unchecked {
			// Calculate the time difference
			uint256 timeDiff = block.timestamp - timestampPoolOpened;

			// Calculate the number of months since the past timestamp
			uint256 monthsSince = timeDiff / AVG_SECONDS_PER_MONTH;

			return monthsSince;
		}
	}

	/// @dev generate a unique stakeID, use a nonce to prevent a possible clash where amount and user are the same in the same block
	function _generateStakeID(
		address _account,
		uint256 _amount
	) internal returns (uint256) {
		// Increment the nonce for every new ID generated
		nonce++;

		/// @dev Concatenate the inputs into a bytes memory array
		bytes memory data = abi.encodePacked(
			block.timestamp,
			_account,
			_amount,
			nonce
		);

		// Generate a hash of the data using keccak256
		bytes32 hash = keccak256(data);

		/// @dev Cast the bytes32 hash to uint256 to get the unique ID
		uint256 uniqueID = uint256(hash);

		return uniqueID;
	}

	function _calculateRewards(
		uint256 _amount,
		uint256 _duration
	) internal view returns (uint256) {
		uint256 annualYieldPercentage = 0;
		uint256 startMonth = _stakePoolOpenMonths();

		// Determine the applicable APY based on duration and start month
		if (startMonth <= 24) {
			annualYieldPercentage = apyByDurationAndMonth[_duration][24];
		} else if (startMonth <= 48) {
			annualYieldPercentage = apyByDurationAndMonth[_duration][48];
		} else if (startMonth <= 60) {
			annualYieldPercentage = apyByDurationAndMonth[_duration][60];
		} else {
			revert StakingPoolClosedError('The stakepool has ended.');
		}

		// Since rewards are calculated and minted at the moment of staking,
		// we can calculate the total reward for the lockup period based on the APY
		uint256 totalReward = (((_amount * annualYieldPercentage) / 100) *
			_duration) / 12;

		return totalReward;
	}

	function createStake(uint256 _amount, uint8 _tier) external nonReentrant {
		// Only able to stake while the pool is open
		if (!_isStakePoolOpen()) {
			revert StakingPoolClosedError('The stakepool is not open');
		}

		// check if stake is at least the minimal amount
		if (_amount < MIN_STAKE_AMOUNT) {
			revert StakeLimitsError(
				'The amount is below the minimal amount.',
				MIN_STAKE_AMOUNT
			);
		}

		// check if user hasn't stake more than allowed
		if (
			_getTotalStakedAccount(msg.sender) + _amount > MAX_STAKE_AMOUNT_USER
		) {
			revert StakeLimitsError(
				'This stake will surpass the maximum amount allowed per user.',
				MAX_STAKE_AMOUNT_USER
			);
		}

		// check if the pool isn't full yet
		if (totalStakedPool + _amount > MAX_STAKE_AMOUNT_POOL) {
			revert StakeLimitsError(
				'This stake will surpass the maximum amount in the pool.',
				MAX_STAKE_AMOUNT_POOL
			);
		}
		// make sure we have an allowance set!
		if (token.allowance(msg.sender, address(this)) < _amount) {
			revert AllowanceError('Not enough allowance.', msg.sender);
		}

		// make sure the user has enough balance
		if (token.balanceOf(msg.sender) < _amount) {
			revert BalanceError('Not enough Balance.', msg.sender);
		}

		// translate the tier to a duration
		uint256 _duration = _getDurationForTier(_tier);

		// Calculate the rewards for this stake
		uint256 _rewards = _calculateRewards(_amount, _duration);

		// Generate a unique stakeID, e.g., using a counter or hash
		uint256 stakeID = _generateStakeID(msg.sender, _amount);

		// Create the new stake
		Stake memory newStake = Stake({
			stakeID: stakeID,
			amount: _amount,
			rewards: _rewards,
			startTimestamp: block.timestamp,
			duration: _duration
		});

		// Add the stake to the user's stakes
		userStakes[msg.sender][stakeID] = newStake;
		userTotalStaked[msg.sender] += _amount;
		userStakeIDs[msg.sender].push(stakeID); // Track the stakeID for this user

		totalStakedPool += _amount;

		// transferFrom the token
		safeToken.safeTransferFrom(msg.sender, address(this), _amount);

		// mint new tokens for the rewards
		token.mintTo(address(this), _rewards);

		emit StakeCreated(
			msg.sender,
			stakeID,
			block.timestamp,
			_duration,
			_amount,
			_rewards
		);
	}

	/// @notice Unstake: the stake needs to belong to msg.sender, and be released before it can be unstaked.
	/// @dev it will transfer the staked amount + rewards to msg.sender
	function unstake(uint256 _stakeID) external nonReentrant {
		Stake storage stake = userStakes[msg.sender][_stakeID];

		// Check if the stake exists and is not the default empty stake
		require(stake.amount > 0, 'Stake does not exist or already unstaked');

		// check if stake is still locked
		if (
			stake.startTimestamp + (stake.duration * AVG_SECONDS_PER_MONTH) >
			block.timestamp
		) {
			revert StakeTimeLockedError(
				'This stake is still locked',
				stake.startTimestamp,
				stake.duration
			);
		}

		// Remove stake from the user
		delete userStakes[msg.sender][_stakeID];
		userTotalStaked[msg.sender] -= stake.amount;

		// remove amount from the pool
		totalStakedPool -= stake.amount;

		// transfer funds to user
		uint256 amountRewards = stake.amount + stake.rewards;
		safeToken.safeTransfer(msg.sender, amountRewards);

		emit UnstakeEvent(msg.sender, _stakeID);
	}

	/// @notice Function to return all stakes for a user
	function getAllStakesForUser(
		address account
	) external view returns (Stake[] memory) {
		uint256[] memory stakeIDs = userStakeIDs[account];
		Stake[] memory stakes = new Stake[](stakeIDs.length);

		/// @dev only return stakes that are not unstaked yet
		for (uint256 i = 0; i < stakeIDs.length; i++) {
			if (userStakes[account][stakeIDs[i]].amount > 0) {
				stakes[i] = userStakes[account][stakeIDs[i]];
			}
		}

		return stakes;
	}
}
