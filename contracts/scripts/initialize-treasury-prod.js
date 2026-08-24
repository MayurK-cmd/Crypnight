const crypto = require('crypto');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROGRAM_ID = new PublicKey('DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK');
const TREASURY_SEED = Buffer.from('platform_treasury');

// Compute the correct discriminator for an Anchor instruction
function getDiscriminator(name) {
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
  return hash.slice(0, 8);
}

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

    // Derive treasury PDA
    const [treasuryPDA, bump] = PublicKey.findProgramAddressSync(
      [TREASURY_SEED],
      PROGRAM_ID
    );

    console.log('Program ID:', PROGRAM_ID.toBase58());
    console.log('Authority:', authority.publicKey.toBase58());
    console.log('Treasury PDA:', treasuryPDA.toBase58());

    // Check balance
    const balance = await connection.getBalance(authority.publicKey);
    console.log('Wallet balance:', balance / 1e9, 'SOL\n');

    if (balance < 2e9) {
      throw new Error('Insufficient balance. Need at least 2 SOL. Get devnet SOL from: https://faucet.solana.com/');
    }

    // Build initialize_treasury instruction with correct discriminator
    const discriminator = getDiscriminator('initialize_treasury');
    console.log('Using discriminator:', discriminator.toString('hex'));

    const initInstruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: treasuryPDA, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });

    // Create and send transaction
    const tx = new Transaction().add(initInstruction);
    tx.feePayer = authority.publicKey;

    const blockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash.blockhash;

    console.log('Sending initialize_treasury transaction...');
    const signature = await sendAndConfirmTransaction(connection, tx, [authority], {
      commitment: 'confirmed',
    });

    console.log('✅ Treasury initialized');
    console.log('   Tx:', `https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    // Now fund the treasury with 2 SOL
    console.log('Funding treasury with 2 SOL...');
    const fundAmount = 2e9; // 2 SOL in lamports

    const fundInstruction = SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: treasuryPDA,
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

    console.log('\n✅ Setup complete! Treasury is ready for payouts.');
    console.log('\nVerify backend .env has:');
    console.log(`PLATFORM_TREASURY_PUBKEY=${treasuryPDA.toBase58()}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.error('Program logs:', error.logs);
    }
    process.exit(1);
  }
}

main();
