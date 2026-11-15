import assetRegistryArtifact from "../../../artifacts/contracts/ALUAssetRegistry.sol/ALUAssetRegistry.json";
import logoTokenArtifact from "../../../artifacts/contracts/ALULogoToken.sol/ALULogoToken.json";

export const ASSET_REGISTRY_ABI = assetRegistryArtifact.abi;
export const LOGO_TOKEN_ABI = logoTokenArtifact.abi;

const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_SEPOLIA_ADDRESSES = {
  ALUAssetRegistry: "0x93B4124B9673f520457577819B525E40abEc8F57",
  ALULogoToken: "0xc83E78175eD2c5f07Dcc8143D153cbB181d57730",
};
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isPlaceholder(value) {
  return !value || /example|placeholder|your[_-]?|\.{3}/i.test(value.trim());
}

function getSepoliaRpcUrl() {
  const configuredUrl = import.meta.env.VITE_SEPOLIA_RPC_URL?.trim();
  if (isPlaceholder(configuredUrl)) {
    return DEFAULT_SEPOLIA_RPC_URL;
  }

  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("VITE_SEPOLIA_RPC_URL must be a valid public HTTP or HTTPS URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_SEPOLIA_RPC_URL must use HTTP or HTTPS.");
  }

  return configuredUrl;
}

function getSepoliaAddress(name, variableName, environmentValue) {
  const configuredAddress = environmentValue?.trim();
  if (isPlaceholder(configuredAddress) || configuredAddress?.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return DEFAULT_SEPOLIA_ADDRESSES[name];
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(configuredAddress)) {
    throw new Error(`${variableName} must be a valid Ethereum address.`);
  }

  return configuredAddress;
}

export const LOCAL_NETWORK = {
  chainId: 31337,
  name: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
  currency: "ETH",
};

function getSelectedNetworkName() {
  const networkName = import.meta.env.VITE_NETWORK?.toLowerCase();
  return networkName === "sepolia" || networkName === "local" ? networkName : "local";
}

export const SEPOLIA_NETWORK = {
  chainId: 11155111,
  name: "Ethereum Sepolia",
  rpcUrl: getSepoliaRpcUrl(),
  currency: "ETH",
};

export const SEPOLIA_TOKEN_HOLDER_ADDRESSES = (
  import.meta.env.VITE_SEPOLIA_TOKEN_HOLDER_ADDRESSES || ""
)
  .split(",")
  .map((address) => address.trim())
  .filter(Boolean);

export const NETWORKS = {
  local: LOCAL_NETWORK,
  sepolia: SEPOLIA_NETWORK,
};

export const ACTIVE_NETWORK =
  NETWORKS[getSelectedNetworkName()] ?? LOCAL_NETWORK;

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
    ALUAssetRegistry: getSepoliaAddress(
      "ALUAssetRegistry",
      "VITE_SEPOLIA_ALU_ASSET_REGISTRY",
      import.meta.env.VITE_SEPOLIA_ALU_ASSET_REGISTRY
    ),
    ALULogoToken: getSepoliaAddress(
      "ALULogoToken",
      "VITE_SEPOLIA_ALU_LOGO_TOKEN",
      import.meta.env.VITE_SEPOLIA_ALU_LOGO_TOKEN
    ),
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
