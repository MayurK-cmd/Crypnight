import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CrypnightContracts } from "../target/types/crypnight_contracts";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.CrypnightContracts as Program<CrypnightContracts>;

  const [treasuryPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("platform_treasury")],
    program.programId
  );

  console.log("Treasury PDA:", treasuryPDA.toBase58());

  await program.methods
    .initializeTreasury()
    .accounts({ authority: provider.wallet.publicKey })
    .rpc();

  console.log("Treasury initialized.");

  await program.methods
    .fundTreasury(new anchor.BN(anchor.web3.LAMPORTS_PER_SOL))
    .accounts({ funder: provider.wallet.publicKey })
    .rpc();

  console.log("Treasury funded with 1 SOL.");
  console.log("Add to backend/.env:");
  console.log(`PLATFORM_TREASURY_PUBKEY=${treasuryPDA.toBase58()}`);
}

main().catch(console.error);
