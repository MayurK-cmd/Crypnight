import dotenv from 'dotenv';
dotenv.config();

import pkg from 'stellar-sdk';
const { Server, Networks, Keypair, Asset, Operation, TransactionBuilder, Memo, StrKey } = pkg;

const STELLAR_TESTNET = {
  networkPassphrase: Networks.TESTNET_NETWORK_PASSPHRASE,
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

let cachedAuthorityKeypair = null;
const getAuthorityKeypair = () => {
  if (!cachedAuthorityKeypair) {
    if (!process.env.PLATFORM_AUTHORITY_SECRET_KEY) {
      throw new Error('PLATFORM_AUTHORITY_SECRET_KEY not set in environment');
    }
    cachedAuthorityKeypair = Keypair.fromSecret(
      process.env.PLATFORM_AUTHORITY_SECRET_KEY
    );
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
