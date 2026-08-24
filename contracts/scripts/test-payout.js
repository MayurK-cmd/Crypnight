import { payReward, getTreasuryBalance } from '../backend/src/services/payoutService.js';

async function testPayout() {
  try {
    console.log('\n🧪 TESTING PAYOUT FLOW\n');

    // Check treasury balance before
    const treasuryBalanceBefore = await getTreasuryBalance();
    console.log(`✅ Treasury balance before: ${treasuryBalanceBefore} SOL`);

    // Test with a valid devnet wallet address (using a test address)
    // In production, this would be a real player wallet
    const testWallet = 'CHEXaU5Z1SjDVqUfu4zWkK2tpApWd2C31RhvFxq7ZRXX';
    const testReward = 0.1; // 0.1 SOL

    console.log(`\nAttempting payout to ${testWallet} for ${testReward} SOL...\n`);

    const result = await payReward(testWallet, testReward);

    console.log('\n✅ PAYOUT TEST SUCCESSFUL');
    console.log(`   Signature: ${result.signature}`);
    console.log(`   Player received: ${result.playerPayout} SOL`);
    console.log(`   Platform fee: ${result.fee} SOL`);

    // Check treasury balance after
    const treasuryBalanceAfter = await getTreasuryBalance();
    console.log(`\n✅ Treasury balance after: ${treasuryBalanceAfter} SOL`);
    console.log(`   Debited: ${(treasuryBalanceBefore - treasuryBalanceAfter).toFixed(9)} SOL`);

  } catch (error) {
    console.error('\n❌ PAYOUT TEST FAILED');
    console.error(error.message);
    process.exit(1);
  }
}

testPayout();
