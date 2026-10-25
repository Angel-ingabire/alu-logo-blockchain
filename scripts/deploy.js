
import { network } from "hardhat";

const { ethers } = await network.create();

const LOGO_HASH =
    "0x407BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with:", deployer.address);

    const registry = await ethers.deployContract("ALUAssetRegistry");
    await registry.waitForDeployment();

    console.log("ALUAssetRegistry deployed to:", await registry.getAddress());

    const token = await ethers.deployContract("ALULogoToken", [
        deployer.address,
    ]);
    await token.waitForDeployment();

    console.log("ALULogoToken deployed to:", await token.getAddress());

    const transaction = await registry.registerAsset(
        "ALU Official Logo",
        "PNG",
        LOGO_HASH
    );

    await transaction.wait();

    console.log("ALU logo registered successfully.");
    console.log("NFT owner:", await registry.ownerOf(1n));

    const asset = await registry.getAsset(1n);
    console.log("Asset name:", asset.assetName);
    console.log("File type:", asset.fileType);
    console.log("SHA-256 hash:", asset.contentHash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
