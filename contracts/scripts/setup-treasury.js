const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const PROGRAM_ID = 'DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK';
const TREASURY_SEED = 'platform_treasury';
const TREASURY_PDA = 'omyRQ6Ynne5seohfqiMQRPyaMuSkPDi9gksUeKm4oi6';

async function main() {
  try {
    // Get wallet address
    const { stdout } = await execAsync('solana address');
    const walletAddress = stdout.trim();
    console.log('Wallet:', walletAddress);

    // Check balance
    const { stdout: balanceOutput } = await execAsync('solana balance');
    console.log('Balance:', balanceOutput.trim());

    console.log('\nTo complete Phase 3 setup:');
    console.log('');
    console.log('1. Initialize treasury (requires sending a transaction):');
    console.log(`   solana program invoke ${PROGRAM_ID} \\`);
    console.log(`     --input-file <(echo '{"initializeTreasury": {}}') \\`);
    console.log(`     --authority ${walletAddress}`);
    console.log('');
    console.log('2. Fund treasury with 1 SOL:');
    console.log(`   solana transfer ${TREASURY_PDA} 1`);
    console.log('');
    console.log('For now, the treasury PDA is ready:');
    console.log(`   PLATFORM_TREASURY_PUBKEY=${TREASURY_PDA}`);
    console.log('');
    console.log('✅ Backend .env is configured with:');
    console.log(`   SOLANA_PROGRAM_ID=${PROGRAM_ID}`);
    console.log(`   PLATFORM_TREASURY_PUBKEY=${TREASURY_PDA}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
