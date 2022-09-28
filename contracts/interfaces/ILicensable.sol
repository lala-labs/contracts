// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.1.0

pragma solidity ^0.8.16;

// Adopted from "@a16z/contracts/licenses/ICantBeEvil.sol"
interface ICantBeEvil {
  function getLicenseURI() external view returns (string memory);

  function getLicenseName() external view returns (string memory);
}

interface ILicensable is ICantBeEvil {
  enum LicenseType {
    CBE_CC0,
    CBE_ECR,
    CBE_NECR,
    CBE_NECR_HS,
    CBE_PR,
    CBE_PR_HS,
    CUSTOM,
    UNLICENSED
  }

  error Licensable_LicenseLocked();
  error Licensable_MissingPermission();

  function setLicenseType(LicenseType licenseType) external;

  function setCustomLicense(string calldata licenseName, string calldata licenseUri) external;

  function lockLicenseType() external;
}
