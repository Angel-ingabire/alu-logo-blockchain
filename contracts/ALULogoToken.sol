
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ALULogoToken is ERC20, Ownable {
    uint256 public constant TOTAL_SHARES = 1_000_000;

    constructor(address initialOwner)
        ERC20("ALU Logo Token", "ALUT")
        Ownable(initialOwner)
    {
        require(initialOwner != address(0), "Invalid owner");

        _mint(initialOwner, TOTAL_SHARES * 10 ** decimals());
    }

    function distributeShares(
        address recipient,
        uint256 amount
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than zero");

        _transfer(msg.sender, recipient, amount);
    }

    function ownershipPercentage(
        address account
    ) external view returns (uint256) {
        return (balanceOf(account) * 100) / totalSupply();
    }
}
