// Soroban RPC wrapper.
//
// stellar-sdk v11 exposes SorobanRpc.Server for talking to the Soroban RPC
// endpoint (separate from Horizon). It provides the three-step flow that
// classic transactions do not:
//
//   1. simulateTransaction  — dry-run to learn the resource fees + footprint
//   2. prepareTransaction    — assemble/price the real tx using the sim result
//   3. sendTransaction       — submit; poll getTransaction for confirmation
//
// We use namespace import for the same reason as config/solana.js: stellar-sdk
// v11's default export loses the `.prototype` chain on classes.

import * as StellarSdk from 'stellar-sdk';
import { getAuthorityKeypair } from '../config/solana.js';
import { server as horizonServer, STELLAR_TESTNET } from '../config/solana.js';

const SOROBAN_RPC_URL =
  process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

let _sorobanServer = null;
const getSorobanServer = () => {
  if (!_sorobanServer) {
    _sorobanServer = new StellarSdk.SorobanRpc.Server(SOROBAN_RPC_URL, {
      allowHttp: false,
    });
  }
  return _sorobanServer;
};

// Build, simulate, prepare, sign, submit, and poll a contract invocation.
//
// `args` is an array of raw JS values (Address instances, native bigints for
// i128, plain strings, etc). They're wrapped via nativeToScVal inside here.
//
// The signer is always the platform admin keypair (STELLAR_SOLO_TREASURY_SECRET_KEY)
// because every money-moving entry point on both contracts calls
// `admin.require_auth()`. The player never has authority to invoke these.
const invokeContract = async ({ contractId, method, args = [] }) => {
  const contract = new StellarSdk.Contract(contractId);
  const scArgs = args.map((a) => StellarSdk.nativeToScVal(a));

  const signer = getAuthorityKeypair();

  // Horizon still serves source-account lookups for the signer's seq number.
  const sourceAccount = await horizonServer.loadAccount(signer.publicKey());

  let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE, // placeholder; prepareTransaction overwrites
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const sorobanServer = getSorobanServer();
  tx = await sorobanServer.prepareTransaction(tx);
  tx.sign(signer);

  const sendResp = await sorobanServer.sendTransaction(tx);

  // sendTransaction returns immediately with a status. For non-PENDING it has
  // already failed — surface that. Otherwise poll for inclusion.
  if (sendResp.status !== 'PENDING') {
    const err = new Error(
      `Soroban sendTransaction returned status=${sendResp.status}: ${JSON.stringify(
        sendResp.errorResult ?? sendResp
      )}`
    );
    err.sendResponse = sendResp;
    throw err;
  }

  const hash = sendResp.hash;
  const getResp = await pollUntilConfirmed(sorobanServer, hash);

  return {
    hash,
    status: getResp.status,
    result: getResp.returnValue
      ? StellarSdk.scValToNative(getResp.returnValue)
      : null,
    ledger: getResp.ledger,
  };
};

// Poll getTransaction up to ~30s waiting for the tx to land.
const pollUntilConfirmed = async (sorobanServer, hash) => {
  const start = Date.now();
  const POLL_INTERVAL_MS = 1000;
  const TIMEOUT_MS = 30_000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await sorobanServer.getTransaction(hash);

    if (resp.status === 'SUCCESS' || resp.status === 'FAILED') {
      return resp;
    }

    if (Date.now() - start > TIMEOUT_MS) {
      const err = new Error(
        `Soroban tx ${hash} did not confirm within ${TIMEOUT_MS}ms (last status: ${resp.status})`
      );
      err.lastResponse = resp;
      throw err;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
};

// Helper: convert XLM string/number to stroops bigint for contract args.
const xlmToStroopsBigInt = (xlm) => {
  // toFixed(7) keeps the 7-decimal stroop precision, then we parse as bigint.
  const stroopsStr = (Math.round(parseFloat(xlm) * 10_000_000)).toString();
  return BigInt(stroopsStr);
};

// Solo contract entry points -------------------------------------------------

const soloContractId = () => process.env.STELLAR_SOLO_CONTRACT_ID;

const invokeSoloPayReward = async (playerAddress, grossRewardXlm) => {
  if (!soloContractId()) throw new Error('STELLAR_SOLO_CONTRACT_ID not set');
  return invokeContract({
    contractId: soloContractId(),
    method: 'pay_reward',
    args: [
      new StellarSdk.Address(playerAddress),
      xlmToStroopsBigInt(grossRewardXlm),
    ],
  });
};

// Duel contract entry points -------------------------------------------------

const duelContractId = () => process.env.STELLAR_DUEL_CONTRACT_ID;

// tier: canonical short form. Contracts encode tier as i32:
//   beginner=0, intermediate=1, pro=2, gm=3
const TIER_TO_INT = { beginner: 0, intermediate: 1, pro: 2, gm: 3 };
const intToTier = (i) =>
  ({ 0: 'beginner', 1: 'intermediate', 2: 'pro', 3: 'gm' }[i] ?? null);

const invokeCreateDuelEscrow = async ({ matchId, playerA, playerB, tier }) => {
  if (!duelContractId()) throw new Error('STELLAR_DUEL_CONTRACT_ID not set');
  if (!(tier in TIER_TO_INT)) throw new Error(`Unknown tier: ${tier}`);
  return invokeContract({
    contractId: duelContractId(),
    method: 'create_duel_escrow',
    args: [
      matchId,
      new StellarSdk.Address(playerA),
      new StellarSdk.Address(playerB),
      TIER_TO_INT[tier],
    ],
  });
};

const invokeJoinDuelEscrow = async ({ matchId, playerB }) => {
  if (!duelContractId()) throw new Error('STELLAR_DUEL_CONTRACT_ID not set');
  return invokeContract({
    contractId: duelContractId(),
    method: 'join_duel_escrow',
    args: [matchId, new StellarSdk.Address(playerB)],
  });
};

const invokeSettleDuel = async ({ matchId, winnerAddress }) => {
  if (!duelContractId()) throw new Error('STELLAR_DUEL_CONTRACT_ID not set');
  return invokeContract({
    contractId: duelContractId(),
    method: 'settle_duel',
    args: [matchId, new StellarSdk.Address(winnerAddress)],
  });
};

const invokeRefundDuel = async ({ matchId }) => {
  if (!duelContractId()) throw new Error('STELLAR_DUEL_CONTRACT_ID not set');
  return invokeContract({
    contractId: duelContractId(),
    method: 'refund_duel',
    args: [matchId],
  });
};

const invokeForfeitDuel = async ({ matchId, forfeitingPlayer }) => {
  if (!duelContractId()) throw new Error('STELLAR_DUEL_CONTRACT_ID not set');
  return invokeContract({
    contractId: duelContractId(),
    method: 'forfeit_duel',
    args: [matchId, new StellarSdk.Address(forfeitingPlayer)],
  });
};

export {
  invokeContract,
  invokeSoloPayReward,
  invokeCreateDuelEscrow,
  invokeJoinDuelEscrow,
  invokeSettleDuel,
  invokeRefundDuel,
  invokeForfeitDuel,
  xlmToStroopsBigInt,
  TIER_TO_INT,
  intToTier,
};
