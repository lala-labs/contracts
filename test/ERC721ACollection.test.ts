import { ContractFactory, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { ERC721ACollectionImpl } from '../typechain-types';
import { expect } from 'chai';

describe('ERC721ACollectionImpl', function() {

  let factory: ContractFactory;
  let contract: ERC721ACollectionImpl;
  let contractAsUser: ERC721ACollectionImpl;

  let owner: Signer;
  let ownerAddress: string;

  let user: Signer;
  let userAddress: string;

  let royaltyRecipient: Signer;
  let royaltyRecipientAddress: string;

  let addrs: Signer[];

  const DEFAULT_TARGET_SUPPLY = 1000;

  const DEFAULT_BASE_URI = 'uri://';

  before(async function() {
    factory = await ethers.getContractFactory('ERC721ACollectionImpl');
    [owner, user, royaltyRecipient, ...addrs] = await ethers.getSigners();

    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();
    royaltyRecipientAddress = await royaltyRecipient.getAddress();
  });

  beforeEach(async function() {
    contract = await factory.deploy(
      'TestCollection',
      'TEST',
      DEFAULT_BASE_URI,
      DEFAULT_TARGET_SUPPLY,
      royaltyRecipientAddress,
      0 // CBE_CC0
    ) as ERC721ACollectionImpl;
    await contract.deployed();

    contractAsUser = contract.connect(user);
  });

  describe('Name and Symbol', () => {
    it('should return the proper contract name', async () => {
      expect(await contract.name()).to.equal('TestCollection');
    });

    it('should return the proper token symbol', async () => {
      expect(await contract.symbol()).to.equal('TEST');
    });
  });

  describe('baseUri', () => {

    it('should return the default base uri', async function() {
      expect(await contract.baseUri()).to.equal(DEFAULT_BASE_URI);
    });

    it('should allow to set the base uri', async function() {
      const newBaseUri = 'newUri://';

      await contract.setBaseUri(newBaseUri);

      expect(await contract.baseUri()).to.equal(newBaseUri);
    });

    it('should not allow to set the base uri by anyone', async function() {
      await expect(
        contractAsUser.setBaseUri('userBaseUri://')
      ).to.have.revertedWith('ERC721ACollection_MissingPermission()');
    });

    it('should allow to lock the base uri', async function() {
      await contract.lockBaseUri();

      await expect(
        contract.setBaseUri('newUri://')
      ).to.have.revertedWith('ERC721ACollection_BaseUriLocked()');
    });

    it('should not allow to lock the base uri by anyone', async function() {
      await expect(
        contractAsUser.lockBaseUri()
      ).to.have.revertedWith('ERC721ACollection_MissingPermission()');
    });
  });

  describe('Minting', () => {
    it('should mint tokens with a start index of 1', async () => {
      await contract.mint(ownerAddress, 1);

      expect(
        await contract.ownerOf(1)
      ).to.equal(ownerAddress);
    });

    it('should return totalMinted', async () => {
      await contract.mint(ownerAddress, 10);
      await contractAsUser.mint(ownerAddress, 10);

      expect(
        await contract.totalMinted()
      ).to.equal(20);
    });

    it('should return targetSupply', async () => {
      expect(
        await contract.targetSupply()
      ).to.equal(DEFAULT_TARGET_SUPPLY);
    });

    it('should keep extra data upon transfers', async () => {
      await contract.mintWithExtraData(ownerAddress, 1, 42);

      // ERC721A by default clears the extra data upon transfer unless implemented
      await contract.transferFrom(ownerAddress, userAddress, 1);
      await contractAsUser.transferFrom(userAddress, ownerAddress, 1);

      const { addr, extraData } = await contract.explicitOwnershipOf(1);
      expect(extraData).to.equal(42);
      expect(addr).to.equal(ownerAddress);
    });
  });

  describe('Target Supply', () => {
    it('should allow to reduce the supply', async function() {
      expect((await contract.targetSupply()).toNumber()).to.equal(DEFAULT_TARGET_SUPPLY);

      const newTargetSupply = DEFAULT_TARGET_SUPPLY / 2;
      expect(await contract.adjustTargetSupply(newTargetSupply));

      expect((await contract.targetSupply()).toNumber()).to.equal(newTargetSupply);
    });

    it('should not allow to inflate the supply', async function() {
      expect((await contract.targetSupply()).toNumber()).to.equal(DEFAULT_TARGET_SUPPLY);

      const newTargetSupply = DEFAULT_TARGET_SUPPLY * 2;
      await expect(
        contract.adjustTargetSupply(newTargetSupply)
      ).to.have.revertedWith('SupplyIncreaseBlocked()');
    });

    it('should not allow to reduce the supply by anyone', async function() {
      await expect(
        contractAsUser.adjustTargetSupply(1)
      ).to.have.revertedWith('ERC721ACollection_MissingPermission()');
    });

    it('should not allow to reduce the supply to lower than already minted supply', async function() {
      expect((await contract.targetSupply()).toNumber()).to.equal(DEFAULT_TARGET_SUPPLY);

      const mintedSupply = 10;
      await contract.mint(ownerAddress, mintedSupply);

      await expect(
        contract.adjustTargetSupply(mintedSupply - 1)
      ).to.have.revertedWith('BelowMintedSupply()');
    });
  });

  describe('License', () => {
    it('should have a license set', async () => {
      expect(
        await contract.getLicenseName()
      ).to.equal('CBE_CC0');
    });
  });

  describe('Royalties', () => {
    it('should have default royalties set at 5%', async () => {
      const [receiver, amount] = await contract.royaltyInfo(1, 10_000);
      expect(receiver).to.equal(royaltyRecipientAddress);
      expect(amount).to.equal(500);
    });

    it('should allow to set default royalties', async () => {
      const newRoyaltyRecipientAddress = await addrs[10].getAddress();
      await contract.setDefaultRoyalty(newRoyaltyRecipientAddress, 1_000);

      const [receiver, amount] = await contract.royaltyInfo(1, 10_000);
      expect(receiver).to.equal(newRoyaltyRecipientAddress);
      expect(amount).to.equal(1_000);
    });

    it('should not allow to set default royalties by anyone', async () => {
      await expect(
        contractAsUser.setDefaultRoyalty(royaltyRecipientAddress, 1_000)
      ).to.have.revertedWith('ERC721ACollection_MissingPermission()');
    });

    it('should not allow to set default royalties over the limit', async () => {
      const upperLimit = (await contract.royaltyUpperLimitBps()).toNumber();
      await expect(
        contract.setDefaultRoyalty(royaltyRecipientAddress, upperLimit + 1)
      ).to.have.revertedWith('ERC721ACollection_OverRoyaltyLimit()');
    });
  });

  describe('Guardian', () => {

    describe('setApprovalForAll', () => {
      it('should allow `setApprovalForAll` by default', async function() {
        const operatorAddress = await addrs[10].getAddress();

        await contractAsUser.setApprovalForAll(operatorAddress, true);
        expect(await contract.isApprovedForAll(userAddress, operatorAddress)).to.be.true;
      });

      it('should not allow to grant new approvals when a guardian is set', async function() {
        const guardianAddress = await addrs[11].getAddress();
        const operatorAddress = await addrs[12].getAddress();
        await contractAsUser.setGuardian(guardianAddress);

        await expect(
          contractAsUser.setApprovalForAll(operatorAddress, true)
        ).to.be.revertedWith('LockedByGuardian()');
      });

      it('should allow to revoke approvals when a guardian is set', async function() {
        const guardianAddress = await addrs[11].getAddress();
        const operatorAddress = await addrs[12].getAddress();

        await contractAsUser.setApprovalForAll(operatorAddress, true);
        await contractAsUser.setGuardian(guardianAddress);

        await contractAsUser.setApprovalForAll(operatorAddress, false);

        expect(await contract.isApprovedForAll(userAddress, operatorAddress)).to.be.false;
      });
    });

    describe('approve', () => {
      it('should allow `approve` by default', async function() {
        await contractAsUser.mint(userAddress, 1);
        const operatorAddress = await addrs[10].getAddress();

        await contractAsUser.approve(operatorAddress, 1);
        expect(await contract.getApproved(1)).to.equal(operatorAddress);
      });

      it('should not allow to grant new approvals when a guardian is set', async function() {
        const guardianAddress = await addrs[11].getAddress();
        const operatorAddress = await addrs[12].getAddress();
        await contractAsUser.mint(userAddress, 1);
        await contractAsUser.setGuardian(guardianAddress);

        await expect(
          contractAsUser.approve(operatorAddress, 1)
        ).to.be.revertedWith('LockedByGuardian()');
      });
    });
  });

  // TODO: Withdraw
});
