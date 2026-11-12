import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, JsonRpcProvider, formatUnits, parseUnits } from "ethers";
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
import { ACTIVE_NETWORK, getNetworkConfig } from "./blockchain/config";
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

export default function App() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [walletAddress, setWalletAddress] = useState("");
  const [networkName, setNetworkName] = useState("Not connected");
  const [connectionError, setConnectionError] = useState("");
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokenBalance, setTokenBalance] = useState("0");
  const [tokenSupply, setTokenSupply] = useState("0");
  const [ownershipPercentage, setOwnershipPercentage] = useState("0");
  const [tokenOwner, setTokenOwner] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [assetName, setAssetName] = useState("ALU Official Logo");
  const [fileType, setFileType] = useState("PNG");
  const [generatedHash, setGeneratedHash] = useState("");
  const [registeringStatus, setRegisteringStatus] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [verifyTokenId, setVerifyTokenId] = useState("1");
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [distributionRecipient, setDistributionRecipient] = useState("");
  const [distributionAmount, setDistributionAmount] = useState("");
  const [distributionStatus, setDistributionStatus] = useState("");
  const [isDistributing, setIsDistributing] = useState(false);
  const [copied, setCopied] = useState(false);

  const connectedWallet = useMemo(
    () => (walletAddress ? formatAddress(walletAddress) : "Not connected"),
    [walletAddress]
  );

  useEffect(() => {
    setIsMetaMaskInstalled(Boolean(window.ethereum));

    if (!window.ethereum) {
      setNetworkName("No wallet installed");
      return undefined;
    }

    const handleAccountsChanged = async (accounts) => {
      if (!accounts.length) {
        setWalletAddress("");
        setTokenBalance("0");
        setOwnershipPercentage("0");
        setConnectionError("");
        setNetworkName("No wallet connected");
        return;
      }

      setWalletAddress(accounts[0]);
      await refreshWalletData();
    };

    const handleChainChanged = () => {
      window.location.reload();
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
    if (!window.ethereum) {
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      setWalletAddress(address);
      setNetworkName(network.name || "Unknown network");

      if (chainId !== ACTIVE_NETWORK.chainId) {
        setConnectionError(unsupportedNetworkMessage);
      } else {
        setConnectionError("");
      }

      const tokenContract = getTokenContract(provider);
      const [balance, supply, owner, percentage] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.totalSupply(),
        tokenContract.owner(),
        tokenContract.ownershipPercentage(address),
      ]);

      setTokenBalance(formatUnits(balance, 18));
      setTokenSupply(formatUnits(supply, 18));
      setTokenOwner(owner);
      setOwnershipPercentage(percentage.toString());
    } catch (error) {
      setConnectionError(error.message || "Unable to refresh wallet state.");
    }
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
      setConnectionError(error.message || "Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const hash = await computeFileHash(file);
      const guessedType = file.type?.split("/")[1]?.toUpperCase() || "PNG";

      setSelectedFile(file);
      setGeneratedHash(hash);
      setFileType(guessedType);
      setRegisteringStatus("");
      setVerifyHash(hash);
    } catch (error) {
      setRegisteringStatus(error.message || "The image could not be hashed.");
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
      setRegisteringStatus("Submitting transaction to the blockchain...");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const registry = getRegistryContract(signer);
      const transaction = await registry.registerAsset(
        assetName.trim(),
        fileType.trim() || "PNG",
        generatedHash
      );

      const receipt = await transaction.wait();
      const parsedLog = receipt.logs
        .map((log) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "AssetRegistered");

      const newTokenId = parsedLog?.args?.[0]?.toString?.() ?? "unknown";

      setRegisteringStatus(`Asset registered successfully. Token ID: ${newTokenId}`);
      setVerifyTokenId(newTokenId);
    } catch (error) {
      if (String(error.message || error).includes("already registered")) {
        setRegisteringStatus("This logo hash has already been registered. Please verify the asset before submitting a duplicate.");
      } else {
        setRegisteringStatus(error.message || "Registration failed.");
      }
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();

    try {
      setIsVerifying(true);
      setVerifyResult(null);

      const provider = new JsonRpcProvider(getNetworkConfig(ACTIVE_NETWORK.chainId).rpcUrl);
      const registry = getRegistryContract(provider);
      const normalizedHash = normalizeHash(verifyHash || generatedHash);
      const tokenId = BigInt(verifyTokenId || 1);
      const [isAuthentic, message] = await registry.verifyLogoIntegrity(tokenId, normalizedHash);
      const asset = await registry.getAsset(tokenId).catch(() => null);

      setVerifyResult({
        verified: Boolean(isAuthentic),
        message: isAuthentic ? "Logo Verified: This is the authentic ALU logo." : "Warning: This logo does not match the registered ALU logo.",
        asset,
      });

      if (!isAuthentic) {
        setConnectionError("");
      }
    } catch (error) {
      setVerifyResult({
        verified: false,
        message: error.message || "Verification failed.",
        asset: null,
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleDistribution(event) {
    event.preventDefault();

    if (!walletAddress) {
      setDistributionStatus("Connect a wallet to distribute ALUT tokens.");
      return;
    }

    if (!distributionRecipient || !distributionAmount) {
      setDistributionStatus("Recipient address and amount are required.");
      return;
    }

    try {
      setIsDistributing(true);
      setDistributionStatus("Sending ALUT tokens...");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = getTokenContract(signer);
      const amountInWei = parseUnits(distributionAmount.trim(), 18);
      const transaction = await token.distributeShares(distributionRecipient.trim(), amountInWei);
      await transaction.wait();

      const balance = await token.balanceOf(walletAddress);
      const owner = await token.owner();
      const percentage = await token.ownershipPercentage(walletAddress);

      setTokenBalance(formatUnits(balance, 18));
      setTokenOwner(owner);
      setOwnershipPercentage(percentage.toString());
      setDistributionStatus(`Success: ${distributionAmount} ALUT was distributed to ${formatAddress(distributionRecipient.trim())}.`);
      setDistributionRecipient("");
      setDistributionAmount("");
    } catch (error) {
      setDistributionStatus(error.message || "Token distribution failed.");
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
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Wallet className="h-4 w-4" />
                {isConnecting ? "Connecting..." : walletAddress ? connectedWallet : "Connect Wallet"}
              </button>
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
                        <p className="font-semibold">{Number(tokenBalance).toLocaleString()} ALUT</p>
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
                        <p className="font-semibold">{Number(tokenSupply).toLocaleString()} ALUT</p>
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
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {registeringStatus}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRegistering || !walletAddress}
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
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700">Token ID</label>
                        <input
                          value={verifyTokenId}
                          onChange={(event) => setVerifyTokenId(event.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          placeholder="1"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700">Paste SHA-256 hash</label>
                        <input
                          value={verifyHash}
                          onChange={(event) => setVerifyHash(event.target.value)}
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
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const hash = await computeFileHash(file);
                            setVerifyHash(hash);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      {isVerifying ? "Verifying..." : "Verify logo"}
                    </button>
                  </form>
                </div>

                {verifyResult && (
                  <div
                    className={`rounded-2xl border p-5 shadow-sm ${
                      verifyResult.verified
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {verifyResult.verified ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5" />
                      )}
                      <div className="flex-1">
                        <p className="text-lg font-semibold">{verifyResult.message}</p>
                        {verifyResult.asset && (
                          <div className="mt-4 space-y-2 text-sm">
                            <p>
                              <span className="font-semibold">Asset name:</span> {verifyResult.asset.assetName}
                            </p>
                            <p>
                              <span className="font-semibold">File type:</span> {verifyResult.asset.fileType}
                            </p>
                            <p>
                              <span className="font-semibold">Registered by:</span> {formatAddress(verifyResult.asset.registeredBy)}
                            </p>
                            <p>
                              <span className="font-semibold">Registered at:</span> {formatDate(verifyResult.asset.registeredAt)}
                            </p>
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
                    <p className="mt-2 text-2xl font-bold">{Number(tokenBalance).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Ownership share</p>
                    <p className="mt-2 text-2xl font-bold">{ownershipPercentage}%</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Token owner</p>
                    <p className="mt-2 text-sm font-semibold break-all">{tokenOwner ? formatAddress(tokenOwner) : "Pending"}</p>
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
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
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
