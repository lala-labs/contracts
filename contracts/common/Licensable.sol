// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.2.0

pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "../interfaces/ILicensable.sol";

/// A contract extension to declare a usage License that should apply to all contract contents and tokens.
///
/// @dev Adopted partly from https://github.com/a16z/a16z-contracts/blob/master/contracts/licenses/CantBeEvil.sol
/// Some code copied since the CantBeEvil contract is final and does not provide facilities to override name and URI.
abstract contract Licensable is Ownable, ERC165, ILicensable {
  using Strings for uint256;

  string internal constant A16Z_LICENSE_BASE_URI = "ar://_D9kN1WrNWbCq55BSAGRbTB4bS3v8QAPTYmBThSbX3A/";

  LicenseType public licenseType;
  string public customLicenseUri;
  string public customLicenseName;

  bool public licenseTypeLocked;

  constructor (LicenseType license) {
    licenseType = license;
  }

  function getLicenseURI() public override view returns (string memory) {
    if (licenseType == LicenseType.UNLICENSED) {
      return "";
    }

    if (licenseType == LicenseType.CUSTOM) {
      return customLicenseUri;
    }

    return string.concat(A16Z_LICENSE_BASE_URI, uint256(licenseType).toString());
  }

  function getLicenseName() public override view returns (string memory) {
    if (licenseType == LicenseType.UNLICENSED) {
      return "UNLICENSED";
    }

    if (licenseType == LicenseType.CUSTOM) {
      return customLicenseName;
    }

    require(uint8(licenseType) <= 6); // A16Z licenses
    if (licenseType == LicenseType.CBE_CC0) return "CBE_CC0";
    if (licenseType == LicenseType.CBE_ECR) return "CBE_ECR";
    if (licenseType == LicenseType.CBE_NECR) return "CBE_NECR";
    if (licenseType == LicenseType.CBE_NECR_HS) return "CBE_NECR_HS";
    if (licenseType == LicenseType.CBE_PR) return "CBE_PR";
    else return "CBE_PR_HS";
  }

  function _canManageLicense() internal virtual view returns (bool) {
    return _msgSender() == owner();
  }

  function setLicenseType(LicenseType license) external override {
    if (!_canManageLicense()) revert Licensable_MissingPermission();
    if (licenseTypeLocked) revert Licensable_LicenseLocked();

    licenseType = license;
  }

  function setCustomLicense(
    string calldata licenseName,
    string calldata licenseUri
  ) external {
    if (!_canManageLicense()) revert Licensable_MissingPermission();
    if (licenseTypeLocked) revert Licensable_LicenseLocked();

    licenseType = LicenseType.CUSTOM;
    customLicenseName = licenseName;
    customLicenseUri = licenseUri;
  }

  function lockLicenseType() external override {
    if (!_canManageLicense()) revert Licensable_MissingPermission();

    licenseTypeLocked = true;
  }

  function supportsInterface(bytes4 interfaceId) public view override virtual returns (bool) {
    return interfaceId == type(ICantBeEvil).interfaceId
    || interfaceId == type(ILicensable).interfaceId
    || super.supportsInterface(interfaceId);
  }
}
