// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @author Cryptology SAC

interface IERC20AllowanceProtected {
    /// @notice Error to revert with when an allowance was not first reset to 0
    error AllowanceFirstResetToZeroError(string message);

    /// @notice Error to revert with when trying to set an allowance to an invalid spender
    error AllowanceToError(string message);

    /// @notice Emit an event to notify that an unlimited allowance has been given from <owner> to <spender>
    event UnlimitedAllowanceWarning(address owner, address spender);
}
