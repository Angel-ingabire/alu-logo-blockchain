
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const LOGO_HASH =
    "0x407BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE";

describe("ALUAssetRegistry", function () {
    async function deployRegistry() {
        const registry = await ethers.deployContract("ALUAssetRegistry");
        return registry;
    }

    it("should register the ALU logo as an NFT", async function () {
        const [owner] = await ethers.getSigners();
        const registry = await deployRegistry();

        await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);

        expect(await registry.ownerOf(1n)).to.equal(owner.address);
        expect(await registry.registeredHashes(LOGO_HASH)).to.equal(true);
    });

    it("should reject a duplicate logo hash", async function () {
        const registry = await deployRegistry();

        await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);

        await expect(
            registry.registerAsset("Duplicate Logo", "PNG", LOGO_HASH)
        ).to.be.revertedWith("Asset hash already registered");
    });

    it("should confirm the logo when the supplied hash is correct", async function () {
        const registry = await deployRegistry();

        await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);

        const result = await registry.verifyLogoIntegrity(1n, LOGO_HASH);

        expect(result[0]).to.equal(true);
        expect(result[1]).to.equal("Logo is authentic.");
    });

    it("should warn when the supplied logo hash is incorrect", async function () {
        const registry = await deployRegistry();

        await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);

        const wrongHash =
            "0x507BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE";

        const result = await registry.verifyLogoIntegrity(1n, wrongHash);

        expect(result[0]).to.equal(false);
        expect(result[1]).to.equal("Warning: logo does not match.");
    });

    it("should return the correct asset name and file type", async function () {
        const [owner] = await ethers.getSigners();
        const registry = await deployRegistry();

        await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);

        const asset = await registry.getAsset(1n);

        expect(asset.assetName).to.equal("ALU Official Logo");
        expect(asset.fileType).to.equal("PNG");
        expect(asset.contentHash.toLowerCase()).to.equal(LOGO_HASH.toLowerCase());
        expect(asset.registeredBy).to.equal(owner.address);
        expect(asset.registeredAt).to.be.greaterThan(0n);
    });
});

describe("ALULogoToken", function () {
    async function deployToken() {
        const [owner] = await ethers.getSigners();
        const token = await ethers.deployContract("ALULogoToken", [
            owner.address,
        ]);

        return { token, owner };
    }

    it("should mint the full supply of one million ALUT tokens", async function () {
        const { token, owner } = await deployToken();

        const expectedSupply = ethers.parseUnits("1000000", 18);

        expect(await token.totalSupply()).to.equal(expectedSupply);
        expect(await token.balanceOf(owner.address)).to.equal(expectedSupply);
        expect(await token.name()).to.equal("ALU Logo Token");
        expect(await token.symbol()).to.equal("ALUT");
    });

    it("should allow the owner to distribute tokens", async function () {
        const { token } = await deployToken();
        const [, recipient] = await ethers.getSigners();
        const amount = ethers.parseUnits("250000", 18);

        await token.distributeShares(recipient.address, amount);

        expect(await token.balanceOf(recipient.address)).to.equal(amount);
    });

    it("should calculate the ownership percentage correctly", async function () {
        const { token, owner } = await deployToken();
        const [, recipient] = await ethers.getSigners();

        const amount = ethers.parseUnits("250000", 18);
        await token.distributeShares(recipient.address, amount);

        expect(await token.ownershipPercentage(owner.address)).to.equal(75n);
        expect(await token.ownershipPercentage(recipient.address)).to.equal(25n);
    });
});
