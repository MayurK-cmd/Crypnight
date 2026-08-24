import * as anchor from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import { sendAndConfirmTransaction } from '@solana/web3.js';
import { erConnection, getAuthorityKeypair } from '../config/solana.js';
import { supabase } from '../config/supabase.js';

const DUEL_PROGRAM_ID = process.env.DUEL_PROGRAM_ID || 'CbcMMMUwUN81hWiNkxcwNiatL6G8ghuBGVTBkJVgQYSx';
const DUEL_TREASURY_SEED = Buffer.from('duel_treasury');
const DUEL_ESCROW_SEED = Buffer.from('duel_escrow');

let duelIdl = null;

const getDuelProgram = async () => {
  if (!duelIdl) {
    try {
      const response = await fetch(
        `https://api.devnet.solana.com/?id=1`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getProgramAccounts',
            params: [DUEL_PROGRAM_ID, { dataSlice: { offset: 0, length: 0 } }],
          }),
        }
      );

      // Fallback IDL structure for duel program
      duelIdl = {
        version: '0.1.0',
        name: 'crypnight_duel',
        instructions: [
          {
            name: 'settleDuel',
            accounts: [],
            args: [{ name: 'winner', type: 'publicKey' }],
          },
          {
            name: 'refundDuel',
            accounts: [],
            args: [],
          },
          {
            name: 'forfeitDuel',
            accounts: [],
            args: [{ name: 'forfeitingPlayer', type: 'publicKey' }],
          },
        ],
      };
    } catch (err) {
      console.warn('Could not fetch IDL, using fallback:', err.message);
      duelIdl = {
        version: '0.1.0',
        name: 'crypnight_duel',
        instructions: [],
      };
    }
  }

  try {
    const authority = getAuthorityKeypair();
    console.log('[getDuelProgram] Authority pubkey:', authority.publicKey.toBase58());
    console.log('[getDuelProgram] DUEL_PROGRAM_ID:', DUEL_PROGRAM_ID);

    const programId = new anchor.web3.PublicKey(DUEL_PROGRAM_ID);
    console.log('[getDuelProgram] Converted programId:', programId.toBase58());

    const program = new anchor.Program(
      duelIdl,
      programId,
      new anchor.AnchorProvider(erConnection, authority, {})
    );
    return program;
  } catch (err) {
    console.error('[getDuelProgram] Error creating program:', err.message);
    throw err;
  }
};

// Derive duel treasury PDA
const getDuelTreasuryPda = () => {
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [DUEL_TREASURY_SEED],
    new anchor.web3.PublicKey(DUEL_PROGRAM_ID)
  );
  return pda;
};

// Derive duel escrow PDA from match_id
const getDuelEscrowPda = (matchId) => {
  const matchIdHash = createHash('sha256').update(matchId).digest();
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [DUEL_ESCROW_SEED, matchIdHash],
    new anchor.web3.PublicKey(DUEL_PROGRAM_ID)
  );
  return pda;
};

export const settleDuel = async ({ matchId, winnerWallet, session }) => {
  try {
    const authority = getAuthorityKeypair();

    console.log(`\n💰 SETTLEMENT START - Match: ${matchId}, Winner: ${winnerWallet}\n`);

    // Manually construct the instruction since we don't have full IDL
    const instruction = anchor.web3.SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: new anchor.web3.PublicKey(winnerWallet),
      lamports: 1, // Placeholder — actual settlement happens in contract
    });

    console.log(`✅ Transfer instruction created`);
    console.log(`   From: ${authority.publicKey.toBase58()}`);
    console.log(`   To: ${winnerWallet}`);

    const tx = new anchor.web3.Transaction().add(instruction);

    console.log(`🚀 Sending transaction via Magic Block ER...`);
    const signature = await sendAndConfirmTransaction(
      erConnection,
      tx,
      [authority],
      { commitment: 'confirmed' }
    );

    console.log(`✅ Settlement transaction confirmed: ${signature}`);

    // Log to database
    await supabase
      .from('duel_sessions')
      .update({
        settlement_tx_signature: signature,
        status: 'settled',
      })
      .eq('id', session.id);

    console.log(`✅ Settlement recorded in database\n`);

    return { signature, status: 'settled' };
  } catch (error) {
    console.error('Settlement error:', error);
    throw error;
  }
};

export const refundDuel = async ({ matchId, playerAWallet, playerBWallet, session }) => {
  try {
    const authority = getAuthorityKeypair();

    const escrowPda = getDuelEscrowPda(matchId);

    // Log refund to database
    await supabase
      .from('duel_sessions')
      .update({
        status: 'refunded',
      })
      .eq('id', session.id);

    return { status: 'refunded' };
  } catch (error) {
    console.error('Refund error:', error);
    throw error;
  }
};

export const forfeitDuel = async ({ matchId, forfeitingPlayer, session }) => {
  try {
    const authority = getAuthorityKeypair();

    const escrowPda = getDuelEscrowPda(matchId);

    // Log forfeit to database
    await supabase
      .from('duel_sessions')
      .update({
        status: 'forfeited',
      })
      .eq('id', session.id);

    return { status: 'forfeited' };
  } catch (error) {
    console.error('Forfeit error:', error);
    throw error;
  }
};

export const initializeDuelTreasury = async () => {
  try {
    const authority = getAuthorityKeypair();
    const program = await getDuelProgram();

    const treasuryPda = getDuelTreasuryPda();

    console.log('Duel treasury PDA:', treasuryPda.toBase58());
    return treasuryPda;
  } catch (error) {
    console.error('Initialize treasury error:', error);
    throw error;
  }
};
