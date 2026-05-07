import { expect } from "chai";
import { ethers } from "hardhat";

describe("OriginVerdictRegistry", function () {
  async function deploy() {
    const [owner, publisher, nonAuth] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("OriginVerdictRegistry");
    const registry = await Registry.deploy();
    return { registry, owner, publisher, nonAuth };
  }

  it("should publish a verdict and retrieve it", async function () {
    const { registry } = await deploy();
    const bountyId = "bounty-001";
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test verdict data"));

    await registry.publishVerdict(bountyId, hash, "compass", "heuristic-structured", 2_000_000, "USDC");

    const verdict = await registry.getVerdict(bountyId);
    expect(verdict.winnerAgentId).to.equal("compass");
    expect(verdict.verdictHash).to.equal(hash);
    expect(verdict.exists).to.be.true;
  });

  it("should prevent duplicate verdicts for same bountyId", async function () {
    const { registry } = await deploy();
    const bountyId = "bounty-002";
    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));

    await registry.publishVerdict(bountyId, hash, "compass", "heuristic-structured", 2_000_000, "USDC");

    await expect(
      registry.publishVerdict(bountyId, hash, "scout", "breadth-discovery", 1_000_000, "USDC")
    ).to.be.revertedWith("Verdict already published");
  });

  it("should update agent reputation", async function () {
    const { registry, owner } = await deploy();
    const agentWallet = owner.address;
    const hash = ethers.keccak256(ethers.toUtf8Bytes("verdict"));

    await registry.updateReputation(agentWallet, "heuristic-structured", 10n, hash);

    const rep = await registry.getAgentReputation(agentWallet, "heuristic-structured");
    expect(rep.reputationDelta).to.equal(10n);
    expect(rep.totalWins).to.equal(1n);
  });

  it("should reject unauthorized publisher", async function () {
    const { registry, nonAuth } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));

    await expect(
      registry.connect(nonAuth).publishVerdict("b-003", hash, "scout", "breadth", 0, "USDC")
    ).to.be.revertedWith("Not authorized");
  });

  it("should allow authorized publisher to publish", async function () {
    const { registry, publisher } = await deploy();
    await registry.addPublisher(publisher.address);

    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));
    await expect(
      registry.connect(publisher).publishVerdict("b-004", hash, "drill", "depth-investigation", 0, "USDC")
    ).to.not.be.reverted;
  });
});
