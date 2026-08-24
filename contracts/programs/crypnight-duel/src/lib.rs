use anchor_lang::prelude::*;

declare_id!("CbcMMMUwUN81hWiNkxcwNiatL6G8ghuBGVTBkJVgQYSx");

// Seeds
pub const DUEL_ESCROW_SEED: &[u8] = b"duel_escrow";
pub const DUEL_TREASURY_SEED: &[u8] = b"duel_treasury";

// Tier stake amounts in lamports
pub const STAKE_BEGINNER: u64     =  50_000_000; // 0.05 SOL
pub const STAKE_INTERMEDIATE: u64 = 100_000_000; // 0.10 SOL
pub const STAKE_PRO: u64          = 250_000_000; // 0.25 SOL
pub const STAKE_GM: u64           = 500_000_000; // 0.50 SOL

// Platform fee: 20% of pot goes to platform
pub const PLATFORM_FEE_BPS: u64 = 2_000;
pub const BPS_DENOMINATOR: u64  = 10_000;

// Escrow statuses
pub const STATUS_WAITING_B: u8  = 0; // Player A deposited, waiting for B
pub const STATUS_ACTIVE: u8     = 1; // Both deposited, duel in progress
pub const STATUS_SETTLED: u8    = 2; // Winner paid out
pub const STATUS_REFUNDED: u8   = 3; // Draw or cancelled — both refunded

// ─── State ─────────────────────────────────────────────────────────────────────

#[account]
pub struct DuelEscrow {
    /// Unique match ID (UUID from backend, stored as 36 bytes)
    pub match_id: [u8; 36],
    /// Player A pubkey
    pub player_a: Pubkey,
    /// Player B pubkey
    pub player_b: Pubkey,
    /// Platform authority pubkey (backend signer)
    pub authority: Pubkey,
    /// Stake per player in lamports (both must deposit this exact amount)
    pub stake_lamports: u64,
    /// Total pot = stake_lamports * 2
    pub pot_lamports: u64,
    /// 0=waiting_b, 1=active, 2=settled, 3=refunded
    pub status: u8,
    /// Whether player A has deposited
    pub player_a_deposited: bool,
    /// Whether player B has deposited
    pub player_b_deposited: bool,
    /// Bump for PDA derivation
    pub bump: u8,
}

/// Global duel platform treasury — receives the 20% fee from every duel.
/// Separate from the solo treasury.
#[account]
pub struct DuelTreasury {
    pub authority: Pubkey,
    pub total_fees_collected: u64,
    pub bump: u8,
}

// ─── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum DuelError {
    #[msg("Unauthorized: caller is not the platform authority")]
    Unauthorized,
    #[msg("Incorrect stake amount")]
    WrongStakeAmount,
    #[msg("Player already deposited")]
    AlreadyDeposited,
    #[msg("Escrow is not in the correct status for this operation")]
    WrongStatus,
    #[msg("Player is not part of this duel")]
    NotAParticipant,
    #[msg("Insufficient escrow balance for settlement")]
    InsufficientEscrowBalance,
    #[msg("Winner must be player_a or player_b")]
    InvalidWinner,
}

// ─── Program ───────────────────────────────────────────────────────────────────

#[program]
pub mod crypnight_duel {
    use super::*;

    /// Initialize the duel platform treasury. Call once after deployment.
    pub fn initialize_duel_treasury(ctx: Context<InitializeDuelTreasury>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.total_fees_collected = 0;
        treasury.bump = ctx.bumps.treasury;
        msg!("Duel treasury initialized. Authority: {}", treasury.authority);
        Ok(())
    }

    /// Player A creates the escrow and deposits their stake.
    /// Called when Player A confirms ready and approves the Phantom popup.
    /// match_id: 36-byte UUID string from the backend matchmaking system.
    /// tier: 0=beginner, 1=intermediate, 2=pro, 3=gm
    pub fn create_duel_escrow(
        ctx: Context<CreateDuelEscrow>,
        match_id: [u8; 36],
        tier: u8,
    ) -> Result<()> {
        let stake = tier_to_stake(tier)?;

        // Initialize escrow fields
        {
            let escrow = &mut ctx.accounts.escrow;
            escrow.match_id = match_id;
            escrow.player_a = ctx.accounts.player_a.key();
            escrow.player_b = ctx.accounts.player_b.key();
            escrow.authority = ctx.accounts.authority.key();
            escrow.stake_lamports = stake;
            escrow.pot_lamports = 0;
            escrow.status = STATUS_WAITING_B;
            escrow.player_a_deposited = false;
            escrow.player_b_deposited = false;
            escrow.bump = ctx.bumps.escrow;
        }

        // Transfer player A's stake into the escrow PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.player_a.key(),
            &ctx.accounts.escrow.key(),
            stake,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.player_a.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Update after transfer
        {
            let escrow = &mut ctx.accounts.escrow;
            escrow.player_a_deposited = true;
            escrow.pot_lamports += stake;
        }

        msg!(
            "Duel escrow created. Match: {:?}, Stake: {} lamports",
            match_id,
            stake
        );
        Ok(())
    }

    /// Player B deposits their stake into the existing escrow.
    /// Called when Player B confirms ready and approves the Phantom popup.
    /// Status moves from waiting_b → active.
    pub fn join_duel_escrow(ctx: Context<JoinDuelEscrow>) -> Result<()> {
        let stake = {
            let escrow = &ctx.accounts.escrow;
            require!(escrow.status == STATUS_WAITING_B, DuelError::WrongStatus);
            require!(
                ctx.accounts.player_b.key() == escrow.player_b,
                DuelError::NotAParticipant
            );
            require!(!escrow.player_b_deposited, DuelError::AlreadyDeposited);
            escrow.stake_lamports
        };

        // Transfer player B's stake into the escrow PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.player_b.key(),
            &ctx.accounts.escrow.key(),
            stake,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.player_b.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let escrow = &mut ctx.accounts.escrow;
        escrow.player_b_deposited = true;
        escrow.pot_lamports += stake;
        escrow.status = STATUS_ACTIVE;

        msg!("Player B joined duel. Pot: {} lamports", escrow.pot_lamports);
        Ok(())
    }

    /// Settle the duel — called by the backend authority after the 3-minute
    /// timer ends or both players exhaust their puzzles.
    /// winner: the pubkey of the winning player.
    /// The winner receives 80% of the pot; 20% goes to the duel treasury.
    pub fn settle_duel(ctx: Context<SettleDuel>, winner: Pubkey) -> Result<()> {
        let (pot, player_a_key, player_b_key) = {
            let escrow = &ctx.accounts.escrow;
            require!(escrow.status == STATUS_ACTIVE, DuelError::WrongStatus);
            require!(
                ctx.accounts.authority.key() == escrow.authority,
                DuelError::Unauthorized
            );
            require!(
                winner == escrow.player_a || winner == escrow.player_b,
                DuelError::InvalidWinner
            );
            require!(
                ctx.accounts.escrow.to_account_info().lamports() >= escrow.pot_lamports,
                DuelError::InsufficientEscrowBalance
            );
            (escrow.pot_lamports, escrow.player_a, escrow.player_b)
        };

        let fee = pot * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
        let winner_payout = pot - fee;

        let winner_account = if winner == player_a_key {
            ctx.accounts.player_a.to_account_info()
        } else {
            ctx.accounts.player_b.to_account_info()
        };

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= winner_payout;
        **winner_account.try_borrow_mut_lamports()? += winner_payout;

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= fee;
        **ctx.accounts.duel_treasury.to_account_info().try_borrow_mut_lamports()? += fee;

        let treasury = &mut ctx.accounts.duel_treasury;
        treasury.total_fees_collected += fee;

        let escrow = &mut ctx.accounts.escrow;
        escrow.status = STATUS_SETTLED;

        msg!(
            "Duel settled. Winner: {}, Payout: {} lamports, Fee: {} lamports",
            winner,
            winner_payout,
            fee
        );
        Ok(())
    }

    /// Refund both players — called on draw or match cancellation.
    /// Both players get their full stake back. No fee taken.
    pub fn refund_duel(ctx: Context<RefundDuel>) -> Result<()> {
        let (stake, player_a_deposited, player_b_deposited) = {
            let escrow = &ctx.accounts.escrow;
            require!(
                escrow.status == STATUS_ACTIVE || escrow.status == STATUS_WAITING_B,
                DuelError::WrongStatus
            );
            require!(
                ctx.accounts.authority.key() == escrow.authority,
                DuelError::Unauthorized
            );
            (escrow.stake_lamports, escrow.player_a_deposited, escrow.player_b_deposited)
        };

        if player_a_deposited {
            **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= stake;
            **ctx.accounts.player_a.to_account_info().try_borrow_mut_lamports()? += stake;
        }

        if player_b_deposited {
            **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= stake;
            **ctx.accounts.player_b.to_account_info().try_borrow_mut_lamports()? += stake;
        }

        let escrow = &mut ctx.accounts.escrow;
        escrow.status = STATUS_REFUNDED;

        msg!("Duel refunded. Both players returned {} lamports each.", stake);
        Ok(())
    }

    /// Forfeit — called when a player disconnects for 30s.
    /// The connected player wins automatically.
    /// Same payout math as settle_duel (80/20 split).
    pub fn forfeit_duel(ctx: Context<ForfeitDuel>, forfeiting_player: Pubkey) -> Result<()> {
        let (winner, pot) = {
            let escrow = &ctx.accounts.escrow;
            require!(escrow.status == STATUS_ACTIVE, DuelError::WrongStatus);
            require!(
                ctx.accounts.authority.key() == escrow.authority,
                DuelError::Unauthorized
            );
            require!(
                forfeiting_player == escrow.player_a || forfeiting_player == escrow.player_b,
                DuelError::NotAParticipant
            );

            let winner = if forfeiting_player == escrow.player_a {
                escrow.player_b
            } else {
                escrow.player_a
            };
            (winner, escrow.pot_lamports)
        };

        let fee = pot * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
        let winner_payout = pot - fee;

        let winner_account = if winner == ctx.accounts.player_a.key() {
            ctx.accounts.player_a.to_account_info()
        } else {
            ctx.accounts.player_b.to_account_info()
        };

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= winner_payout;
        **winner_account.try_borrow_mut_lamports()? += winner_payout;

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= fee;
        **ctx.accounts.duel_treasury.to_account_info().try_borrow_mut_lamports()? += fee;

        let treasury = &mut ctx.accounts.duel_treasury;
        treasury.total_fees_collected += fee;

        let escrow = &mut ctx.accounts.escrow;
        escrow.status = STATUS_SETTLED;

        msg!(
            "Duel forfeited by {}. Winner: {}, Payout: {} lamports",
            forfeiting_player,
            winner,
            winner_payout
        );
        Ok(())
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

fn tier_to_stake(tier: u8) -> Result<u64> {
    match tier {
        0 => Ok(STAKE_BEGINNER),
        1 => Ok(STAKE_INTERMEDIATE),
        2 => Ok(STAKE_PRO),
        3 => Ok(STAKE_GM),
        _ => Err(DuelError::WrongStakeAmount.into()),
    }
}

// ─── Account Contexts ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeDuelTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1,
        seeds = [DUEL_TREASURY_SEED],
        bump
    )]
    pub treasury: Account<'info, DuelTreasury>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 36])]
pub struct CreateDuelEscrow<'info> {
    #[account(
        init,
        payer = player_a,
        space = 160,
        seeds = [DUEL_ESCROW_SEED, &match_id],
        bump
    )]
    pub escrow: Account<'info, DuelEscrow>,
    #[account(mut)]
    pub player_a: Signer<'info>,
    /// CHECK: Player B pubkey — verified by the backend before calling this
    pub player_b: AccountInfo<'info>,
    /// CHECK: Platform authority pubkey — stored in escrow for later verification
    pub authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinDuelEscrow<'info> {
    #[account(
        mut,
        seeds = [DUEL_ESCROW_SEED, &escrow.match_id],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DuelEscrow>,
    #[account(mut)]
    pub player_b: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleDuel<'info> {
    #[account(
        mut,
        seeds = [DUEL_ESCROW_SEED, &escrow.match_id],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DuelEscrow>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Player A wallet — receives payout if winner
    #[account(mut)]
    pub player_a: AccountInfo<'info>,
    /// CHECK: Player B wallet — receives payout if winner
    #[account(mut)]
    pub player_b: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [DUEL_TREASURY_SEED],
        bump = duel_treasury.bump
    )]
    pub duel_treasury: Account<'info, DuelTreasury>,
}

#[derive(Accounts)]
pub struct RefundDuel<'info> {
    #[account(
        mut,
        seeds = [DUEL_ESCROW_SEED, &escrow.match_id],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DuelEscrow>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Player A wallet — receives refund
    #[account(mut)]
    pub player_a: AccountInfo<'info>,
    /// CHECK: Player B wallet — receives refund
    #[account(mut)]
    pub player_b: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ForfeitDuel<'info> {
    #[account(
        mut,
        seeds = [DUEL_ESCROW_SEED, &escrow.match_id],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DuelEscrow>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Player A wallet
    #[account(mut)]
    pub player_a: AccountInfo<'info>,
    /// CHECK: Player B wallet
    #[account(mut)]
    pub player_b: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [DUEL_TREASURY_SEED],
        bump = duel_treasury.bump
    )]
    pub duel_treasury: Account<'info, DuelTreasury>,
}
