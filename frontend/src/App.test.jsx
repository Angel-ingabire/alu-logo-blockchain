import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const MOCK_HASH = "0x407be7b9ac994bcca2ab5e0c901b6471a149aa08fc9201f7bf546e6852fb9dde";
const MOCK_OWNER = "0x1111111111111111111111111111111111111111";
const MOCK_HOLDER = "0x2222222222222222222222222222222222222222";
const MOCK_RECIPIENT = "0x3333333333333333333333333333333333333333";

const mockTokenContract = {
  balanceOf: vi.fn(),
  totalSupply: vi.fn(),
  owner: vi.fn(),
  ownershipPercentage: vi.fn(),
  queryFilter: vi.fn(),
  filters: { Transfer: vi.fn() },
  distributeShares: vi.fn(),
};

const mockRegistryContract = {
  queryFilter: vi.fn(),
  filters: { AssetRegistered: vi.fn() },
  interface: { parseLog: vi.fn() },
  getAsset: vi.fn(),
  verifyLogoIntegrity: vi.fn(),
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
      getNetwork: vi.fn().mockResolvedValue({ chainId: 31337n, name: "Hardhat Local" }),
    })),
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      queryFilter: vi.fn().mockResolvedValue([{ data: "0x1", topics: ["0x1"] }]),
      interface: { parseLog: vi.fn().mockReturnValue({ args: [1n] }) },
      filters: { AssetRegistered: vi.fn() },
      getAsset: vi.fn().mockResolvedValue({
        assetName: "ALU Official Logo",
        fileType: "PNG",
        contentHash: MOCK_HASH,
        registeredBy: MOCK_OWNER,
        registeredAt: 1710000000n,
      }),
      verifyLogoIntegrity: vi.fn().mockResolvedValue([true, "Logo is authentic."]),
    })),
  };
});

vi.mock("./blockchain/config", () => ({
  ACTIVE_NETWORK: { chainId: 31337, name: "Hardhat Local", rpcUrl: "http://127.0.0.1:8545", currency: "ETH" },
  getNetworkConfig: vi.fn(() => ({ chainId: 31337, name: "Hardhat Local", rpcUrl: "http://127.0.0.1:8545" })),
}));

vi.mock("./blockchain/contracts", () => ({
  getRegistryContract: vi.fn(() => mockRegistryContract),
  getTokenContract: vi.fn(() => mockTokenContract),
}));

vi.mock("./lib/utils", () => ({
  computeFileHash: vi.fn(async () => MOCK_HASH),
  formatAddress: vi.fn((address) => `${address.slice(0, 6)}...${address.slice(-4)}`),
  formatDate: vi.fn(() => "Jan 1, 2024"),
  normalizeHash: vi.fn((hash) => hash),
}));

describe("ALU dApp frontend requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    window.ethereum = {
      on: vi.fn(),
      removeListener: vi.fn(),
      request: vi.fn(),
    };

    mockTokenContract.balanceOf.mockImplementation(async (address) => {
      if (address.toLowerCase() === MOCK_OWNER.toLowerCase()) {
        return 1000000n * 10n ** 18n;
      }
      if (address.toLowerCase() === MOCK_HOLDER.toLowerCase()) {
        return 250000n * 10n ** 18n;
      }
      return 750000n * 10n ** 18n;
    });
    mockTokenContract.totalSupply.mockResolvedValue(1000000n * 10n ** 18n);
    mockTokenContract.owner.mockResolvedValue(MOCK_OWNER);
    mockTokenContract.ownershipPercentage.mockImplementation(async (address) => {
      if (address.toLowerCase() === MOCK_OWNER.toLowerCase()) return 75n;
      if (address.toLowerCase() === MOCK_HOLDER.toLowerCase()) return 25n;
      return 0n;
    });
    mockTokenContract.queryFilter.mockResolvedValue([
      { args: { from: "0x0000000000000000000000000000000000000000", to: MOCK_OWNER } },
      { args: { from: MOCK_OWNER, to: MOCK_HOLDER } },
    ]);
    mockTokenContract.distributeShares.mockResolvedValue({ wait: async () => ({}) });

    mockRegistryContract.queryFilter.mockResolvedValue([{ data: "0x1", topics: ["0x1"] }]);
    mockRegistryContract.interface.parseLog.mockReturnValue({ args: [1n] });
    mockRegistryContract.getAsset.mockResolvedValue({
      assetName: "ALU Official Logo",
      fileType: "PNG",
      contentHash: MOCK_HASH,
      registeredBy: MOCK_OWNER,
      registeredAt: 1710000000n,
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

  it("skips historical Transfer log scans when no verified deployment block is available", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: /token dashboard/i }));

    await waitFor(() => {
      expect(mockTokenContract.balanceOf).toHaveBeenCalledWith(MOCK_OWNER.toLowerCase());
      expect(screen.getByText(/Complete holder list unavailable:/i)).toBeInTheDocument();
    });

    expect(mockTokenContract.queryFilter).not.toHaveBeenCalled();
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

  it("successfully verifies the authentic ALU logo using a matching hash", async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);

    const hashInput = screen.getByPlaceholderText("0x...");
    fireEvent.change(hashInput, { target: { value: MOCK_HASH } });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText(/Logo Verified: This is the authentic ALU logo\./i)).toBeInTheDocument();
    });
  });

  it("rejects a missing or mismatched logo hash during verification", async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[0]);

    mockRegistryContract.verifyLogoIntegrity.mockResolvedValue([false, "Warning: logo does not match."]);
    fireEvent.change(screen.getByPlaceholderText("0x..."), { target: { value: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" } });
    fireEvent.click(screen.getAllByRole("button", { name: /verify logo/i })[1]);

    await waitFor(() => {
      expect(screen.getByText(/This logo does not match the registered ALU logo\./i)).toBeInTheDocument();
    });
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
      expect(screen.getByText(/Complete holder list unavailable:/i)).toBeInTheDocument();
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
