const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROGRAM_ID = new PublicKey('DKoawaEk5pJj1npwNYXeCCPF3Uqzxahokq67NY387qbK');
const TREASURY_SEED = Buffer.from('platform_treasury');

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
    const [treasuryPDA] = PublicKey.findProgramAddressSync([TREASURY_SEED], PROGRAM_ID);

    console.log('Program ID:', PROGRAM_ID.toBase58());
    console.log('Authority:', authority.publicKey.toBase58());
    console.log('Treasury PDA:', treasuryPDA.toBase58());

    // Check balance
    const balance = await connection.getBalance(authority.publicKey);
    console.log('Wallet balance:', balance / 1e9, 'SOL');

    if (balance < 2e9) {
      console.log('\n⚠️  Warning: Low balance. Need at least 2 SOL.');
      console.log('Get devnet SOL from: https://faucet.solana.com/');
    }

    console.log('\n✅ Treasury PDA derived successfully');
    console.log('\nAdd to backend/.env:');
    console.log(`PLATFORM_TREASURY_PUBKEY=${treasuryPDA.toBase58()}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
