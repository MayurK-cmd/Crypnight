import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CrypnightContracts } from "../target/types/crypnight_contracts";
import { sendAndConfirmTransaction } from "@solana/web3.js";

// ER validator pubkeys (devnet)
// Asia: MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57
// EU:   MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e
// US:   MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd
const ER_VALIDATOR = new anchor.web3.PublicKey(
  "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"
);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.CrypnightContracts as Program<CrypnightContracts>;

  const [treasuryPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("platform_treasury")],
    program.programId
  );

  let tx = await program.methods
    .fundTreasury(new anchor.BN(0))
    .accounts({
      funder: provider.wallet.publicKey,
    })
    .transaction();

  tx.feePayer = provider.wallet.publicKey;
  tx.recentBlockhash = (await provider.connection.getLatestBlockhash())
    .blockhash;

  const sig = await provider.sendAndConfirm(tx);
  console.log("Treasury state verified. Sig:", sig);
  console.log("Note: MagicBlock ER delegation requires ER-specific implementation.");
  console.log("For now, pay_reward transactions will go to base layer (~400ms confirms).");
}

main().catch(console.error);
