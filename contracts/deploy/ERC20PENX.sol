// SPDX-License-Identifier: MIT
/**
 * @dev contract for the PENX Token
 */

pragma solidity ^0.8.20;

import '../ERC20CryptologyToken.sol';

contract ERC20PENX is ERC20CryptologyToken {
	constructor(
		string memory _name,
		string memory _symbol,
		uint256 _tokenCap
	) ERC20CryptologyToken(_name, _symbol, _tokenCap) {}
}
