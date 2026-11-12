import assetRegistryArtifact from "../../artifacts/contracts/ALUAssetRegistry.sol/ALUAssetRegistry.json";
import logoTokenArtifact from "../../artifacts/contracts/ALULogoToken.sol/ALULogoToken.json";

export const ASSET_REGISTRY_ABI = assetRegistryArtifact.abi;
export const LOGO_TOKEN_ABI = logoTokenArtifact.abi;

export const LOCAL_NETWORK = {
  chainId: 31337,
  name: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
  currency: "ETH",
};

export const CONTRACT_ADDRESSES = {
  31337: {
    ALUAssetRegistry:
      import.meta.env.VITE_ALU_ASSET_REGISTRY || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    ALULogoToken:
      import.meta.env.VITE_ALU_LOGO_TOKEN || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
};

export function getContractAddress(name, chainId = 31337) {
  const selected = CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[31337];

  return selected?.[name] ?? "0x0000000000000000000000000000000000000000";
}
