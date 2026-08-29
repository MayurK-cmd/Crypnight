import {
  server,
  STELLAR_TESTNET,
  getAuthorityKeypair,
  Asset,
  Operation,
  TransactionBuilder,
  Memo,
  StrKey,
} from '../config/solana.js';
import {
  invokeSettleDuel,
  invokeRefundDuel,
} from './sorobanService.js';

const DUEL_CONTRACT_ID = process.env.STELLAR_DUEL_CONTRACT_ID;
const DUEL_TREASURY = process.env.STELLAR_DUEL_TREASURY_PUBLIC_KEY;

const DUEL_PLATFORM_FEE_BPS = 2000; // 20% — matches contract's PLATFORM_FEE_BPS
const BPS_DENOMINATOR = 10_000;

// The duel contract's settle_duel() takes a winner address and computes the
// fee + payout internally using its own stake/pot state. We mirror that math
// here on the classic-payment side using session.stake_sol (column name
// retained from the original schema; values are in XLM).
const computeWinnerPayoutXlm = (session) => {
  const stakeXlm = parseFloat(session.stake_sol);
  if (!Number.isFinite(stakeXlm) || stakeXlm <= 0) {
    throw new Error(`Invalid stake_sol on duel session ${session.id}: ${session.stake_sol}`);
  }
  const potXlm = stakeXlm * 2;
  const feeXlm = (potXlm * DUEL_PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
  return {
    potXlm,
    feeXlm,
    winnerPayoutXlm: potXlm - feeXlm,
  };
};

// Orchestrator — settle a duel: classic payout + Soroban settle_duel().
// Mirrors the controller's call site:
//   await settleDuel({ matchId, winnerWallet, session });
const settleDuel = async ({ matchId, winnerWallet, session }) => {
  if (!winnerWallet) throw new Error('winnerWallet required');
  if (!session) throw new Error('session required');
  if (!StrKey.isValidEd25519PublicKey(winnerWallet)) {
    throw new Error('Invalid Stellar wallet address');
  }

  const { potXlm, feeXlm, winnerPayoutXlm } = computeWinnerPayoutXlm(session);
  console.log(
    `\n🏆 DUEL SETTLEMENT - Winner: ${winnerWallet}, pot=${potXlm} XLM, fee=${feeXlm} XLM, payout=${winnerPayoutXlm} XLM\n`
  );

  const classic = await sendClassicWinnerPayment(winnerWallet, winnerPayoutXlm);

  let contractResult = null;
  try {
    contractResult = await invokeSettleDuel({
      matchId,
      winnerAddress: winnerWallet,
    });
    console.log(
      `[duelPayoutService] Soroban settle_duel confirmed: hash=${contractResult.hash} status=${contractResult.status}`
    );
  } catch (err) {
    console.error(
      `[duelPayoutService] Soroban settle_duel failed AFTER classic payment (${classic.signature}):`,
      err.message
    );
    // Player has been paid — do not throw. Ledger lag is an ops concern.
  }

  return {
    signature: classic.signature,
    winnerPayout: winnerPayoutXlm,
    fee: feeXlm,
    contractTxHash: contractResult?.hash ?? null,
    contractStatus: contractResult?.status ?? 'FAILED',
  };
};

// Refund on a draw / cancel: classic refunds + Soroban refund_duel().
// Controller call site:
//   await refundDuel({ matchId, playerAWallet, playerBWallet, session });
const refundDuel = async ({ matchId, playerAWallet, playerBWallet, session }) => {
  if (!playerAWallet || !playerBWallet) throw new Error('Both player wallets required');
  if (!session) throw new Error('session required');

  if (!StrKey.isValidEd25519PublicKey(playerAWallet) ||
      !StrKey.isValidEd25519PublicKey(playerBWallet)) {
    throw new Error('Invalid Stellar wallet address');
  }

  const stakeXlm = parseFloat(session.stake_sol);
  if (!Number.isFinite(stakeXlm) || stakeXlm <= 0) {
    throw new Error(`Invalid stake_sol on duel session ${session.id}: ${session.stake_sol}`);
  }
  const refundAmountXlm = stakeXlm; // each player gets their stake back

  console.log(
    `\n♻️ DUEL REFUND - Players: ${playerAWallet.substring(0, 8)}... & ${playerBWallet.substring(0, 8)}..., refund=${refundAmountXlm} XLM each\n`
  );

  const classic = await sendClassicRefundPayments(playerAWallet, playerBWallet, refundAmountXlm);

  let contractResult = null;
  try {
    contractResult = await invokeRefundDuel({ matchId });
    console.log(
      `[duelPayoutService] Soroban refund_duel confirmed: hash=${contractResult.hash} status=${contractResult.status}`
    );
  } catch (err) {
    console.error(
      `[duelPayoutService] Soroban refund_duel failed AFTER classic refunds (${classic.signature}):`,
      err.message
    );
  }

  return {
    signature: classic.signature,
    player1Refund: refundAmountXlm,
    player2Refund: refundAmountXlm,
    contractTxHash: contractResult?.hash ?? null,
    contractStatus: contractResult?.status ?? 'FAILED',
  };
};

// ---- internal: classic-payment helpers (one op for winner, two ops for refund) ----

const sendClassicWinnerPayment = async (winnerWallet, amountXlm) => {
  const authorityKeypair = getAuthorityKeypair();
  const sourceAccount = await server.loadAccount(authorityKeypair.publicKey());
  const baseFee = await server.fetchBaseFee();

  const tx = new TransactionBuilder(sourceAccount, {
    fee: Math.ceil(baseFee * 100),
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: winnerWallet,
        asset: Asset.native(),
        amount: amountXlm.toFixed(7),
      })
    )
    .addMemo(Memo.text('CrypNight Duel Win'))
    .setTimeout(300)
    .build();

  tx.sign(authorityKeypair);
  console.log(`🚀 Submitting duel winner payout to Stellar Testnet...`);
  const result = await server.submitTransaction(tx);
  console.log(`✅ DUEL WINNER PAYOUT SUCCESS hash=${result.hash}`);
  return { signature: result.hash };
};

const sendClassicRefundPayments = async (p1, p2, amountXlm) => {
  const authorityKeypair = getAuthorityKeypair();
  const sourceAccount = await server.loadAccount(authorityKeypair.publicKey());
  const baseFee = await server.fetchBaseFee();

  const tx = new TransactionBuilder(sourceAccount, {
    fee: Math.ceil(baseFee * 200), // Two operations
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: p1,
        asset: Asset.native(),
        amount: amountXlm.toFixed(7),
      })
    )
    .addOperation(
      Operation.payment({
        destination: p2,
        asset: Asset.native(),
        amount: amountXlm.toFixed(7),
      })
    )
    .addMemo(Memo.text('CrypNight Refund'))
    .setTimeout(300)
    .build();

  tx.sign(authorityKeypair);
  console.log(`🚀 Submitting duel refund to Stellar Testnet...`);
  const result = await server.submitTransaction(tx);
  console.log(`✅ DUEL REFUND SUCCESS hash=${result.hash}`);
  return { signature: result.hash };
};

const getTreasuryBalance = async () => {
  try {
    const account = await server.loadAccount(DUEL_TREASURY);
    const nativeBalance = account.balances.find(b => b.asset_type === 'native');
    return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
  } catch (err) {
    console.error('Failed to fetch duel treasury balance:', err);
    throw err;
  }
};

export { settleDuel, refundDuel, getTreasuryBalance };
