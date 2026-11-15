
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

    it("should reject invalid token IDs when verifying or reading asset metadata", async function () {
        const registry = await deployRegistry();

        await expect(
            registry.verifyLogoIntegrity(999n, LOGO_HASH)
        ).to.be.revertedWith("Asset does not exist");
        await expect(registry.getAsset(999n)).to.be.revertedWith(
            "Asset does not exist"
        );
    });

    it("should reject empty metadata and a zero content hash", async function () {
        const registry = await deployRegistry();
        const zeroHash = `0x${"0".repeat(64)}`;

        await expect(
            registry.registerAsset("", "PNG", LOGO_HASH)
        ).to.be.revertedWith("Asset name is required");
        await expect(
            registry.registerAsset("ALU Official Logo", "", LOGO_HASH)
        ).to.be.revertedWith("File type is required");
        await expect(
            registry.registerAsset("ALU Official Logo", "PNG", zeroHash)
        ).to.be.revertedWith("Content hash is required");
    });

    it("should prevent a receiver from registering the same hash reentrantly", async function () {
        const registry = await deployRegistry();
        const receiver = await ethers.deployContract("AssetRegistryReceiver", [
            await registry.getAddress(),
            LOGO_HASH,
            false,
        ]);

        await receiver.registerInitialAsset();

        expect(await receiver.reentrantRegistrationSucceeded()).to.equal(false);
        expect(await receiver.reentrantDuplicateRejected()).to.equal(true);
        expect(await registry.balanceOf(await receiver.getAddress())).to.equal(1n);
        expect(await registry.registeredHashes(LOGO_HASH)).to.equal(true);
    });

    it("should roll back registry state when the receiver rejects a mint", async function () {
        const [owner] = await ethers.getSigners();
        const registry = await deployRegistry();
        const receiver = await ethers.deployContract("AssetRegistryReceiver", [
            await registry.getAddress(),
            LOGO_HASH,
            true,
        ]);

        await expect(receiver.registerInitialAsset()).to.revert(ethers);
        expect(await registry.registeredHashes(LOGO_HASH)).to.equal(false);
        await expect(registry.getAsset(1n)).to.be.revertedWith(
            "Asset does not exist"
        );

        await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);
        expect(await registry.ownerOf(1n)).to.equal(owner.address);
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

    it("should reject distributions from non-owners", async function () {
        const { token } = await deployToken();
        const [, nonOwner, recipient] = await ethers.getSigners();

        await expect(
            token.connect(nonOwner).distributeShares(recipient.address, 1n)
        )
            .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
            .withArgs(nonOwner.address);
    });

    it("should reject zero-address recipients and zero amounts", async function () {
        const { token } = await deployToken();
        const [, recipient] = await ethers.getSigners();

        await expect(
            token.distributeShares(ethers.ZeroAddress, 1n)
        ).to.be.revertedWith("Invalid recipient");
        await expect(
            token.distributeShares(recipient.address, 0n)
        ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("should reject distributions greater than the owner's balance", async function () {
        const { token, owner } = await deployToken();
        const [, recipient] = await ethers.getSigners();
        const supply = await token.totalSupply();

        await expect(token.distributeShares(recipient.address, supply + 1n))
            .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
            .withArgs(owner.address, supply, supply + 1n);
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
