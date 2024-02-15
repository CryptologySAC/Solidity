import { type HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import dotenv from 'dotenv'
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-verify'

dotenv.config()

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true
      }
    }
  },
  networks: {
    zkEVM: {
      url: 'https://rpc.public.zkevm-test.net',
      accounts: [process.env.ACCOUNT_PRIVATE_KEY ?? '']
    },
    polygonMumbai: {
      url: 'https://rpc-mumbai.polygon.technology',
      accounts: [process.env.ACCOUNT_PRIVATE_KEY ?? '']
    }
  },
  sourcify: {
    enabled: false
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.POLYGONSCAN_API_KEY ?? '',
      zkEVM: process.env.ZKEVM_API_KEY ?? ''
    },
    customChains: [
      {
        network: 'polygonMumbai',
        chainId: 80001,
        urls: {
          apiURL: 'https://api-testnet.polygonscan.com/api',
          browserURL: 'https://mumbai.polygonscan.com'
        }
      },
      {
        network: 'zkEVM',
        chainId: 1442,
        urls: {
          apiURL: 'https://api-testnet-zkevm.polygonscan.com/api',
          browserURL: 'https://testnet-zkevm.polygonscan.com/'
        }
      }
    ]
  }
}

export default config
