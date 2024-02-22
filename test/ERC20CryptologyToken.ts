import {expect} from 'chai'
import {ethers, config} from 'hardhat'
import {loadFixture} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {keccak256, toUtf8Bytes, ZeroAddress} from 'ethers'
import {signERC2612Permit} from 'eth-permit'
import {type ERC20CryptologyToken} from '../typechain-types'
import {type HardhatNetworkHDAccountsUserConfig} from 'hardhat/types'

describe('ERC20Cryptology.sol', function () {
	const PROJECT_NAME = 'ERC20Cryptology'
	const PROJECT_SYMBOL = 'CRYPTOLOGY'
	const PROJECT_DECIMALS = 18
	const DEFAULT_ADMIN_ROLE =
		'0x0000000000000000000000000000000000000000000000000000000000000000'
	const MINTER_ROLE = keccak256(toUtf8Bytes('MINTER_ROLE'))
	const PAUSER_ROLE = keccak256(toUtf8Bytes('PAUSER_ROLE'))
	const BLACKLIST_ROLE = keccak256(toUtf8Bytes('BLACKLIST_ROLE'))
	const TEST_ROLE = keccak256(toUtf8Bytes('TEST_ROLE'))
	const MAX_CAPPED_TOKENS = '20000000000000000000000000'
	const HALF_CAPPED_TOKENS = '10000000000000000000000000'
	const PERMISSIONS = /^Permissions:/

	async function deployDeFiFundToken(): Promise<ERC20CryptologyToken> {
		const instance: ERC20CryptologyToken = await ethers.deployContract(
			'ERC20CryptologyTokenTest',
			[PROJECT_NAME, PROJECT_SYMBOL, MAX_CAPPED_TOKENS]
		)
		return instance
	}

	describe('The contract is deployed and has been initialized correctly.', function () {
		it('Token name, symbol and decimals are as expected', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			expect(await instance.name()).to.equal(PROJECT_NAME)
			expect(await instance.symbol()).to.equal(PROJECT_SYMBOL)
			expect(await instance.decimals()).to.be.eq(PROJECT_DECIMALS)
		})

		it('Token cap equals MAX_CAPPED_TOKENS and the total minted/burned supplies are both 0. ', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			expect(await instance.cap()).to.be.eq(MAX_CAPPED_TOKENS)
			expect(await instance.totalSupply()).to.be.eq(0)
			expect(await instance.burned()).to.be.eq(0)
		})

		it('<msg.sender> has been granted DEFAULT_ADMIN_ROLE and that role can grant/revoke the other roles.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin] = await ethers.getSigners()
			expect(await instance.getRoleAdmin(DEFAULT_ADMIN_ROLE)).to.equal(
				DEFAULT_ADMIN_ROLE
			)
			expect(await instance.getRoleAdmin(MINTER_ROLE)).to.equal(
				DEFAULT_ADMIN_ROLE
			)
			expect(await instance.getRoleAdmin(PAUSER_ROLE)).to.equal(
				DEFAULT_ADMIN_ROLE
			)
			expect(await instance.getRoleAdmin(BLACKLIST_ROLE)).to.equal(
				DEFAULT_ADMIN_ROLE
			)
			expect(
				await instance.hasRole(DEFAULT_ADMIN_ROLE, defaultAdmin.address)
			).to.equal(true)
		})
	})

	// external and public functions
	describe('pause()', function () {
		it('<msg.sender> with PAUSER_ROLE can pause the contract.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, pauser] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.grantRole(PAUSER_ROLE, pauser.address)
			await expect(instance.connect(pauser).pause())
				.to.emit(instance, 'Paused')
				.withArgs(pauser.address)
		})

		it('<msg.sender> with PAUSER_ROLE can not pause the contract while it is already paused.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, pauser] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.grantRole(PAUSER_ROLE, pauser.address)
			await instance.connect(pauser).pause()
			await expect(
				instance.connect(pauser).pause()
			).to.revertedWithCustomError(instance, 'EnforcedPause')
		})

		it('a user without PAUSER_ROLE can not pause the contract', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const notPauser = await ethers.getSigners()
			await expect(
				instance.connect(notPauser[1]).pause()
			).to.be.revertedWith(PERMISSIONS)
		})
	})

	describe('unpause()', function () {
		it('<msg.sender> with PAUSER_ROLE can unpause the contract.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, pauser] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.grantRole(PAUSER_ROLE, pauser.address)
			await instance.connect(pauser).pause()
			await expect(instance.connect(pauser).unpause())
				.to.emit(instance, 'Unpaused')
				.withArgs(pauser.address)
		})

		it('<msg.sender> with PAUSER_ROLE can not unpause the contract while it is not paused.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin] = await ethers.getSigners()
			await expect(
				instance.connect(defaultAdmin).unpause()
			).to.revertedWithCustomError(instance, 'ExpectedPause')
		})

		it('<msg.sender> without PAUSER_ROLE can not unpause the contract.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, notPauser] = await ethers.getSigners()
			await instance.connect(defaultAdmin).pause()
			await expect(
				instance.connect(notPauser).unpause()
			).to.be.revertedWith(PERMISSIONS)
		})
	})

	describe('mintTo(address to, uint256 amount)', function () {
		it('only <msg.sender> with granted MINTER_ROLE can mintTo <amount> tokens for <to>', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, someUser] = await ethers.getSigners()
			await expect(
				instance.connect(defaultAdmin).mintTo(someUser.address, '100')
			)
				.to.emit(instance, 'Transfer')
				.withArgs(ZeroAddress, someUser.address, '100')
			await expect(
				instance.connect(someUser).mintTo(someUser.address, '100')
			).to.be.revertedWith(PERMISSIONS)
		})

		it('<msg.sender> with granted MINTER_ROLE can not mintTo more tokens than the cap allows', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin] = await ethers.getSigners()
			const tooManyTokens = '20000000000000000000000001'
			await expect(
				instance
					.connect(defaultAdmin)
					.mintTo(defaultAdmin.address, tooManyTokens)
			).to.be.revertedWithCustomError(instance, 'ERC20ExceededCap')
		})

		it('<msg.sender> with granted MINTER_ROLE can not mintTo more tokens than the updated cap allows after tokens have been burned', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(defaultAdmin.address, MAX_CAPPED_TOKENS)
			await instance
				.connect(defaultAdmin)
				.burnFrom(defaultAdmin.address, '10')
			await expect(
				instance.connect(defaultAdmin).mintTo(defaultAdmin.address, '1')
			).to.be.revertedWithCustomError(instance, 'ERC20ExceededCap')
		})
	})

	describe('cap()', function () {
		it('cap() is showing the correct value after tokens have been burned.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(tokenReceiver.address, MAX_CAPPED_TOKENS)
			expect(await instance.cap()).to.equal(MAX_CAPPED_TOKENS)
			await instance
				.connect(tokenReceiver)
				.burnFrom(tokenReceiver.address, HALF_CAPPED_TOKENS)
			expect(await instance.cap()).to.equal(HALF_CAPPED_TOKENS)
		})
	})

	// internal override functions
	describe('the contract is correctly inheriting the _update function from our abstract contracts.', function () {
		it('it correctly inherits from ERC20AllowanceProtected', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(tokenReceiver)
				.approve(defaultAdmin.address, '500')
			expect(
				await instance.allowance(
					tokenReceiver.address,
					defaultAdmin.address
				)
			).to.equal(500)
			await expect(
				instance
					.connect(tokenReceiver)
					.approve(defaultAdmin.address, '300')
			).to.be.revertedWithCustomError(
				instance,
				'AllowanceFirstResetToZeroError'
			)
		})

		it('it correctly inherits from ERC20Blacklist.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, badUser] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(defaultAdmin.address, '300')
			await instance.connect(defaultAdmin).blacklist(badUser.address)
			await expect(
				instance.transfer(badUser.address, '200')
			).to.be.revertedWithCustomError(instance, 'BlacklistedError')
		})

		it('it correctly inherits from ERC20BurnableTracked.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(tokenReceiver.address, MAX_CAPPED_TOKENS)
			await instance
				.connect(tokenReceiver)
				.burnFrom(tokenReceiver.address, HALF_CAPPED_TOKENS)
			expect(await instance.cap()).to.equal(HALF_CAPPED_TOKENS)
		})

		it('while the contract is paused it can not mintTo/burn/transfer tokens.', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin] = await ethers.getSigners()
			await instance.pause()
			await expect(
				instance.mintTo(defaultAdmin.address, '100')
			).to.be.revertedWithCustomError(instance, 'EnforcedPause')
		})
	})

	// inherited functionality from ERC20(*)
	describe('<msg.sender> granted with DEFAULT_ADMIN_ROLE can correctly manage roles.', function () {
		it('the admin can correctly grant a role, the RoleGranted event is emitted', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, someUser] = await ethers.getSigners()
			expect(
				await instance
					.connect(defaultAdmin)
					.hasRole(TEST_ROLE, someUser.address)
			).to.equal(false)
			await expect(
				instance
					.connect(defaultAdmin)
					.grantRole(TEST_ROLE, someUser.address)
			)
				.to.emit(instance, 'RoleGranted')
				.withArgs(TEST_ROLE, someUser.address, defaultAdmin.address)
			expect(
				await instance
					.connect(defaultAdmin)
					.hasRole(TEST_ROLE, someUser.address)
			).to.equal(true)
		})

		it('the admin can correctly revoke a role, the RoleRevoked event is emitted', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, someUser] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.grantRole(TEST_ROLE, someUser.address)
			expect(
				await instance
					.connect(defaultAdmin)
					.hasRole(TEST_ROLE, someUser.address)
			).to.equal(true)
			await expect(
				instance
					.connect(defaultAdmin)
					.revokeRole(TEST_ROLE, someUser.address)
			)
				.to.emit(instance, 'RoleRevoked')
				.withArgs(TEST_ROLE, someUser.address, defaultAdmin.address)
			expect(
				await instance
					.connect(defaultAdmin)
					.hasRole(TEST_ROLE, someUser.address)
			).to.equal(false)
		})

		it('an account can renounce a role that has been granted to it, the RoleRevoked event is emitted', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, someUser] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.grantRole(TEST_ROLE, someUser.address)
			expect(
				await instance.hasRole(TEST_ROLE, someUser.address)
			).to.equal(true)
			await expect(
				instance
					.connect(someUser)
					.renounceRole(TEST_ROLE, someUser.address)
			)
				.to.emit(instance, 'RoleRevoked')
				.withArgs(TEST_ROLE, someUser.address, someUser.address)
			expect(
				await instance.hasRole(TEST_ROLE, someUser.address)
			).to.equal(false)
		})

		it('a account without being granted DEFAULT_ADMIN_ROLE can not revoke a role for an other user', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, someUser] = await ethers.getSigners()
			await instance.grantRole(TEST_ROLE, defaultAdmin.address)
			await expect(
				instance
					.connect(someUser)
					.renounceRole(TEST_ROLE, defaultAdmin.address)
			).to.be.revertedWith('Can only renounce for self')
			expect(
				await instance.hasRole(TEST_ROLE, defaultAdmin.address)
			).to.equal(true)
		})
	})

	describe('Correctly transferring tokens', function () {
		it('a user can transfer his tokens', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(tokenReceiver.address, '100')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(
				100
			)
			await expect(
				instance
					.connect(tokenReceiver)
					.transfer(defaultAdmin.address, '5')
			)
				.to.emit(instance, 'Transfer')
				.withArgs(tokenReceiver.address, defaultAdmin.address, '5')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(95)
			expect(await instance.balanceOf(defaultAdmin.address)).to.equal(5)
		})

		it('a user can not transfer more tokens than he owns', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(tokenReceiver.address, '100')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(
				100
			)
			await expect(
				instance
					.connect(tokenReceiver)
					.transfer(defaultAdmin.address, '1000')
			).to.be.revertedWithCustomError(
				instance,
				'ERC20InsufficientBalance'
			)
		})

		it('a user can approve an other wallet (e.g. a contract) to transfer an allowance of his tokens', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(tokenReceiver.address, '100')
			await instance
				.connect(tokenReceiver)
				.approve(defaultAdmin.address, '50')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(
				100
			)
			await expect(
				instance
					.connect(defaultAdmin)
					.transferFrom(
						tokenReceiver.address,
						defaultAdmin.address,
						'50'
					)
			)
				.to.emit(instance, 'Transfer')
				.withArgs(tokenReceiver.address, defaultAdmin.address, '50')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(50)
			expect(await instance.balanceOf(defaultAdmin.address)).to.equal(50)
		})

		it('the other wallet (e.g. a contract) can not transfer more than the allowance of these tokens', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(tokenReceiver.address, '100')
			await instance
				.connect(tokenReceiver)
				.approve(defaultAdmin.address, '50')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(
				100
			)
			await expect(
				instance
					.connect(defaultAdmin)
					.transferFrom(
						tokenReceiver.address,
						defaultAdmin.address,
						'51'
					)
			).to.be.revertedWithCustomError(
				instance,
				'ERC20InsufficientAllowance'
			)
		})

		it('the other wallet (e.g. a contract) can not transfer more than the balance of these tokens', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, tokenReceiver] = await ethers.getSigners()
			await instance
				.connect(defaultAdmin)
				.mintTo(tokenReceiver.address, '10')
			await instance
				.connect(tokenReceiver)
				.approve(defaultAdmin.address, '50')
			expect(await instance.balanceOf(tokenReceiver.address)).to.equal(10)
			await expect(
				instance
					.connect(defaultAdmin)
					.transferFrom(
						tokenReceiver.address,
						defaultAdmin.address,
						'50'
					)
			).to.be.revertedWithCustomError(
				instance,
				'ERC20InsufficientBalance'
			)
		})
	})

	describe('Correctly permit an other wallet (e.g. a contract) to burn or transer tokens for a user', function () {
		it('a user can approve an other wallet (e.g. a contract) to burn an allowance of his tokens by using an EIP-2612 signature', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, wallet] = await ethers.getSigners()
			const deadline = 4200 + Math.floor(Date.now() / 1000)
			const nonces = await instance.nonces(defaultAdmin.address)
			const contractAddress = await instance.getAddress()
			const accounts: HardhatNetworkHDAccountsUserConfig = config.networks
				.hardhat.accounts as HardhatNetworkHDAccountsUserConfig
			const index = 0 // first wallet, increment for next wallets
			const mnemonic = ethers.Mnemonic.fromPhrase(`${accounts.mnemonic}`)
			const wallet1 = ethers.HDNodeWallet.fromMnemonic(
				mnemonic,
				`${accounts.path}/${index}`
			)
			const privateKey1 = wallet1.privateKey
			const mainnetWallet = new ethers.Wallet(
				privateKey1,
				ethers.provider
			)

			// sign the Permit type data with the deployer's private key
			const result1 = await signERC2612Permit(
				mainnetWallet,
				contractAddress,
				defaultAdmin.address,
				wallet.address,
				25,
				deadline,
				Number(nonces)
			)
			await expect(
				instance
					.connect(wallet)
					.permit(
						defaultAdmin.address,
						wallet.address,
						25,
						deadline,
						result1.v,
						result1.r,
						result1.s
					)
			).to.not.reverted
			expect(
				await instance.allowance(defaultAdmin.address, wallet.address)
			).to.equal(25)
			expect(await instance.nonces(defaultAdmin.address)).to.equal(1)
		})

		it('a permit will be reverted if the signature is not for the correct signer', async function () {
			const instance = await loadFixture(deployDeFiFundToken)
			const [defaultAdmin, wallet, anOtherWallet] =
				await ethers.getSigners()
			const deadline = 4200 + Math.floor(Date.now() / 1000)
			const nonces = await instance.nonces(defaultAdmin.address)
			const contractAddress = await instance.getAddress()
			const accounts: HardhatNetworkHDAccountsUserConfig = config.networks
				.hardhat.accounts as HardhatNetworkHDAccountsUserConfig
			const index = 0 // first wallet, increment for next wallets
			const mnemonic = ethers.Mnemonic.fromPhrase(`${accounts.mnemonic}`)
			const wallet1 = ethers.HDNodeWallet.fromMnemonic(
				mnemonic,
				`${accounts.path}/${index}`
			)
			const privateKey1 = wallet1.privateKey
			const mainnetWallet = new ethers.Wallet(
				privateKey1,
				ethers.provider
			)

			// sign the Permit type data with the deployer's private key
			const result1 = await signERC2612Permit(
				mainnetWallet,
				contractAddress,
				defaultAdmin.address,
				anOtherWallet.address,
				25,
				deadline,
				Number(nonces)
			)
			await expect(
				instance
					.connect(wallet)
					.permit(
						defaultAdmin.address,
						wallet.address,
						25,
						deadline,
						result1.v,
						result1.r,
						result1.s
					)
			).to.revertedWithCustomError(instance, 'ERC2612InvalidSigner')
		})
	})
})
