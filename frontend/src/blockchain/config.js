import assetRegistryArtifact from "../../../artifacts/contracts/ALUAssetRegistry.sol/ALUAssetRegistry.json";
import logoTokenArtifact from "../../../artifacts/contracts/ALULogoToken.sol/ALULogoToken.json";

export const ASSET_REGISTRY_ABI = assetRegistryArtifact.abi;
export const LOGO_TOKEN_ABI = logoTokenArtifact.abi;

export const LOCAL_NETWORK = {
  chainId: 31337,
  name: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
  currency: "ETH",
};

export const SEPOLIA_NETWORK = {
  chainId: 11155111,
  name: "Ethereum Sepolia",
  rpcUrl:
    import.meta.env.VITE_SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com",
  currency: "ETH",
};

export const NETWORKS = {
  local: LOCAL_NETWORK,
  sepolia: SEPOLIA_NETWORK,
};

export const ACTIVE_NETWORK =
  NETWORKS[import.meta.env.VITE_NETWORK?.toLowerCase()] ?? LOCAL_NETWORK;

export const CONTRACT_ADDRESSES = {
  31337: {
    ALUAssetRegistry:
      import.meta.env.VITE_ALU_ASSET_REGISTRY ||
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    ALULogoToken:
      import.meta.env.VITE_ALU_LOGO_TOKEN ||
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
  11155111: {
    ALUAssetRegistry:
      import.meta.env.VITE_SEPOLIA_ALU_ASSET_REGISTRY ||
      import.meta.env.VITE_ALU_ASSET_REGISTRY ||
      "0x0000000000000000000000000000000000000000",
    ALULogoToken:
      import.meta.env.VITE_SEPOLIA_ALU_LOGO_TOKEN ||
      import.meta.env.VITE_ALU_LOGO_TOKEN ||
      "0x0000000000000000000000000000000000000000",
  },
};

export function getNetworkConfig(chainId = ACTIVE_NETWORK.chainId) {
  return (
    Object.values(NETWORKS).find((network) => network.chainId === chainId) ??
    LOCAL_NETWORK
  );
}

export function getContractAddress(name, chainId = ACTIVE_NETWORK.chainId) {
  const selected = CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[LOCAL_NETWORK.chainId];

  return selected?.[name] ?? "0x0000000000000000000000000000000000000000";
}
