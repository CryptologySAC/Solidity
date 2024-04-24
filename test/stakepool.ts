import {expect} from 'chai'
import {ethers, config} from 'hardhat'
import {
	loadFixture,
	mine,
	time
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {keccak256, toUtf8Bytes, ZeroAddress, MaxUint256} from 'ethers'
import {signERC2612Permit} from 'eth-permit'
import {
	type ERC20CryptologyToken,
	type ERC20StakingPool
} from '../typechain-types'
import {type HardhatNetworkHDAccountsUserConfig} from 'hardhat/types'
import {anyValue} from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import BigNumber from 'bignumber.js'

describe('ERC20StakingPool.sol', function () {
	const PROJECT_NAME = 'ERC20Cryptology'
	const PROJECT_SYMBOL = 'CRYPTOLOGY'
	const MAX_CAPPED_TOKENS = '20000000000000000000000000'
	const MAX_STAKE_POOL = '10000000000000000000000000'
	const MIN_STAKE_AMOUNT = '1000000000000000000000'
	const MAX_STAKE_AMOUNT = '200000000000000000000000'
	const MIN_STAKE_REWARDS_SILVER_24 = '12500000000000000000'
	const MIN_STAKE_REWARDS_SILVER_48 = '10000000000000000000'
	const MIN_STAKE_REWARDS_SILVER_60 = '7500000000000000000'
	const MIN_STAKE_REWARDS_GOLD_24 = '35000000000000000000'
	const MIN_STAKE_REWARDS_GOLD_48 = '30000000000000000000'
	const MIN_STAKE_REWARDS_GOLD_60 = '25000000000000000000'
	const MIN_STAKE_REWARDS_PLATINUM_24 = '90000000000000000000'
	const MIN_STAKE_REWARDS_PLATINUM_48 = '80000000000000000000'
	const MIN_STAKE_REWARDS_PLATINUM_60 = '70000000000000000000'
	const TIER_SILVER = 0
	const TIER_GOLD = 1
	const TIER_PLATINUM = 2
	const THREE_MONTHS = 3
	const SIX_MONTHS = 6
	const TWELVE_MONTHS = 12
	const AVG_SECONDS_PER_MONTH = new BigNumber(2630016) // 30.44 * 24 * 60 * 60

	const PROJECT_DECIMALS = 18
	const DEFAULT_ADMIN_ROLE =
		'0x0000000000000000000000000000000000000000000000000000000000000000'
	const MINTER_ROLE = keccak256(toUtf8Bytes('MINTER_ROLE'))
	const PAUSER_ROLE = keccak256(toUtf8Bytes('PAUSER_ROLE'))
	const STAKEPOOL_ROLE = keccak256(toUtf8Bytes('STAKEPOOL_ROLE'))
	const PERMISSIONS = /^Permissions:/

	type contracts = {
		stakingPoolInstance: ERC20StakingPool
		tokenInstance: ERC20CryptologyToken
	}

	async function deployStakingPool(): Promise<contracts> {
		const tokenInstance: ERC20CryptologyToken = await ethers.deployContract(
			'ERC20CryptologyTokenTest',
			[PROJECT_NAME, PROJECT_SYMBOL, MAX_CAPPED_TOKENS]
		)

		const tokenAddress = await tokenInstance.getAddress()
		console.log(`Token Address: ${tokenAddress}`)

		const stakingPoolInstance: ERC20StakingPool =
			await ethers.deployContract('ERC20StakingPoolTest', [tokenAddress])

		const stakingPoolAddress = await stakingPoolInstance.getAddress()
		console.log(`Staking Pool Address: ${stakingPoolAddress}`)

		const accounts = await ethers.getSigners()
		console.log(`First account: ${accounts[0].address}`)

		// Prepare both contracts
		// add MINTER_ROLE
		await tokenInstance.grantRole(MINTER_ROLE, stakingPoolAddress)

		// add funds
		await tokenInstance.mintTo(accounts[1].address, MAX_STAKE_AMOUNT)

		return {stakingPoolInstance, tokenInstance}
	}

	const date = new Date()
	const NOW = Math.floor(date.getTime() / 1000)
	const THIRTHEEN_WEEKS = time.duration.weeks(13) + 1
	const SIXTY_MONTHS = time.duration.weeks(261)
	const POOL_OPEN_NEAR_FUTURE = NOW + 500
	const POOL_OPEN_FAR_FUTURE = POOL_OPEN_NEAR_FUTURE + THIRTHEEN_WEEKS

	describe('openStakePool', function () {
		it('it should correctly open the pool with a valid timestamp at least block.timestamp or in the future.', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(false)
			await expect(
				stakingPoolInstance.openStakePool(POOL_OPEN_NEAR_FUTURE)
			)
				.to.emit(stakingPoolInstance, 'PoolOpened')
				.withArgs(POOL_OPEN_NEAR_FUTURE)
			// mine 1000 blocks to make sure the pool is open
			await mine(1000)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(true)
		})

		it('it should correctly open the pool with a timestamp in the past.', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(false)
			const initialTimestamp = await time.latest()
			await expect(stakingPoolInstance.openStakePool(0))
				.to.emit(stakingPoolInstance, 'PoolOpened')
				.withArgs(initialTimestamp + 1)
		})

		it('it should revert if we open the pool with a timestamp larger than <block.timestamp + 13 weeks>', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(false)
			const initialTimestamp = await time.latest()
			await expect(
				stakingPoolInstance.openStakePool(POOL_OPEN_FAR_FUTURE)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolOpenError'
				)
				.withArgs(
					'The timestamp is too far into the future, maximum allowed: ',
					initialTimestamp + THIRTHEEN_WEEKS
				)

			// confirm that we moved one block and with that 1 second
			expect((await time.latest()) - initialTimestamp).eq(1)
		})

		it('it should revert if the pool is already configured.', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(false)
			await expect(
				stakingPoolInstance.openStakePool(POOL_OPEN_NEAR_FUTURE)
			)
				.to.emit(stakingPoolInstance, 'PoolOpened')
				.withArgs(POOL_OPEN_NEAR_FUTURE)
			await expect(
				stakingPoolInstance.openStakePool(POOL_OPEN_NEAR_FUTURE + 1000)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The Stakepool is already configured')
		})

		it('it should revert if trying to open the pool with MaxUint256.', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(false)
			const initialTimestamp = await time.latest()
			await expect(stakingPoolInstance.openStakePool(MaxUint256))
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolOpenError'
				)
				.withArgs(
					'The timestamp is too far into the future, maximum allowed: ',
					initialTimestamp + THIRTHEEN_WEEKS
				)
		})
	})

	it('it should revert if trying to open the pool without the correct ROLE.', async function () {
		const {stakingPoolInstance} = await loadFixture(deployStakingPool)
		const [admin, generalAccount] = await ethers.getSigners()
		expect(
			await stakingPoolInstance.connect(admin).isStakePoolOpen()
		).to.equal(false)
		await expect(
			stakingPoolInstance
				.connect(generalAccount)
				.openStakePool(POOL_OPEN_NEAR_FUTURE)
		).to.revertedWith(PERMISSIONS)
	})

	describe('stakePoolOpenMonths()', function () {
		it('it should revert when pool is not configured', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			await expect(stakingPoolInstance.stakePoolOpenMonths())
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is closed.')
		})

		it('it should revert when pool is not yet open', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			const initialTimestamp = await time.latest()
			await expect(
				stakingPoolInstance.openStakePool(initialTimestamp + 1000)
			)
				.to.emit(stakingPoolInstance, 'PoolOpened')
				.withArgs(initialTimestamp + 1000)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(false)
			await expect(stakingPoolInstance.stakePoolOpenMonths())
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is closed.')
		})

		it('it should show 0 months when pool is open less than a month', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			const initialTimestamp = await time.latest()
			await expect(stakingPoolInstance.openStakePool(0))
				.to.emit(stakingPoolInstance, 'PoolOpened')
				.withArgs(initialTimestamp + 1)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(true)
			await mine(time.duration.days(30))
			expect(await stakingPoolInstance.stakePoolOpenMonths()).to.eq(0)
		})

		it('it should show 1 month when pool is open more than a month but less than two months', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			const initialTimestamp = await time.latest()
			await expect(stakingPoolInstance.openStakePool(0))
				.to.emit(stakingPoolInstance, 'PoolOpened')
				.withArgs(initialTimestamp + 1)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(true)
			await mine(time.duration.days(31))
			expect(await stakingPoolInstance.stakePoolOpenMonths()).to.eq(1)
		})

		it('it should revert when pool is open more than 60 months', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			const initialTimestamp = await time.latest()
			await expect(stakingPoolInstance.openStakePool(0))
				.to.emit(stakingPoolInstance, 'PoolOpened')
				.withArgs(initialTimestamp + 1)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(true)
			await mine(SIXTY_MONTHS)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.equal(false)
			await expect(stakingPoolInstance.stakePoolOpenMonths())
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is closed.')
		})
	})

	describe('createStake()', function () {
		it('it should revert when the pool is closed', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			const [admin, generalAccount] = await ethers.getSigners()
			expect(
				await stakingPoolInstance.connect(admin).isStakePoolOpen()
			).to.equal(false)
			await expect(
				stakingPoolInstance.connect(generalAccount).createStake(2000, 1)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is not open.')
		})

		it('it should revert if the amount is less than 1000', async function () {
			const {stakingPoolInstance} = await loadFixture(deployStakingPool)
			const [admin, generalAccount] = await ethers.getSigners()
			await stakingPoolInstance.openStakePool(0)
			expect(
				await stakingPoolInstance.connect(admin).isStakePoolOpen()
			).to.equal(true)
			await expect(
				stakingPoolInstance.connect(generalAccount).createStake(999, 1)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakeLimitsError'
				)
				.withArgs(
					'The amount is below the minimal amount.',
					MIN_STAKE_AMOUNT
				)
		})

		it('it should revert if the account has already staked more than allowed, including this stake', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			expect(
				await stakingPoolInstance.getTotalStakedAccount(
					accounts[1].address
				)
			).to.eq(MIN_STAKE_AMOUNT)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MAX_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakeLimitsError'
				)
				.withArgs(
					'This stake will surpass the maximum amount allowed per user.',
					MAX_STAKE_AMOUNT
				)
		})

		it('it should revert if the stake pool is full', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)
			const stakingPoolAddress = stakingPoolInstance.getAddress()

			let i: number = 2
			while (i < 52) {
				await tokenInstance
					.connect(accounts[i])
					.approve(stakingPoolAddress, MaxUint256)

				await tokenInstance.mintTo(
					accounts[i].address,
					MAX_STAKE_AMOUNT
				)
				await stakingPoolInstance
					.connect(accounts[i])
					.createStake(MAX_STAKE_AMOUNT, TIER_SILVER)
				i++
			}

			expect(await stakingPoolInstance.getTotalStakedPool()).to.eq(
				MAX_STAKE_POOL
			)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MAX_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakeLimitsError'
				)
				.withArgs(
					'This stake will surpass the maximum amount in the pool.',
					MAX_STAKE_POOL
				)
		})

		it('it should revert if the contract does not have the token allowance from the staker', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MAX_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'AllowanceError'
				)
				.withArgs('Not enough allowance.', accounts[1].address)
		})

		it('it should revert if the staker does not have the balance to stake', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[2])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[2])
					.createStake(MAX_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.revertedWithCustomError(stakingPoolInstance, 'BalanceError')
				.withArgs('Not enough Balance.', accounts[2].address)
		})

		it('it should revert if the contract does not have the ROLE to mint the token', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)
			await tokenInstance.revokeRole(
				MINTER_ROLE,
				stakingPoolInstance.getAddress()
			)
			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MAX_STAKE_AMOUNT, TIER_SILVER)
			).to.revertedWith(PERMISSIONS)
		})

		it('it should revert on a wrong tier input', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_GOLD)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_PLATINUM)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, 4)
			).to.revertedWithCustomError(
				stakingPoolInstance,
				'StakingTierError'
			)
		})

		it('it should determine the duration correcly', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					anyValue,
					anyValue,
					anyValue,
					THREE_MONTHS,
					anyValue,
					anyValue
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_GOLD)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					anyValue,
					anyValue,
					anyValue,
					SIX_MONTHS,
					anyValue,
					anyValue
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_PLATINUM)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					anyValue,
					anyValue,
					anyValue,
					TWELVE_MONTHS,
					anyValue,
					anyValue
				)
		})

		it('it should calculate the rewards correcly', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			const initialTimestamp = (await time.latest()) + 1
			const MONTH_24: number = AVG_SECONDS_PER_MONTH.times(24)
				.plus(initialTimestamp)
				.toNumber()
			const MONTH_48 = AVG_SECONDS_PER_MONTH.times(48)
				.plus(initialTimestamp)
				.toNumber()
			const MONTH_60 = AVG_SECONDS_PER_MONTH.times(60)
				.plus(initialTimestamp)
				.toNumber()

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					THREE_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_SILVER_24
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_GOLD)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					SIX_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_GOLD_24
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_PLATINUM)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					TWELVE_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_PLATINUM_24
				)

			// go forward in time to month 24+: lower start interest by 1%
			await time.increaseTo(MONTH_24)
			expect(await stakingPoolInstance.stakePoolOpenMonths()).to.eq(24)
			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					THREE_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_SILVER_48
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_GOLD)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					SIX_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_GOLD_48
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_PLATINUM)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					TWELVE_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_PLATINUM_48
				)

			// go forward in time to month 48+: lower start interest by 2%
			await time.increaseTo(MONTH_48)
			expect(await stakingPoolInstance.stakePoolOpenMonths()).to.eq(48)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					THREE_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_SILVER_60
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_GOLD)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					SIX_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_GOLD_60
				)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_PLATINUM)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					TWELVE_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_PLATINUM_60
				)

			// go forward in time to month 60+: Pool closed
			await time.increaseTo(MONTH_60)
			await expect(stakingPoolInstance.stakePoolOpenMonths())
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is closed.')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is not open.')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_GOLD)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is not open.')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_PLATINUM)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakingPoolClosedError'
				)
				.withArgs('The stakepool is not open.')
		})

		it('it should generate an stake correctly', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			)
				.to.emit(stakingPoolInstance, 'StakeCreated')
				.withArgs(
					accounts[1].address,
					anyValue,
					anyValue,
					THREE_MONTHS,
					MIN_STAKE_AMOUNT,
					MIN_STAKE_REWARDS_SILVER_24
				)
		})

		it('it should update the stake amount totals correctly', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			expect(await stakingPoolInstance.getTotalStakedPool()).to.eq(
				MIN_STAKE_AMOUNT
			)

			expect(
				await stakingPoolInstance.getTotalStakedAccount(
					accounts[1].address
				)
			).to.eq(MIN_STAKE_AMOUNT)
		})

		it('it should mint the reward amount correctly', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const EXPECTED_BALANCE =
				BigInt(MIN_STAKE_AMOUNT) + BigInt(MIN_STAKE_REWARDS_SILVER_24)

			expect(
				await tokenInstance.balanceOf(
					await stakingPoolInstance.getAddress()
				)
			).to.eq(EXPECTED_BALANCE)
		})

		it('it should revert if it can not mint the reward amount', async function () {})
	})

	describe('getAllStakesForUser()', function () {
		it('it should return empty array when there are no stakes', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)
			expect(stakes.length).to.eq(0)
		})

		it('it should return array with 1 entry when there is one stake', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)
			expect(stakes.length).to.eq(1)
		})

		it('it should return array with x entries when there are x stakes', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)
			expect(stakes.length).to.eq(2)
			// stakes.forEach(element => {
			//	console.log(`stakes: ${element[0]}`)
			// })
		})

		it('it should return an empty array when requesting for the zero address', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			const stakes =
				await stakingPoolInstance.getAllStakesForUser(ZeroAddress)
			expect(stakes.length).to.eq(0)
		})

		it('it should return an empty array when requesting for the contract address', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				await stakingPoolInstance.getAddress()
			)
			expect(stakes.length).to.eq(0)
		})

		it('should show the correct amount if the pool is closed', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const initialTimestamp = (await time.latest()) + 1
			const MONTH_60: number = AVG_SECONDS_PER_MONTH.times(60)
				.plus(initialTimestamp)
				.toNumber()
			await time.increaseTo(MONTH_60)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.eq(false)
			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)
			expect(stakes.length).to.eq(2)
		})

		it('should show only stakes that have not been claimed yet', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const initialTimestamp = (await time.latest()) + 1
			const MONTH_60: number = AVG_SECONDS_PER_MONTH.times(60)
				.plus(initialTimestamp)
				.toNumber()
			await time.increaseTo(MONTH_60)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.eq(false)

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)

			const stakeID = `${stakes[0][0]}`
			await expect(
				stakingPoolInstance.connect(accounts[1]).unstake(stakeID)
			)
				.to.emit(stakingPoolInstance, 'UnstakeEvent')
				.withArgs(accounts[1].address, stakeID)

			const stakesAfterRemove =
				await stakingPoolInstance.getAllStakesForUser(
					accounts[1].address
				)
			expect(stakes.length).to.eq(2)
			expect(stakesAfterRemove.length).to.eq(1)
		})
	})

	describe('unstake()', function () {
		it('it should revert if the stake was already claimed or does not exist', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const initialTimestamp = (await time.latest()) + 1
			const MONTH_60: number = AVG_SECONDS_PER_MONTH.times(60)
				.plus(initialTimestamp)
				.toNumber()
			await time.increaseTo(MONTH_60)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.eq(false)

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)

			const stakeID = `${stakes[0][0]}`
			await expect(
				stakingPoolInstance.connect(accounts[1]).unstake(stakeID)
			)
				.to.emit(stakingPoolInstance, 'UnstakeEvent')
				.withArgs(accounts[1].address, stakeID)

			const stakesAfterRemove =
				await stakingPoolInstance.getAllStakesForUser(
					accounts[1].address
				)
			expect(stakes.length).to.eq(2)
			expect(stakesAfterRemove.length).to.eq(1)

			await expect(
				stakingPoolInstance.connect(accounts[1]).unstake(stakeID)
			).to.revertedWithCustomError(stakingPoolInstance, 'StakeClaimError')
		})

		it('it should revert if the stake is not for the <msg.sender>', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const initialTimestamp = (await time.latest()) + 1
			const MONTH_60: number = AVG_SECONDS_PER_MONTH.times(60)
				.plus(initialTimestamp)
				.toNumber()
			await time.increaseTo(MONTH_60)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.eq(false)

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)

			const stakeID = `${stakes[0][0]}`

			await expect(
				stakingPoolInstance.connect(accounts[2]).unstake(stakeID)
			).to.revertedWithCustomError(stakingPoolInstance, 'StakeClaimError')
		})

		it('it should revert if the stake is not claimable yet', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)

			const stakeID = `${stakes[0][0]}`

			await expect(
				stakingPoolInstance.connect(accounts[1]).unstake(stakeID)
			)
				.to.revertedWithCustomError(
					stakingPoolInstance,
					'StakeTimeLockedError'
				)
				.withArgs('This stake is still locked', anyValue, THREE_MONTHS)
		})

		it('it should correctly update the total staked amounts', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MIN_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const initialTimestamp = (await time.latest()) + 1
			const MONTH_60: number = AVG_SECONDS_PER_MONTH.times(60)
				.plus(initialTimestamp)
				.toNumber()
			await time.increaseTo(MONTH_60)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.eq(false)

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)

			const stakeID = `${stakes[0][0]}`

			await expect(
				stakingPoolInstance.connect(accounts[1]).unstake(stakeID)
			)
				.to.emit(stakingPoolInstance, 'UnstakeEvent')
				.withArgs(accounts[1].address, stakeID)

			const stakesAfterRemove =
				await stakingPoolInstance.getAllStakesForUser(
					accounts[1].address
				)
			expect(stakes.length).to.eq(2)
			expect(stakesAfterRemove.length).to.eq(1)
		})

		it('it should correctly transfer the staked amount + rewards to the <msg.sender>', async function () {
			const accounts = await ethers.getSigners()
			const {stakingPoolInstance, tokenInstance} =
				await loadFixture(deployStakingPool)

			await stakingPoolInstance.openStakePool(0)

			await tokenInstance
				.connect(accounts[1])
				.approve(stakingPoolInstance.getAddress(), MaxUint256)

			await expect(
				stakingPoolInstance
					.connect(accounts[1])
					.createStake(MAX_STAKE_AMOUNT, TIER_SILVER)
			).to.emit(stakingPoolInstance, 'StakeCreated')

			const initialTimestamp = (await time.latest()) + 1
			const MONTH_60: number = AVG_SECONDS_PER_MONTH.times(60)
				.plus(initialTimestamp)
				.toNumber()
			await time.increaseTo(MONTH_60)
			expect(await stakingPoolInstance.isStakePoolOpen()).to.eq(false)

			const stakes = await stakingPoolInstance.getAllStakesForUser(
				accounts[1].address
			)

			const balance = await tokenInstance.balanceOf(accounts[1].address)

			const stakeID = `${stakes[0][0]}`

			expect(
				await stakingPoolInstance.getTotalStakedAccount(
					accounts[1].address
				)
			).to.eq(MAX_STAKE_AMOUNT)

			expect(await stakingPoolInstance.getTotalStakedPool()).to.eq(
				MAX_STAKE_AMOUNT
			)

			await expect(
				stakingPoolInstance.connect(accounts[1]).unstake(stakeID)
			)
				.to.emit(stakingPoolInstance, 'UnstakeEvent')
				.withArgs(accounts[1].address, stakeID)
				.to.emit(tokenInstance, 'Transfer')
				.withArgs(
					stakingPoolInstance.getAddress(),
					accounts[1].address,
					'202500000000000000000000'
				)

			const balanceAfter = await tokenInstance.balanceOf(
				accounts[1].address
			)
			expect(balance).to.eq(0)
			expect(balanceAfter).to.eq('202500000000000000000000')
			expect(
				await stakingPoolInstance.getTotalStakedAccount(
					accounts[1].address
				)
			).to.eq(0)
			expect(await stakingPoolInstance.getTotalStakedPool()).to.eq(0)
		})
	})
})
