// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@thirdweb-dev/contracts/extension/PermissionsEnumerable.sol";
import "./IERC20BurnableTracked.sol";

abstract contract ERC20BurnableTracked is
    IERC20BurnableTracked,
    ERC20,
    ERC20Capped,
    PermissionsEnumerable
{
    /// @notice The total amount of tokens that have been burned
    uint256 private _burned = 0;

    /**
     * @notice Destroys a `value` amount of tokens from `account`.
     *
     * @dev See {ERC20-_burn}.
     * @dev We need to track the amount of tokens burned, to prevent them from being minted again.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `value`.
     */
    function burnFrom(address from, uint256 value) public virtual {
        address spender = _msgSender();
        if (spender != from) {
            _spendAllowance(from, spender, value);
        }

        unchecked {
            // we dont't need to check for overflow because the value <= to the capped tokens
            _burned += value;
        }

        _burn(from, value);
        uint256 _cap = cap();
        emit BurnableTracked(
            spender,
            "has burned tokens from an allowance. New Token cap:",
            _cap
        );
    }

    /**
     * @notice Returns the cap on the token's total supply.
     * Taking the already burned tokens into account.
     */
    function cap() public view virtual override(ERC20Capped) returns (uint256) {
        uint256 realCap = super.cap() - _burned;
        return realCap;
    }

    /**
     * @notice Returns the token's burned supply.
     */
    function burned() external view returns (uint256) {
        return _burned;
    }

    // The following functions are overrides required by Solidity.
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override(ERC20, ERC20Capped) {
        super._update(from, to, value);
    }
}
