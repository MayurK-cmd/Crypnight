import dotenv from 'dotenv';
dotenv.config();

import { payReward, getTreasuryBalance } from './src/services/payoutService.js';
import { erConnection, PLATFORM_TREASURY_PDA, getAuthorityKeypair, anchor } from './src/config/solana.js';

const testWallet = 'CHEXaU5Z1SjDVqUfu4zWkK2tpApWd2C31RhvFxq7ZRXX';
const testReward = 0.01;

async function runTest() {
  try {
    console.log('Testing payout system...\n');

    // Check what authority is stored in the treasury account
    const treasuryInfo = await erConnection.getAccountInfo(PLATFORM_TREASURY_PDA);
    if (treasuryInfo) {
      console.log('📋 Treasury account data (first 32 bytes - authority pubkey):');
      const storedAuthority = treasuryInfo.data.slice(8, 40);
      console.log('   Hex:', storedAuthority.toString('hex'));
      // Try to parse as PublicKey
      try {
        const storedAuthorityPubkey = new anchor.web3.PublicKey(storedAuthority);
        console.log('   Authority stored in treasury:', storedAuthorityPubkey.toBase58());
      } catch (e) {
        console.log('   (Could not parse as PublicKey)');
      }
    }

    const authorityKeypair = getAuthorityKeypair();
    console.log('   Authority from env:', authorityKeypair.publicKey.toBase58());
    console.log();

    const balanceBefore = await getTreasuryBalance();
    console.log(`Treasury balance before: ${balanceBefore} SOL`);

    console.log(`\nAttempting payout of ${testReward} SOL to ${testWallet}...\n`);
    const result = await payReward(testWallet, testReward);

    console.log('\n✅ Payout test passed!');
    console.log(`   Signature: ${result.signature}`);
    console.log(`   Player received: ${result.playerPayout} SOL`);
    console.log(`   Platform fee: ${result.fee} SOL`);

    const balanceAfter = await getTreasuryBalance();
    console.log(`\nTreasury balance after: ${balanceAfter} SOL`);
    console.log(`   Debited: ${(balanceBefore - balanceAfter).toFixed(9)} SOL`);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

runTest();
