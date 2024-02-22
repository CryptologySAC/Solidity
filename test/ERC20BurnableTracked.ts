import {expect} from 'chai'
import {ethers} from 'hardhat'
import {ZeroAddress, keccak256, toUtf8Bytes} from 'ethers'

import {loadFixture} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {type ERC20BurnableTrackedTest} from '../typechain-types'

describe('ERC20BurnableTracked.sol', function () {
	const MAX_CAPPED_TOKENS = '20000000000000000000000000'
	const HALF_CAPPED_TOKENS = '10000000000000000000000000'
	const BURNER_ROLE = keccak256(toUtf8Bytes('BURNER_ROLE'))

	// Deploy a test contract that implements the abstract ERC20Blacklist so we can unit test it
	async function deployBurnableTracked(): Promise<ERC20BurnableTrackedTest> {
		const instance: ERC20BurnableTrackedTest = await ethers.deployContract(
			'ERC20BurnableTrackedTest'
		)
		return instance
	}

	// external and public functions
	describe('burn(uint256 value)', function () {
		it('it allows <msg.sender> to burn <value> tokens with a maximum of his balance.', async function () {
			const instance = await loadFixture(deployBurnableTracked)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.transfer(tokenReceiver.address, '100')
			await instance.grantRole(BURNER_ROLE, tokenReceiver)
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(
				100
			)
			await expect(
				instance
					.connect(tokenReceiver)
					.burnFrom(tokenReceiver.address, '1000')
			).to.be.revertedWithCustomError(
				instance,
				'ERC20InsufficientBalance'
			)
			await expect(
				instance
					.connect(tokenReceiver)
					.burnFrom(tokenReceiver.address, '100')
			)
				.to.emit(instance, 'Transfer')
				.withArgs(tokenReceiver.address, ZeroAddress, '100')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(0)
		})
	})

	describe('burnFrom(address account, uint256 value)', function () {
		it('it allows <account> to allow <msg.sender> to burn <value> tokens on his behalfe.', async function () {
			const instance = await loadFixture(deployBurnableTracked)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance.transfer(tokenReceiver.address, '100')
			await instance
				.connect(tokenReceiver)
				.approve(defaultAdmin.address, '50')
			await expect(
				instance
					.connect(defaultAdmin)
					.burnFrom(tokenReceiver.address, '50')
			)
				.to.emit(instance, 'Transfer')
				.withArgs(tokenReceiver.address, ZeroAddress, '50')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(50)
		})
	})

	describe('cap()', function () {
		it('a token burn correctly updates the token cap to the previouse cap() - burned().', async function () {
			const instance = await loadFixture(deployBurnableTracked)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance.grantRole(BURNER_ROLE, tokenReceiver)
			await instance
				.connect(defaultAdmin)
				.transfer(tokenReceiver.address, MAX_CAPPED_TOKENS)
			expect(await instance.cap()).to.equal(MAX_CAPPED_TOKENS)
			await instance
				.connect(tokenReceiver)
				.burnFrom(tokenReceiver.address, HALF_CAPPED_TOKENS)
			expect(await instance.cap()).to.equal(HALF_CAPPED_TOKENS)
		})
	})

	describe('burned()', function () {
		it('it correctly shows the total amount of tokens burned.', async function () {
			const instance = await loadFixture(deployBurnableTracked)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.transfer(tokenReceiver.address, MAX_CAPPED_TOKENS)
			await instance.grantRole(BURNER_ROLE, tokenReceiver)
			expect(await instance.burned()).to.equal(0)
			await instance
				.connect(tokenReceiver)
				.burnFrom(tokenReceiver.address, HALF_CAPPED_TOKENS)
			expect(await instance.burned()).to.equal(HALF_CAPPED_TOKENS)
		})
	})
})
