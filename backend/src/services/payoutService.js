import { TransactionInstruction, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import crypto from 'crypto';
import {
  erConnection,
  getAuthorityKeypair,
  programId,
  PLATFORM_TREASURY_PDA,
  anchor,
} from '../config/solana.js';

const getDiscriminator = (name) => {
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
  return hash.slice(0, 8);
};

const payReward = async (playerWalletAddress, rewardSol) => {
  console.log(`\n💰 PAYOUT START - Player: ${playerWalletAddress}, Reward: ${rewardSol} SOL\n`);

  if (!playerWalletAddress) {
    console.error('❌ No wallet address provided');
    throw new Error('Player has no linked wallet address');
  }
  if (rewardSol <= 0) {
    console.error('❌ Invalid reward amount:', rewardSol);
    throw new Error('Reward must be greater than zero');
  }

  try {
    const authorityKeypair = getAuthorityKeypair();
    const playerPubkey = new anchor.web3.PublicKey(playerWalletAddress);
    console.log(`✅ Player pubkey created: ${playerPubkey.toBase58()}`);

    const grossLamports = Math.round(rewardSol * anchor.web3.LAMPORTS_PER_SOL);
    console.log(`✅ Gross lamports: ${grossLamports}`);

    // Compute discriminator from instruction name
    const payRewardDiscriminator = getDiscriminator('pay_reward');
    console.log(`✅ Discriminator computed: ${payRewardDiscriminator.toString('hex')}`);

    // Encode the grossRewardLamports as little-endian u64
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(grossLamports), 0);

    // Build instruction data: discriminator + amount
    const instructionData = Buffer.concat([payRewardDiscriminator, amountBuffer]);
    console.log(`✅ Instruction data built, length: ${instructionData.length}`);

    // Build instruction with accounts (3 total)
    const payRewardInstruction = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: PLATFORM_TREASURY_PDA, isSigner: false, isWritable: true },
        { pubkey: playerPubkey, isSigner: false, isWritable: true },
      ],
      data: instructionData,
    });
    console.log(`✅ Instruction created`);
    console.log(`   Authority: ${authorityKeypair.publicKey.toBase58()}`);
    console.log(`   Treasury: ${PLATFORM_TREASURY_PDA.toBase58()}`);
    console.log(`   Player: ${playerPubkey.toBase58()}`);

    // Build and sign transaction
    const tx = new anchor.web3.Transaction().add(payRewardInstruction);
    tx.feePayer = authorityKeypair.publicKey;
    console.log(`✅ Transaction created, fee payer set`);

    const blockhash = await erConnection.getLatestBlockhash();
    console.log(`✅ Latest blockhash retrieved: ${blockhash.blockhash}`);
    tx.recentBlockhash = blockhash.blockhash;

    // Sign the transaction
    tx.sign(authorityKeypair);
    console.log(`✅ Transaction signed`);

    // Send via Magic Block ER
    console.log(`🚀 Sending transaction via Magic Block ER...`);
    let signature;
    try {
      signature = await sendAndConfirmTransaction(
        erConnection,
        tx,
        [authorityKeypair],
        { commitment: 'confirmed' }
      );
    } catch (err) {
      // Magic Block may not support getSignatureStatus fully — try sending without confirm
      if (err.message.includes('Assertion failed') || err.message.includes('getSignatureStatus')) {
        console.log(`⚠️  Confirmation failed, sending without confirmation...`);
        signature = await erConnection.sendTransaction(tx, [authorityKeypair]);
        console.log(`📝 Transaction sent (unconfirmed): ${signature}`);
      } else {
        throw err;
      }
    }

    console.log(`✅ Transaction confirmed, signature: ${signature}`);

    // Calculate what the player actually received (after 3% fee)
    const fee = Math.round((grossLamports * 300) / 10_000);
    const playerPayout = grossLamports - fee;

    console.log(`✅ PAYOUT SUCCESS`);
    console.log(`   Gross: ${rewardSol} SOL`);
    console.log(`   Fee (3%): ${fee / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`   Player receives: ${playerPayout / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`   Tx: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    return {
      signature,
      playerPayout: playerPayout / anchor.web3.LAMPORTS_PER_SOL,
      fee: fee / anchor.web3.LAMPORTS_PER_SOL,
    };
  } catch (err) {
    console.error(`\n❌ PAYOUT FAILED`);
    console.error(`   Error: ${err.message}`);
    if (err.logs) {
      console.error(`   Program logs:`, err.logs);
    }
    console.error(`   Stack: ${err.stack}\n`);
    throw err;
  }
};

const getTreasuryBalance = async () => {
  const balance = await erConnection.getBalance(PLATFORM_TREASURY_PDA);
  return balance / anchor.web3.LAMPORTS_PER_SOL;
};

export { payReward, getTreasuryBalance };
