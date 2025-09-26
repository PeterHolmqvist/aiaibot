use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

declare_id!("FDCr1ogj5pg5HVVKwoRoBkuvbPMk1Hvapk5efAh4j1JG");

#[program]
pub mod aiai_onchain_v1 {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        price_lamports_per_token: u64, // 0.002 SOL => 2_000_000
        min_total: u64,                // 0.2 SOL  => 200_000_000
        max_total: u64,                // 2 SOL    => 2_000_000_000
    ) -> Result<()> {
        require!(min_total <= max_total, PresaleError::InvalidLimits);

        let sale = &mut ctx.accounts.presale;
        sale.bump = ctx.bumps.presale;
        sale.vault_bump = ctx.bumps.vault;
        sale.mint_auth_bump = ctx.bumps.mint_authority;

        sale.admin = ctx.accounts.admin.key();
        sale.mint = ctx.accounts.mint.key();
        sale.price_lamports_per_token = price_lamports_per_token;
        sale.min_total = min_total;
        sale.max_total = max_total;
        sale.total_raised = 0;
        sale.total_sold = 0;
        sale.paused = false;
        sale.tge_live = false;

        // supply cap = 69,420,000 * 10^decimals
        let cap = (69_420_000u128)
            .checked_mul(10u128.pow(ctx.accounts.mint.decimals as u32))
            .ok_or(PresaleError::MathOverflow)?;
        sale.supply_cap = u64::try_from(cap).map_err(|_| PresaleError::MathOverflow)?;

        // safety: require mint & freeze authority = PDA
        require_keys_eq!(
            ctx.accounts.mint.mint_authority.unwrap(),
            ctx.accounts.mint_authority.key(),
            PresaleError::MintAuthorityNotSet
        );
        require_keys_eq!(
            ctx.accounts.mint.freeze_authority.unwrap(),
            ctx.accounts.mint_authority.key(),
            PresaleError::FreezeAuthorityNotSet
        );

        Ok(())
    }

    // small admin toggles (we'll use later)
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.presale.paused = paused;
        Ok(())
    }
    pub fn set_tge(ctx: Context<AdminOnly>, live: bool) -> Result<()> {
        ctx.accounts.presale.tge_live = live;
        Ok(())
    }
}

/* -------------------- Accounts -------------------- */

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + Presale::SIZE,
        seeds = [b"presale", mint.key().as_ref()],
        bump
    )]
    pub presale: Account<'info, Presale>,

    /// PDA system-account vault (receives SOL later)
    #[account(
        seeds = [b"vault", presale.key().as_ref()],
        bump
    )]
    /// CHECK: system account PDA
    pub vault: AccountInfo<'info>,

    /// PDA that must be mint & freeze authority
    #[account(
        seeds = [b"mint-auth", presale.key().as_ref()],
        bump
    )]
    /// CHECK: PDA signer only
    pub mint_authority: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"presale", presale.mint.as_ref()],
        bump = presale.bump,
        has_one = admin @ PresaleError::Unauthorized
    )]
    pub presale: Account<'info, Presale>,
}

/* -------------------- State -------------------- */

#[account]
pub struct Presale {
    pub bump: u8,
    pub vault_bump: u8,
    pub mint_auth_bump: u8,
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub price_lamports_per_token: u64,
    pub min_total: u64,
    pub max_total: u64,
    pub total_raised: u64,
    pub total_sold: u64,
    pub supply_cap: u64,
    pub paused: bool,
    pub tge_live: bool,
}
impl Presale {
    pub const SIZE: usize = 1+1+1 + 32+32 + 8+8+8+8+8 + 8 + 1+1;
}

/* -------------------- Errors -------------------- */
#[error_code]
pub enum PresaleError {
    #[msg("Math overflow")] MathOverflow,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Invalid min/max limits")] InvalidLimits,
    #[msg("Mint authority not set to PDA")] MintAuthorityNotSet,
    #[msg("Freeze authority not set to PDA")] FreezeAuthorityNotSet,
}

