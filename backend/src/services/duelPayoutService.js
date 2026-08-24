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

const DUEL_CONTRACT_ID = process.env.STELLAR_DUEL_CONTRACT_ID;
const DUEL_TREASURY = process.env.STELLAR_DUEL_TREASURY_PUBLIC_KEY;

const settleDuel = async (playerWalletAddress, winningsXlm) => {
  console.log(`\n🏆 DUEL SETTLEMENT START - Winner: ${playerWalletAddress}, Winnings: ${winningsXlm} XLM\n`);

  if (!playerWalletAddress) {
    console.error('❌ No wallet address provided');
    throw new Error('Player has no linked wallet address');
  }
  if (winningsXlm <= 0) {
    console.error('❌ Invalid winnings amount:', winningsXlm);
    throw new Error('Winnings must be greater than zero');
  }

  try {
    const authorityKeypair = getAuthorityKeypair();
    console.log(`✅ Authority keypair loaded: ${authorityKeypair.publicKey()}`);

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(playerWalletAddress)) {
      throw new Error('Invalid Stellar wallet address');
    }
    console.log(`✅ Winner wallet validated: ${playerWalletAddress}`);

    const sourceAccount = await server.loadAccount(authorityKeypair.publicKey());
    console.log(`✅ Authority account loaded, sequence: ${sourceAccount.sequence}`);

    const winnerPayout = (parseFloat(winningsXlm) * 0.80).toFixed(7); // 20% fee deducted
    const feeXlm = (parseFloat(winningsXlm) * 0.20).toFixed(7);

    console.log(`✅ Duel settlement calculated:`);
    console.log(`   Total pot: ${winningsXlm} XLM`);
    console.log(`   Fee (20%): ${feeXlm} XLM`);
    console.log(`   Winner receives: ${winnerPayout} XLM`);

    const baseFee = await server.fetchBaseFee();
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: Math.ceil(baseFee * 100),
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: playerWalletAddress,
          asset: Asset.native(),
          amount: winnerPayout,
        })
      )
      .addMemo(Memo.text('CrypNight Duel Win'))
      .setTimeout(300)
      .build();

    console.log(`✅ Transaction built`);

    transaction.sign(authorityKeypair);
    console.log(`✅ Transaction signed`);

    console.log(`🚀 Submitting settlement to Stellar Testnet...`);
    const result = await server.submitTransaction(transaction);

    console.log(`✅ SETTLEMENT SUCCESS`);
    console.log(`   Tx Hash: ${result.hash}`);
    console.log(`   Ledger: ${result.ledger}`);
    console.log(`   Explorer: https://stellar.expert/explorer/testnet/tx/${result.hash}\n`);

    return {
      signature: result.hash,
      winnerPayout: parseFloat(winnerPayout),
      fee: parseFloat(feeXlm),
    };
  } catch (err) {
    console.error(`\n❌ SETTLEMENT FAILED`);
    console.error(`   Error: ${err.message}`);
    if (err.response) {
      console.error(`   Response:`, err.response.data || err.response);
    }
    console.error(`   Stack: ${err.stack}\n`);
    throw err;
  }
};

const refundDuel = async (player1WalletAddress, player2WalletAddress, refundAmountXlm) => {
  console.log(`\n♻️ DUEL REFUND START - Players: ${player1WalletAddress.substring(0, 8)}... & ${player2WalletAddress.substring(0, 8)}..., Refund: ${refundAmountXlm} XLM each\n`);

  if (!player1WalletAddress || !player2WalletAddress) {
    throw new Error('Both player wallet addresses required for refund');
  }
  if (refundAmountXlm <= 0) {
    throw new Error('Refund amount must be greater than zero');
  }

  try {
    const authorityKeypair = getAuthorityKeypair();
    console.log(`✅ Authority keypair loaded: ${authorityKeypair.publicKey()}`);

    [player1WalletAddress, player2WalletAddress].forEach(addr => {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(addr)) {
        throw new Error('Invalid Stellar wallet address');
      }
    });
    console.log(`✅ Both player wallets validated`);

    const sourceAccount = await server.loadAccount(authorityKeypair.publicKey());
    console.log(`✅ Authority account loaded, sequence: ${sourceAccount.sequence}`);

    const baseFee = await server.fetchBaseFee();
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: Math.ceil(baseFee * 200), // Two operations
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: player1WalletAddress,
          asset: Asset.native(),
          amount: refundAmountXlm.toString(),
        })
      )
      .addOperation(
        Operation.payment({
          destination: player2WalletAddress,
          asset: Asset.native(),
          amount: refundAmountXlm.toString(),
        })
      )
      .addMemo(Memo.text('CrypNight Refund'))
      .setTimeout(300)
      .build();

    console.log(`✅ Refund transaction built for both players`);

    transaction.sign(authorityKeypair);
    console.log(`✅ Transaction signed`);

    console.log(`🚀 Submitting refund to Stellar Testnet...`);
    const result = await server.submitTransaction(transaction);

    console.log(`✅ REFUND SUCCESS`);
    console.log(`   Tx Hash: ${result.hash}`);
    console.log(`   Ledger: ${result.ledger}`);
    console.log(`   Explorer: https://stellar.expert/explorer/testnet/tx/${result.hash}\n`);

    return {
      signature: result.hash,
      player1Refund: parseFloat(refundAmountXlm),
      player2Refund: parseFloat(refundAmountXlm),
    };
  } catch (err) {
    console.error(`\n❌ REFUND FAILED`);
    console.error(`   Error: ${err.message}`);
    if (err.response) {
      console.error(`   Response:`, err.response.data || err.response);
    }
    console.error(`   Stack: ${err.stack}\n`);
    throw err;
  }
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
