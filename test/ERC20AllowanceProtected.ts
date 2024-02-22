import {expect} from 'chai'
import {ethers, config} from 'hardhat'
import {ZeroAddress, MaxUint256} from 'ethers'
import {loadFixture} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {type ERC20AllowanceProtectedTest} from '../typechain-types'
import {type HardhatNetworkHDAccountsUserConfig} from 'hardhat/types'
import {signERC2612Permit} from 'eth-permit'

async function deployAllowanceProtected(): Promise<ERC20AllowanceProtectedTest> {
	const instance: ERC20AllowanceProtectedTest = await ethers.deployContract(
		'ERC20AllowanceProtectedTest'
	)
	return instance
}

describe('ERC20AllowanceProtected.sol - Enforce an account to first reset a given allowance to 0 before setting a new allowance.', function () {
	describe('approve() - use ERC20 approve(address owner, address spender, uint256 value)', function () {
		describe('Allow an owner account to set an allowance to a spender account if that current allowance is 0.', function () {
			it('The allowance from <owner> to <spender> is 0 at the start, has the set value at the end and an <Approval> event was emitted', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = '1234567890'
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
				await expect(
					instance.connect(owner).approve(spender.address, allowance)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
			})
		})

		describe('Allow an owner account to remove an allowance to a spender account be setting it to 0.', function () {
			it('The allowance from <owner> to <spender> is <allowance> at the start, has set <0> at the end and an <Approval> event was emitted', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = '1234567890'
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await expect(
					instance.connect(owner).approve(spender.address, 0)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, 0)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
			})
		})

		describe('Allow an owner account to remove an allowance to a spender account be setting it to 0, when it is already 0.', function () {
			it('The allowance from <owner> to <spender> is <0> at the start, has set <0> at the end and an <Approval> event was emitted', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
				await expect(
					instance.connect(owner).approve(spender.address, 0)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, 0)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
			})
		})

		describe('Dissalow an owner account to set an allowance to a spender account if the current allowance is not 0.', function () {
			it('The allowance from <owner> to <spender> is <allowance> at the start, has set <allowance> at the end and an <AllowanceFirstResetToZeroError> revert was executed', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = '1234567890'
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await expect(
					instance.connect(owner).approve(spender.address, 1)
				)
					.to.revertedWithCustomError(
						instance,
						'AllowanceFirstResetToZeroError'
					)
					.withArgs('Reset the allowance to 0 before updating it.')
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
			})
		})

		describe('Allow an owner account to set an <unlimited> allowance to a spender account by setting it to MAX UINT256. Emit an event when doing so.', function () {
			it('The allowance from <owner> to <spender> is 0 at the start, has <MaxUint256>> at the end and <Approval> and <WarningUnlimitedAllowance> events were emitted', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = MaxUint256
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
				await expect(
					instance.connect(owner).approve(spender.address, allowance)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, allowance)
					.to.emit(instance, 'UnlimitedAllowanceWarning')
					.withArgs(owner.address, spender.address)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
			})
		})

		describe('Allow an owner account to set an allowance to a spender account that exceeds his balance.', function () {
			it('The allowance from <owner> to <spender> is 0 at the start, has the set value at the end and an <Approval> event was emitted; the balance of the owner account is <Balance>, where <Balance> < <Allowance>', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [admin, owner, spender] = await ethers.getSigners()
				const allowance = '1234567890'
				const Balance = '1000'
				await instance.connect(admin).transfer(owner, Balance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
				await expect(
					instance.connect(owner).approve(spender.address, allowance)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				expect(await instance.balanceOf(owner.address)).to.equal(
					Balance
				)
			})
		})

		describe('An owner account can not set an allowance to himself.', function () {
			it('The allowance from <owner> to <owner> is 0 at the start, has the set value at the end and an <AllowanceToError> revert was executed', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner] = await ethers.getSigners()
				const allowance = '1234567890'
				expect(
					await instance.allowance(owner.address, owner.address)
				).to.be.equal(0)
				await expect(
					instance.connect(owner).approve(owner.address, allowance)
				)
					.to.revertedWithCustomError(instance, 'AllowanceToError')
					.withArgs(
						'There is no reason to grant yourself an allowance'
					)
				expect(
					await instance.allowance(owner.address, owner.address)
				).to.be.equal(0)
			})
		})

		describe('An owner account can not set an allowance to the Zero address.', function () {
			it('The allowance from <owner> to <Zero address> is 0 at the start, has the set value at the end and an <AllowanceToError> revert was executed', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner] = await ethers.getSigners()
				const allowance = '1234567890'
				expect(
					await instance.allowance(owner.address, ZeroAddress)
				).to.be.equal(0)
				await expect(
					instance.connect(owner).approve(ZeroAddress, allowance)
				)
					.to.revertedWithCustomError(instance, 'AllowanceToError')
					.withArgs(
						'There is no reason to grant the Zero address an allowance'
					)
				expect(
					await instance.allowance(owner.address, owner.address)
				).to.be.equal(0)
			})
		})
	})

	describe('permit() - use EIP-2612 permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s )', function () {
		const deadline = 4200 + Math.floor(Date.now() / 1000)
		const accounts: HardhatNetworkHDAccountsUserConfig = config.networks
			.hardhat.accounts as HardhatNetworkHDAccountsUserConfig
		const index = 0 // first wallet, increment for next wallets
		const mnemonic = ethers.Mnemonic.fromPhrase(`${accounts.mnemonic}`)
		const ownerWallet = ethers.HDNodeWallet.fromMnemonic(
			mnemonic,
			`${accounts.path}/${index}`
		)
		const privateKey1 = ownerWallet.privateKey
		const mainnetWallet = new ethers.Wallet(privateKey1, ethers.provider)
		const allowance = '1234567890'

		describe('Permit an owner account to use an EIP-2612 Signature to set an allowance to a spender account gas-free if that current allowance is 0.', function () {
			it('The allowance from <owner> to <spender> is 0 at the start, has the set value at the end and an <Approval> event was emitted', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const contractAddress = await instance.getAddress()
				const [owner, spender] = await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)

				// sign the Permit type data with the deployer's private key
				const signedMessage = await signERC2612Permit(
					mainnetWallet,
					contractAddress,
					owner.address,
					spender.address,
					allowance,
					deadline,
					Number(nonces)
				)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
				await expect(
					instance
						.connect(spender)
						.permit(
							owner.address,
							spender.address,
							allowance,
							deadline,
							signedMessage.v,
							signedMessage.r,
							signedMessage.s
						)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
			})
		})

		describe('Allow an owner account to use an EIP-2612 Signature to remove an allowance to a spender account gas-free be setting it to 0.', function () {
			it('The allowance from <owner> to <spender> is 0 at the start, has the set value at the end and an <Approval> event was emitted', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const contractAddress = await instance.getAddress()
				const [owner, spender] = await ethers.getSigners()
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				const nonces = await instance.nonces(owner.address)

				// sign the Permit type data with the deployer's private key
				const signedMessage = await signERC2612Permit(
					mainnetWallet,
					contractAddress,
					owner.address,
					spender.address,
					0,
					deadline,
					Number(nonces)
				)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await expect(
					instance
						.connect(spender)
						.permit(
							owner.address,
							spender.address,
							0,
							deadline,
							signedMessage.v,
							signedMessage.r,
							signedMessage.s
						)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, 0)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
			})
		})

		describe('Dissalow an owner account to use an EIP-2612 Signature to set an allowance to a spender account gas-free if the current allowance is not 0.', function () {
			it('The allowance from <owner> to <spender> is <allowance> at the start, has set <allowance> at the end and an <AllowanceFirstResetToZeroError> revert was executed', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const contractAddress = await instance.getAddress()
				const [owner, spender] = await ethers.getSigners()
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				const nonces = await instance.nonces(owner.address)

				// sign the Permit type data with the deployer's private key
				const signedMessage = await signERC2612Permit(
					mainnetWallet,
					contractAddress,
					owner.address,
					spender.address,
					1,
					deadline,
					Number(nonces)
				)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await expect(
					instance
						.connect(spender)
						.permit(
							owner.address,
							spender.address,
							1,
							deadline,
							signedMessage.v,
							signedMessage.r,
							signedMessage.s
						)
				)
					.to.revertedWithCustomError(
						instance,
						'AllowanceFirstResetToZeroError'
					)
					.withArgs('Reset the allowance to 0 before updating it.')
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
			})
		})

		describe('Allow an owner account to use an EIP-2612 Signature to set an <unlimited> allowance to a spender account gas-free by setting it to MAX UINT256. Emit an event when doing so.', function () {
			it('The allowance from <owner> to <spender> is 0 at the start, has <MaxUint256>> at the end and <Approval> and <WarningUnlimitedAllowance> events were emitted', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const contractAddress = await instance.getAddress()
				const [owner, spender] = await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)

				// sign the Permit type data with the deployer's private key
				const signedMessage = await signERC2612Permit(
					mainnetWallet,
					contractAddress,
					owner.address,
					spender.address,
					`${MaxUint256}`,
					deadline,
					Number(nonces)
				)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
				await expect(
					instance
						.connect(spender)
						.permit(
							owner.address,
							spender.address,
							`${MaxUint256}`,
							deadline,
							signedMessage.v,
							signedMessage.r,
							signedMessage.s
						)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, MaxUint256)
					.to.emit(instance, 'UnlimitedAllowanceWarning')
					.withArgs(owner.address, spender.address)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(MaxUint256)
			})
		})

		describe('Allow an owner account to use an EIP-2612 Signature to set an allowance to a spender account gas-free that exceeds his balance.', function () {
			it('The allowance from <owner> to <spender> is 0 at the start, has the set value at the end and an <Approval> event was emitted; where balance of the owner account < allowance', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const contractAddress = await instance.getAddress()
				const [owner, spender] = await ethers.getSigners()
				const balance = await instance.balanceOf(owner)
				await instance.transfer(spender.address, balance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
				const nonces = await instance.nonces(owner.address)

				// sign the Permit type data with the deployer's private key
				const signedMessage = await signERC2612Permit(
					mainnetWallet,
					contractAddress,
					owner.address,
					spender.address,
					allowance,
					deadline,
					Number(nonces)
				)
				await expect(
					instance
						.connect(spender)
						.permit(
							owner.address,
							spender.address,
							allowance,
							deadline,
							signedMessage.v,
							signedMessage.r,
							signedMessage.s
						)
				)
					.to.emit(instance, 'Approval')
					.withArgs(owner.address, spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				expect(await instance.balanceOf(owner.address)).to.be.equal(0)
			})
		})

		describe('An owner account can not use an EIP-2612 Signature to set an allowance to himself.', function () {
			it('The allowance from <owner> to <owner> is 0 at the start, has the set value at the end and an <AllowanceToError> revert was executed', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const contractAddress = await instance.getAddress()
				const [owner, spender] = await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)

				// sign the Permit type data with the deployer's private key
				const signedMessage = await signERC2612Permit(
					mainnetWallet,
					contractAddress,
					owner.address,
					owner.address,
					allowance,
					deadline,
					Number(nonces)
				)
				expect(
					await instance.allowance(owner.address, owner.address)
				).to.be.equal(0)
				await expect(
					instance
						.connect(spender)
						.permit(
							owner.address,
							owner.address,
							allowance,
							deadline,
							signedMessage.v,
							signedMessage.r,
							signedMessage.s
						)
				)
					.to.revertedWithCustomError(instance, 'AllowanceToError')
					.withArgs(
						'There is no reason to grant yourself an allowance'
					)
				expect(
					await instance.allowance(owner.address, owner.address)
				).to.be.equal(0)
			})
		})

		describe('An owner account can not use an EIP-2612 Signature to set an allowance to the Zero address.', function () {
			it('The allowance from <owner> to the Zero address is 0 at the start, has the set value at the end and an <AllowanceToError> revert was executed', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const contractAddress = await instance.getAddress()
				const [owner, spender] = await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)

				// sign the Permit type data with the deployer's private key
				const signedMessage = await signERC2612Permit(
					mainnetWallet,
					contractAddress,
					owner.address,
					ZeroAddress,
					allowance,
					deadline,
					Number(nonces)
				)
				expect(
					await instance.allowance(owner.address, ZeroAddress)
				).to.be.equal(0)
				await expect(
					instance
						.connect(spender)
						.permit(
							owner.address,
							ZeroAddress,
							allowance,
							deadline,
							signedMessage.v,
							signedMessage.r,
							signedMessage.s
						)
				)
					.to.revertedWithCustomError(instance, 'AllowanceToError')
					.withArgs(
						'There is no reason to grant the Zero address an allowance'
					)
				expect(
					await instance.allowance(owner.address, ZeroAddress)
				).to.be.equal(0)
			})
		})
	})

	describe('General functionality', function () {
		describe('An allowance from an owner account to a spender account should be updated correctly when the spender account uses (part of) the allowance', function () {
			it('The allowance from <owner> to <spender> is <allowance> at the start, and is <allowance - transfer value> at the end', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = '1234567890'
				const transferValue = '1234567889'
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await instance
					.connect(spender)
					.transferFrom(owner.address, spender.address, transferValue)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(1)
			})
		})

		describe('An unlimited allowance from an owner account to a spender account should be updated correctly when it is reset to 0', function () {
			it('The allowance from <owner> to <spender> is <MaxUint256> at the start, and is <0> at the end', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = MaxUint256
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await instance.approve(spender.address, 0)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
			})
		})

		describe('An allowance from an owner account to a spender account should be updated correctly when the spender account uses (part of) the allowance to transfer from the owner to the owner', function () {
			it('The allowance from <owner> to <spender> is <allowance> at the start, and is <allowance - transfer value> at the end', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = '1234567890'
				const transferValue = '1234567889'
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await instance
					.connect(spender)
					.transferFrom(owner.address, owner.address, transferValue)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(1)
			})
		})

		describe('An unlimited allowance from an owner account to a spender account should remain unlimited when the spender account uses (part of) the allowance', function () {
			it('The allowance from <owner> to <spender> is <allowance> at the start, and is <allowance - transfer value> at the end', async function () {
				const instance: ERC20AllowanceProtectedTest = await loadFixture(
					deployAllowanceProtected
				)
				const [owner, spender] = await ethers.getSigners()
				const allowance = MaxUint256
				const transferValue = '1234567889'
				await instance
					.connect(owner)
					.approve(spender.address, allowance)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
				await instance
					.connect(spender)
					.transferFrom(owner.address, spender.address, transferValue)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(allowance)
			})
		})
	})
})
