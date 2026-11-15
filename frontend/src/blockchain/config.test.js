import { afterEach, describe, expect, it, vi } from "vitest";

const DEFAULT_REGISTRY_ADDRESS = "0x93B4124B9673f520457577819B525E40abEc8F57";
const DEFAULT_TOKEN_ADDRESS = "0xc83E78175eD2c5f07Dcc8143D153cbB181d57730";

async function loadConfig() {
  vi.resetModules();
  return import("./config.js");
}

describe("Sepolia frontend configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the recorded deployment and public RPC defaults when settings are absent", async () => {
    vi.stubEnv("VITE_NETWORK", "sepolia");

    const config = await loadConfig();

    expect(config.ACTIVE_NETWORK.chainId).toBe(11155111);
    expect(config.ACTIVE_NETWORK.rpcUrl).toBe("https://ethereum-sepolia-rpc.publicnode.com");
    expect(config.getContractAddress("ALUAssetRegistry", 11155111)).toBe(DEFAULT_REGISTRY_ADDRESS);
    expect(config.getContractAddress("ALULogoToken", 11155111)).toBe(DEFAULT_TOKEN_ADDRESS);
    expect(config.SEPOLIA_TOKEN_HOLDER_ADDRESSES).toEqual([]);
  });

  it("accepts valid Sepolia RPC and contract address overrides", async () => {
    vi.stubEnv("VITE_NETWORK", "sepolia");
    vi.stubEnv("VITE_SEPOLIA_RPC_URL", "https://sepolia.publicnode.com");
    vi.stubEnv("VITE_SEPOLIA_ALU_ASSET_REGISTRY", "0x1111111111111111111111111111111111111111");
    vi.stubEnv("VITE_SEPOLIA_ALU_LOGO_TOKEN", "0x2222222222222222222222222222222222222222");

    const config = await loadConfig();

    expect(config.ACTIVE_NETWORK.rpcUrl).toBe("https://sepolia.publicnode.com");
    expect(config.getContractAddress("ALUAssetRegistry", 11155111)).toBe("0x1111111111111111111111111111111111111111");
    expect(config.getContractAddress("ALULogoToken", 11155111)).toBe("0x2222222222222222222222222222222222222222");
  });

  it("parses configured example holder addresses without supplying defaults", async () => {
    vi.stubEnv(
      "VITE_SEPOLIA_TOKEN_HOLDER_ADDRESSES",
      "0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222"
    );

    const config = await loadConfig();

    expect(config.SEPOLIA_TOKEN_HOLDER_ADDRESSES).toEqual([
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ]);
  });

  it("rejects configured RPC URLs that do not use HTTP or HTTPS", async () => {
    vi.stubEnv("VITE_NETWORK", "sepolia");
    vi.stubEnv("VITE_SEPOLIA_RPC_URL", "file:///tmp/provider");

    await expect(loadConfig()).rejects.toThrow("must use HTTP or HTTPS");
  });
});
