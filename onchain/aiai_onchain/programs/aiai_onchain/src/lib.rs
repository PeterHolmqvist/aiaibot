use anchor_lang::prelude::*;

declare_id!("FoooWVaFppYJimDvPonULD6ZPk8n52QhHBE4XQzqEUai");

#[program]
pub mod aiai_onchain {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
