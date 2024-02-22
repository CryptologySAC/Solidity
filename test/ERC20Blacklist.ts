import {expect} from 'chai'
import {ethers, config} from 'hardhat'
import {MaxInt256, ZeroAddress, keccak256, toUtf8Bytes} from 'ethers'
import {loadFixture} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {type ERC20BlacklistTest} from '../typechain-types'
import {type HardhatNetworkHDAccountsUserConfig} from 'hardhat/types'
import {signERC2612Permit} from 'eth-permit'

async function deployBlacklistTest(): Promise<ERC20BlacklistTest> {
	const instance: ERC20BlacklistTest =
		await ethers.deployContract('ERC20BlacklistTest')
	return instance
}

const BLACKLIST_ROLE = keccak256(toUtf8Bytes('BLACKLIST_ROLE'))
const PERMISSIONS = /^Permissions:/

describe('ERC20Blacklist.sol - EManage a blacklist on an ERC20 token to prevent bad actor addresses from being able to use the token.', function () {
	describe('blacklist() - Add <account> to the blacklist.)', function () {
		describe('blacklist an account that is not blacklisted', function () {
			it('it correctly adds <account> to the blacklist and emits an event', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				expect(
					await instance.isBlacklisted(userAccount.address)
				).to.equal(false)
				await expect(instance.blacklist(userAccount.address))
					.to.emit(instance, 'Blacklisted')
					.withArgs(userAccount.address, true, admin.address)
				expect(
					await instance.isBlacklisted(userAccount.address)
				).to.equal(true)
			})
		})

		describe('blacklist an account that is blacklisted', function () {
			it('it will revert if <account> already is blacklisted', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await expect(instance.blacklist(userAccount.address))
					.to.emit(instance, 'Blacklisted')
					.withArgs(userAccount.address, true, admin.address)
				expect(
					await instance.isBlacklisted(userAccount.address)
				).to.equal(true)
				await expect(instance.blacklist(userAccount.address))
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						userAccount.address,
						'This address is already blacklisted.'
					)
			})
		})

		describe('blacklist the Zero address', function () {
			it('it will revert on trying to blacklist the Zero account', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				await expect(instance.blacklist(ZeroAddress))
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						ZeroAddress,
						'This address can not be blacklisted.'
					)
			})
		})

		describe('blacklist the contract address', function () {
			it('it will revert on trying to blacklist the Zero account', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const contractAddress = await instance.getAddress()
				await expect(instance.blacklist(contractAddress))
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						contractAddress,
						'This address can not be blacklisted.'
					)
			})
		})

		describe('blacklist the <msg.sender>', function () {
			it('it will revert on trying to blacklist <msg.sender>', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await instance
					.connect(admin)
					.grantRole(BLACKLIST_ROLE, userAccount.address)
				expect(
					await instance.hasRole(BLACKLIST_ROLE, userAccount.address)
				).to.equal(true)
				await expect(
					instance.connect(userAccount).blacklist(userAccount.address)
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						userAccount.address,
						'This address can not be blacklisted.'
					)
			})
		})

		describe('blacklist a DEFAULT_ADMIN_ROLE', function () {
			it('it will revert on trying to blacklist DEFAULT_ADMIN_ROLE', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await instance.grantRole(BLACKLIST_ROLE, userAccount.address)
				expect(
					await instance.hasRole(BLACKLIST_ROLE, userAccount.address)
				).to.equal(true)
				await expect(
					instance.connect(userAccount).blacklist(admin.address)
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						admin.address,
						'This address can not be blacklisted.'
					)
			})
		})

		describe('blacklist by a <msg.sender> without BLACKLIST_ROLE', function () {
			it('it will revert on trying to blacklist without BLACKLIST_ROLE', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				expect(
					await instance.hasRole(BLACKLIST_ROLE, userAccount.address)
				).to.equal(false)
				await expect(
					instance.connect(userAccount).blacklist(admin.address)
				).to.be.revertedWith(PERMISSIONS)
			})
		})
	})

	describe('unblacklist() - Remove <account> from the blacklist.)', function () {
		describe('unblacklist an account that is blacklisted', function () {
			describe('unblacklist an account that is blacklisted', function () {
				it('it correctly removes <account> from the blacklist and emits an event', async function () {
					const instance: ERC20BlacklistTest =
						await loadFixture(deployBlacklistTest)
					const [admin, userAccount] = await ethers.getSigners()
					await expect(instance.blacklist(userAccount.address))
						.to.emit(instance, 'Blacklisted')
						.withArgs(userAccount.address, true, admin.address)
					expect(
						await instance.isBlacklisted(userAccount.address)
					).to.equal(true)
					await expect(instance.unblacklist(userAccount.address))
						.to.emit(instance, 'Blacklisted')
						.withArgs(userAccount.address, false, admin.address)
					expect(
						await instance.isBlacklisted(userAccount.address)
					).to.equal(false)
				})
			})

			describe('unblacklist an account that is not blacklisted', function () {
				it('it will revert if <account> is not blacklisted', async function () {
					const instance: ERC20BlacklistTest =
						await loadFixture(deployBlacklistTest)
					const [admin, userAccount] = await ethers.getSigners()
					expect(
						await instance
							.connect(admin)
							.isBlacklisted(userAccount.address)
					).to.equal(false)
					await expect(instance.unblacklist(userAccount.address))
						.to.be.revertedWithCustomError(
							instance,
							'BlacklistedError'
						)
						.withArgs(
							userAccount.address,
							'This address is not blacklisted.'
						)
					expect(
						await instance.isBlacklisted(userAccount.address)
					).to.equal(false)
				})
			})

			describe('unblacklist an the contract address (which can not be blacklisted)', function () {
				it('it will revert if <account> is not blacklisted', async function () {
					const instance: ERC20BlacklistTest =
						await loadFixture(deployBlacklistTest)
					const contractAddress = await instance.getAddress()
					expect(
						await instance.isBlacklisted(contractAddress)
					).to.equal(false)
					await expect(instance.unblacklist(contractAddress))
						.to.be.revertedWithCustomError(
							instance,
							'BlacklistedError'
						)
						.withArgs(
							contractAddress,
							'This address is not blacklisted.'
						)
				})
			})
		})

		describe('unblacklist by a <msg.sender>  without BLACKLIST_ROLE', function () {
			it('it will revert on trying to unblacklist without BLACKLIST_ROLE', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount, badUser] = await ethers.getSigners()
				await expect(instance.blacklist(badUser.address))
					.to.emit(instance, 'Blacklisted')
					.withArgs(badUser.address, true, admin.address)
				expect(await instance.isBlacklisted(badUser.address)).to.equal(
					true
				)
				expect(
					await instance.hasRole(BLACKLIST_ROLE, userAccount.address)
				).to.equal(false)
				await expect(
					instance.connect(userAccount).unblacklist(badUser.address)
				).to.be.revertedWith(PERMISSIONS)
			})
		})
	})

	describe('isBlacklisted() - Check if <account> is blacklisted.)', function () {
		describe('check blacklist for an account that is not blacklisted', function () {
			it('it will return false', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				expect(
					await instance
						.connect(admin)
						.isBlacklisted(userAccount.address)
				).to.equal(false)
			})
		})

		describe('check blacklist for an account that is blacklisted', function () {
			it('it will return true', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await expect(instance.blacklist(userAccount.address))
					.to.emit(instance, 'Blacklisted')
					.withArgs(userAccount.address, true, admin.address)
				expect(
					await instance.isBlacklisted(userAccount.address)
				).to.equal(true)
			})
		})

		describe('check blacklist for the Zero account', function () {
			it('it will return false', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				expect(await instance.isBlacklisted(ZeroAddress)).to.equal(
					false
				)
			})
		})

		describe('check blacklist for the contract address', function () {
			it('it will return false', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const contractAddress = await instance.getAddress()
				expect(await instance.isBlacklisted(contractAddress)).to.equal(
					false
				)
			})
		})
	})

	describe('Allowances)', function () {
		describe('approve() from a blacklisted <msg.sender>', function () {
			it('it will revert if <msg.sender> is blacklisted', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await instance.blacklist(userAccount.address)
				await expect(
					instance.connect(userAccount).approve(admin.address, '100')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						userAccount.address,
						'Your address has been blacklisted and is currently not allowed to interact with this token.'
					)
			})
		})

		describe('approve() to a blacklisted <spender>', function () {
			it('', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await instance.blacklist(userAccount.address)
				await expect(
					instance.connect(admin).approve(userAccount.address, '100')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						userAccount.address,
						'The allowance for this spender can only be reset to 0.'
					)
			})
		})

		describe('reset via approve() a blacklisted <spender>', function () {
			it('it will reset the allowance and emit an event', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await instance.blacklist(userAccount.address)
				await expect(
					instance.connect(admin).approve(userAccount.address, '0')
				)
					.to.be.emit(instance, 'Approval')
					.withArgs(admin.address, userAccount.address, 0)
			})
		})

		const deadline = 4200 + Math.floor(Date.now() / 1000)
		const accounts: HardhatNetworkHDAccountsUserConfig = config.networks
			.hardhat.accounts as HardhatNetworkHDAccountsUserConfig
		const index = 1
		const mnemonic = ethers.Mnemonic.fromPhrase(`${accounts.mnemonic}`)
		const ownerWallet = ethers.HDNodeWallet.fromMnemonic(
			mnemonic,
			`${accounts.path}/${index}`
		)
		const privateKey1 = ownerWallet.privateKey
		const mainnetWallet = new ethers.Wallet(privateKey1, ethers.provider)
		const allowance = '1234567890'

		describe('permit() by a blacklisted <msg.sender>', function () {
			it('it will revert', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const contractAddress = await instance.getAddress()
				const [admin, owner, spender, badUser] =
					await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)
				await instance.connect(admin).blacklist(badUser.address)

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
						.connect(badUser)
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
					.to.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						badUser.address,
						'Your address has been blacklisted and is currently not allowed to interact with this token.'
					)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
			})
		})

		describe('permit() from a blacklisted <owner>', function () {
			it('it will revert', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const contractAddress = await instance.getAddress()
				const [admin, owner, spender, msgSender] =
					await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)
				await instance.connect(admin).blacklist(owner.address)

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
						.connect(msgSender)
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
					.to.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						owner.address,
						'This address has been blacklisted and is currently not allowed to transfer this token.'
					)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
			})
		})

		describe('permit() to a blacklisted <spender>', function () {
			it('it will revert', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const contractAddress = await instance.getAddress()
				const [admin, owner, spender, msgSender] =
					await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)
				await instance.connect(admin).blacklist(spender.address)

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
						.connect(msgSender)
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
					.to.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						spender.address,
						'The allowance for this spender can only be reset to 0.'
					)
				expect(
					await instance.allowance(owner.address, spender.address)
				).to.be.equal(0)
			})
		})

		describe('reset via permit() a blacklisted <spender>', function () {
			it('it will correctly reset the allowance to 0 and emit an event', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const contractAddress = await instance.getAddress()
				const [admin, owner, spender, msgSender] =
					await ethers.getSigners()
				const nonces = await instance.nonces(owner.address)
				await instance.connect(admin).blacklist(spender.address)

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
				).to.be.equal(0)
				await expect(
					instance
						.connect(msgSender)
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
	})

	describe('Transfer())', function () {
		describe('Transfer from a blacklisted <msg.sender>', function () {
			it('it will revert a transfer from a blacklisted <msg.sender>', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await instance.transfer(userAccount.address, '200')
				await instance.blacklist(userAccount.address)
				await expect(
					instance.connect(userAccount).transfer(admin.address, '50')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						userAccount.address,
						'This address has been blacklisted and is currently not allowed to transfer this token.'
					)
			})
		})

		describe('Transfer to a blacklisted <receiver>', function () {
			it('it will revert a transfer to a blacklisted <receiver>', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, userAccount] = await ethers.getSigners()
				await instance.blacklist(userAccount.address)
				await expect(
					instance.connect(admin).transfer(userAccount.address, '50')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						userAccount.address,
						'This address has been blacklisted and is currently not allowed to receive this token.'
					)
			})
		})
	})

	describe('TransferFrom())', function () {
		describe('TransferFrom by a blacklisted <msg.sender>', function () {
			it('it will revert a transfer from a blacklisted <msg.sender>', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, owner, spender] = await ethers.getSigners()
				await instance.transfer(owner.address, '200')
				await instance.connect(owner).approve(spender, 50)
				await instance.blacklist(spender.address)
				await expect(
					instance
						.connect(spender)
						.transferFrom(owner.address, admin.address, '50')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						spender.address,
						'Your address has been blacklisted and is currently not allowed to interact with this token.'
					)
			})
		})

		describe('TransferFrom from a blacklisted <owner>', function () {
			it('it will revert a transfer from a blacklisted <owner>', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, owner, spender] = await ethers.getSigners()
				await instance.transfer(owner.address, '200')
				await instance.connect(owner).approve(spender, 50)
				await instance.blacklist(owner.address)
				await expect(
					instance
						.connect(spender)
						.transferFrom(owner.address, admin.address, '50')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						owner.address,
						'This address has been blacklisted and is currently not allowed to transfer this token.'
					)
			})

			it('it will revert a transfer from a blacklisted <owner> who has approved an unlimited allowance', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, owner, spender] = await ethers.getSigners()
				await instance.transfer(owner.address, '200')
				await instance.connect(owner).approve(spender, MaxInt256)
				await instance.blacklist(owner.address)
				await expect(
					instance
						.connect(spender)
						.transferFrom(owner.address, admin.address, '50')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						owner.address,
						'This address has been blacklisted and is currently not allowed to transfer this token.'
					)
			})
		})

		describe('TransferFrom to a blacklisted <receiver>', function () {
			it('it will revert a transfer to a blacklisted <receiver>', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, owner, spender, receiver] =
					await ethers.getSigners()
				await instance.connect(admin).transfer(owner.address, '200')
				await instance.connect(owner).approve(spender, 50)
				await instance.blacklist(receiver.address)
				await expect(
					instance
						.connect(spender)
						.transferFrom(owner.address, receiver.address, '50')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						receiver.address,
						'This address has been blacklisted and is currently not allowed to receive this token.'
					)
			})
		})

		describe('TransferFrom to a blacklisted <receiver>', function () {
			it('it will revert a transfer to a blacklisted <receiver> while <spender> has an unlimited allowance', async function () {
				const instance: ERC20BlacklistTest =
					await loadFixture(deployBlacklistTest)
				const [admin, owner, spender, receiver] =
					await ethers.getSigners()
				await instance.connect(admin).transfer(owner.address, '200')
				await instance.connect(owner).approve(spender, MaxInt256)
				await instance.blacklist(receiver.address)
				await expect(
					instance
						.connect(spender)
						.transferFrom(owner.address, receiver.address, '50')
				)
					.to.be.revertedWithCustomError(instance, 'BlacklistedError')
					.withArgs(
						receiver.address,
						'This address has been blacklisted and is currently not allowed to receive this token.'
					)
			})
		})
	})

	describe('ERC20 Standard Compliance', function () {
		it('transfers tokens correctly and emits a Transfer event', async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [sender, recipient] = await ethers.getSigners()
			const amount = '10000'

			await expect(
				instance.connect(sender).transfer(recipient.address, amount)
			)
				.to.emit(instance, 'Transfer')
				.withArgs(sender.address, recipient.address, amount)

			expect(await instance.balanceOf(recipient.address)).to.equal(amount)
		})

		it('approves tokens for delegated transfer and emits an Approval event', async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [owner, spender] = await ethers.getSigners()
			const amount = '10000'

			await expect(
				instance.connect(owner).approve(spender.address, amount)
			)
				.to.emit(instance, 'Approval')
				.withArgs(owner.address, spender.address, amount)

			expect(
				await instance.allowance(owner.address, spender.address)
			).to.equal(amount)
		})

		it('handles delegated token transfers via transferFrom', async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [owner, spender, recipient] = await ethers.getSigners()
			const amount = 100000000

			// Owner approves spender
			await instance.connect(owner).approve(spender.address, amount)
			expect(
				await instance.allowance(owner.address, spender.address)
			).to.equal(amount)

			// Spender transfers from Owner to Recipient
			await expect(
				instance
					.connect(spender)
					.transferFrom(owner.address, recipient.address, amount)
			)
				.to.emit(instance, 'Transfer')
				.withArgs(owner.address, recipient.address, amount)

			expect(await instance.balanceOf(recipient.address)).to.equal(amount)
		})

		it("reverts transfers that exceed the sender's balance", async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [sender, recipient] = await ethers.getSigners()
			const balance = await instance.balanceOf(sender.address)
			const amount = balance + BigInt(1) // One more than the balance
			await expect(
				instance.connect(sender).transfer(recipient.address, amount)
			).to.be.revertedWithCustomError(
				instance,
				'ERC20InsufficientBalance'
			)
		})
	})

	describe('Role Management:', function () {
		it('prevents blacklisting by an account after `BLACKLIST_ROLE` is revoked', async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [admin, user] = await ethers.getSigners()

			// Grant `BLACKLIST_ROLE` and then revoke it
			await instance.grantRole(BLACKLIST_ROLE, user.address)
			await instance.revokeRole(BLACKLIST_ROLE, user.address)

			// Attempt to blacklist another account should fail
			await expect(
				instance.connect(user).blacklist(admin.address)
			).to.be.revertedWith(
				'Permissions: account ' +
					user.address.toLowerCase() +
					' is missing role ' +
					BLACKLIST_ROLE
			)
		})

		it('allows only `BLACKLIST_ROLE` holders to unblacklist accounts', async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [admin, user, other] = await ethers.getSigners()

			// Admin (default `BLACKLIST_ROLE` holder) blacklists a user
			await instance.connect(admin).blacklist(user.address)
			expect(await instance.isBlacklisted(user.address)).to.equal(true)

			// Attempt to unblacklist by an unauthorized account should fail
			await expect(
				instance.connect(other).unblacklist(user.address)
			).to.be.revertedWith(
				'Permissions: account ' +
					other.address.toLowerCase() +
					' is missing role ' +
					BLACKLIST_ROLE
			)

			// Unblacklist by an authorized account should succeed
			await instance.unblacklist(user.address)
			expect(await instance.isBlacklisted(user.address)).to.equal(false)
		})

		it('ensures adding new roles does not grant blacklist capabilities', async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [admin, user] = await ethers.getSigners()
			const NEW_ROLE = keccak256(toUtf8Bytes('NEW_ROLE'))

			// Create a new role and grant it to a user
			await instance.grantRole(NEW_ROLE, user.address)

			// Ensure the user with the new role cannot blacklist others
			await expect(
				instance.connect(user).blacklist(admin.address)
			).to.be.revertedWith(
				'Permissions: account ' +
					user.address.toLowerCase() +
					' is missing role ' +
					BLACKLIST_ROLE
			)
		})
	})

	describe('Edge Case Handling:', function () {
		it('handles sequential blacklisting and unblacklisting correctly', async function () {
			const instance = await loadFixture(deployBlacklistTest)
			const [admin, user] = await ethers.getSigners()

			// Blacklist user
			await instance.connect(admin).blacklist(user.address)
			expect(await instance.isBlacklisted(user.address)).to.equal(true)

			// Unblacklist user
			await instance.unblacklist(user.address)
			expect(await instance.isBlacklisted(user.address)).to.equal(false)

			// Blacklist user again
			await instance.blacklist(user.address)
			expect(await instance.isBlacklisted(user.address)).to.equal(true)
		})
	})
})
