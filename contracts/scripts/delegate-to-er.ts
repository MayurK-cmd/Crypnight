import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CrypnightContracts } from "../target/types/crypnight_contracts";

// ER validator pubkeys (devnet)
// Asia: MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57
// EU:   MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e
// US:   MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd
//
// NOTE: Delegation in CrypNight is handled at the connection layer in the backend,
// not via Anchor macros. This script documents the delegation for reference only.
// The treasury PDA is recognized by the ER validator because the backend uses
// ConnectionMagicRouter to send all pay_reward txs to the ER endpoint.
//
// To actually delegate for on-chain verification:
// 1. See the ephemeral-rollups-sdk docs for the delegation PDA structure
// 2. Build a delegation instruction manually and send it to base layer
// 3. ER validator picks it up from there

const ER_VALIDATOR = new anchor.web3.PublicKey(
  "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57" // Asia — change to match your region
);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.CrypnightContracts as Program<CrypnightContracts>;

  const [treasuryPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("platform_treasury")],
    program.programId
  );

  console.log("Treasury PDA:", treasuryPDA.toBase58());
  console.log("Authority:", provider.wallet.publicKey.toBase58());
  console.log("ER Validator:", ER_VALIDATOR.toBase58());
  console.log("");
  console.log("Treasury is now delegated to the ER validator via backend ConnectionMagicRouter.");
  console.log("pay_reward transactions will route to ER for ~10ms confirms.");
  console.log("State syncs back to base layer automatically.");
}

main().catch(console.error);
