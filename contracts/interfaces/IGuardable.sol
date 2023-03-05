// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.2.1

pragma solidity ^0.8.16;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// Interface ID: 0x126f5523
interface IGuardable is IERC165 {

  error LockedByGuardian();
  error CallerGuardianMismatch(address caller, address guardian);
  error InvalidGuardian();

  event GuardianAdded(address indexed guardedAddress, address indexed guardian);
  event GuardianRemoved(address indexed guardedAddress);

  function setGuardian(address guardian) external;

  function removeGuardianOf(address guardedAddress) external;

  function guardianOf(address guardedAddress) external view returns (address);
}
