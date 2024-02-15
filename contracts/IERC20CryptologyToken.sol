/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @author Cryptology SAC

interface IERC20CryptologyToken {
    /// Pause the contract
    function pause() external;

    /// UnPause the contract
    function unpause() external;
}
