// Browser-side Soroban helpers.
//
// Builds, signs (via Freighter), and submits InvokeHostFunctionOp transactions
// for the no-auth contract entry points. The admin-gated ones
// (pay_reward, settle_duel, refund_duel, forfeit_duel) are called server-side
// because they require admin.require_auth() and the player doesn't hold the
// admin key. The on-chain hash for those calls is returned by the backend
// after the backend invokes them, so the UI can still surface the contract
// tx hash even when the player isn't the signer.

import * as StellarSdk from "stellar-sdk";
import { signTransaction as freighterSignTransaction } from "@stellar/freighter-api";

const RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";

const NETWORK_PASSPHRASE =
  import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ||
  StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE;

const HORIZON_URL =
  import.meta.env.VITE_STELLAR_HORIZON || "https://horizon-testnet.stellar.org";

let _rpcServer = null;
const getRpcServer = () => {
  if (!_rpcServer) _rpcServer = new StellarSdk.SorobanRpc.Server(RPC_URL);
  return _rpcServer;
};

// Arg encoders — the contract signatures use:
//   - String      → scValTypeSymbol/string
//   - Address     → scAddress type
//   - i32 tier    → nativeToScVal(number) covers it
const encodeArg = (value) => {
  if (value instanceof StellarSdk.Address) {
    return value.toScVal();
  }
  return StellarSdk.nativeToScVal(value);
};

// Build + simulate + prepare an InvokeHostFunctionOp for `method` on
// `contractId`, signed by `signerPublicKey`. Returns the prepared XDR for
// the caller to hand to Freighter.
const buildInvokeTx = async ({ contractId, method, args, signerPublicKey }) => {
  if (!contractId) throw new Error("contractId required");
  if (!method) throw new Error("method required");
  if (!signerPublicKey) throw new Error("signerPublicKey required");

  const contract = new StellarSdk.Contract(contractId);
  const scArgs = args.map(encodeArg);

  // Source account lookup via Horizon (same network as Soroban RPC).
  const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);
  const sourceAccount = await horizon.loadAccount(signerPublicKey);

  let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE, // placeholder; prepareTransaction overwrites
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  tx = await getRpcServer().prepareTransaction(tx);
  return tx.toXDR();
};

// Sign the prepared XDR with Freighter, submit to Soroban RPC, and poll for
// the final status. Returns { hash, status }.
const signAndSubmit = async ({ preparedXdr, signerPublicKey }) => {
  const signedRes = await freighterSignTransaction(preparedXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  // freighter-api v6 returns { signedTxResult: "<xdr>" }; older versions
  // returned the XDR string directly. Accept both.
  const signedXdr =
    (signedRes && typeof signedRes === "object"
      ? signedRes.signedTxResult
      : signedRes) || null;

  if (!signedXdr) {
    throw new Error("Freighter did not return a signed transaction");
  }

  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE
  );

  const sendResp = await getRpcServer().sendTransaction(tx);
  if (sendResp.status !== "PENDING") {
    throw new Error(
      `Soroban sendTransaction returned status=${sendResp.status}: ${JSON.stringify(
        sendResp.errorResult ?? sendResp
      )}`
    );
  }

  const hash = sendResp.hash;
  const finalResp = await pollUntilConfirmed(hash);
  return { hash, status: finalResp.status };
};

const pollUntilConfirmed = async (hash) => {
  const start = Date.now();
  const POLL_INTERVAL_MS = 1000;
  const TIMEOUT_MS = 30_000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await getRpcServer().getTransaction(hash);
    if (resp.status === "SUCCESS" || resp.status === "FAILED") return resp;
    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error(
        `Soroban tx ${hash} did not confirm within ${TIMEOUT_MS}ms (last: ${resp.status})`
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
};

// High-level helpers for the two no-auth contract calls.

// create_duel_escrow(match_id, player_a, player_b, tier_i32)
const createDuelEscrow = async ({ matchId, playerA, playerB, tier, signerPublicKey }) => {
  const TIER_TO_INT = { beginner: 0, intermediate: 1, pro: 2, gm: 3 };
  if (!(tier in TIER_TO_INT)) throw new Error(`Unknown tier: ${tier}`);

  const contractId = import.meta.env.VITE_DUEL_CONTRACT_ID;
  if (!contractId) throw new Error("VITE_DUEL_CONTRACT_ID not set");

  const xdr = await buildInvokeTx({
    contractId,
    method: "create_duel_escrow",
    args: [
      matchId,
      new StellarSdk.Address(playerA),
      new StellarSdk.Address(playerB),
      TIER_TO_INT[tier],
    ],
    signerPublicKey,
  });

  return signAndSubmit({ preparedXdr: xdr, signerPublicKey });
};

// join_duel_escrow(match_id, player_b)
const joinDuelEscrow = async ({ matchId, playerB, signerPublicKey }) => {
  const contractId = import.meta.env.VITE_DUEL_CONTRACT_ID;
  if (!contractId) throw new Error("VITE_DUEL_CONTRACT_ID not set");

  const xdr = await buildInvokeTx({
    contractId,
    method: "join_duel_escrow",
    args: [matchId, new StellarSdk.Address(playerB)],
    signerPublicKey,
  });

  return signAndSubmit({ preparedXdr: xdr, signerPublicKey });
};

export {
  buildInvokeTx,
  signAndSubmit,
  createDuelEscrow,
  joinDuelEscrow,
};
