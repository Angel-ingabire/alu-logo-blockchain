import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, JsonRpcProvider, formatUnits, isAddress, parseUnits } from "ethers";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Coins,
  Copy,
  FileImage,
  FileText,
  HardDriveUpload,
  LayoutDashboard,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  ACTIVE_NETWORK,
  SEPOLIA_NETWORK,
  SEPOLIA_TOKEN_HOLDER_ADDRESSES,
} from "./blockchain/config";
import { getRegistryContract, getTokenContract } from "./blockchain/contracts";
import { computeFileHash, formatAddress, formatDate, normalizeHash } from "./lib/utils";

const navItems = [
  "Overview",
  "Register Asset",
  "Verify Logo",
  "Token Dashboard",
  "Documentation",
];

const unsupportedNetworkMessage = `Unsupported network. Please switch MetaMask to ${ACTIVE_NETWORK.name} (Chain ID ${ACTIVE_NETWORK.chainId}).`;
const OFFICIAL_LOGO_ASSET_ID = 2n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function formatTokenAmount(rawAmount, decimals) {
  const [wholePart, fractionalPart = ""] = formatUnits(rawAmount, decimals).split(".");
  const whole = BigInt(wholePart).toLocaleString();
  const fraction = fractionalPart.replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole;
}

function calculateOwnershipPercentage(balance, totalSupply) {
  return totalSupply > 0n ? ((balance * 100n) / totalSupply).toString() : "N/A";
}

function getErrorMessage(error) {
  const messages = [
    error?.shortMessage,
    error?.reason,
    error?.info?.error?.message,
    error?.message,
  ].filter((message) => typeof message === "string" && message.trim());

  return [...new Set(messages)].join(" ") || String(error);
}

function isWalletTransactionRejected(error) {
  return (
    error?.code === 4001 ||
    error?.info?.error?.code === 4001 ||
    error?.code === "ACTION_REJECTED"
  );
}

async function loadExampleHolderEntries(tokenContract, totalSupply, decimals, chainId) {
  if (chainId !== SEPOLIA_NETWORK.chainId) {
    return {
      entries: [],
      warning: "Example holder addresses are configured for Sepolia only. Switch to Sepolia to load them.",
    };
  }

  const addresses = [];
  const seen = new Set();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const rawAddress of SEPOLIA_TOKEN_HOLDER_ADDRESSES) {
    if (!isAddress(rawAddress) || rawAddress.toLowerCase() === ZERO_ADDRESS) {
      invalidCount += 1;
      continue;
    }

    const normalizedAddress = rawAddress.toLowerCase();
    if (seen.has(normalizedAddress)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(normalizedAddress);
    addresses.push(rawAddress);
  }

  const warnings = [];
  if (addresses.length === 0) {
    warnings.push(
      "No verified example holder addresses are configured. Set VITE_SEPOLIA_TOKEN_HOLDER_ADDRESSES to at least three comma-separated addresses."
    );
  } else if (addresses.length < 3) {
    warnings.push(
      `Only ${addresses.length} valid example holder address${addresses.length === 1 ? "" : "es"} configured; at least three are required.`
    );
  }
  if (invalidCount > 0) {
    warnings.push(`${invalidCount} invalid or zero address${invalidCount === 1 ? "" : "es"} ignored.`);
  }
  if (duplicateCount > 0) {
    warnings.push(`${duplicateCount} duplicate address${duplicateCount === 1 ? "" : "es"} ignored.`);
  }

  const results = await Promise.allSettled(
    addresses.map(async (address) => {
      const balance = await tokenContract.balanceOf(address);
      return {
        address,
        balance: formatTokenAmount(balance, decimals),
        percentage: calculateOwnershipPercentage(balance, totalSupply),
      };
    })
  );
  const entries = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const failedReads = results.filter((result) => result.status === "rejected");
  if (failedReads.length > 0) {
    warnings.push(
      `Could not read the balance for ${failedReads.length} configured example address${failedReads.length === 1 ? "" : "es"}: ${failedReads[0].reason?.message || "RPC request failed."}`
    );
  }

  return { entries, warning: warnings.join(" ") };
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [walletAddress, setWalletAddress] = useState("");
  const [networkName, setNetworkName] = useState("Not connected");
  const [connectionError, setConnectionError] = useState("");
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [tokenSupply, setTokenSupply] = useState(null);
  const [tokenDecimals, setTokenDecimals] = useState(null);
  const [ownershipPercentage, setOwnershipPercentage] = useState("");
  const [tokenOwner, setTokenOwner] = useState("");
  const [holderEntries, setHolderEntries] = useState([]);
  const [holderWarning, setHolderWarning] = useState("");
  const [tokenReadError, setTokenReadError] = useState("");
  const [isLoadingTokenData, setIsLoadingTokenData] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [assetName, setAssetName] = useState("ALU Official Logo");
  const [fileType, setFileType] = useState("PNG");
  const [generatedHash, setGeneratedHash] = useState("");
  const [registeringStatus, setRegisteringStatus] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isHashingVerificationFile, setIsHashingVerificationFile] = useState(false);
  const [verificationFileName, setVerificationFileName] = useState("");
  const verificationRequestId = useRef(0);
  const tokenRefreshRequestId = useRef(0);
  const [distributionRecipient, setDistributionRecipient] = useState("");
  const [distributionAmount, setDistributionAmount] = useState("");
  const [distributionStatus, setDistributionStatus] = useState("");
  const [isDistributing, setIsDistributing] = useState(false);
  const [copied, setCopied] = useState(false);

  const connectedWallet = useMemo(
    () => (walletAddress ? formatAddress(walletAddress) : "Not connected"),
    [walletAddress]
  );

  function clearTokenDashboardData() {
    setTokenBalance(null);
    setTokenSupply(null);
    setTokenDecimals(null);
    setOwnershipPercentage("");
    setTokenOwner("");
    setHolderEntries([]);
    setHolderWarning("");
    setTokenReadError("");
    setIsLoadingTokenData(false);
  }

  useEffect(() => {
    setIsMetaMaskInstalled(Boolean(window.ethereum));

    if (!window.ethereum) {
      setNetworkName("No wallet installed");
      return undefined;
    }

    const handleAccountsChanged = async (accounts) => {
      if (!accounts.length) {
        tokenRefreshRequestId.current += 1;
        setWalletAddress("");
        clearTokenDashboardData();
        setConnectionError("");
        setNetworkName("No wallet connected");
        return;
      }

      setWalletAddress(accounts[0]);
      clearTokenDashboardData();
      await refreshWalletData();
    };

    const handleChainChanged = async () => {
      tokenRefreshRequestId.current += 1;
      clearTokenDashboardData();
      await refreshWalletData();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function refreshWalletData() {
    const requestId = ++tokenRefreshRequestId.current;
    clearTokenDashboardData();

    if (!window.ethereum) {
      setIsLoadingTokenData(false);
      return;
    }

    setIsLoadingTokenData(true);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      if (requestId !== tokenRefreshRequestId.current) {
        return;
      }

      setWalletAddress(address);
      setNetworkName(network.name || "Unknown network");

      if (chainId !== ACTIVE_NETWORK.chainId) {
        setConnectionError(unsupportedNetworkMessage);
        setTokenReadError(
          `Switch MetaMask to ${ACTIVE_NETWORK.name} to load current ALUT token data.`
        );
        return;
      }

      setConnectionError("");
      const tokenContract = getTokenContract(provider);
      const [balance, supply, owner, percentage, decimalsValue] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.totalSupply(),
        tokenContract.owner(),
        typeof tokenContract.ownershipPercentage === "function"
          ? tokenContract.ownershipPercentage(address)
          : Promise.resolve(null),
        tokenContract.decimals(),
      ]);

      if (requestId !== tokenRefreshRequestId.current) {
        return;
      }

      const decimals = Number(decimalsValue);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error("The token contract returned an invalid decimals value.");
      }

      setTokenBalance(balance);
      setTokenSupply(supply);
      setTokenDecimals(decimals);
      setTokenOwner(owner);
      setOwnershipPercentage(
        percentage === null
          ? calculateOwnershipPercentage(balance, supply)
          : percentage.toString()
      );

      const holderData = await loadExampleHolderEntries(
        tokenContract,
        supply,
        decimals,
        chainId
      );
      if (requestId !== tokenRefreshRequestId.current) {
        return;
      }
      setHolderEntries(holderData.entries);
      setHolderWarning(holderData.warning);
    } catch (error) {
      if (requestId === tokenRefreshRequestId.current) {
        clearTokenDashboardData();
        setTokenReadError(
          `Unable to load ALUT dashboard data: ${error.message || "contract or RPC request failed."}`
        );
      }
    } finally {
      if (requestId === tokenRefreshRequestId.current) {
        setIsLoadingTokenData(false);
      }
    }
  }

  async function getCurrentWalletSigner() {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const [address, network] = await Promise.all([
      signer.getAddress(),
      provider.getNetwork(),
    ]);

    setNetworkName(network.name || "Unknown network");
    if (Number(network.chainId) !== ACTIVE_NETWORK.chainId) {
      setConnectionError(unsupportedNetworkMessage);
      throw new Error(unsupportedNetworkMessage);
    }

    if (!walletAddress || address.toLowerCase() !== walletAddress.toLowerCase()) {
      setWalletAddress(address);
      await refreshWalletData();
      throw new Error("The active wallet account changed. Review the refreshed account and retry.");
    }

    setConnectionError("");
    return signer;
  }

  async function handleConnectWallet() {
    if (!window.ethereum) {
      setConnectionError("MetaMask is not installed. Please install a browser wallet to continue.");
      return;
    }

    setIsConnecting(true);
    setConnectionError("");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (!accounts.length) {
        throw new Error("No wallet account was selected.");
      }

      setWalletAddress(accounts[0]);
      await refreshWalletData();
    } catch (error) {
      tokenRefreshRequestId.current += 1;
      setWalletAddress("");
      clearTokenDashboardData();
      setConnectionError(error.message || "Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnectWallet() {
    tokenRefreshRequestId.current += 1;
    setWalletAddress("");
    clearTokenDashboardData();
    setConnectionError("");
    setNetworkName("Wallet disconnected");
  }

  async function handleSwitchNetwork() {
    if (!window.ethereum) {
      setConnectionError("MetaMask is not installed. Please install the browser wallet before switching networks.");
      return;
    }

    try {
      const chainId = `0x${ACTIVE_NETWORK.chainId.toString(16)}`;
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
      setConnectionError("");
      await refreshWalletData();
    } catch (error) {
      const message = error?.info?.error?.message || error?.message || "Unable to switch the network.";
      if (error?.code === 4001) {
        setConnectionError("The network switch was cancelled. Please approve the request to continue.");
      } else if (error?.code === -32002) {
        setConnectionError("MetaMask is already processing a network switch request. Please try again in a moment.");
      } else {
        setConnectionError(message);
      }
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const requestId = ++verificationRequestId.current;
    setVerifyResult(null);
    setIsVerifying(false);
    setIsHashingVerificationFile(false);

    try {
      if (file.size === 0) {
        throw new Error("The selected image is empty. Please choose a file with content.");
      }
      if (!file.type.startsWith("image/")) {
        throw new Error("Unsupported file format. Please upload an image file such as PNG, JPG or WEBP.");
      }

      const hash = await computeFileHash(file);
      const guessedType = file.type?.split("/")[1]?.toUpperCase() || "PNG";

      setSelectedFile(file);
      setGeneratedHash(hash);
      setFileType(guessedType);
      setRegisteringStatus("");
      if (requestId === verificationRequestId.current) {
        setVerifyHash(hash);
        setVerificationFileName(file.name);
      }
    } catch (error) {
      setRegisteringStatus(error.message || "The image could not be hashed.");
    }
  }

  function handleVerificationHashChange(event) {
    verificationRequestId.current += 1;
    setVerifyHash(event.target.value);
    setVerificationFileName("");
    setVerifyResult(null);
    setIsVerifying(false);
    setIsHashingVerificationFile(false);
  }

  async function handleVerificationFileSelection(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const requestId = ++verificationRequestId.current;
    setVerifyHash("");
    setVerificationFileName("");
    setVerifyResult(null);
    setIsVerifying(false);
    setIsHashingVerificationFile(true);

    try {
      if (file.size === 0) {
        throw new Error("The selected image is empty. Please choose a file with content.");
      }
      if (!file.type.startsWith("image/")) {
        throw new Error("Unsupported file format. Please upload an image file such as PNG, JPG or WEBP.");
      }

      const hash = await computeFileHash(file);
      if (requestId !== verificationRequestId.current) {
        return;
      }

      setVerifyHash(hash);
      setVerificationFileName(file.name);
    } catch (error) {
      if (requestId === verificationRequestId.current) {
        setVerifyResult({
          status: "input-error",
          message: error.message || "Unable to hash the selected image.",
        });
      }
    } finally {
      if (requestId === verificationRequestId.current) {
        setIsHashingVerificationFile(false);
      }
    }
  }

  async function handleRegisterAsset(event) {
    event.preventDefault();

    if (!walletAddress) {
      setRegisteringStatus("Connect a wallet before registering the asset.");
      return;
    }

    if (!assetName.trim() || !generatedHash) {
      setRegisteringStatus("Asset name and a generated hash are required.");
      return;
    }

    try {
      setIsRegistering(true);
      setRegisteringStatus("Checking the registry for duplicates...");

      const signer = await getCurrentWalletSigner();
      const registry = getRegistryContract(signer);
      const contentHash = normalizeHash(generatedHash);
      if (await registry.registeredHashes(contentHash)) {
        setRegisteringStatus(
          "This logo hash has already been registered. Please verify the asset before submitting a duplicate."
        );
        return;
      }

      setRegisteringStatus("Submitting transaction to the blockchain...");
      const transaction = await registry.registerAsset(
        assetName.trim(),
        fileType.trim() || "PNG",
        contentHash
      );

      const receipt = await transaction.wait();
      const parsedLog = (receipt?.logs ?? [])
        .map((log) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "AssetRegistered");

      if (parsedLog?.args?.[0] === undefined) {
        setRegisteringStatus(
          "Asset registration transaction confirmed, but its token ID could not be read from the receipt."
        );
      } else {
        setRegisteringStatus(
          `Asset registered successfully. Token ID: ${parsedLog.args[0].toString()}`
        );
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (/already registered/i.test(errorMessage)) {
        setRegisteringStatus("This logo hash has already been registered. Please verify the asset before submitting a duplicate.");
      } else if (isWalletTransactionRejected(error)) {
        setRegisteringStatus("The registration transaction was rejected in MetaMask.");
      } else {
        setRegisteringStatus(errorMessage || "Registration failed.");
      }
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();

    const requestId = ++verificationRequestId.current;
    setIsVerifying(true);
    setVerifyResult(null);

    let normalizedHash;
    try {
      normalizedHash = normalizeHash(verifyHash);
    } catch (error) {
      if (requestId === verificationRequestId.current) {
        setVerifyResult({
          status: "input-error",
          message: error.message || "Enter a valid SHA-256 hash.",
        });
      }
      setIsVerifying(false);
      return;
    }

    try {
      const registry = getRegistryContract(
        new JsonRpcProvider(SEPOLIA_NETWORK.rpcUrl),
        SEPOLIA_NETWORK.chainId
      );
      const [verified] = await registry.verifyLogoIntegrity(
        OFFICIAL_LOGO_ASSET_ID,
        normalizedHash
      );

      if (requestId !== verificationRequestId.current) {
        return;
      }

      if (!verified) {
        setVerifyResult({
          status: "mismatch",
          verified: false,
          message: "Verification failed: the submitted image or hash does not match the registered official ALU logo.",
        });
        return;
      }

      let asset = null;
      let metadataError = "";
      if (typeof registry.getAsset === "function") {
        try {
          asset = await registry.getAsset(OFFICIAL_LOGO_ASSET_ID);
        } catch (error) {
          metadataError = error.message || "The metadata call failed.";
        }
      }

      if (requestId !== verificationRequestId.current) {
        return;
      }

      setVerifyResult({
        status: "verified",
        verified: true,
        message: "Verified: this image or hash matches the registered official ALU logo.",
        assetId: OFFICIAL_LOGO_ASSET_ID,
        asset,
        metadataError,
      });
    } catch (error) {
      if (requestId === verificationRequestId.current) {
        const detail = error.shortMessage || error.message;
        setVerifyResult({
          status: "technical-error",
          verified: false,
          message: `Unable to verify against the Sepolia ALU registry. ${detail || "The contract or RPC request failed."}`,
        });
      }
    } finally {
      if (requestId === verificationRequestId.current) {
        setIsVerifying(false);
      }
    }
  }

  async function handleDistribution(event) {
    event.preventDefault();

    if (!walletAddress) {
      setDistributionStatus("Connect a wallet to distribute ALUT tokens.");
      return;
    }

    const recipient = distributionRecipient.trim();
    const amount = distributionAmount.trim();

    if (!recipient || !amount) {
      setDistributionStatus("Recipient address and amount are required.");
      return;
    }

    if (!isAddress(recipient)) {
      setDistributionStatus("Enter a valid recipient wallet address.");
      return;
    }

    let amountInWei;
    try {
      amountInWei = parseUnits(amount, 18);
    } catch {
      setDistributionStatus("Enter a valid ALUT amount with no more than 18 decimal places.");
      return;
    }

    if (amountInWei <= 0n) {
      setDistributionStatus("The amount must be greater than zero.");
      return;
    }

    try {
      setIsDistributing(true);
      setDistributionStatus("Sending ALUT tokens...");

      const signer = await getCurrentWalletSigner();
      const token = getTokenContract(signer);
      const contractOwner = await token.owner();
      setTokenOwner(contractOwner);
      if (contractOwner.toLowerCase() !== walletAddress.toLowerCase()) {
        setDistributionStatus("Only the ALUT token contract owner can distribute tokens.");
        return;
      }

      const ownerBalance = await token.balanceOf(walletAddress);
      if (amountInWei > ownerBalance) {
        setDistributionStatus("Insufficient ALUT balance for this distribution.");
        return;
      }

      const transaction = await token.distributeShares(recipient, amountInWei);
      await transaction.wait();

      const [balance, updatedOwner, percentage, recipientBalance] = await Promise.all([
        token.balanceOf(walletAddress),
        token.owner(),
        token.ownershipPercentage(walletAddress),
        token.balanceOf(recipient),
      ]);

      setTokenBalance(balance);
      setTokenOwner(updatedOwner);
      setOwnershipPercentage(percentage.toString());
      setDistributionStatus(`Success: ${amount} ALUT was distributed to ${formatAddress(recipient)}. Recipient balance: ${formatTokenAmount(recipientBalance, tokenDecimals ?? 18)} ALUT.`);
      setDistributionRecipient("");
      setDistributionAmount("");

      try {
        const totalSupply = tokenSupply ?? await token.totalSupply();
        const decimals = tokenDecimals ?? Number(await token.decimals());
        const holderData = await loadExampleHolderEntries(
          token,
          totalSupply,
          decimals,
          ACTIVE_NETWORK.chainId
        );
        setHolderEntries(holderData.entries);
        setHolderWarning(holderData.warning);
      } catch (error) {
        setHolderEntries([]);
        setHolderWarning(
          `Unable to refresh configured example holders: ${error.message || "contract or RPC request failed."}`
        );
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (isWalletTransactionRejected(error)) {
        setDistributionStatus("The distribution transaction was rejected in MetaMask.");
      } else if (/ownableunauthorizedaccount|caller is not the owner/i.test(errorMessage)) {
        setDistributionStatus("Only the ALUT token contract owner can distribute tokens.");
      } else {
        setDistributionStatus(errorMessage || "Token distribution failed.");
      }
    } finally {
      setIsDistributing(false);
    }
  }

  async function copyHashToClipboard() {
    if (!generatedHash) {
      return;
    }

    await navigator.clipboard.writeText(generatedHash);
    setCopied(true);
  }

  const isOwner = walletAddress && tokenOwner && tokenOwner.toLowerCase() === walletAddress.toLowerCase();
  const isWrongNetwork = connectionError.includes("Unsupported network");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-emerald-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-900 text-lg font-bold text-white">
                ALU
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  African Leadership University
                </p>
                <h1 className="text-xl font-bold text-slate-900">ALU Asset Registry</h1>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                {networkName}
              </div>
              <button
                type="button"
                onClick={walletAddress ? handleDisconnectWallet : handleConnectWallet}
                disabled={isConnecting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Wallet className="h-4 w-4" />
                {isConnecting ? "Connecting..." : walletAddress ? "Disconnect" : "Connect Wallet"}
              </button>
              {walletAddress && connectionError && connectionError.includes("Unsupported network") && (
                <button
                  type="button"
                  onClick={handleSwitchNetwork}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                >
                  Switch to {ACTIVE_NETWORK.name}
                </button>
              )}
            </div>
          </div>
        </header>

        {!isMetaMaskInstalled && (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">MetaMask is not installed.</p>
                <p className="mt-1">Install MetaMask in your browser in order to register assets and distribute ALUT tokens.</p>
              </div>
            </div>
          </div>
        )}

        {connectionError && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5" />
              <p>{connectionError}</p>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveTab(item)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    activeTab === item
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{item}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ))}
            </nav>

            <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold uppercase tracking-[0.12em] text-slate-500">Local network</p>
              <p className="mt-2">{ACTIVE_NETWORK.name}</p>
              <p>RPC: {ACTIVE_NETWORK.rpcUrl}</p>
              <p>Chain ID: {ACTIVE_NETWORK.chainId}</p>
              <p>Currency: {ACTIVE_NETWORK.currency}</p>
            </div>
          </aside>

          <main className="space-y-6">
            {activeTab === "Overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Connected wallet</p>
                        <p className="font-semibold">{walletAddress ? formatAddress(walletAddress) : "Not connected"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                        <Coins className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">ALUT balance</p>
                        <p className="font-semibold">
                          {tokenBalance === null
                            ? "Not connected"
                            : `${formatTokenAmount(tokenBalance, tokenDecimals)} ALUT`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
                        <LayoutDashboard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Token supply</p>
                        <p className="font-semibold">
                          {tokenSupply === null
                            ? isLoadingTokenData
                              ? "Loading..."
                              : "Unavailable"
                            : `${formatTokenAmount(tokenSupply, tokenDecimals)} ALUT`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">
                        Registration status
                      </p>
                      <h2 className="mt-1 text-2xl font-bold">ALU logo asset integrity overview</h2>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Asset name</p>
                      <p className="mt-2 text-lg font-semibold">ALU Official Logo</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Registered file hash</p>
                      <p className="mt-2 break-all text-sm font-mono font-semibold">0x407BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Register Asset" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                    <HardDriveUpload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">Asset registration</p>
                    <h2 className="text-2xl font-bold">Register a new ALU logo asset</h2>
                  </div>
                </div>

                <form onSubmit={handleRegisterAsset} className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">Asset name</label>
                      <input
                        value={assetName}
                        onChange={(event) => setAssetName(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="ALU Official Logo 2026"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">File type</label>
                      <input
                        value={fileType}
                        onChange={(event) => setFileType(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="PNG"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
                      <FileImage className="h-8 w-8 text-emerald-700" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Upload an image</p>
                        <p className="text-xs text-slate-500">PNG, JPG, JPEG and other image formats supported</p>
                      </div>
                      <input type="file" accept="image/*" onChange={handleFileSelection} className="hidden" />
                    </label>
                  </div>

                  {selectedFile && (
                    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {previewUrl ? <img src={previewUrl} alt="Selected asset preview" className="h-52 w-full object-cover" /> : null}
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm text-slate-500">Selected file</p>
                        <p className="font-semibold">{selectedFile.name}</p>
                        <p className="text-sm text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl("");
                            setGeneratedHash("");
                            setVerifyHash("");
                          }}
                          className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Remove file
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-500">Generated SHA-256 hash</p>
                        <p className="mt-1 break-all font-mono text-sm font-semibold">{generatedHash || "No file selected yet"}</p>
                      </div>
                      {generatedHash && (
                        <button
                          type="button"
                          onClick={copyHashToClipboard}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copied ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>

                  {registeringStatus && (
                    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {registeringStatus}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRegistering || !walletAddress || isWrongNetwork}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isRegistering ? "Registering..." : "Register Asset"}
                  </button>
                </form>
              </div>
            )}

            {activeTab === "Verify Logo" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">Public verification</p>
                      <h2 className="text-2xl font-bold">Check if a logo is authentic</h2>
                    </div>
                  </div>

                  <form onSubmit={handleVerify} className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-[180px_1fr]">
                      <div className="space-y-3 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Paste SHA-256 hash</label>
                        <input
                          value={verifyHash}
                          onChange={handleVerificationHashChange}
                          aria-label="SHA-256 hash to verify"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          placeholder="0x..."
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
                        <FileImage className="h-8 w-8 text-emerald-700" />
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Verify by file upload</p>
                          <p className="text-xs text-slate-500">The app will hash the file in the browser before checking the on-chain registry.</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleVerificationFileSelection}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {isHashingVerificationFile && (
                      <p role="status" className="text-sm text-slate-600">
                        Calculating the image SHA-256 hash in your browser...
                      </p>
                    )}
                    {verificationFileName && verifyHash && (
                      <p className="break-all text-sm text-slate-600">
                        <span className="font-semibold">Calculated SHA-256 for {verificationFileName}:</span>{" "}
                        <span className="font-mono">{verifyHash}</span>
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isVerifying || isHashingVerificationFile}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      {isHashingVerificationFile
                        ? "Hashing image..."
                        : isVerifying
                          ? "Verifying..."
                          : "Verify logo"}
                    </button>
                  </form>
                </div>

                {verifyResult && (
                  <div
                    role={verifyResult.status === "mismatch" ? "status" : "alert"}
                    aria-live="polite"
                    className={`rounded-2xl border p-5 shadow-sm ${
                      verifyResult.status === "verified"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : verifyResult.status === "mismatch"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {verifyResult.status === "verified" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5" />
                      ) : verifyResult.status === "mismatch" ? (
                        <XCircle className="mt-0.5 h-5 w-5" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5" />
                      )}
                      <div className="flex-1">
                        <p className="text-lg font-semibold">{verifyResult.message}</p>
                        {verifyResult.status === "verified" && (
                          <div className="mt-4 space-y-2 text-sm">
                            <p><span className="font-semibold">Asset ID:</span> {verifyResult.assetId.toString()}</p>
                            {verifyResult.asset ? (
                              <>
                                <p>
                                  <span className="font-semibold">Asset name:</span>{" "}
                                  {verifyResult.asset.assetName || "Unavailable"}
                                </p>
                                <p>
                                  <span className="font-semibold">File type:</span>{" "}
                                  {verifyResult.asset.fileType || "Unavailable"}
                                </p>
                                <p className="break-all">
                                  <span className="font-semibold">Registered by:</span>{" "}
                                  {verifyResult.asset.registeredBy || "Unavailable"}
                                </p>
                                <p>
                                  <span className="font-semibold">Registered at:</span>{" "}
                                  {formatDate(verifyResult.asset.registeredAt)}
                                </p>
                              </>
                            ) : (
                              <p>Asset metadata is unavailable.</p>
                            )}
                            {verifyResult.metadataError && (
                              <p>Asset metadata could not be loaded: {verifyResult.metadataError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Token Dashboard" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Your ALUT balance</p>
                    <p className="mt-2 text-2xl font-bold">
                      {tokenBalance !== null
                        ? formatTokenAmount(tokenBalance, tokenDecimals)
                        : walletAddress
                          ? isLoadingTokenData
                            ? "Loading..."
                            : "Unavailable"
                          : "Not connected"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Ownership share</p>
                    <p className="mt-2 text-2xl font-bold">
                      {ownershipPercentage
                        ? `${ownershipPercentage}%`
                        : walletAddress
                          ? isLoadingTokenData
                            ? "Loading..."
                            : "Unavailable"
                          : "Not connected"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Token owner</p>
                    <p className="mt-2 text-sm font-semibold break-all">
                      {tokenOwner ? formatAddress(tokenOwner) : isLoadingTokenData ? "Loading..." : "Unavailable"}
                    </p>
                  </div>
                </div>

                {tokenReadError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    {tokenReadError}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">Example holders</p>
                      <h2 className="text-2xl font-bold">Not a complete holder list</h2>
                    </div>
                  </div>

                  {holderWarning && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      {holderWarning}
                    </div>
                  )}

                  <div className="space-y-3">
                    {holderEntries.length === 0 && !holderWarning ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        {isLoadingTokenData
                          ? "Loading configured example holders..."
                          : "No example holder data is available."}
                      </div>
                    ) : holderEntries.length > 0 ? (
                      holderEntries.map((entry) => (
                        <div
                          key={entry.address.toLowerCase()}
                          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{entry.address}</p>
                            <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                              Configured example holder
                            </p>
                          </div>
                          <div className="flex gap-6 text-sm text-slate-600">
                            <span>Balance: {entry.balance} ALUT</span>
                            <span>
                              Ownership: {entry.percentage === "N/A" ? "N/A" : `${entry.percentage}%`}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">ALUT distribution</p>
                      <h2 className="text-2xl font-bold">Distribute shares</h2>
                    </div>
                  </div>

                  {!walletAddress ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Connect your wallet to view your balance and distribute ALUT tokens.
                    </div>
                  ) : isWrongNetwork ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Switch MetaMask to {ACTIVE_NETWORK.name} before distributing ALUT tokens.
                    </div>
                  ) : !tokenOwner && isLoadingTokenData ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Loading token ownership data...
                    </div>
                  ) : !tokenOwner && tokenReadError ? (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {tokenReadError}
                    </div>
                  ) : !isOwner ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      You are not the contract owner, so you cannot distribute ALUT tokens from this account.
                    </div>
                  ) : (
                    <form onSubmit={handleDistribution} className="space-y-5">
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-slate-700">Recipient address</label>
                          <input
                            value={distributionRecipient}
                            onChange={(event) => setDistributionRecipient(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="0x..."
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-slate-700">Amount (ALUT)</label>
                          <input
                            value={distributionAmount}
                            onChange={(event) => setDistributionAmount(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="250000"
                          />
                        </div>
                      </div>

                      {distributionStatus && (
                        <div
                          role="status"
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            distributionStatus.startsWith("Success:")
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : distributionStatus === "Sending ALUT tokens..."
                                ? "border-blue-200 bg-blue-50 text-blue-800"
                                : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {distributionStatus}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isDistributing}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Coins className="h-4 w-4" />
                        {isDistributing ? "Processing..." : "Distribute shares"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Documentation" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">Documentation</p>
                      <h2 className="text-2xl font-bold">How the dApp works</h2>
                    </div>
                  </div>

                  <div className="space-y-5 text-sm leading-7 text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">ABI:</span> An ABI is the Application Binary Interface. It is the machine-readable definition of the smart contract functions, events and data structures that the browser uses to call the deployed contract.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Read-only vs transaction:</span> A read-only call does not change blockchain state and usually does not require gas or a wallet signature. A transaction modifies state, requires gas, and must be signed by the connected wallet.
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Why the wallet signs transactions:</span> The user approves the exact action that will be recorded on-chain. The application never signs on the user’s behalf because it would bypass user control and compromise security.
                    </p>
                    <p>
                      Hashing in the browser ensures a user can compute the SHA-256 fingerprint of a file locally without uploading private or sensitive data to an external server. The resulting digest is then compared against the on-chain metadata.
                    </p>
                    <p>
                      A duplicate registration attempts to re-use the same bytes32 content hash. The contract enforces a mapping that prevents an already-registered hash from being stored twice. The user’s wallet must approve the transaction before it is mined.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-bold">Add the local Hardhat network to MetaMask</h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    <li>Network: {ACTIVE_NETWORK.name}</li>
                    <li>RPC URL: http://127.0.0.1:8545</li>
                    <li>Chain ID: 31337</li>
                    <li>Currency Symbol: ETH</li>
                  </ul>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
