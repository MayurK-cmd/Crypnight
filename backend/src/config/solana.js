import dotenv from 'dotenv';
dotenv.config();

import * as anchor from '@coral-xyz/anchor';
import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';
import bs58 from 'bs58';

const baseConnection = new anchor.web3.Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

const erConnection = new ConnectionMagicRouter(
  process.env.MAGICBLOCK_ROUTER_URL || 'https://devnet-router.magicblock.app',
  {
    wsEndpoint: process.env.MAGICBLOCK_WS_URL || 'wss://devnet-router.magicblock.app',
  }
);

let cachedAuthorityKeypair = null;
const getAuthorityKeypair = () => {
  if (!cachedAuthorityKeypair) {
    if (!process.env.PLATFORM_AUTHORITY_PRIVATE_KEY) {
      throw new Error('PLATFORM_AUTHORITY_PRIVATE_KEY not set in environment');
    }
    cachedAuthorityKeypair = anchor.web3.Keypair.fromSecretKey(
      bs58.decode(process.env.PLATFORM_AUTHORITY_PRIVATE_KEY)
    );
  }
  return cachedAuthorityKeypair;
};

const programId = new anchor.web3.PublicKey(process.env.SOLANA_PROGRAM_ID);
const PLATFORM_TREASURY_PDA = new anchor.web3.PublicKey(
  process.env.PLATFORM_TREASURY_PUBKEY
);

export {
  baseConnection,
  erConnection,
  getAuthorityKeypair,
  programId,
  PLATFORM_TREASURY_PDA,
  anchor,
};
