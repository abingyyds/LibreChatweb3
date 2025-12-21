const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const { logger } = require('@librechat/data-schemas');

const PROOF_OF_OWNERSHIP_ADDRESS = '0x7587CA385f1e10c411638003dA0f1bd3C99b919e';
const CLUB_MANAGER_ADDRESS = '0xd4BAB0d82948955B09760F26F5EDd5E19F2Bee55';
const MEMBERSHIP_QUERY_ADDRESS = '0x2A152405afB201258D66919570BbD4625455a65f';
const REQUIRED_CLUB_NAME = 'justhub';

const abi = parseAbi([
  'function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[1] input) returns (address hashDeployer, bool isValid)',
]);

const clubManagerAbi = parseAbi([
  'function getClubDetails(string domainName) view returns (uint256 domainId, address admin, bool active, uint256 memberCount, string name, string symbol, string description, string logoURL, string bannerURL, string baseURI)',
]);

const membershipQueryAbi = parseAbi([
  'function checkDetailedMembership(address member, string domainName) view returns (bool isPermanent, bool isTemporary, bool isTokenBased, bool isCrossChain)',
]);

/**
 * @typedef {Object} ZkpPayload
 * @property {[string, string]} a
 * @property {[[string, string], [string, string]]} b
 * @property {[string, string]} c
 * @property {[string]} input
 */

/**
 * Parse ZKP code from string or object format
 * @param {string | ZkpPayload} input
 * @returns {ZkpPayload}
 */
function parseZkpCode(input) {
  if (typeof input === 'string') {
    const s = input.trim();
    if (s.startsWith('{')) {
      return JSON.parse(s);
    }
    // Remove zero-width spaces and other invisible characters
    const cleanStr = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    const parts = cleanStr.split(/\s*,\s*/).map((p) => p.trim());
    if (parts.length !== 9) {
      throw new Error('INVALID_ZKP_CODE');
    }
    return {
      a: [parts[0], parts[1]],
      b: [
        [parts[2], parts[3]],
        [parts[4], parts[5]],
      ],
      c: [parts[6], parts[7]],
      input: [parts[8]],
    };
  }
  return input;
}

/**
 * Convert ZKP payload to contract arguments
 * @param {ZkpPayload} payload
 * @returns {{ a: [bigint, bigint], b: [[bigint, bigint], [bigint, bigint]], c: [bigint, bigint], input: [bigint] }}
 */
function toContractArgs(payload) {
  const a = [BigInt(payload.a[0]), BigInt(payload.a[1])];
  const b = [
    [BigInt(payload.b[0][0]), BigInt(payload.b[0][1])],
    [BigInt(payload.b[1][0]), BigInt(payload.b[1][1])],
  ];
  const c = [BigInt(payload.c[0]), BigInt(payload.c[1])];
  const input = [BigInt(payload.input[0])];
  return { a, b, c, input };
}

const RPC_URL = 'https://base-mainnet.infura.io/v3/64154bb5696a46eb841b6c687260559a';

/**
 * Get configured viem clients
 * @returns {{ publicClient: import('viem').PublicClient, walletClient: import('viem').WalletClient | null, account: import('viem/accounts').PrivateKeyAccount | null }}
 */
function getClients() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });

  const privateKey = process.env.ZKP_PRIVATE_KEY;
  let walletClient = null;
  let account = null;

  if (privateKey) {
    account = privateKeyToAccount(
      privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
    );
    walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(RPC_URL),
    });
  }

  return { publicClient, walletClient, account };
}

/**
 * Verify ZKP proof on-chain
 * @param {string | ZkpPayload} zkpCode
 * @returns {Promise<{ isValid: boolean, address: string, zkpHash: string, txHash?: string }>}
 */
async function verifyZkpProof(zkpCode) {
  const payload = parseZkpCode(zkpCode);
  const { a, b, c, input } = toContractArgs(payload);
  const { publicClient, walletClient, account } = getClients();

  // Simulate the contract call to verify the proof
  const sim = await publicClient.simulateContract({
    account,
    address: PROOF_OF_OWNERSHIP_ADDRESS,
    abi,
    functionName: 'verifyProof',
    args: [a, b, c, input],
  });

  const [address, isValid] = sim.result;

  if (!isValid) {
    return { isValid: false, address: '', zkpHash: '' };
  }

  const zkpHash = payload.input[0];

  // Write the verification transaction on-chain
  let txHash;
  if (walletClient) {
    try {
      txHash = await walletClient.writeContract({
        address: PROOF_OF_OWNERSHIP_ADDRESS,
        abi,
        functionName: 'verifyProof',
        args: [a, b, c, input],
      });
      logger.info(`[ZKP] Proof verified on-chain. TxHash: ${txHash}`);
    } catch (err) {
      logger.warn('[ZKP] Failed to write proof on-chain:', err.message);
    }
  }

  return { isValid: true, address, zkpHash, txHash };
}

/**
 * Check if an address is a member or owner of the required club
 * @param {string} userAddress - The user's wallet address
 * @returns {Promise<{ isMember: boolean, isOwner: boolean, clubName: string }>}
 */
async function checkClubMembership(userAddress) {
  const { publicClient } = getClients();

  try {
    // Get club details to check if user is owner
    const details = await publicClient.readContract({
      address: CLUB_MANAGER_ADDRESS,
      abi: clubManagerAbi,
      functionName: 'getClubDetails',
      args: [REQUIRED_CLUB_NAME],
    });

    const [, admin, active] = details;

    if (!active) {
      logger.warn(`[ZKP] Club ${REQUIRED_CLUB_NAME} is not active`);
      return { isMember: false, isOwner: false, clubName: REQUIRED_CLUB_NAME };
    }

    // Check if user is owner
    const isOwner = admin.toLowerCase() === userAddress.toLowerCase();

    // Check membership status
    const membership = await publicClient.readContract({
      address: MEMBERSHIP_QUERY_ADDRESS,
      abi: membershipQueryAbi,
      functionName: 'checkDetailedMembership',
      args: [userAddress, REQUIRED_CLUB_NAME],
    });

    const [isPermanent, isTemporary, isTokenBased, isCrossChain] = membership;
    const isMember = isPermanent || isTemporary || isTokenBased || isCrossChain || isOwner;

    logger.info(
      `[ZKP] Club membership check for ${userAddress}: isMember=${isMember}, isOwner=${isOwner}`,
    );

    return { isMember, isOwner, clubName: REQUIRED_CLUB_NAME };
  } catch (err) {
    logger.error('[ZKP] Failed to check club membership:', err.message);
    throw new Error('CLUB_CHECK_FAILED');
  }
}

module.exports = {
  parseZkpCode,
  verifyZkpProof,
  checkClubMembership,
};
