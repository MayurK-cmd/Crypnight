import {
  server,
  STELLAR_TESTNET,
  getAuthorityKeypair,
  Server,
  Asset,
  Operation,
  TransactionBuilder,
  Memo,
  StrKey,
} from '../config/solana.js';

const SOLO_CONTRACT_ID = process.env.STELLAR_SOLO_CONTRACT_ID;
const SOLO_TREASURY = process.env.STELLAR_SOLO_TREASURY_PUBLIC_KEY;

const payReward = async (playerWalletAddress, rewardXlm) => {
  console.log(`\n💰 PAYOUT START - Player: ${playerWalletAddress}, Reward: ${rewardXlm} XLM\n`);

  if (!playerWalletAddress) {
    console.error('❌ No wallet address provided');
    throw new Error('Player has no linked wallet address');
  }
  if (rewardXlm <= 0) {
    console.error('❌ Invalid reward amount:', rewardXlm);
    throw new Error('Reward must be greater than zero');
  }

  try {
    const authorityKeypair = getAuthorityKeypair();
    console.log(`✅ Authority keypair loaded: ${authorityKeypair.publicKey()}`);

    // Verify player wallet address is valid
    if (!StrKey.isValidEd25519PublicKey(playerWalletAddress)) {
      throw new Error('Invalid Stellar wallet address');
    }
    console.log(`✅ Player wallet validated: ${playerWalletAddress}`);

    // Get authority account
    const sourceAccount = await server.loadAccount(authorityKeypair.publicKey());
    console.log(`✅ Authority account loaded, sequence: ${sourceAccount.sequence}`);

    const playerPayoutXlm = (parseFloat(rewardXlm) * 0.97).toFixed(7); // 3% fee deducted
    const feeXlm = (parseFloat(rewardXlm) * 0.03).toFixed(7);

    console.log(`✅ Reward calculated:`);
    console.log(`   Gross: ${rewardXlm} XLM`);
    console.log(`   Fee (3%): ${feeXlm} XLM`);
    console.log(`   Player receives: ${playerPayoutXlm} XLM`);

    // Build transaction - transfer player payout from treasury to player
    const baseFee = await server.fetchBaseFee();
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: Math.ceil(baseFee * 100),
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: playerWalletAddress,
          asset: Asset.native(),
          amount: playerPayoutXlm,
        })
      )
      .addMemo(Memo.text('CrypNight Reward'))
      .setTimeout(300)
      .build();

    console.log(`✅ Transaction built`);

    // Sign transaction
    transaction.sign(authorityKeypair);
    console.log(`✅ Transaction signed`);

    // Submit transaction
    console.log(`🚀 Submitting transaction to Stellar Testnet...`);
    const result = await server.submitTransaction(transaction);

    console.log(`✅ PAYOUT SUCCESS`);
    console.log(`   Tx Hash: ${result.hash}`);
    console.log(`   Ledger: ${result.ledger}`);
    console.log(`   Explorer: https://stellar.expert/explorer/testnet/tx/${result.hash}\n`);

    return {
      signature: result.hash,
      playerPayout: parseFloat(playerPayoutXlm),
      fee: parseFloat(feeXlm),
    };
  } catch (err) {
    console.error(`\n❌ PAYOUT FAILED`);
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
    const account = await server.loadAccount(SOLO_TREASURY);
    const nativeBalance = account.balances.find(b => b.asset_type === 'native');
    return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
  } catch (err) {
    console.error('Failed to fetch treasury balance:', err);
    throw err;
  }
};

export { payReward, getTreasuryBalance };
