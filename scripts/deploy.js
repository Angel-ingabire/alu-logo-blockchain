
import fs from "node:fs/promises";
import path from "node:path";
import { network } from "hardhat";

const { ethers, networkName } = await network.create();

const LOGO_HASH =
  "0x407BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE";
const REQUIRED_ACCOUNT_1_ADDRESS = "0x55D23cA45Eace7E4497C780f89eac62f61421B3E";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }
  return value;
}

function normalizeAddress(address) {
  return address.toLowerCase();
}

async function saveDeploymentMetadata(metadata) {
  const deploymentDir = path.resolve(process.cwd(), "deployments");
  await fs.mkdir(deploymentDir, { recursive: true });
  const deploymentPath = path.join(deploymentDir, "sepolia.json");
  await fs.writeFile(deploymentPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`Deployment metadata saved to ${deploymentPath}`);
}

async function main() {
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const privateKey = requireEnv("SEPOLIA_PRIVATE_KEY");
  const expectedOwnerAddress = requireEnv("EXPECTED_OWNER_ADDRESS");

  if (!ethers.isAddress(expectedOwnerAddress)) {
    throw new Error("EXPECTED_OWNER_ADDRESS must be a valid Ethereum address.");
  }

  if (normalizeAddress(expectedOwnerAddress) !== normalizeAddress(REQUIRED_ACCOUNT_1_ADDRESS)) {
    throw new Error(
      `EXPECTED_OWNER_ADDRESS must match the required Account 1 address ${REQUIRED_ACCOUNT_1_ADDRESS}.`
    );
  }

  if (!rpcUrl.startsWith("http://") && !rpcUrl.startsWith("https://")) {
    throw new Error("SEPOLIA_RPC_URL must be a valid HTTP/HTTPS URL.");
  }

  if (!/^(?:0x)?[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("SEPOLIA_PRIVATE_KEY must be a valid 32-byte hex private key.");
  }

  const activeNetwork = networkName;
  if (activeNetwork !== "sepolia") {
    throw new Error(
      `Deployment is blocked: this script must run against the Sepolia network, not ${activeNetwork}.`
    );
  }

  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== 11155111n) {
    throw new Error(
      `Deployment is blocked: expected Sepolia chain ID 11155111 but received ${networkInfo.chainId}.`
    );
  }

  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;

  if (normalizeAddress(deployerAddress) !== normalizeAddress(expectedOwnerAddress)) {
    throw new Error(
      `Signer mismatch: deployment wallet ${deployerAddress} does not match the required Account 1 address ${expectedOwnerAddress}.`
    );
  }

  console.log("Deploying contracts with signer:", deployerAddress);

  const registry = await ethers.deployContract("ALUAssetRegistry");
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  const registryTx = registry.deploymentTransaction();
  console.log("ALUAssetRegistry deployed to:", registryAddress);

  const token = await ethers.deployContract("ALULogoToken", [deployerAddress]);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  const tokenTx = token.deploymentTransaction();
  console.log("ALULogoToken deployed to:", tokenAddress);

  const ownerAddress = await token.owner();
  if (normalizeAddress(ownerAddress) !== normalizeAddress(expectedOwnerAddress)) {
    throw new Error(
      `Token owner mismatch: expected ${expectedOwnerAddress} but token owner is ${ownerAddress}.`
    );
  }

  const registrationTx = await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);
  await registrationTx.wait();

  const asset = await registry.getAsset(1n);
  if (asset.contentHash.toLowerCase() !== LOGO_HASH.toLowerCase()) {
    throw new Error("Registered ALU logo hash does not match the expected asset hash.");
  }

  console.log("ALU logo registered successfully.");
  console.log("NFT owner:", await registry.ownerOf(1n));
  console.log("Asset name:", asset.assetName);
  console.log("File type:", asset.fileType);
  console.log("SHA-256 hash:", asset.contentHash);

  const metadata = {
    network: activeNetwork,
    chainId: Number(networkInfo.chainId),
    deployedAt: new Date().toISOString(),
    expectedOwner: expectedOwnerAddress,
    deployer: deployerAddress,
    tokenOwner: ownerAddress,
    ALUAssetRegistry: registryAddress,
    ALULogoToken: tokenAddress,
    deploymentTransactions: {
      ALUAssetRegistry: registryTx?.hash ?? null,
      ALULogoToken: tokenTx?.hash ?? null,
      logoRegistration: registrationTx?.hash ?? null,
    },
  };

  await saveDeploymentMetadata(metadata);

  console.log("Deployment summary:");
  console.log(JSON.stringify(metadata, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
