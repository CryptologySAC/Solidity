// SPDX-License-Identifier: MIT
/**
 * @dev a contract to be able to run unit tests on the abstract ERC20Blacklist contract
 */

pragma solidity ^0.8.20;

import "../ERC20CryptologyToken.sol";

contract ERC20BlacklistTest is ERC20CryptologyToken {
    string private constant _name = "ERC20BlacklistTest";
    string private constant _symbol = "BLACKLIST";
    uint256 private constant _tokenCap = 20_000_000 * (10 ** 18);

    constructor() ERC20CryptologyToken(_name, _symbol, _tokenCap) {
        _mint(msg.sender, 1000 * 10 ** decimals());
    }
}
