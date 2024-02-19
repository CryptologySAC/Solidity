import { expect } from 'chai'
import { ethers, config } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { keccak256, toUtf8Bytes, ZeroAddress } from 'ethers'
import { signERC2612Permit } from 'eth-permit'
import { type ERC20CryptologyToken } from '../typechain-types'
import { type HardhatNetworkHDAccountsUserConfig } from 'hardhat/types'

describe('ERC20StakingPool.sol', async function () {
  const PROJECT_NAME = 'ERC20Cryptology'
  const PROJECT_SYMBOL = 'CRYPTOLOGY'
  const MAX_CAPPED_TOKENS = '20000000000000000000000000'
  const PROJECT_DECIMALS = 18
  const DEFAULT_ADMIN_ROLE =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  const MINTER_ROLE = keccak256(toUtf8Bytes('MINTER_ROLE'))
  const PAUSER_ROLE = keccak256(toUtf8Bytes('PAUSER_ROLE'))
  const STAKEPOOL_ROLE = keccak256(toUtf8Bytes('STAKEPOOL_ROLE'))

  const instance: ERC20CryptologyToken = await ethers.deployContract(
    'ERC20CryptologyTokenTest',
    [PROJECT_NAME, PROJECT_SYMBOL, MAX_CAPPED_TOKENS]
  )
})
