// SPDX-License-Identifier: MIT
/**
 * @dev a contract to be able to run unit tests on the abstract ERC20BurnableTracked contract
 */

pragma solidity ^0.8.20;

import "../ERC20CryptologyToken.sol";

contract ERC20CryptologyTokenTest is ERC20CryptologyToken {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _tokenCap
    ) ERC20CryptologyToken(_name, _symbol, _tokenCap) {}
}
