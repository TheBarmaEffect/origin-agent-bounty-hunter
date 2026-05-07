// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OriginVerdictRegistry
 * @notice Records verifiable proofs of agent bounty verdicts and reputation updates
 * @dev Deployed on Base Sepolia (chainId: 84532)
 */
contract OriginVerdictRegistry {
    address public owner;
    mapping(address => bool) public authorizedPublishers;

    struct VerdictRecord {
        string bountyId;
        bytes32 verdictHash;
        string winnerAgentId;
        string problemType;
        uint256 payoutAmount; // in USDC micro-units (6 decimals)
        string payoutAsset;
        uint256 timestamp;
        address publisher;
        bool exists;
    }

    struct ReputationRecord {
        int256 reputationDelta;
        uint256 totalWins;
        uint256 totalLosses;
        uint256 lastUpdated;
    }

    // bountyId string -> VerdictRecord
    mapping(string => VerdictRecord) private verdicts;
    // agentWallet -> taskType -> ReputationRecord
    mapping(address => mapping(string => ReputationRecord)) private reputation;

    string[] private bountyIds;

    event VerdictPublished(
        string indexed bountyId,
        bytes32 verdictHash,
        string winnerAgentId,
        string problemType,
        uint256 payoutAmount,
        address indexed publisher,
        uint256 timestamp
    );

    event ReputationUpdated(
        address indexed agentWallet,
        string taskType,
        int256 reputationDelta,
        bytes32 verdictHash,
        uint256 timestamp
    );

    event BountyPaid(
        string indexed bountyId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    modifier onlyOwnerOrPublisher() {
        require(
            msg.sender == owner || authorizedPublishers[msg.sender],
            "Not authorized"
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedPublishers[msg.sender] = true;
    }

    function addPublisher(address publisher) external onlyOwner {
        authorizedPublishers[publisher] = true;
    }

    function removePublisher(address publisher) external onlyOwner {
        authorizedPublishers[publisher] = false;
    }

    /**
     * @notice Publish a verdict proof for a completed bounty
     * @dev Prevents duplicate verdicts for the same bountyId
     */
    function publishVerdict(
        string calldata bountyId,
        bytes32 verdictHash,
        string calldata winnerAgentId,
        string calldata problemType,
        uint256 payoutAmount,
        string calldata payoutAsset
    ) external onlyOwnerOrPublisher {
        require(!verdicts[bountyId].exists, "Verdict already published");
        require(bytes(bountyId).length > 0, "Empty bountyId");
        require(verdictHash != bytes32(0), "Empty verdictHash");

        verdicts[bountyId] = VerdictRecord({
            bountyId: bountyId,
            verdictHash: verdictHash,
            winnerAgentId: winnerAgentId,
            problemType: problemType,
            payoutAmount: payoutAmount,
            payoutAsset: payoutAsset,
            timestamp: block.timestamp,
            publisher: msg.sender,
            exists: true
        });

        bountyIds.push(bountyId);

        emit VerdictPublished(
            bountyId,
            verdictHash,
            winnerAgentId,
            problemType,
            payoutAmount,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Update agent reputation after a verdict
     */
    function updateReputation(
        address agentWallet,
        string calldata taskType,
        int256 reputationDelta,
        bytes32 verdictHash
    ) external onlyOwnerOrPublisher {
        ReputationRecord storage rec = reputation[agentWallet][taskType];
        rec.reputationDelta += reputationDelta;
        rec.lastUpdated = block.timestamp;
        if (reputationDelta > 0) {
            rec.totalWins += 1;
        } else if (reputationDelta < 0) {
            rec.totalLosses += 1;
        }

        emit ReputationUpdated(agentWallet, taskType, reputationDelta, verdictHash, block.timestamp);
    }

    // View functions

    function getVerdict(string calldata bountyId)
        external view
        returns (VerdictRecord memory)
    {
        require(verdicts[bountyId].exists, "Verdict not found");
        return verdicts[bountyId];
    }

    function getAgentReputation(address agentWallet, string calldata taskType)
        external view
        returns (ReputationRecord memory)
    {
        return reputation[agentWallet][taskType];
    }

    function verdictExists(string calldata bountyId) external view returns (bool) {
        return verdicts[bountyId].exists;
    }

    function getBountyCount() external view returns (uint256) {
        return bountyIds.length;
    }
}
