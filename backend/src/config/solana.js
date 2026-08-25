import dotenv from 'dotenv';
dotenv.config();

// Use namespace import — destructuring from a default import of stellar-sdk
// (CJS) loses the `.prototype` chain, so `new Server(...)` throws
// "Server is not a constructor". The namespace form preserves the live
// class references.
import * as StellarSdk from 'stellar-sdk';
// stellar-sdk v11 renamed `Server` → `Horizon.Server`. Keep the local name
// `Server` so the rest of the file (and its consumers) doesn't change.
const { Horizon, Networks, Keypair, Asset, Operation, TransactionBuilder, Memo, StrKey } = StellarSdk;
const Server = Horizon.Server;

const STELLAR_TESTNET = {
  // stellar-sdk v11 flattened `Networks.TESTNET_NETWORK_PASSPHRASE` →
  // `Networks.TESTNET` (the passphrase string itself).
  networkPassphrase: Networks.TESTNET,
  horizon: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
};

let _server = null;
const getServer = () => {
  if (!_server) {
    _server = new Server(STELLAR_TESTNET.horizon);
  }
  return _server;
};

const server = { loadAccount: (addr) => getServer().loadAccount(addr), fetchBaseFee: () => getServer().fetchBaseFee(), submitTransaction: (tx) => getServer().submitTransaction(tx) };

// Authoring keypair for solo payouts. Backed by STELLAR_SOLO_TREASURY_SECRET_KEY
// (the migration renamed PLATFORM_AUTHORITY_SECRET_KEY → STELLAR_SOLO_TREASURY_SECRET_KEY
// in .env but this loader was never updated).
let cachedAuthorityKeypair = null;
const getAuthorityKeypair = () => {
  if (!cachedAuthorityKeypair) {
    const secret = process.env.STELLAR_SOLO_TREASURY_SECRET_KEY;
    if (!secret) {
      throw new Error('STELLAR_SOLO_TREASURY_SECRET_KEY not set in environment');
    }
    cachedAuthorityKeypair = Keypair.fromSecret(secret);
  }
  return cachedAuthorityKeypair;
};

export {
  server,
  STELLAR_TESTNET,
  getAuthorityKeypair,
  Server,
  Networks,
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Memo,
  StrKey,
};
