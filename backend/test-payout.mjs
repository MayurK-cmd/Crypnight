import dotenv from 'dotenv';
dotenv.config();

import { payReward, getTreasuryBalance } from './src/services/payoutService.js';

const testWallet = 'CHEXaU5Z1SjDVqUfu4zWkK2tpApWd2C31RhvFxq7ZRXX'; // Test wallet
const testReward = 0.01; // 0.01 SOL

async function runTest() {
  try {
    console.log('Testing payout system...\n');

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
