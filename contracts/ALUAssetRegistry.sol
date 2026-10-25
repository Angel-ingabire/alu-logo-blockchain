
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ALUAssetRegistry is ERC721 {
    struct AssetMetadata {
        string assetName;
        string fileType;
        bytes32 contentHash;
        address registeredBy;
        uint256 registeredAt;
    }

    uint256 private nextTokenId = 1;

    mapping(uint256 => AssetMetadata) private assets;
    mapping(bytes32 => bool) public registeredHashes;

    event AssetRegistered(
        uint256 indexed tokenId,
        string assetName,
        bytes32 contentHash,
        address indexed registeredBy
    );

    constructor() ERC721("ALU Official Logo", "ALULOGO") {}

    function registerAsset(
        string memory assetName,
        string memory fileType,
        bytes32 contentHash
    ) public returns (uint256 tokenId) {
        require(bytes(assetName).length > 0, "Asset name is required");
        require(bytes(fileType).length > 0, "File type is required");
        require(contentHash != bytes32(0), "Content hash is required");
        require(!registeredHashes[contentHash], "Asset hash already registered");

        tokenId = nextTokenId;
        nextTokenId++;

        _safeMint(msg.sender, tokenId);

        assets[tokenId] = AssetMetadata({
            assetName: assetName,
            fileType: fileType,
            contentHash: contentHash,
            registeredBy: msg.sender,
            registeredAt: block.timestamp
        });

        registeredHashes[contentHash] = true;

        emit AssetRegistered(
            tokenId,
            assetName,
            contentHash,
            msg.sender
        );
    }

    function verifyLogoIntegrity(
        uint256 tokenId,
        bytes32 suppliedHash
    ) public view returns (bool, string memory) {
        require(_ownerOf(tokenId) != address(0), "Asset does not exist");

        if (assets[tokenId].contentHash == suppliedHash) {
            return (true, "Logo is authentic.");
        }

        return (false, "Warning: logo does not match.");
    }

    function getAsset(
        uint256 tokenId
    ) public view returns (AssetMetadata memory) {
        require(_ownerOf(tokenId) != address(0), "Asset does not exist");

        return assets[tokenId];
    }
}
