// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/// @title ERC20Blacklist
/// @author Cryptology SAC
/// @notice Manage a blacklist on an ERC20 token to prevent bad actor addresses from being able to use the token.

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@thirdweb-dev/contracts/extension/PermissionsEnumerable.sol";
import "./IERC20Blacklist.sol";

abstract contract ERC20Blacklist is
    ERC20,
    ERC20Permit,
    PermissionsEnumerable,
    IERC20Blacklist
{
    bytes32 public constant BLACKLIST_ROLE = keccak256("BLACKLIST_ROLE");
    mapping(address => bool) private _blacklistedAdresses;

    /// @notice Add <account> to the blacklist.
    function blacklist(address account) external onlyRole(BLACKLIST_ROLE) {
        _blacklist(account);
    }

    /// @notice Remove <account> from the blacklist.
    function unblacklist(address account) external onlyRole(BLACKLIST_ROLE) {
        _unblacklist(account);
    }

    /// @notice Check if <account> is blacklisted.
    function isBlacklisted(address account) external view returns (bool) {
        return _isBlacklisted(account);
    }

    /// @notice Return TRUE if <account> is blacklisted
    function _isBlacklisted(address account) internal view returns (bool) {
        return _blacklistedAdresses[account];
    }

    /// @dev Revert in case an account is already blacklisted to prevent any edge cases.
    function _blacklist(address account) internal virtual {
        if (_isBlacklisted(account)) {
            revert BlacklistedError(
                account,
                "This address is already blacklisted."
            );
        }

        /// @dev avoid blacklisting the Zero address, msg.sender, this contract, or anyone with an DEFAULT_ADMIN_ROLE (to prevent a possible deadlock)
        if (
            account == address(0) ||
            account == msg.sender ||
            account == address(this) ||
            hasRole(DEFAULT_ADMIN_ROLE, account)
        ) {
            revert BlacklistedError(
                account,
                "This address can not be blacklisted."
            );
        }
        _blacklistedAdresses[account] = true;
        emit Blacklisted(account, true, msg.sender);
    }

    /// @dev Revert in case an account is not blacklisted to prevent any edge cases.
    function _unblacklist(address account) internal virtual {
        if (!_isBlacklisted(account)) {
            revert BlacklistedError(
                account,
                "This address is not blacklisted."
            );
        }
        _blacklistedAdresses[account] = false;
        emit Blacklisted(account, false, msg.sender);
    }

    /// @dev See {ERC20-_update}.
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override(ERC20) {
        /// @dev revert if <msg.sender> is blacklisted.
        if (_isBlacklisted(msg.sender)) {
            revert BlacklistedError(
                msg.sender,
                "Your address has been blacklisted and is currently not allowed to interact with this token."
            );
        }

        /// @dev revert if <from> is blacklisted.
        /// @dev There is an edge case here where: allowance(from, spender) > 0 but <from> is now blacklisted and therefor spender can not use the allowance that was given previously.
        /// @dev This might break expected functionality in contracts that depend on these allowances. However there is a reaon why we can not accomodate this:
        /// @dev In case an account expects to be blacklisted it could previously approve an unlimited allowance to an other account and
        /// @dev - whilst blacklisted - empty the balance with a transferFrom().
        if (_isBlacklisted(from)) {
            revert BlacklistedError(
                from,
                "This address has been blacklisted and is currently not allowed to interact with this token."
            );
        }

        /// @dev revert if <to> is blacklisted.
        if (_isBlacklisted(to)) {
            revert BlacklistedError(
                to,
                "This address has been blacklisted and is currently not allowed to interact with this token."
            );
        }

        /// @dev  Good to go
        super._update(from, to, value);
    }

    /// @dev Override the ERC20 _approve to prevent either msg.sender, owner or spender access in case of a blacklist.
    function _approve(
        address owner,
        address spender,
        uint256 value,
        bool emitEvent
    ) internal virtual override(ERC20) {
        /// @dev revert if <msg.sender> is blacklisted
        if (_isBlacklisted(msg.sender)) {
            revert BlacklistedError(
                msg.sender,
                "Your address has been blacklisted and is currently not allowed to interact with this token."
            );
        }

        /// @dev revert if <owner> is blacklisted; when using EIP-2612 Signature permit() the owner will differ from <msg.sender>._approve
        if (_isBlacklisted(owner)) {
            revert BlacklistedError(
                owner,
                "This address has been blacklisted and is currently not allowed to interact with this token."
            );
        }

        /// @dev revert if <spender> is blacklisted, but only when an exisiting allowance is not being reset to 0.
        if (_isBlacklisted(spender) && value != 0) {
            revert BlacklistedError(
                spender,
                "The allowance for this spender can only be reset to 0."
            ); /// TEST FOR EDGE CASE when spender spends exactly the allowance
        }

        /// @dev  Good to go
        super._approve(owner, spender, value, emitEvent);
    }
}
