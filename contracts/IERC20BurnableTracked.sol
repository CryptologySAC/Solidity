// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @author Cryptology SAC

interface IERC20BurnableTracked {
	event BurnableTracked(address burner, string message, uint256 cap);

	/// @notice Burn tokens from a specified address
	function burnFrom(address account, uint256 value) external;

	/// @notice Returns the token's burned supply.
	function burned() external view returns (uint256);
}
