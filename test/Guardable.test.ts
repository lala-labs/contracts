import {expect} from "chai";
import {ContractFactory, Signer} from "ethers";
import { artifacts, ethers } from 'hardhat';
import { GuardableImpl, IGuardable } from '../typechain-types';

describe('GuardableImpl', function() {

  let factory: ContractFactory;
  let contract: GuardableImpl;

  let userActingContract: GuardableImpl;
  let user: Signer;
  let userAddress: string;

  let guardianActingContract: GuardableImpl;
  let guardian: Signer;
  let guardianAddress: string;

  let addrs: Signer[];

  before(async function() {
    factory = await ethers.getContractFactory('GuardableImpl');
    [user, guardian, ...addrs] = await ethers.getSigners();
    userAddress = await user.getAddress();
    guardianAddress = await guardian.getAddress();
  });

  beforeEach(async function() {
    contract = await factory.deploy() as GuardableImpl;
    await contract.deployed();

    userActingContract = contract.connect(user);
    guardianActingContract = contract.connect(guardian);
  });

  describe("supportsInterface", () => {
    it("should return true for the IGuardable interface", async function() {
      expect(
        await userActingContract.supportsInterface("0x126f5523")
      ).to.be.true;
    })
  });

  describe("modifier guardWithGuardian", () => {
    it("should allow to call a protected function by default", async function() {
      expect(
        await userActingContract.guardedFunctionCall()
      ).to.be.true;
    })

    it("should not allow to call a protected function when a guardian is set", async function() {
      await userActingContract.setGuardian(guardianAddress);

      await expect(
        userActingContract.guardedFunctionCall()
      ).to.be.revertedWith("LockedByGuardian()");
    })

    it("should allow to call a protected function when a guardian was removed", async function() {
      await userActingContract.setGuardian(guardianAddress);
      await guardianActingContract.removeGuardianOf(userAddress);

      expect(
        await userActingContract.guardedFunctionCall()
      ).to.be.true;
    })
  });

  describe("_checkHasGuardian", () => {

    it("should allow `setApprovalForAll` by default", async function() {
      const operatorAddress = await addrs[0].getAddress();

      await userActingContract.setApprovalForAll(operatorAddress, true);
      expect(await contract.isApprovedForAll(userAddress, operatorAddress)).to.be.true;
    })

    it("should not allow to grant new approvals when a guardian is set", async function() {
      const operatorAddress = await addrs[0].getAddress();

      await userActingContract.setGuardian(guardianAddress);

      await expect(
          userActingContract.setApprovalForAll(operatorAddress, true)
      ).to.be.revertedWith("LockedByGuardian()");
    })

    it("should allow to revoke approvals when a guardian is set", async function() {
      const operatorAddress = await addrs[0].getAddress();
      await userActingContract.setApprovalForAll(operatorAddress, true);
      await userActingContract.setGuardian(guardianAddress);

      await userActingContract.setApprovalForAll(operatorAddress, false);

      expect(await contract.isApprovedForAll(userAddress, operatorAddress)).to.be.false;
    })
  });

  describe("setGuardian", () => {
    it("should set the guardian to the given address", async function() {
      await userActingContract.setGuardian(guardianAddress);

      expect(
        await userActingContract.guardianOf(userAddress)
      ).to.equal(guardianAddress);
    })

    it("should emit a GuardianAdded event", async function() {
      await expect(
        userActingContract.setGuardian(guardianAddress)
      ).to.emit(contract, "GuardianAdded").withArgs(userAddress, guardianAddress);
    })

    it("should set the guardian to a new address when a guardian was already set", async function() {
      await userActingContract.setGuardian(guardianAddress);

      const newGuardianAddress = await addrs[0].getAddress();
      await userActingContract.setGuardian(newGuardianAddress);

      expect(
        await userActingContract.guardianOf(userAddress)
      ).to.equal(newGuardianAddress);
    })

    it("should not allow to set the guardian to the caller address", async function() {
      await expect(
        userActingContract.setGuardian(userAddress)
      ).to.be.revertedWith("InvalidGuardian()");
    })

    it("should not allow to set the guardian to the zero address", async function() {
      await expect(
        userActingContract.setGuardian(ethers.constants.AddressZero)
      ).to.be.revertedWith("InvalidGuardian()")
    })
  });

  describe("guardianOf", () => {
    it("should return the zero address by default", async function() {
      expect(
        await userActingContract.guardianOf(userAddress)
      ).to.equal(ethers.constants.AddressZero);
    })

    it("should return the guardian address when a guardian is set", async function() {
      await userActingContract.setGuardian(guardianAddress);

      expect(
        await userActingContract.guardianOf(userAddress)
      ).to.equal(guardianAddress);
    })
  });

  describe("removeGuardianOf", () => {
    it("should remove the guardian for the guarded address", async function() {
      await userActingContract.setGuardian(guardianAddress);
      await guardianActingContract.removeGuardianOf(userAddress);

      expect(
        await userActingContract.guardianOf(userAddress)
      ).to.equal(ethers.constants.AddressZero);
    })

    it("should emit a GuardianRemoved event", async function() {
      await userActingContract.setGuardian(guardianAddress);

      await expect(
        guardianActingContract.removeGuardianOf(userAddress)
      ).to.emit(contract, "GuardianRemoved").withArgs(userAddress);
    })

    it("should not allow to remove the guardian for the guarded address by the guarded address", async function() {
      await userActingContract.setGuardian(guardianAddress);

      await expect(
        userActingContract.removeGuardianOf(userAddress)
      ).to.have.revertedWith(`CallerGuardianMismatch("${userAddress}", "${guardianAddress}")`)
    })

    it("should not allow to remove the guardian when no guardian is set", async function() {
      await expect(
        guardianActingContract.removeGuardianOf(userAddress)
      ).to.have.revertedWith(`CallerGuardianMismatch("${guardianAddress}", "${ethers.constants.AddressZero}")`)
    })
  });

  describe("_removeGuardian", () => {
    it("should remove the guardian for the guarded caller address", async function() {
      await userActingContract.setGuardian(guardianAddress);
      await userActingContract.removeGuardian();

      expect(
        await userActingContract.guardianOf(userAddress)
      ).to.equal(ethers.constants.AddressZero);
    })

    it("should emit a GuardianRemoved event", async function() {
      await userActingContract.setGuardian(guardianAddress);

      await expect(
        userActingContract.removeGuardian()
      ).to.emit(contract, "GuardianRemoved").withArgs(userAddress);
    })
  });

  describe("_lockToSelf", () => {
    it("should set the guardian to the caller address", async function() {
      await userActingContract.lockToSelf();

      expect(
        await userActingContract.guardianOf(userAddress)
      ).to.equal(userAddress);
    })

    it("should emit a GuardianAdded event", async function() {
      await expect(
        userActingContract.lockToSelf()
      ).to.emit(contract, "GuardianAdded").withArgs(userAddress, userAddress);
    })
  });
});
