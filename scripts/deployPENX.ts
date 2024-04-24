import {ethers} from 'hardhat'

async function main(): Promise<void> {
	const instance = await ethers.deployContract('ERC20PENX')

	console.log(
		`ERC20PENX deployed to ${await instance.getAddress()}`
	)
}

main()
	.then(() => {})
	.catch(error => {
		console.error(error)
	})
