import { ethers } from 'hardhat'

async function main(): Promise<void> {
  const instance = await ethers.deployContract('DeFiInvestmentFund0224')

  console.log(
    `DeFiInvestmentFund0224 deployed to ${await instance.getAddress()}`
  )
}

main()
  .then(() => {})
  .catch(error => {
    console.error(error)
  })
