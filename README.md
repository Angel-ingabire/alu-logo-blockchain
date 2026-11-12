# ALU Asset Registry dApp

This project combines the original Hardhat smart contracts with a modern web front end for the African Leadership University (ALU). The application connects to the deployed `ALUAssetRegistry` and `ALULogoToken` contracts, allowing users to connect a wallet, register assets, verify the ALU logo, and track token ownership without using terminal commands.

## Stack

- Solidity 0.8.34
- Hardhat 3.21.0
- Ethers.js 6
- React + Vite
- Tailwind CSS
- OpenZeppelin Contracts 5.6.1
- MetaMask wallet integration

## Smart contracts

- `ALUAssetRegistry.sol`: ERC-721 registry for the ALU logo. Stores metadata, a SHA-256 `bytes32` hash, prevents duplicate registrations, and validates integrity with `verifyLogoIntegrity()`.
- `ALULogoToken.sol`: ERC-20 token with a fixed max supply of 1,000,000 ALUT. The owner can distribute tokens and each wallet can check its percentage ownership.

## Local deployment

Start the local Hardhat blockchain:

```bash
npx hardhat node --hostname 127.0.0.1
```

Deploy the contracts:

```bash
npx hardhat run ./scripts/deploy.js --network localhost
```

The deployment writes the live contract addresses to the frontend configuration file. The current deployed addresses are:

- `ALUAssetRegistry`: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- `ALULogoToken`: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`

## Run the dApp

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev -- --host 0.0.0.0
```

Open the local Vite URL in the browser, usually:

```text
http://localhost:5173/
```

## Features

- Wallet connection using MetaMask
- Display of connected wallet address and ALUT balance
- Local network detection and network guidance
- Browser-side SHA-256 hash generation from uploaded image files
- Asset registration using `registerAsset()`
- Public logo verification using `verifyLogoIntegrity()`
- ALUT ownership dashboard and owner-only distribution form
- Documentation on ABI usage, read-only calls, transaction signing, and local Hardhat setup

## Network configuration for MetaMask

- Network name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency: ETH

## Verification and tests

Run Hardhat contract tests:

```bash
npx hardhat test
```

Build the production frontend:

```bash
npm run build
```

The current suite passes successfully, including the ALU asset registry and token distribution tests.

## Project structure

```text
.
├── contracts/
│   ├── ALUAssetRegistry.sol
│   ├── ALULogoToken.sol
│   ├── Counter.sol
│   └── Counter.t.sol
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── blockchain/
│   │   ├── config.js
│   │   └── contracts.js
│   └── lib/
│       └── utils.js
├── scripts/
│   └── deploy.js
├── test/
│   └── ALUAssetRegistry.test.js
├── hardhat.config.ts
├── package.json
├── vite.config.js
├── index.html
├── README.md
└── ...
```
