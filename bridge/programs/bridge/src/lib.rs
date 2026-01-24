use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AQnhpeyiJYKvnp47oE4S8ng6aUpSD2VTYBqj8Pw9WDoX");

const COLLATERAL_RATIO: u64 = 150; // 150% collateralization
const LIQUIDATION_THRESHOLD: u64 = 120; // 120% liquidation threshold
const MINT_FEE_BPS: u64 = 30; // 0.3%
const BURN_FEE_BPS: u64 = 30; // 0.3%

#[program]
pub mod bridge {
    use super::*;

    /// Initialize the bridge with wXMR mint and USD1 collateral
    pub fn initialize(
        ctx: Context<Initialize>,
        verification_key: Vec<u8>,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.authority = ctx.accounts.authority.key();
        bridge.wxmr_mint = ctx.accounts.wxmr_mint.key();
        bridge.usd1_mint = ctx.accounts.usd1_mint.key();
        bridge.vault = ctx.accounts.vault.key();
        bridge.pyth_feed = ctx.accounts.pyth_feed.key();
        bridge.total_minted = 0;
        bridge.total_collateral = 0;
        bridge.paused = false;
        bridge.verification_key = verification_key;
        bridge.bump = ctx.bumps.bridge_state;
        
        msg!("Bridge initialized with wXMR mint: {}", bridge.wxmr_mint);
        Ok(())
    }

    /// Register as a Liquidity Provider
    pub fn register_lp(
        ctx: Context<RegisterLP>,
        initial_collateral: u64,
    ) -> Result<()> {
        require!(initial_collateral > 0, BridgeError::InvalidAmount);
        
        let lp = &mut ctx.accounts.lp_position;
        lp.owner = ctx.accounts.owner.key();
        lp.collateral_amount = initial_collateral;
        lp.minted_amount = 0;
        lp.last_update = Clock::get()?.unix_timestamp;
        lp.bump = ctx.bumps.lp_position;

        // Transfer USD1 collateral to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_usd1.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            initial_collateral,
        )?;

        let bridge = &mut ctx.accounts.bridge_state;
        bridge.total_collateral = bridge.total_collateral.checked_add(initial_collateral)
            .ok_or(BridgeError::Overflow)?;

        msg!("LP registered with {} USD1 collateral", initial_collateral);
        Ok(())
    }

    /// Mint wXMR against LP collateral after proof verification
    pub fn mint_wxmr(
        ctx: Context<MintWXMR>,
        amount: u64,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
        merkle_root: [u8; 32],
        block_height: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.bridge_state.paused, BridgeError::Paused);
        require!(amount > 0, BridgeError::InvalidAmount);

        // Verify Merkle root exists on-chain
        let block_root = &ctx.accounts.block_root;
        require!(
            block_root.block_height == block_height,
            BridgeError::InvalidBlockHeight
        );
        require!(
            block_root.output_merkle_root == merkle_root,
            BridgeError::InvalidMerkleRoot
        );

        // TODO: Verify ZK proof using Noir verifier
        // This would call the deployed verifier program
        msg!("Proof verification placeholder - implement CPI to verifier");

        // Check LP has sufficient collateral
        let lp = &mut ctx.accounts.lp_position;
        let required_collateral = amount
            .checked_mul(COLLATERAL_RATIO)
            .ok_or(BridgeError::Overflow)?
            .checked_div(100)
            .ok_or(BridgeError::Overflow)?;
        
        let available_collateral = lp.collateral_amount
            .checked_sub(lp.minted_amount.checked_mul(COLLATERAL_RATIO).ok_or(BridgeError::Overflow)?.checked_div(100).ok_or(BridgeError::Overflow)?)
            .ok_or(BridgeError::InsufficientCollateral)?;
        
        require!(
            available_collateral >= required_collateral,
            BridgeError::InsufficientCollateral
        );

        // Calculate fee
        let fee = amount.checked_mul(MINT_FEE_BPS).ok_or(BridgeError::Overflow)?
            .checked_div(10000).ok_or(BridgeError::Overflow)?;
        let amount_after_fee = amount.checked_sub(fee).ok_or(BridgeError::Overflow)?;

        // Mint wXMR to user
        let seeds = &[
            b"bridge",
            ctx.accounts.bridge_state.wxmr_mint.as_ref(),
            &[ctx.accounts.bridge_state.bump],
        ];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.wxmr_mint.to_account_info(),
                    to: ctx.accounts.user_wxmr.to_account_info(),
                    authority: ctx.accounts.bridge_state.to_account_info(),
                },
                signer,
            ),
            amount_after_fee,
        )?;

        // Update state
        lp.minted_amount = lp.minted_amount.checked_add(amount).ok_or(BridgeError::Overflow)?;
        lp.last_update = Clock::get()?.unix_timestamp;
        
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.total_minted = bridge.total_minted.checked_add(amount).ok_or(BridgeError::Overflow)?;

        msg!("Minted {} wXMR (fee: {})", amount_after_fee, fee);
        Ok(())
    }

    /// Burn wXMR to release collateral
    pub fn burn_wxmr(
        ctx: Context<BurnWXMR>,
        amount: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.bridge_state.paused, BridgeError::Paused);
        require!(amount > 0, BridgeError::InvalidAmount);

        let lp = &mut ctx.accounts.lp_position;
        require!(lp.minted_amount >= amount, BridgeError::InsufficientMinted);

        // Calculate fee
        let fee = amount.checked_mul(BURN_FEE_BPS).ok_or(BridgeError::Overflow)?
            .checked_div(10000).ok_or(BridgeError::Overflow)?;

        // Burn wXMR from user
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.wxmr_mint.to_account_info(),
                    from: ctx.accounts.user_wxmr.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Release collateral proportionally
        let collateral_to_release = amount
            .checked_mul(COLLATERAL_RATIO)
            .ok_or(BridgeError::Overflow)?
            .checked_div(100)
            .ok_or(BridgeError::Overflow)?;

        let seeds = &[
            b"bridge",
            ctx.accounts.bridge_state.wxmr_mint.as_ref(),
            &[ctx.accounts.bridge_state.bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.lp_usd1.to_account_info(),
                    authority: ctx.accounts.bridge_state.to_account_info(),
                },
                signer,
            ),
            collateral_to_release,
        )?;

        // Update state
        lp.minted_amount = lp.minted_amount.checked_sub(amount).ok_or(BridgeError::Overflow)?;
        lp.last_update = Clock::get()?.unix_timestamp;
        
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.total_minted = bridge.total_minted.checked_sub(amount).ok_or(BridgeError::Overflow)?;
        bridge.total_collateral = bridge.total_collateral.checked_sub(collateral_to_release).ok_or(BridgeError::Overflow)?;

        msg!("Burned {} wXMR, released {} USD1 collateral", amount, collateral_to_release);
        Ok(())
    }

    /// Submit Merkle root for a block (oracle function)
    pub fn submit_merkle_root(
        ctx: Context<SubmitMerkleRoot>,
        block_height: u64,
        block_hash: [u8; 32],
        tx_merkle_root: [u8; 32],
        output_merkle_root: [u8; 32],
    ) -> Result<()> {
        let block_root = &mut ctx.accounts.block_root;
        block_root.block_height = block_height;
        block_root.block_hash = block_hash;
        block_root.tx_merkle_root = tx_merkle_root;
        block_root.output_merkle_root = output_merkle_root;
        block_root.timestamp = Clock::get()?.unix_timestamp;
        block_root.submitter = ctx.accounts.oracle.key();

        msg!("Merkle root submitted for block {}", block_height);
        Ok(())
    }
}

// Account Structures

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + BridgeState::INIT_SPACE,
        seeds = [b"bridge", wxmr_mint.key().as_ref()],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub wxmr_mint: Account<'info, Mint>,
    pub usd1_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = usd1_mint,
        token::authority = bridge_state,
        seeds = [b"vault", bridge_state.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    /// CHECK: Pyth price feed account
    pub pyth_feed: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterLP<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + LpPosition::INIT_SPACE,
        seeds = [b"lp", bridge_state.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LpPosition>,
    
    #[account(mut)]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(mut)]
    pub owner_usd1: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MintWXMR<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(mut)]
    pub lp_position: Account<'info, LpPosition>,
    
    pub block_root: Account<'info, BlockRoot>,
    
    #[account(mut)]
    pub wxmr_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user_wxmr: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnWXMR<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(mut)]
    pub lp_position: Account<'info, LpPosition>,
    
    #[account(mut)]
    pub wxmr_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user_wxmr: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub lp_usd1: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(block_height: u64)]
pub struct SubmitMerkleRoot<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(
        init,
        payer = oracle,
        space = 8 + BlockRoot::INIT_SPACE,
        seeds = [b"block", bridge_state.key().as_ref(), &block_height.to_le_bytes()],
        bump
    )]
    pub block_root: Account<'info, BlockRoot>,
    
    pub system_program: Program<'info, System>,
}

// State Accounts

#[account]
#[derive(InitSpace)]
pub struct BridgeState {
    pub authority: Pubkey,
    pub wxmr_mint: Pubkey,
    pub usd1_mint: Pubkey,
    pub vault: Pubkey,
    pub pyth_feed: Pubkey,
    pub total_minted: u64,
    pub total_collateral: u64,
    pub paused: bool,
    #[max_len(1024)]
    pub verification_key: Vec<u8>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpPosition {
    pub owner: Pubkey,
    pub collateral_amount: u64,
    pub minted_amount: u64,
    pub last_update: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BlockRoot {
    pub block_height: u64,
    pub block_hash: [u8; 32],
    pub tx_merkle_root: [u8; 32],
    pub output_merkle_root: [u8; 32],
    pub timestamp: i64,
    pub submitter: Pubkey,
}

// Errors

#[error_code]
pub enum BridgeError {
    #[msg("Bridge is paused")]
    Paused,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Insufficient minted amount")]
    InsufficientMinted,
    #[msg("Invalid block height")]
    InvalidBlockHeight,
    #[msg("Invalid Merkle root")]
    InvalidMerkleRoot,
    #[msg("Arithmetic overflow")]
    Overflow,
}
