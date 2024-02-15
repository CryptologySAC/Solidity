// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title
/// @author
/// @notice

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@thirdweb-dev/contracts/extension/ContractMetadata.sol";
import "@thirdweb-dev/contracts/extension/PermissionsEnumerable.sol";
import "@thirdweb-dev/contracts/extension/interface/IMintableERC20.sol";
import "./IERC20CryptologyToken.sol";
import "./ERC20Blacklist.sol";
import "./ERC20AllowanceProtected.sol";
import "./ERC20BurnableTracked.sol";

/// @custom:security-contact security@capitalsecure.pe
contract ERC20CryptologyToken is
    PermissionsEnumerable,
    ERC20AllowanceProtected,
    ERC20Blacklist,
    ERC20BurnableTracked,
    ERC20Pausable,
    ContractMetadata,
    IERC20CryptologyToken,
    IMintableERC20
{
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant METADATA_ROLE = keccak256("METADATA_ROLE");
    bytes32 public constant KYCAML_ROLE = keccak256("KYCAML_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BLACKLIST_ROLE = keccak256("BLACKLIST_ROLE");

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 tokenCap_
    ) ERC20(name_, symbol_) ERC20Permit(name_) ERC20Capped(tokenCap_) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(PAUSER_ROLE, msg.sender);
        _setupRole(BLACKLIST_ROLE, msg.sender);
        _setupRole(METADATA_ROLE, msg.sender);
        _setupRole(KYCAML_ROLE, msg.sender);
        _setupRole(BURNER_ROLE, msg.sender);
    }

    // Emits event Paused(msg.sender) on success
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    // Emits event Unpaused(msg.sender) on success
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // only mint if it doesn't exceed the cap
    // emits an event from _update()
    function mintTo(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 value) public override {
        super.burnFrom(from, value);
    }

    /// @notice Add <account> to the blacklist.
    function blacklist(
        address account
    ) public override onlyRole(BLACKLIST_ROLE) {
        super.blacklist(account);
    }

    /// @notice Remove <account> from the blacklist.
    function unblacklist(
        address account
    ) public override onlyRole(BLACKLIST_ROLE) {
        super.unblacklist(account);
    }

    // The following functions are overrides required by Solidity.
    function _update(
        address from,
        address to,
        uint256 value
    )
        internal
        override(ERC20, ERC20BurnableTracked, ERC20Pausable, ERC20Blacklist)
    {
        super._update(from, to, value);
    }

    /**
     * @dev Override the ERC20 _approve to add the obligation to first reset an allowance to 0 before updating it
     * This will prevent a typical frontrunning attack, but be aware to check if you request an approval first.
     */
    function _approve(
        address owner,
        address spender,
        uint256 value,
        bool emitEvent
    ) internal override(ERC20, ERC20Blacklist, ERC20AllowanceProtected) {
        super._approve(owner, spender, value, emitEvent);
    }

    /// @dev Returns whether contract metadata can be set in the given execution context.
    function _canSetContractURI() internal view override returns (bool) {
        return hasRole(METADATA_ROLE, msg.sender);
    }
}
