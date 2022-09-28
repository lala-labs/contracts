// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.2.0
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC1155.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "erc721a/contracts/extensions/ERC4907A.sol";
import "erc721a/contracts/extensions/ERC721ABurnable.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";

import "../security/Guardable.sol";
import "../common/Licensable.sol";

/// An opinionated ERC721 collection based on ERC721A with support for:
/// - Royalties (ERC2981)
/// - ERC4907 (lending)
/// - Guardable (approval security)
/// - Licensable (license declaration)
/// - Withdrawal of ETH, ERC20, ERC721, ERC1155
/// - lowering the target supply
/// - base uri support
abstract contract ERC721ACollection is
Ownable,
ERC4907A,
ERC721AQueryable,
ERC2981,
Guardable,
Licensable
{
  error ERC721ACollection_BaseUriLocked();
  error ERC721ACollection_BelowMintedSupply();
  error ERC721ACollection_OverRoyaltyLimit();
  error ERC721ACollection_OverTargetSupply();
  error ERC721ACollection_SupplyIncreaseBlocked();
  error ERC721ACollection_MissingPermission();

  uint256 internal constant WITHDRAW_TYPE_ETH = 1;
  uint256 internal constant WITHDRAW_TYPE_ERC20 = 2;
  uint256 internal constant WITHDRAW_TYPE_ERC721 = 3;
  uint256 internal constant WITHDRAW_TYPE_ERC1155 = 4;

  uint96 internal constant FIVE_PERCENT_IN_BPS = 500;
  uint96 internal constant TEN_PERCENT_IN_BPS = 1_000;

  uint256 private _targetSupply;

  string public baseUri;
  bool public baseUriLocked;

  constructor(
    string memory name,
    string memory symbol,
    string memory baseUri_,
    uint256 supply,
    address royaltyRecipient,
    LicenseType license
  ) ERC721A(name, symbol) Licensable(license) {
    baseUri = baseUri_;

    _targetSupply = supply;

    _setDefaultRoyalty(royaltyRecipient, royaltyDefaultBps());
  }

  /*
   * Region: ERC721A configuration
   */

  function _startTokenId() internal pure override returns (uint256) {
    return 1;
  }

  /// @dev keep extra data assigned to tokens around rather than clearing upon transfer
  function _extraData(address from, address to, uint24 previousExtraData) internal pure override returns (uint24) {
    // clear state upon burning
    if (to == address(0)) {
      return 0;
    }

    // persist extra data upon transfers
    return previousExtraData;
  }

  function _msgSenderERC721A() internal override view returns (address) {
    return _msgSender();
  }

  /*
   * Region: Minting
   */

  function totalMinted() external view returns(uint256) {
    return _totalMinted();
  }

  function targetSupply() external view returns(uint256) {
    return _targetSupply;
  }

  function adjustTargetSupply(uint256 supply) external {
    if (!_canAdjustTargetSupply()) revert ERC721ACollection_MissingPermission();

    if (supply >= _targetSupply) revert ERC721ACollection_SupplyIncreaseBlocked();
    if (supply < _totalMinted()) revert ERC721ACollection_BelowMintedSupply();
    _targetSupply = supply;
  }

  function _mint(address to, uint256 amount) internal virtual override {
    if (_totalMinted() + amount > _targetSupply) revert ERC721ACollection_OverTargetSupply();

    super._mint(to, amount);
  }

  function _mintWithExtraData(address to, uint256 amount, uint24 extraData) internal virtual {
    if (_totalMinted() + amount > _targetSupply) revert ERC721ACollection_OverTargetSupply();

    uint256 tokenId = _nextTokenId();
    super._mint(to, amount);
    _setTokenExtraData(tokenId, extraData);
  }

  /**
   * @dev Gas spent here starts off proportional to the maximum mint batch size.
   * It gradually moves to O(1) as tokens get transferred around over time.
   * Also see `ERC721A._ownershipOf(uint256 tokenId)`
   */
  function _getTokenExtraData(uint256 tokenId) internal virtual returns(uint24) {
    return _ownershipOf(tokenId).extraData;
  }

  function _setTokenExtraData(uint256 tokenId, uint24 extraData) internal virtual {
    _setExtraDataAt(tokenId, extraData);
  }

  function _getWalletExtraData(address wallet) internal virtual returns(uint64) {
    return _getAux(wallet);
  }

  function _setWalletExtraData(address wallet, uint64 extraData) internal virtual {
    _setAux(wallet, extraData);
  }

  /*
   * Region: Metadata
   */

  function setBaseUri(string calldata _uri) public {
    if (!_canManageBaseUri()) revert ERC721ACollection_MissingPermission();
    if (baseUriLocked) revert ERC721ACollection_BaseUriLocked();

    baseUri = _uri;
  }

  function _baseURI() internal view override returns (string memory) {
    return baseUri;
  }

  function lockBaseUri() public {
    if (!_canManageBaseUri()) revert ERC721ACollection_MissingPermission();

    baseUriLocked = true;
  }

  /*
   * Region: Guard
   */

  /**
   * @notice Approvals can be locked by setting up a guardian.
   */
  function approve(address to, uint256 tokenId) public override(ERC721A, IERC721A) payable {
    _checkHasGuardian();

    super.approve(to, tokenId);
  }

  /**
   * @notice Approvals can be locked by setting up a guardian.
   * Existing approvals can still be leveraged as normal, and it is expected that this functionality be used
   * after a user has set the approvals they want to set (e.g. for all marketplaces they want to trade on).
   * Approvals can still be removed while a guardian is set.
   */
  function setApprovalForAll(address operator, bool approved) public override(ERC721A, IERC721A) {
    if (approved) _checkHasGuardian();

    super.setApprovalForAll(operator, approved);
  }

  /*
   * Region: Royalties
   */

  function royaltyDefaultBps() public pure virtual returns (uint96) {
    return FIVE_PERCENT_IN_BPS;
  }

  function royaltyUpperLimitBps() public pure virtual returns (uint96) {
    return TEN_PERCENT_IN_BPS;
  }

  /**
   * Sets default token royalties.
   *
   * @param recipient The recipient of the royalties
   * @param value The royalties amount expressed as basis points (100 = 1%)
   */
  function setDefaultRoyalty(address recipient, uint96 value) external {
    if (!_canSetDefaultRoyalty()) revert ERC721ACollection_MissingPermission();

    if (value > royaltyUpperLimitBps()) revert ERC721ACollection_OverRoyaltyLimit();
    _setDefaultRoyalty(recipient, value);
  }

  /*
   * Region: Token/ETH Withdrawal
   */

  // @dev allow to retrieve ETH sent to the contract
  function withdrawETH(address to) external {
    if (!_canWithdraw(WITHDRAW_TYPE_ETH)) revert ERC721ACollection_MissingPermission();

    Address.sendValue(payable(to), address(this).balance);
  }

  // @dev allow to retrieve ERC20 tokens sent to the contract
  function withdrawERC20(address to, IERC20 token) external {
    if (!_canWithdraw(WITHDRAW_TYPE_ERC20)) revert ERC721ACollection_MissingPermission();

    token.transfer(to, token.balanceOf(address(this)));
  }

  // @dev allow to retrieve ERC721 tokens sent to the contract
  function withdrawERC721(address to, IERC721 token, uint256 tokenId) external {
    if (!_canWithdraw(WITHDRAW_TYPE_ERC721)) revert ERC721ACollection_MissingPermission();

    token.transferFrom(address(this), to, tokenId);
  }

  // @dev allow to retrieve ERC1155 tokens sent to the contract
  function withdrawERC1155(address to, IERC1155 token, uint256 tokenId) external {
    if (!_canWithdraw(WITHDRAW_TYPE_ERC1155)) revert ERC721ACollection_MissingPermission();

    token.safeTransferFrom(address(this), to, tokenId, token.balanceOf(address(this), tokenId), "");
  }

  /*
   * Region: Permissions
   * Moved here to make finding all overrideable permission checks easy.
   */

  function _canAdjustTargetSupply() internal virtual view returns (bool) {
    return _msgSender() == owner();
  }

  function _canManageBaseUri() internal virtual view returns (bool) {
    return _msgSender() == owner();
  }

  function _canSetDefaultRoyalty() internal virtual view returns (bool) {
    return _msgSender() == owner();
  }

  function _canWithdraw(uint256 withdrawType) internal virtual view returns (bool) {
    return _msgSender() == owner();
  }

  /*
   * Region: ERC165
   */

  // Supports the following `interfaceId`s:
  // - via ERC4907A: IERC721, IERC721Metadata, ERC4907
  // - via ERC2981: IERC2981
  // - via Guardable: IGuardable
  // - via Licensable: ILicensable, ICantDoEvil
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC721A, IERC721A, ERC4907A, ERC2981, Guardable, Licensable) returns (bool) {
    return ERC4907A.supportsInterface(interfaceId)
    || ERC2981.supportsInterface(interfaceId)
    || Guardable.supportsInterface(interfaceId)
    || Licensable.supportsInterface(interfaceId)
    ;
  }
}
