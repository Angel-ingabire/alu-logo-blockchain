// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "../ALUAssetRegistry.sol";

contract AssetRegistryReceiver is IERC721Receiver {
    ALUAssetRegistry private immutable registry;
    bytes32 private immutable contentHash;
    bool private immutable rejectMint;
    bool private attemptedReentry;

    bool public reentrantRegistrationSucceeded;
    bool public reentrantDuplicateRejected;

    constructor(
        address registryAddress,
        bytes32 logoHash,
        bool shouldRejectMint
    ) {
        registry = ALUAssetRegistry(registryAddress);
        contentHash = logoHash;
        rejectMint = shouldRejectMint;
    }

    function registerInitialAsset() external {
        registry.registerAsset("ALU Official Logo", "PNG", contentHash);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        require(!rejectMint, "Receiver rejected");

        if (!attemptedReentry) {
            attemptedReentry = true;

            try registry.registerAsset("Reentrant duplicate", "PNG", contentHash) returns (uint256) {
                reentrantRegistrationSucceeded = true;
            } catch Error(string memory reason) {
                reentrantDuplicateRejected =
                    keccak256(bytes(reason)) == keccak256(bytes("Asset hash already registered"));
            } catch {}
        }

        return IERC721Receiver.onERC721Received.selector;
    }
}
