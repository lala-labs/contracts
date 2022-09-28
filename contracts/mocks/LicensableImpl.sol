// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.2.0

pragma solidity ^0.8.16;

import "../common/Licensable.sol";

contract LicensableImpl is Licensable {

  constructor() Licensable(LicenseType.UNLICENSED) {
  }
}
