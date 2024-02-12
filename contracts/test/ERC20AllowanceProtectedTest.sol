// SPDX-License-Identifier: MIT
/**
 * @dev a contract to be able to run unit tests on the abstract ERC20AllowanceProtected contract
 */

pragma solidity ^0.8.20;

import "../ERC20AllowanceProtected.sol";

contract ERC20AllowanceProtectedTest is ERC20AllowanceProtected {
    constructor()
        ERC20("ERC20AllowanceProtectedTest", "ALLOWANCE")
        ERC20Permit("ERC20AllowanceProtectedTest")
    {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
