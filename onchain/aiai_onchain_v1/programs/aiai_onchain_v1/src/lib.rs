use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::{self, AssociatedToken, Create},
    token::{self, FreezeAccount, Mint, MintTo, Token},
};

declare_id!("GKiKsPmSQHGvg5VFXAGy99vmb3JV9BPnqFzC9iwp95Km");

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

        // require mint & freeze authority = PDA
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

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.presale.paused = paused;
        Ok(())
    }

    pub fn set_tge(ctx: Context<AdminOnly>, live: bool) -> Result<()> {
        ctx.accounts.presale.tge_live = live;
        Ok(())
    }

    /// Buyer pays SOL; program mints tokens to buyer ATA and freezes it.
    pub fn purchase(ctx: Context<Purchase>, amount_lamports: u64) -> Result<()> {
        let sale = &mut ctx.accounts.presale;

        // checks
        require!(!sale.paused, PresaleError::Unauthorized);
        require!(amount_lamports >= sale.min_total, PresaleError::BelowMin);
        require!(amount_lamports <= sale.max_total, PresaleError::AboveMax);
        require!(
            amount_lamports % sale.price_lamports_per_token == 0,
            PresaleError::NotMultiple
        );

        // move SOL -> vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount_lamports,
        )?;

        // tokens = amount * 10^decimals / price
        let scale: u128 = 10u128.pow(ctx.accounts.mint.decimals as u32);
        let tokens_u128 = (amount_lamports as u128)
            .checked_mul(scale).ok_or(PresaleError::MathOverflow)?
            .checked_div(sale.price_lamports_per_token as u128).ok_or(PresaleError::MathOverflow)?;
        let tokens: u64 = u64::try_from(tokens_u128).map_err(|_| PresaleError::MathOverflow)?;
        require!(tokens > 0, PresaleError::InvalidLimits);

        // cap check
        let remaining = sale.supply_cap.checked_sub(sale.total_sold).ok_or(PresaleError::MathOverflow)?;
        require!(tokens <= remaining, PresaleError::ExceedsSupplyCap);

        // --------------------------
        // Ensure buyer ATA exists (create only if missing)
        // --------------------------
        let expected_ata = anchor_spl::associated_token::get_associated_token_address(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.mint.key(),
        );
        require_keys_eq!(ctx.accounts.buyer_ata.key(), expected_ata, PresaleError::Unauthorized);

        let ata_info = ctx.accounts.buyer_ata.to_account_info();
        if ata_info.data_is_empty() {
            let cpi_accounts = associated_token::Create {
                payer: ctx.accounts.buyer.to_account_info(),
                associated_token: ata_info.clone(),
                authority: ctx.accounts.buyer.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                cpi_accounts,
            );
            associated_token::create(cpi_ctx)?;
        }

        // mint + freeze (PDA signs)
        let sale_key = sale.key(); // keep binding alive
        let seeds: &[&[u8]] = &[b"mint-auth", sale_key.as_ref(), &[sale.mint_auth_bump]];
        let signer: &[&[&[u8]]] = &[seeds];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.buyer_ata.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            tokens,
        )?;

        token::freeze_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                FreezeAccount {
                    account: ctx.accounts.buyer_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
        )?;

        // counters + event
        sale.total_raised = sale.total_raised.checked_add(amount_lamports).ok_or(PresaleError::MathOverflow)?;
        sale.total_sold   = sale.total_sold.checked_add(tokens).ok_or(PresaleError::MathOverflow)?;
        emit!(Buy { buyer: ctx.accounts.buyer.key(), lamports: amount_lamports, tokens });

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

    /// PDA system-account vault (receives SOL)
    #[account(
        init,
        payer = admin,
        space = 0,
        seeds = [b"vault", presale.key().as_ref()],
        bump
    )]
    /// CHECK: system-owned PDA, no data
    pub vault: AccountInfo<'info>,   // ← changed from SystemAccount<'info>

    /// PDA that must be mint & freeze authority
    #[account(seeds = [b"mint-auth", presale.key().as_ref()], bump)]
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

#[derive(Accounts)]
pub struct Purchase<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"presale", presale.mint.as_ref()],
        bump = presale.bump,
    )]
    pub presale: Account<'info, Presale>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// PDA signer (mint & freeze authority)
    #[account(
        seeds = [b"mint-auth", presale.key().as_ref()],
        bump = presale.mint_auth_bump,
    )]
    /// CHECK: PDA signer
    pub mint_authority: AccountInfo<'info>,

    /// SOL vault PDA
    #[account(
        mut,
        seeds = [b"vault", presale.key().as_ref()],
        bump = presale.vault_bump,
    )]
    /// CHECK: system account PDA
    pub vault: AccountInfo<'info>,

    // Buyer ATA (we create it in the handler if missing)
    #[account(mut)]
    /// CHECK: created on demand via associated_token::create
    pub buyer_ata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
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

/* -------------------- Events -------------------- */
#[event]
pub struct Buy {
    pub buyer: Pubkey,
    pub lamports: u64,
    pub tokens: u64,
}

/* -------------------- Errors -------------------- */
#[error_code]
pub enum PresaleError {
    #[msg("Math overflow")] MathOverflow,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Invalid min/max limits")] InvalidLimits,
    #[msg("Mint authority not set to PDA")] MintAuthorityNotSet,
    #[msg("Freeze authority not set to PDA")] FreezeAuthorityNotSet,
    #[msg("Amount below min")] BelowMin,
    #[msg("Amount above max")] AboveMax,
    #[msg("Amount not a multiple of price")] NotMultiple,
    #[msg("Supply cap exceeded")] ExceedsSupplyCap,
}






