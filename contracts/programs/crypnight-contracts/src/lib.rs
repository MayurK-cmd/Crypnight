use anchor_lang::prelude::*;

declare_id!("8X3ZpcDBiQ2ZkRbWpVk8rNmAgpZk862KsdP4sQsjjG9x");

pub const PLATFORM_TREASURY_SEED: &[u8] = b"platform_treasury";
pub const PLATFORM_FEE_BPS: u64 = 300;
pub const BPS_DENOMINATOR: u64 = 10_000;

#[account]
pub struct PlatformTreasury {
    pub authority: Pubkey,
    pub total_paid_out: u64,
    pub total_fees_retained: u64,
    pub bump: u8,
}

#[error_code]
pub enum CrypnightError {
    #[msg("Unauthorized: caller is not the platform authority")]
    Unauthorized,
    #[msg("Treasury has insufficient SOL for this payout")]
    InsufficientTreasuryFunds,
    #[msg("Reward amount is zero")]
    ZeroReward,
}

#[program]
pub mod crypnight_contracts {
    use super::*;

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.total_paid_out = 0;
        treasury.total_fees_retained = 0;
        treasury.bump = ctx.bumps.treasury;
        msg!("Treasury initialized. Authority: {}", treasury.authority);
        Ok(())
    }

    pub fn pay_reward(ctx: Context<PayReward>, gross_reward_lamports: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.treasury.authority,
            CrypnightError::Unauthorized
        );
        require!(gross_reward_lamports > 0, CrypnightError::ZeroReward);

        let fee = gross_reward_lamports * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
        let player_payout = gross_reward_lamports - fee;

        let treasury_balance = ctx.accounts.treasury.to_account_info().lamports();
        require!(
            treasury_balance >= player_payout,
            CrypnightError::InsufficientTreasuryFunds
        );

        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? -=
            player_payout;
        **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += player_payout;

        let treasury = &mut ctx.accounts.treasury;
        treasury.total_paid_out += player_payout;
        treasury.total_fees_retained += fee;

        msg!(
            "Paid {} lamports to player {}. Fee retained: {} lamports.",
            player_payout,
            ctx.accounts.player.key(),
            fee
        );

        Ok(())
    }

    pub fn fund_treasury(ctx: Context<FundTreasury>, amount_lamports: u64) -> Result<()> {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.funder.key(),
            &ctx.accounts.treasury.key(),
            amount_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.funder.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Treasury funded with {} lamports.", amount_lamports);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 1,
        seeds = [PLATFORM_TREASURY_SEED],
        bump
    )]
    pub treasury: Account<'info, PlatformTreasury>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayReward<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLATFORM_TREASURY_SEED], bump = treasury.bump)]
    pub treasury: Account<'info, PlatformTreasury>,
    #[account(mut)]
    pub player: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct FundTreasury<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(mut, seeds = [PLATFORM_TREASURY_SEED], bump = treasury.bump)]
    pub treasury: Account<'info, PlatformTreasury>,
    pub system_program: Program<'info, System>,
}
