// SPDX-License-Identifier: MIT
// LaLaLabs Contracts v0.1.0
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/utils/Context.sol";
import "../interfaces/IGuardable.sol";

/**
 * @dev Contract module which provides added security functionality, where
 * where an account can assign a guardian to protect them. While a guardian
 * is assigned, methods guarded with `guardWithGuardian` are locked.
 *
 * There can only ever be one guardian per account, and setting a new guardian will overwrite
 * any existing one.
 *
 * Inspired by 0xQuit's ERC721Guardable/ERC1155Guardable
 */
abstract contract Guardable is Context, IGuardable {
  // guarded address => guardian
  mapping(address => address) private guardians;

  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(IGuardable).interfaceId;
  }

  /**
   * @dev Common use modifier to prevent the use of methods on behalf of the sender that are guarded.
   */
  modifier guardWithGuardian() {
    _checkHasGuardian();
    _;
  }

  /**
   * @dev Throws if a guardian is set for the caller.
   */
  function _checkHasGuardian() internal view virtual {
    if (guardians[_msgSender()] != address(0)) {
      revert LockedByGuardian();
    }
  }

  /**
   * @dev Sets a guardian for the caller.
   *
   * Note: For security reasons, this method does not allow removing a guardian by passing the zero address.
   * Call `removeGuardianOf` by the guardian instead.
   */
  function setGuardian(address guardian) public {
    if (msg.sender == guardian || guardian == address(0)) {
      revert InvalidGuardian();
    }

    guardians[_msgSender()] = guardian;
    emit GuardianAdded(_msgSender(), guardian);
  }

  function guardianOf(address guardedAddress) public view returns (address) {
    return guardians[guardedAddress];
  }

  function removeGuardianOf(address guardedAddress) external {
    if (_msgSender() != guardianOf(guardedAddress)) {
      revert CallerGuardianMismatch(_msgSender(), guardianOf(guardedAddress));
    }
    delete guardians[guardedAddress];
    emit GuardianRemoved(guardedAddress);
  }

  /**
   * @dev Removes the guardian by the guarded address itself.
   *   It is not recommended to use or expose this method,
   *   as a malicious workflow could effectively disable all guard modifiers.
   */
  function _removeGuardian() internal {
    delete guardians[_msgSender()];
    emit GuardianRemoved(_msgSender());
  }

  /**
   * @dev Sets the guardian to the guarded address itself.
   *   It is not recommended to use or expose this method,
   *   as a malicious workflow could effectively disable all guard modifiers.
   */
  function _lockToSelf() internal {
    guardians[_msgSender()] = _msgSender();
    emit GuardianAdded(_msgSender(), _msgSender());
  }
}
