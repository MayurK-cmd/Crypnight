import {
  server,
  STELLAR_TESTNET,
  getAuthorityKeypair,
  PLATFORM_ESCROW_ACCOUNT,
  StellarSdk,
} from '../config/solana.js';

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
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(playerWalletAddress)) {
      throw new Error('Invalid Stellar wallet address');
    }
    console.log(`✅ Player wallet validated: ${playerWalletAddress}`);

    // Get authority account
    const sourceAccount = await server.loadAccount(authorityKeypair.publicKey());
    console.log(`✅ Authority account loaded, sequence: ${sourceAccount.sequence}`);

    // Calculate fee (3%)
    const grossXlm = parseFloat(rewardXlm);
    const feeXlm = (grossXlm * 0.03);
    const playerPayoutXlm = (grossXlm - feeXlm).toFixed(7);

    console.log(`✅ Reward calculated:`);
    console.log(`   Gross: ${grossXlm} XLM`);
    console.log(`   Fee (3%): ${feeXlm.toFixed(7)} XLM`);
    console.log(`   Player receives: ${playerPayoutXlm} XLM`);

    // Build transaction
    const baseFee = await server.fetchBaseFee();
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: Math.ceil(baseFee * 100),
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: playerWalletAddress,
          asset: StellarSdk.Asset.native(),
          amount: playerPayoutXlm,
        })
      )
      .addMemo(StellarSdk.Memo.text('CrypNight Reward'))
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
      fee: parseFloat(feeXlm.toFixed(7)),
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
    const account = await server.loadAccount(PLATFORM_ESCROW_ACCOUNT);
    const nativeBalance = account.balances.find(b => b.asset_type === 'native');
    return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
  } catch (err) {
    console.error('Failed to fetch escrow balance:', err);
    throw err;
  }
};

export { payReward, getTreasuryBalance };
