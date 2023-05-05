// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.3.0

pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../security/Guardable.sol";

contract GuardableImpl is ERC721, Guardable {

  constructor() ERC721("GuardableToken", "GTOKEN") {
  }

  function guardedFunctionCall() public view guardWithGuardian returns (bool) {
    return true;
  }

  function setApprovalForAll(address operator, bool approved) public override {
    if (approved) _checkHasGuardian();

    super.setApprovalForAll(operator, approved);
  }

  function removeGuardian() public {
    _removeGuardian();
  }

  function lockToSelf() public {
    _lockToSelf();
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC721, Guardable) returns (bool) {
    return ERC721.supportsInterface(interfaceId) || Guardable.supportsInterface(interfaceId);
  }
}
