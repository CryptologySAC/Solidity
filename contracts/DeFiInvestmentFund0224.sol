// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title The token for the DeFi Investment Fund 022024
/// @author Cryptology SAC
/// @custom:security-contact security@capitalsecure.pe

import "./ERC20CryptologyToken.sol";

contract DeFiInvestmentFund0224 is ERC20CryptologyToken {
    /// @dev We use the default 18 decimals and a predefined tokencap of 20M tokens
    uint256 private constant _tokenCap = 20_000_000 * (10 ** 18);
    string private constant _name = "DeFi Investment Fund 0224";
    string private constant _symbol = "DIF0224";

    constructor() ERC20CryptologyToken(_name, _symbol, _tokenCap) {}
}
