use anchor_lang::prelude::*;

declare_id!("7Br9YjPsgziRbUxmHxCxjq2fnBM17FzXo8XBwqbikXpi");

#[program]
pub mod aiai_onchain_v1 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
