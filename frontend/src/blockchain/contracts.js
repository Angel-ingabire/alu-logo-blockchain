import { Contract } from "ethers";
import { ASSET_REGISTRY_ABI, LOGO_TOKEN_ABI, getContractAddress } from "./config";

export function getRegistryContract(signerOrProvider, chainId) {
  return new Contract(
    getContractAddress("ALUAssetRegistry", chainId),
    ASSET_REGISTRY_ABI,
    signerOrProvider
  );
}

export function getTokenContract(signerOrProvider) {
  return new Contract(
    getContractAddress("ALULogoToken"),
    LOGO_TOKEN_ABI,
    signerOrProvider
  );
}
