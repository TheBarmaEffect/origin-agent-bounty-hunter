import { ethers } from "hardhat";

async function main() {
  console.log("Deploying OriginVerdictRegistry to Base Sepolia...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const Registry = await ethers.getContractFactory("OriginVerdictRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("OriginVerdictRegistry deployed to:", address);
  console.log("Add to .env: VERDICT_CONTRACT_ADDRESS=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
