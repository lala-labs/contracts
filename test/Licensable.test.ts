import { expect } from 'chai';
import { ContractFactory, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { ILicensable, LicensableImpl } from '../typechain-types';

describe('LicensableImpl', function() {

  let factory: ContractFactory;
  let contract: LicensableImpl;
  let userActingContract: LicensableImpl;

  let owner: Signer;
  let ownerAddress: string;

  let user: Signer;
  let userAddress: string;

  let addrs: Signer[];

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

  before(async function() {
    factory = await ethers.getContractFactory('LicensableImpl');
    [owner, user, ...addrs] = await ethers.getSigners();

    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();
  });

  beforeEach(async function() {
    contract = await factory.deploy() as LicensableImpl;
    await contract.deployed();

    userActingContract = contract.connect(user);
  });

  describe('supportsInterface', () => {
    it('should return true for the ILicensable and ICantBeEvil interfaces', async function() {
      expect(
        await contract.supportsInterface('0x6d2c9f1d') // ILicensable
      ).to.be.true;

      expect(
        await contract.supportsInterface('0x649a51a8') // ICantBeEvil
      ).to.be.true;
    });
  });

  describe('License lock', () => {
    it(`should allow to update a license if not locked`, async function() {
      expect(await contract.licenseTypeLocked()).to.be.false;
      await expect(
        contract.setLicenseType(LicenseType.UNLICENSED)
      ).to.not.have.reverted
    });

    it(`should not allow to update a license if locked`, async function() {
      await contract.lockLicenseType();

      await expect(
        contract.setLicenseType(LicenseType.UNLICENSED)
      ).to.have.revertedWith("Licensable_LicenseLocked()")
    });

    it(`should not allow to lock the license by anybody`, async function() {
      await expect(
        userActingContract.lockLicenseType()
      ).to.have.revertedWith("Licensable_MissingPermission()")
    });
  });

  describe('License Types', () => {

    it(`should not allow to set the license type by anybody`, async function() {
      await expect(
        userActingContract.setLicenseType(LicenseType.UNLICENSED)
      ).to.have.revertedWith("Licensable_MissingPermission()")
    });

    describe('UNLICENSED', () => {
      it(`getLicenseURI should return an empty string`, async function() {
        await contract.setLicenseType(LicenseType.UNLICENSED);

        expect(
          await contract.getLicenseURI()
        ).to.equal('');
      });

      it(`getLicenseName should return UNLICENSED`, async function() {
        await contract.setLicenseType(LicenseType.UNLICENSED);

        expect(
          await contract.getLicenseName()
        ).to.equal('UNLICENSED');
      });
    });

    describe('Custom License', () => {
      it(`getLicenseURI should return the custom license uri`, async function() {
        await contract.setCustomLicense("name", "uri");

        expect(
          await contract.getLicenseURI()
        ).to.equal('uri');
      });

      it(`getLicenseName should return the custom license name`, async function() {
        await contract.setCustomLicense("name", "uri");

        expect(
          await contract.getLicenseName()
        ).to.equal('name');
      });

      it(`should not allow to set a custom license by anybody`, async function() {
        await expect(
          userActingContract.setCustomLicense("name", "uri")
        ).to.have.revertedWith("Licensable_MissingPermission()")
      });
    });

    describe('A16Z CantBeEvil', () => {

      const a16zBaseUri = 'ar://_D9kN1WrNWbCq55BSAGRbTB4bS3v8QAPTYmBThSbX3A/';
      const a16zLicenseTypes = ['CBE_CC0', 'CBE_ECR', 'CBE_NECR', 'CBE_NECR_HS', 'CBE_PR', 'CBE_PR_HS'];

      for (const [index, licenseType] of a16zLicenseTypes.entries()) {
        describe(licenseType, () => {
          it(`getLicenseURI should return the proper URI`, async function() {
            await contract.setLicenseType(index);

            expect(
              await contract.getLicenseURI()
            ).to.equal(`${a16zBaseUri}${index}`);
          });

          it(`getLicenseName should return the proper name`, async function() {
            await contract.setLicenseType(index);

            expect(
              await contract.getLicenseName()
            ).to.equal(licenseType);
          });
        });
      }
    });
  });
});
