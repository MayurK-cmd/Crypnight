import dotenv from 'dotenv';
dotenv.config();

import StellarSdk from 'stellar-sdk';

const STELLAR_TESTNET = {
  networkPassphrase: StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE,
  horizon: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
};

const server = new StellarSdk.Server(STELLAR_TESTNET.horizon);

let cachedAuthorityKeypair = null;
const getAuthorityKeypair = () => {
  if (!cachedAuthorityKeypair) {
    if (!process.env.PLATFORM_AUTHORITY_SECRET_KEY) {
      throw new Error('PLATFORM_AUTHORITY_SECRET_KEY not set in environment');
    }
    cachedAuthorityKeypair = StellarSdk.Keypair.fromSecret(
      process.env.PLATFORM_AUTHORITY_SECRET_KEY
    );
  }
  return cachedAuthorityKeypair;
};

const PLATFORM_ESCROW_ACCOUNT = process.env.PLATFORM_ESCROW_ACCOUNT;
if (!PLATFORM_ESCROW_ACCOUNT) {
  throw new Error('PLATFORM_ESCROW_ACCOUNT not set in environment');
}

export {
  server,
  STELLAR_TESTNET,
  getAuthorityKeypair,
  PLATFORM_ESCROW_ACCOUNT,
  StellarSdk,
};
