const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROGRAM_ID = new PublicKey('DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK');
const TREASURY_PDA = new PublicKey('omyRQ6Ynne5seohfqiMQRPyaMuSkPDi9gksUeKm4oi6');

async function main() {
  try {
    // Load wallet
    const walletPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    if (!fs.existsSync(walletPath)) {
      throw new Error(`Solana wallet not found at ${walletPath}. Run: solana-keygen new`);
    }

    const secretKey = JSON.parse(fs.readFileSync(walletPath));
    const authority = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    // Connect to devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    console.log('Program ID:', PROGRAM_ID.toBase58());
    console.log('Authority:', authority.publicKey.toBase58());
    console.log('Treasury PDA:', TREASURY_PDA.toBase58());

    // Check balances
    const authorityBalance = await connection.getBalance(authority.publicKey);
    const treasuryBalance = await connection.getBalance(TREASURY_PDA);
    console.log('Authority balance:', authorityBalance / 1e9, 'SOL');
    console.log('Treasury balance:', treasuryBalance / 1e9, 'SOL\n');

    if (authorityBalance < 2e9) {
      throw new Error('Insufficient balance. Need at least 2 SOL. Get devnet SOL from: https://faucet.solana.com/');
    }

    // Fund the treasury with 2 SOL
    console.log('Funding treasury with 2 SOL...');
    const fundAmount = 2e9; // 2 SOL in lamports

    const fundInstruction = SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: TREASURY_PDA,
      lamports: fundAmount,
    });

    const fundTx = new Transaction().add(fundInstruction);
    fundTx.feePayer = authority.publicKey;
    fundTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const fundSig = await sendAndConfirmTransaction(connection, fundTx, [authority], {
      commitment: 'confirmed',
    });

    console.log('✅ Treasury funded with 2 SOL');
    console.log('   Tx:', `https://explorer.solana.com/tx/${fundSig}?cluster=devnet`);

    // Verify new balance
    const newTreasuryBalance = await connection.getBalance(TREASURY_PDA);
    console.log('\n✅ Treasury balance updated:', newTreasuryBalance / 1e9, 'SOL');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.error('Program logs:', error.logs);
    }
    process.exit(1);
  }
}

main();
