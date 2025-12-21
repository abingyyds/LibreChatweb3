const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { verifyZkpProof, checkClubMembership } = require('~/server/services/ZkpService');
const { setAuthTokens } = require('~/server/services/AuthService');
const { findUser, createUser, updateUser, countUsers } = require('~/models');
const { getAppConfig } = require('~/server/services/Config');

/**
 * ZKP Login Controller
 * Authenticates users using Zero-Knowledge Proof via blockchain verification
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const zkpLoginController = async (req, res) => {
  try {
    const { zkpCode } = req.body;

    if (!zkpCode) {
      logger.error('[ZKP Login] Missing zkpCode in request body');
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'zkpCode is required' });
    }

    // Verify the ZKP proof on-chain
    let verificationResult;
    try {
      verificationResult = await verifyZkpProof(zkpCode);
    } catch (err) {
      logger.error('[ZKP Login] Proof verification error:', err);
      return res.status(400).json({ error: 'INVALID_ZKP_CODE', message: err.message });
    }

    const { isValid, address, zkpHash, txHash } = verificationResult;

    if (!isValid) {
      logger.error(`[ZKP Login] Invalid proof for address attempt`);
      return res.status(401).json({ error: 'PROOF_INVALID', message: 'ZKP proof is invalid' });
    }

    logger.info(`[ZKP Login] Valid proof for address: ${address}`);

    // Check club membership
    let clubMembership;
    try {
      clubMembership = await checkClubMembership(address);
    } catch (err) {
      logger.error('[ZKP Login] Club membership check error:', err);
      return res.status(500).json({ error: 'CLUB_CHECK_FAILED', message: 'Failed to verify club membership' });
    }

    if (!clubMembership.isMember && !clubMembership.isOwner) {
      logger.error(`[ZKP Login] User ${address} is not a member of club ${clubMembership.clubName}`);
      return res.status(403).json({
        error: 'NOT_CLUB_MEMBER',
        message: `You must be a member of ${clubMembership.clubName} to access this application`,
      });
    }

    logger.info(`[ZKP Login] User ${address} is a member of club ${clubMembership.clubName}`);

    // Find or create user by wallet address
    let user = await findUser({ walletAddress: address });

    if (!user) {
      // Check if this is the first user (make admin)
      const isFirstUser = (await countUsers()) === 0;
      const appConfig = await getAppConfig();

      // Create new user with wallet address as identifier
      const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const newUserData = {
        provider: 'zkp',
        email: '',
        walletAddress: address,
        zkpId: address,
        zkpHash: zkpHash,
        emailVerified: true, // ZKP users don't need email verification
        name: displayName,
        username: displayName,
        role: isFirstUser ? SystemRoles.ADMIN : SystemRoles.USER,
      };

      user = await createUser(newUserData, appConfig?.balance, true, false);
      logger.info(`[ZKP Login] Created new user for wallet: ${address}`);
    } else {
      // Update zkpHash on each login
      await updateUser(user._id, { zkpHash });
      logger.info(`[ZKP Login] Updated zkpHash for existing user: ${address}`);
    }

    // Remove sensitive fields from user object
    const { password: _p, totpSecret: _t, __v, ...safeUser } = user.toObject ? user.toObject() : user;
    safeUser.id = safeUser._id.toString();

    // Set authentication tokens
    const token = await setAuthTokens(user._id, res);

    logger.info(`[ZKP Login] Login successful for wallet: ${address}`);

    return res.status(200).json({
      token,
      user: safeUser,
      address,
      txHash,
    });
  } catch (err) {
    logger.error('[ZKP Login] Controller error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'An error occurred during ZKP authentication',
      details: err.message,
      stack: err.stack,
    });
  }
};

module.exports = {
  zkpLoginController,
};
