// SPDX-License-Identifier: MIT
/**
 * @dev a contract to be able to run unit tests on the abstract ERC20BurnableTracked contract
 */

pragma solidity ^0.8.20;

import "../ERC20STakingPool.sol";

contract ERC20StakingPoolTest is ERC20StakingPool {
    constructor(address _tokenAddress) ERC20StakingPool(_tokenAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(STAKEPOOL_ROLE, msg.sender);
        _openPool(block.timestamp);
    }
}
