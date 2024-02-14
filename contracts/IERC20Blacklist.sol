/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @author Cryptology SAC

interface IERC20Blacklist {
    /**
     * @notice Emitted when an account is (un)blacklisted
     *
     * value is true when added, false when removed
     */
    event Blacklisted(
        address indexed account,
        bool value,
        address indexed sender
    );

    /// @notice the error to emit when an account is blacklisted
    /// @dev the message will detail what is wrong
    error BlacklistedError(address account, string message);

    /**
     * @notice add an account to the blacklist, blacklisted accounts can't approve, permit, receive, send or use allowances
     * @param account the account to be blacklisted
     */
    function blacklist(address account) external;

    /**
     * @notice remove an account from the blacklist
     * @param account the account to be removed from the blacklist
     */
    function unblacklist(address account) external;

    /**
     * @notice check if an account is blacklisted
     * @param account the account to check
     */
    function isBlacklisted(address account) external view returns (bool);
}
