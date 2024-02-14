// SPDX-License-Identifier: MIT
/**
 * @dev a contract to be able to run unit tests on the abstract ERC20Blacklist contract
 */

pragma solidity ^0.8.20;

import "../ERC20Blacklist.sol";

contract ERC20BlacklistTest is ERC20Blacklist {
    constructor()
        ERC20("ERC20BlacklistTest", "BLACKLIST")
        ERC20Permit("ERC20BlacklistTest")
    {
        _mint(msg.sender, 100000000);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(BLACKLIST_ROLE, msg.sender);
    }
}
