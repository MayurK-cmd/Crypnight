import {
  server,
  STELLAR_TESTNET,
  getAuthorityKeypair,
  PLATFORM_ESCROW_ACCOUNT,
  StellarSdk,
} from '../config/solana.js';
import { supabase } from '../config/supabase.js';

export const settleDuel = async ({ matchId, winnerWallet, session }) => {
  try {
    const authority = getAuthorityKeypair();

    console.log(`\n💰 SETTLEMENT START - Match: ${matchId}, Winner: ${winnerWallet}\n`);

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(winnerWallet)) {
      throw new Error('Invalid winner wallet address');
    }

    // Get source account for authority
    const sourceAccount = await server.loadAccount(authority.publicKey());
    console.log(`✅ Authority account loaded, sequence: ${sourceAccount.sequence}`);

    // Calculate settlement amount (pot from escrow)
    const settlementXlm = (session.pot_xlm || 0).toString();

    if (parseFloat(settlementXlm) <= 0) {
      console.log(`⚠️  Settlement amount is 0, skipping transaction`);
      await supabase
        .from('duel_sessions')
        .update({
          settle_tx_signature: 'zero_amount',
          status: 'settled',
        })
        .eq('id', session.id);
      return { signature: 'zero_amount', status: 'settled' };
    }

    // Build transaction to send settlement to winner
    const baseFee = await server.fetchBaseFee();
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: Math.ceil(baseFee * 100),
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: winnerWallet,
          asset: StellarSdk.Asset.native(),
          amount: settlementXlm,
        })
      )
      .addMemo(StellarSdk.Memo.text(`Duel:${matchId.substring(0, 8)}`))
      .setTimeout(300)
      .build();

    console.log(`✅ Settlement transaction built`);
    console.log(`   Destination: ${winnerWallet}`);
    console.log(`   Amount: ${settlementXlm} XLM`);

    // Sign transaction
    transaction.sign(authority);
    console.log(`✅ Transaction signed`);

    // Submit transaction
    console.log(`🚀 Submitting settlement transaction...`);
    const result = await server.submitTransaction(transaction);

    console.log(`✅ Settlement transaction confirmed: ${result.hash}`);
    console.log(`   Explorer: https://stellar.expert/explorer/testnet/tx/${result.hash}\n`);

    // Log to database
    await supabase
      .from('duel_sessions')
      .update({
        settle_tx_signature: result.hash,
        status: 'settled',
      })
      .eq('id', session.id);

    console.log(`✅ Settlement recorded in database\n`);

    return { signature: result.hash, status: 'settled' };
  } catch (error) {
    console.error('Settlement error:', error);

    // Log failure to database
    await supabase
      .from('duel_sessions')
      .update({
        status: 'settlement_failed',
      })
      .eq('id', session.id)
      .catch(err => console.error('Failed to log settlement failure:', err));

    throw error;
  }
};

export const refundDuel = async ({ matchId, playerAWallet, playerBWallet, session }) => {
  try {
    const authority = getAuthorityKeypair();

    console.log(`\n🔄 REFUND START - Match: ${matchId}\n`);

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(playerAWallet) ||
        !StellarSdk.StrKey.isValidEd25519PublicKey(playerBWallet)) {
      throw new Error('Invalid player wallet addresses');
    }

    // Get source account
    const sourceAccount = await server.loadAccount(authority.publicKey());

    const refundXlm = (session.stake_xlm || 0).toString();

    if (parseFloat(refundXlm) <= 0) {
      console.log(`⚠️  Refund amount is 0, skipping transaction`);
      await supabase
        .from('duel_sessions')
        .update({ status: 'refunded' })
        .eq('id', session.id);
      return { status: 'refunded' };
    }

    // Build transaction with two payment operations (one to each player)
    const baseFee = await server.fetchBaseFee();
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: Math.ceil(baseFee * 200), // Double fee for 2 operations
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: playerAWallet,
          asset: StellarSdk.Asset.native(),
          amount: refundXlm,
        })
      )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: playerBWallet,
          asset: StellarSdk.Asset.native(),
          amount: refundXlm,
        })
      )
      .addMemo(StellarSdk.Memo.text(`Refund:${matchId.substring(0, 8)}`))
      .setTimeout(300)
      .build();

    console.log(`✅ Refund transaction built`);
    console.log(`   Player A: ${refundXlm} XLM to ${playerAWallet}`);
    console.log(`   Player B: ${refundXlm} XLM to ${playerBWallet}`);

    // Sign and submit
    transaction.sign(authority);
    console.log(`✅ Transaction signed`);

    console.log(`🚀 Submitting refund transaction...`);
    const result = await server.submitTransaction(transaction);

    console.log(`✅ Refund transaction confirmed: ${result.hash}\n`);

    // Log to database
    await supabase
      .from('duel_sessions')
      .update({
        settle_tx_signature: result.hash,
        status: 'refunded',
      })
      .eq('id', session.id);

    return { signature: result.hash, status: 'refunded' };
  } catch (error) {
    console.error('Refund error:', error);

    await supabase
      .from('duel_sessions')
      .update({ status: 'refund_failed' })
      .eq('id', session.id)
      .catch(err => console.error('Failed to log refund failure:', err));

    throw error;
  }
};

export const forfeitDuel = async ({ matchId, forfeitingPlayer, winnerWallet, session }) => {
  try {
    const authority = getAuthorityKeypair();

    console.log(`\n⚠️  FORFEIT START - Match: ${matchId}, Forfeiter: ${forfeitingPlayer}\n`);

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(winnerWallet)) {
      throw new Error('Invalid winner wallet address');
    }

    // Get source account
    const sourceAccount = await server.loadAccount(authority.publicKey());

    // Winner gets the full pot on forfeit
    const winningXlm = (session.pot_xlm || 0).toString();

    if (parseFloat(winningXlm) <= 0) {
      console.log(`⚠️  Forfeit amount is 0, skipping transaction`);
      await supabase
        .from('duel_sessions')
        .update({ status: 'forfeited' })
        .eq('id', session.id);
      return { status: 'forfeited' };
    }

    // Build transaction to send full pot to winner
    const baseFee = await server.fetchBaseFee();
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: Math.ceil(baseFee * 100),
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: winnerWallet,
          asset: StellarSdk.Asset.native(),
          amount: winningXlm,
        })
      )
      .addMemo(StellarSdk.Memo.text(`Forfeit:${matchId.substring(0, 8)}`))
      .setTimeout(300)
      .build();

    console.log(`✅ Forfeit transaction built`);
    console.log(`   Winner: ${winningXlm} XLM to ${winnerWallet}`);

    // Sign and submit
    transaction.sign(authority);
    console.log(`✅ Transaction signed`);

    console.log(`🚀 Submitting forfeit transaction...`);
    const result = await server.submitTransaction(transaction);

    console.log(`✅ Forfeit transaction confirmed: ${result.hash}\n`);

    // Log to database
    await supabase
      .from('duel_sessions')
      .update({
        settle_tx_signature: result.hash,
        status: 'forfeited',
      })
      .eq('id', session.id);

    return { signature: result.hash, status: 'forfeited' };
  } catch (error) {
    console.error('Forfeit error:', error);

    await supabase
      .from('duel_sessions')
      .update({ status: 'forfeit_failed' })
      .eq('id', session.id)
      .catch(err => console.error('Failed to log forfeit failure:', err));

    throw error;
  }
};

export const initializeDuelTreasury = async () => {
  try {
    console.log('✅ Duel treasury initialized (Stellar - no on-chain setup needed)');
    console.log(`   Escrow Account: ${PLATFORM_ESCROW_ACCOUNT}`);
    return { escrow: PLATFORM_ESCROW_ACCOUNT };
  } catch (error) {
    console.error('Initialize treasury error:', error);
    throw error;
  }
};
