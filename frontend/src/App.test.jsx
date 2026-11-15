import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JsonRpcProvider } from "ethers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRegistryContract } from "./blockchain/contracts";
import { computeFileHash } from "./lib/utils";
import App from "./App";

const { mockExampleHolderAddresses, mockWalletChainId } = vi.hoisted(() => ({
  mockExampleHolderAddresses: [],
  mockWalletChainId: { value: 11155111n },
}));

const MOCK_HASH = "0x407be7b9ac994bcca2ab5e0c901b6471a149aa08fc9201f7bf546e6852fb9dde";
const SEPOLIA_RPC_URL = "https://sepolia.read-only.test";
const MOCK_OWNER = "0x1111111111111111111111111111111111111111";
const MOCK_HOLDER = "0x2222222222222222222222222222222222222222";
const MOCK_RECIPIENT = "0x3333333333333333333333333333333333333333";

const mockTokenContract = {
  balanceOf: vi.fn(),
  totalSupply: vi.fn(),
  decimals: vi.fn(),
  owner: vi.fn(),
  ownershipPercentage: vi.fn(),
  queryFilter: vi.fn(),
  filters: { Transfer: vi.fn() },
  distributeShares: vi.fn(),
};

const mockRegistryContract = {
  queryFilter: vi.fn(),
  registerAsset: vi.fn(),
  verifyLogoIntegrity: vi.fn(),
  getAsset: vi.fn(),
};

vi.mock("ethers", async () => {
  const actual = await vi.importActual("ethers");

  return {
    ...actual,
    BrowserProvider: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue([MOCK_OWNER]),
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(MOCK_OWNER),
      }),
      getNetwork: vi.fn().mockImplementation(() => ({
        chainId: mockWalletChainId.value,
        name: mockWalletChainId.value === 11155111n ? "Ethereum Sepolia" : "Hardhat Local",
      })),
    })),
    JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock("./blockchain/config", () => ({
  ACTIVE_NETWORK: { chainId: 11155111, name: "Ethereum Sepolia", rpcUrl: "https://sepolia.read-only.test", currency: "ETH" },
  SEPOLIA_NETWORK: { chainId: 11155111, name: "Ethereum Sepolia", rpcUrl: "https://sepolia.read-only.test", currency: "ETH" },
  SEPOLIA_TOKEN_HOLDER_ADDRESSES: mockExampleHolderAddresses,
}));

vi.mock("./blockchain/contracts", () => ({
  getRegistryContract: vi.fn(() => mockRegistryContract),
  getTokenContract: vi.fn(() => mockTokenContract),
}));

vi.mock("./lib/utils", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    computeFileHash: vi.fn(async () => MOCK_HASH),
    formatDate: vi.fn(() => "Jan 1, 2024"),
  };
});

describe("ALU dApp frontend requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExampleHolderAddresses.splice(0, mockExampleHolderAddresses.length);
    mockWalletChainId.value = 11155111n;

    window.ethereum = {
      on: vi.fn(),
      removeListener: vi.fn(),
      request: vi.fn(),
    };

    mockTokenContract.balanceOf.mockImplementation(async (address) => {
      if (address.toLowerCase() === MOCK_OWNER.toLowerCase()) {
        return 500000n * 10n ** 18n;
      }
      if (address.toLowerCase() === MOCK_HOLDER.toLowerCase()) {
        return 300000n * 10n ** 18n;
      }
      if (address.toLowerCase() === MOCK_RECIPIENT.toLowerCase()) {
        return 200000n * 10n ** 18n;
      }
      return 0n;
    });
    mockTokenContract.totalSupply.mockResolvedValue(1000000n * 10n ** 18n);
    mockTokenContract.decimals.mockResolvedValue(18n);
    mockTokenContract.owner.mockResolvedValue(MOCK_OWNER);
    mockTokenContract.ownershipPercentage.mockImplementation(async (address) => {
      if (address.toLowerCase() === MOCK_OWNER.toLowerCase()) return 50n;
      if (address.toLowerCase() === MOCK_HOLDER.toLowerCase()) return 30n;
      if (address.toLowerCase() === MOCK_RECIPIENT.toLowerCase()) return 20n;
      return 0n;
    });
    mockTokenContract.distributeShares.mockResolvedValue({ wait: async () => ({}) });

    mockRegistryContract.getAsset.mockResolvedValue({
      assetName: "ALU Official Logo",
      fileType: "PNG",
      contentHash: MOCK_HASH,
      registeredBy: MOCK_OWNER,
      registeredAt: 1735689600n,
    });
    mockRegistryContract.verifyLogoIntegrity.mockResolvedValue([true, "Logo is authentic."]);
  });

  it("renders the total ALUT supply for the connected wallet", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/1,000,000/i).length).toBeGreaterThan(0);
    });
  });

  it("does not scan Transfer history and explains when no verified example addresses are configured", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    await waitFor(() => {
      expect(mockTokenContract.balanceOf).toHaveBeenCalledWith(MOCK_OWNER.toLowerCase());
      expect(screen.getByText(/No verified example holder addresses are configured/i)).toBeInTheDocument();
    });

    expect(mockTokenContract.queryFilter).not.toHaveBeenCalled();
  });

  it("displays the connected wallet balance and contract ownership percentage", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText("Your ALUT balance").parentElement).toHaveTextContent("500,000");
      expect(screen.getByText("Ownership share").parentElement).toHaveTextContent("50%");
    });

    expect(mockTokenContract.ownershipPercentage).toHaveBeenCalledWith(MOCK_OWNER);
  });

  it("displays three configured example holders using their on-chain balances and supply share", async () => {
    mockExampleHolderAddresses.push(MOCK_OWNER, MOCK_HOLDER, MOCK_RECIPIENT);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Configured example holder")).toHaveLength(3);
    });

    expect(screen.getByText(`Balance: 500,000 ALUT`)).toBeInTheDocument();
    expect(screen.getByText("Ownership: 50%")).toBeInTheDocument();
    expect(screen.getByText("Balance: 300,000 ALUT")).toBeInTheDocument();
    expect(screen.getByText("Ownership: 30%")).toBeInTheDocument();
    expect(screen.getByText("Balance: 200,000 ALUT")).toBeInTheDocument();
    expect(screen.getByText("Ownership: 20%")).toBeInTheDocument();
    expect(mockTokenContract.balanceOf).toHaveBeenCalledWith(MOCK_OWNER);
    expect(mockTokenContract.balanceOf).toHaveBeenCalledWith(MOCK_HOLDER);
    expect(mockTokenContract.balanceOf).toHaveBeenCalledWith(MOCK_RECIPIENT);
  });

  it("formats balances using the token's decimals without losing fractional units", async () => {
    mockTokenContract.decimals.mockResolvedValue(6n);
    mockTokenContract.totalSupply.mockResolvedValue(1000000000000n);
    mockTokenContract.balanceOf.mockImplementation(async (address) =>
      address.toLowerCase() === MOCK_OWNER.toLowerCase() ? 250000250000n : 0n
    );
    mockTokenContract.ownershipPercentage.mockResolvedValue(25n);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText("Your ALUT balance").parentElement).toHaveTextContent("250,000.25");
      expect(screen.getByText("Ownership share").parentElement).toHaveTextContent("25%");
    });
  });

  it("ignores invalid and duplicate configured holder addresses and reports the short list", async () => {
    mockExampleHolderAddresses.push(
      "not-an-address",
      MOCK_HOLDER,
      "0x0000000000000000000000000000000000000000",
      MOCK_HOLDER
    );
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid or zero addresses ignored/i)).toBeInTheDocument();
      expect(screen.getByText(/duplicate address(?:es)? ignored/i)).toBeInTheDocument();
      expect(screen.getByText(/Only 1 valid example holder address configured/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText("Configured example holder")).toHaveLength(1);
    expect(mockTokenContract.balanceOf).toHaveBeenCalledWith(MOCK_HOLDER);
  });

  it("clears wallet-specific dashboard data when the wallet disconnects", async () => {
    mockExampleHolderAddresses.push(MOCK_OWNER, MOCK_HOLDER, MOCK_RECIPIENT);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));
    await screen.findByText("Ownership: 50%");

    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));

    await waitFor(() => {
      expect(screen.getByText("Your ALUT balance").parentElement).toHaveTextContent("Not connected");
      expect(screen.getByText("Ownership share").parentElement).toHaveTextContent("Not connected");
    });

    expect(screen.queryByText("Configured example holder")).not.toBeInTheDocument();
  });

  it("clears stale dashboard values after a network change", async () => {
    mockExampleHolderAddresses.push(MOCK_OWNER);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));
    await screen.findByText("Ownership: 50%");

    mockWalletChainId.value = 31337n;
    const chainChangedHandler = window.ethereum.on.mock.calls.find(
      ([eventName]) => eventName === "chainChanged"
    )[1];
    await act(async () => {
      await chainChangedHandler("0x7a69");
    });

    await waitFor(() => {
      expect(screen.getByText("Your ALUT balance").parentElement).toHaveTextContent("Unavailable");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Switch MetaMask to Ethereum Sepolia to load current ALUT token data."
      );
    });
  });

  it("shows a technical dashboard error when token reads fail", async () => {
    mockTokenContract.totalSupply.mockResolvedValue(
      Promise.reject(new Error("RPC unavailable"))
    );
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((a) => a.textContent.includes("RPC unavailable"))).toBe(true);
  });

  it("hashes a selected file and shows the browser SHA-256 digest", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /register asset/i }));

    const fileInput = document.querySelectorAll('input[type="file"]')[0];
    const file = new File(["ALU logo content"], "alu-logo.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(MOCK_HASH)).toBeInTheDocument();
    });
  });

  it("verifies an uploaded image hash directly without a wallet or transaction", async () => {
    window.ethereum = undefined;
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["ALU logo content"], "alu-logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0x...")).toHaveValue(MOCK_HASH);
      expect(screen.getByText(MOCK_HASH)).toBeInTheDocument();
    });
    expect(computeFileHash).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText("Verified: this image or hash matches the registered official ALU logo.")).toBeInTheDocument();
    });

    expect(JsonRpcProvider).toHaveBeenCalledWith(SEPOLIA_RPC_URL);
    expect(getRegistryContract).toHaveBeenCalledWith(expect.any(Object), 11155111);
    expect(mockRegistryContract.verifyLogoIntegrity).toHaveBeenCalledWith(2n, MOCK_HASH);
    expect(mockRegistryContract.getAsset).toHaveBeenCalledWith(2n);
    expect(mockRegistryContract.queryFilter).not.toHaveBeenCalled();
    expect(screen.getByText("Asset ID:", { exact: true }).parentElement).toHaveTextContent("Asset ID: 2");
    expect(screen.getByText("Asset name:", { exact: true }).parentElement).toHaveTextContent("ALU Official Logo");
    expect(screen.getByText("Registered by:", { exact: true }).parentElement).toHaveTextContent(MOCK_OWNER);
    expect(screen.getByText("Registered at:", { exact: true }).parentElement).toHaveTextContent("Jan 1, 2024");
    expect(mockRegistryContract.registerAsset).not.toHaveBeenCalled();
    expect(mockTokenContract.distributeShares).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("reports a valid non-matching hash without treating it as an RPC failure", async () => {
    window.ethereum = undefined;
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);

    const unregisteredHash = "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";
    mockRegistryContract.verifyLogoIntegrity.mockResolvedValue([false, "Warning: logo does not match."]);
    fireEvent.change(screen.getByRole("textbox", { name: /sha-256 hash to verify/i }), {
      target: { value: unregisteredHash },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText("Verification failed: the submitted image or hash does not match the registered official ALU logo.")).toBeInTheDocument();
    });

    expect(mockRegistryContract.verifyLogoIntegrity).toHaveBeenCalledWith(
      2n,
      `0x${unregisteredHash.toLowerCase()}`
    );
    expect(mockRegistryContract.getAsset).not.toHaveBeenCalled();
    expect(mockRegistryContract.queryFilter).not.toHaveBeenCalled();
    expect(screen.queryByText(/Unable to verify against the Sepolia/i)).not.toBeInTheDocument();
    expect(mockRegistryContract.registerAsset).not.toHaveBeenCalled();
    expect(mockTokenContract.distributeShares).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("rejects malformed hashes before creating a provider or calling the contract", async () => {
    window.ethereum = undefined;
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: /sha-256 hash to verify/i }), {
      target: { value: "not-a-hash" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText(/exactly 32 bytes long/)).toBeInTheDocument();
    });

    expect(JsonRpcProvider).not.toHaveBeenCalled();
    expect(getRegistryContract).not.toHaveBeenCalled();
    expect(mockRegistryContract.verifyLogoIntegrity).not.toHaveBeenCalled();
  });

  it("shows a technical message when the contract or RPC call fails", async () => {
    window.ethereum = undefined;
    mockRegistryContract.verifyLogoIntegrity.mockRejectedValue(new Error("RPC timeout"));
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: /sha-256 hash to verify/i }), {
      target: { value: MOCK_HASH },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText(/Unable to verify against the Sepolia ALU registry\. RPC timeout/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Verification failed: the submitted image or hash does not match/)).not.toBeInTheDocument();
    expect(mockRegistryContract.verifyLogoIntegrity).toHaveBeenCalledWith(2n, MOCK_HASH);
  });

  it("keeps a matching verification successful when asset metadata cannot be loaded", async () => {
    window.ethereum = undefined;
    mockRegistryContract.getAsset.mockRejectedValue(new Error("metadata unavailable"));
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: /sha-256 hash to verify/i }), {
      target: { value: MOCK_HASH },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText(/Verified: this image or hash/)).toBeInTheDocument();
      expect(screen.getByText(/Asset metadata could not be loaded: metadata unavailable/)).toBeInTheDocument();
    });

    expect(screen.getByText("Asset metadata is unavailable.")).toBeInTheDocument();
  });

  it("disables the verification button while the contract call is pending", async () => {
    window.ethereum = undefined;
    let resolveVerification;
    mockRegistryContract.verifyLogoIntegrity.mockImplementation(
      () => new Promise((resolve) => {
        resolveVerification = resolve;
      })
    );
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: /sha-256 hash to verify/i }), {
      target: { value: MOCK_HASH },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    const verifyingButton = screen.getByRole("button", { name: /verifying/i });
    expect(verifyingButton).toBeDisabled();
    resolveVerification([false, "Warning: logo does not match."]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /verify logo/i })).toBeEnabled();
    });
  });

  it("clears a previous verification result when the input changes", async () => {
    window.ethereum = undefined;
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);
    const hashInput = screen.getByRole("textbox", { name: /sha-256 hash to verify/i });
    fireEvent.change(hashInput, { target: { value: MOCK_HASH } });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText(/Verified: this image or hash/)).toBeInTheDocument();
    });

    fireEvent.change(hashInput, { target: { value: "different value" } });
    expect(screen.queryByText(/Verified: this image or hash/)).not.toBeInTheDocument();
  });

  it("refreshes the connected wallet balance after a token distribution without a full historical holder scan", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0x...")).toBeInTheDocument();
      expect(screen.getByText(/No verified example holder addresses are configured/i)).toBeInTheDocument();
    });

    mockTokenContract.balanceOf.mockImplementation(async (address) => {
      if (address.toLowerCase() === MOCK_OWNER.toLowerCase()) return 750000n * 10n ** 18n;
      return 250000n * 10n ** 18n;
    });
    mockTokenContract.ownershipPercentage.mockImplementation(async (address) => {
      if (address.toLowerCase() === MOCK_OWNER.toLowerCase()) return 75n;
      if (address.toLowerCase() === MOCK_RECIPIENT.toLowerCase()) return 25n;
      return 0n;
    });

    const recipientInput = screen.getAllByPlaceholderText("0x...")[0];
    const amountInput = screen.getByPlaceholderText("250000");
    fireEvent.change(recipientInput, { target: { value: MOCK_RECIPIENT } });
    fireEvent.change(amountInput, { target: { value: "250000" } });
    fireEvent.click(screen.getByRole("button", { name: /distribute shares/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Success: 250000 ALUT was distributed/i).length).toBeGreaterThan(0);
      expect(mockTokenContract.balanceOf).toHaveBeenCalledWith(MOCK_RECIPIENT.toLowerCase());
    });
  });

  it("rejects invalid recipients and non-positive amounts before sending", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    const recipientInput = screen.getAllByPlaceholderText("0x...")[0];
    const amountInput = screen.getByPlaceholderText("250000");
    fireEvent.change(recipientInput, { target: { value: "not-an-address" } });
    fireEvent.change(amountInput, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /distribute shares/i }));

    await waitFor(() => {
      expect(screen.getByText("Enter a valid recipient wallet address.")).toBeInTheDocument();
    });
    expect(mockTokenContract.distributeShares).not.toHaveBeenCalled();

    fireEvent.change(recipientInput, { target: { value: MOCK_RECIPIENT } });
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /distribute shares/i }));

    await waitFor(() => {
      expect(screen.getByText("The amount must be greater than zero.")).toBeInTheDocument();
    });
    expect(mockTokenContract.distributeShares).not.toHaveBeenCalled();
  });

  it("rejects a distribution larger than the owner's balance", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    fireEvent.change(screen.getAllByPlaceholderText("0x...")[0], {
      target: { value: MOCK_RECIPIENT },
    });
    fireEvent.change(screen.getByPlaceholderText("250000"), {
      target: { value: "1000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /distribute shares/i }));

    await waitFor(() => {
      expect(screen.getByText("Insufficient ALUT balance for this distribution.")).toBeInTheDocument();
    });
    expect(mockTokenContract.distributeShares).not.toHaveBeenCalled();
  });
});
