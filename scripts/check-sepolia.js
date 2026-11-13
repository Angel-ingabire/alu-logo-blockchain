import { network } from "hardhat";

const { ethers, networkName } = await network.create();
const expectedAddress = "0x55D23cA45Eace7E4497C780f89eac62f61421B3E";

async function main() {
  const [signer] = await ethers.getSigners();
  const connectedNetwork = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(signer.address);

  console.log("Active network:", networkName);
  console.log("Connected chain ID:", connectedNetwork.chainId.toString());
  console.log("First signer address:", signer.address);
  console.log("First signer balance (Sepolia ETH):", ethers.formatEther(balance));
  console.log(
    "Matches expected Account 1:",
    signer.address.toLowerCase() === expectedAddress.toLowerCase()
  );
}

main().catch((error) => {
  console.error("Read-only Sepolia diagnostic failed:", error.message);
  process.exitCode = 1;
});
