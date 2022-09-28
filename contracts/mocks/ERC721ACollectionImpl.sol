// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.2.0

pragma solidity ^0.8.16;

import "../collections/ERC721ACollection.sol";

contract ERC721ACollectionImpl is ERC721ACollection {

  constructor(
    string memory name,
    string memory symbol,
    string memory baseUri,
    uint256 supply,
    address royaltyRecipient,
    LicenseType license
  ) ERC721ACollection(name, symbol, baseUri, supply, royaltyRecipient, license) {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function mintWithExtraData(address to, uint256 amount, uint24 extraData) external {
    _mintWithExtraData(to, amount, extraData);
  }
}
