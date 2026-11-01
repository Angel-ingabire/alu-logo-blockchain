# ALU Logo Blockchain Project

## 1. Project Overview

This project demonstrates how blockchain technology can be used to register, authenticate, and tokenize the African Leadership University (ALU) logo using Solidity smart contracts. The ERC-721 `ALUAssetRegistry` records the logo's metadata and SHA-256 fingerprint as a unique NFT, while the ERC-20 `ALULogoToken` issues fungible ALUT tokens and demonstrates owner-controlled distribution. The token model is educational and does not grant legal ownership or rights to the ALU logo.

The project uses a local Hardhat blockchain for development and testing. It contains two smart contracts:

- **ALUAssetRegistry (ERC-721):** Registers the ALU logo as a non-fungible token (NFT), stores its metadata and SHA-256 content hash, prevents duplicate hash registrations, and verifies logo integrity.
- **ALULogoToken (ERC-20):** Creates a fixed supply of 1,000,000 ALU Logo Tokens (ALUT), allows the owner to distribute tokens, and calculates token ownership percentages.

## 2. Logo Integrity

The project uses SHA-256 to calculate a hash of the original `alu-logo.png` file.

**SHA-256 hash:**

`407BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE`

The hash is stored as a `bytes32` value in the asset registry. During verification, the supplied hash is compared with the registered hash to determine whether the logo matches the registered file.

## 3. Technologies Used

- Solidity 0.8.34
- Hardhat 3.21.0
- Ethers.js 6
- OpenZeppelin Contracts 5.6.1
- JavaScript (ES modules)
- Mocha and Chai
- Node.js 22

## 4. Project Structure

```text
alu-logo-blockchain/
├── contracts/
│   ├── ALUAssetRegistry.sol
│   ├── ALULogoToken.sol
│   ├── Counter.sol
│   └── Counter.t.sol
├── scripts/
│   └── deploy.js
├── test/
│   ├── ALUAssetRegistry.test.js
│   └── Counter.ts
├── alu-logo.png
├── hardhat.config.ts
├── package.json
├── package-lock.json
└── README.md
```

## 5. Installation

Install Node.js and npm, then clone or download the project.

Install the project dependencies:

```bash
npm install
```

## 6. Compile the Smart Contracts

From the project root, run:

```bash
npx hardhat compile
```

## 7. Run the Tests

Execute the automated tests with:

```bash
npx hardhat test
```

The tests cover NFT registration, duplicate hash rejection, correct and incorrect logo verification, metadata retrieval, token supply, token distribution, and ownership percentage calculations.

The project has eight assignment-specific Mocha tests. Run them alone with:

```bash
npx hardhat test mocha test/ALUAssetRegistry.test.js
```

The project currently passes all eight assignment-specific tests. The full test suite also runs the Counter sample tests, giving 13 passing tests overall (10 Mocha and 3 Solidity tests).

## 8. Deploy Locally

Run the deployment script against the local simulated blockchain:

```bash
npx hardhat run ./scripts/deploy.js --network hardhatMainnet
```

The script deploys both contracts and registers the ALU logo. The local deployment does not require real ETH.

## 9. Development Challenges and Solutions

### Hash representation

The SHA-256 hash was generated from the original logo file. Solidity and Ethers.js displayed the hexadecimal hash in lowercase, while the original hash output used uppercase letters. The test comparison was updated to normalize the letter case.

### Duplicate registration

A mapping records whether a content hash has already been registered. The contract rejects attempts to register the same hash again.

### Automated testing

Automated tests were created to verify both contracts' expected behavior, including successful registration, integrity verification, token distribution, and ownership percentage calculations.

## 10. Conclusion

This project demonstrates how smart contracts can support digital asset registration, integrity verification, and token-based ownership representation. The local deployment and passing automated tests provide evidence that the core functionality works in a simulated blockchain environment.

**Deployment status:** Local Hardhat deployment successful.

**Public repository:** https://github.com/Angel-ingabire/alu-logo-blockchain
