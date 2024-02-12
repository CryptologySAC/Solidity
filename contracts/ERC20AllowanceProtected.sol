// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/// @title ERC20AllowanceProtected
/// @author Cryptology SAC
/// @notice Enforce an account to first reset a given allowance to 0 before setting a new allowance

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./IERC20AllowanceProtected.sol";

uint256 constant MAX_INT_TYPE = type(uint256).max;

abstract contract ERC20AllowanceProtected is
    ERC20,
    ERC20Permit,
    IERC20AllowanceProtected
{
    /**
     * @notice Override this function to add the check.
     * @inheritdoc IERC20Permit
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override {
        /// @dev we need to prevent an account to use permit to circumvent the reset to 0 rule
        /// @dev allowance() will be called again in _approve, using a private value outside of the function to cater to both is too risky
        uint256 currentAllowance = allowance(owner, spender);
        if (value != 0 && currentAllowance > 0) {
            revert AllowanceFirstResetToZeroError(
                "Reset the allowance to 0 before updating it."
            );
        }

        super.permit(owner, spender, value, deadline, v, r, s);
    }

    /// @notice Override the ERC20 _approve to add the obligation to first reset an allowance to 0 before updating it
    /// @notice Check if an unlimted allowance is being set to notify with and event
    function _approve(
        address owner,
        address spender,
        uint256 value,
        bool emitEvent
    ) internal virtual override(ERC20) {
        uint256 currentAllowance = allowance(owner, spender);

        /// @dev Why would anyone be allowed to set an allowance to themselves?
        if (owner == spender) {
            revert AllowanceToError(
                "There is no reason to grant yourself an allowance"
            );
        }

        /// @dev Why would anyone be allowed to set an allowance to the Zero address?
        if (spender == address(0)) {
            revert AllowanceToError(
                "There is no reason to grant the Zero address an allowance"
            );
        }

        /// @dev Only check for a non zero allowance if the <owner> account is updating it this way we avoid being able to lower allowance on usage
        if (msg.sender == owner && value != 0 && currentAllowance > 0) {
            revert AllowanceFirstResetToZeroError(
                "Reset the allowance to 0 before updating it."
            );
        }
        super._approve(owner, spender, value, emitEvent);

        /// @dev adhere to the emitEvent boolean for max compatibility.
        if (value == MAX_INT_TYPE && emitEvent) {
            emit UnlimitedAllowanceWarning(owner, spender);
        }
    }
}
