import { createHash } from "node:crypto";
import { expect } from "chai";
import { network } from "hardhat";

import { computeFileHash, normalizeHash } from "../src/lib/utils.js";

const { ethers } = await network.create();

const LOGO_HASH = "0x407BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE";

describe("Frontend hashing and verification helpers", function () {
  it("should normalize a valid SHA-256 bytes32 hash", function () {
    const normalized = normalizeHash(LOGO_HASH.toUpperCase());
    expect(normalized).to.equal(LOGO_HASH.toLowerCase());
  });

  it("should reject hashes that are not exactly 32 bytes long", function () {
    expect(() => normalizeHash("0x1234")).to.throw("32 bytes long");
  });

  it("should compute the correct file digest using the Web Crypto API", async function () {
    const fileContents = "ALU Official Logo content";
    const file = new File([fileContents], "alu-logo.png", { type: "image/png" });

    const expected = `0x${createHash("sha256").update(fileContents).digest("hex")}`;
    const actual = await computeFileHash(file);

    expect(actual).to.equal(expected);
  });

  it("should verify the correct ALU logo hash as authentic", async function () {
    const registry = await ethers.deployContract("ALUAssetRegistry");
    await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);

    const [isAuthentic, message] = await registry.verifyLogoIntegrity(1n, LOGO_HASH);

    expect(isAuthentic).to.equal(true);
    expect(message).to.equal("Logo is authentic.");
  });

  it("should reject an incorrect logo hash", async function () {
    const registry = await ethers.deployContract("ALUAssetRegistry");
    await registry.registerAsset("ALU Official Logo", "PNG", LOGO_HASH);

    const wrongHash = "0x507BE7B9AC994BCCA2AB5E0C901B6471A149AA08FC9201F7BF546E6852FB9DDE";
    const [isAuthentic, message] = await registry.verifyLogoIntegrity(1n, wrongHash);

    expect(isAuthentic).to.equal(false);
    expect(message).to.equal("Warning: logo does not match.");
  });
});
