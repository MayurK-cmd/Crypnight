#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, Symbol,
};

// ============================================================================
// Data Keys and Types
// ============================================================================

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Admin,
    EscrowBalance,
    TotalPaidOut,
    TotalFeesRetained,
}

// ============================================================================
// Errors
// ============================================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CrypnightError {
    NotInitialized = 1,
    Unauthorized = 2,
    InsufficientFunds = 3,
    ZeroReward = 4,
    InvalidAmount = 5,
}

// ============================================================================
// Events
// ============================================================================

#[contractevent]
pub struct TreasuryInitialized {
    #[topic]
    pub admin: Address,
}

#[contractevent]
pub struct RewardPaid {
    #[topic]
    pub player: Address,
    pub gross_reward: i128,
    pub fee: i128,
    pub player_payout: i128,
}

#[contractevent]
pub struct TreasuryFunded {
    #[topic]
    pub funder: Address,
    pub amount: i128,
}

#[contractevent]
pub struct EscrowWithdrawn {
    #[topic]
    pub admin: Address,
    pub amount: i128,
}

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_FEE_BPS: u64 = 300; // 3% in basis points
const BPS_DENOMINATOR: u64 = 10_000;
const ADMIN_BUMP: u32 = 0;

// ============================================================================
// Contract Implementation
// ============================================================================

#[contract]
pub struct CrypnightSoloContract;

#[contractimpl]
impl CrypnightSoloContract {
    /// Initialize the treasury with an admin.
    /// Must be called once at deployment.
    pub fn initialize_treasury(env: Env, admin: Address) -> Result<(), CrypnightError> {
        // Check if already initialized
        if env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Admin)
            .is_ok()
        {
            return Err(CrypnightError::Unauthorized);
        }

        // Set admin and initial state
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::EscrowBalance, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalPaidOut, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesRetained, &0i128);

        // Extend TTL (120 = current ledger offset, 180 = target ledger offset)
        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        TreasuryInitialized { admin: admin.clone() }.publish(&env);
        Ok(())
    }

    /// Pay a reward to a player.
    /// Only the admin can call this.
    /// Deducts 3% fee and sends the rest to the player.
    pub fn pay_reward(
        env: Env,
        player: Address,
        gross_reward_stroops: i128,
    ) -> Result<(), CrypnightError> {
        // Verify admin is calling
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .map_err(|_| CrypnightError::NotInitialized)?;
        admin.require_auth();

        // Validate reward amount
        if gross_reward_stroops <= 0 {
            return Err(CrypnightError::ZeroReward);
        }

        // Calculate fee (3%) and player payout
        let fee = (gross_reward_stroops as u64 * PLATFORM_FEE_BPS / BPS_DENOMINATOR) as i128;
        let player_payout = gross_reward_stroops - fee;

        // Check escrow has sufficient balance
        let escrow_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowBalance)
            .unwrap_or(0);

        if escrow_balance < player_payout {
            return Err(CrypnightError::InsufficientFunds);
        }

        // Update balances
        env.storage()
            .instance()
            .set(&DataKey::EscrowBalance, &(escrow_balance - player_payout));

        let total_paid_out: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPaidOut)
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::TotalPaidOut,
            &(total_paid_out + player_payout),
        );

        let total_fees_retained: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesRetained)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesRetained, &(total_fees_retained + fee));

        // Extend TTL
        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        RewardPaid {
            player: player.clone(),
            gross_reward: gross_reward_stroops,
            fee,
            player_payout,
        }
        .publish(&env);

        Ok(())
    }

    /// Fund the treasury escrow with XLM.
    /// Anyone can fund, but only admin can withdraw.
    pub fn fund_treasury(env: Env, funder: Address, amount_stroops: i128) -> Result<(), CrypnightError> {
        if amount_stroops <= 0 {
            return Err(CrypnightError::InvalidAmount);
        }

        // Get current escrow balance
        let escrow_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowBalance)
            .unwrap_or(0);

        // Update escrow balance
        let new_balance = escrow_balance + amount_stroops;
        env.storage()
            .instance()
            .set(&DataKey::EscrowBalance, &new_balance);

        // Extend TTL
        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        TreasuryFunded {
            funder: funder.clone(),
            amount: amount_stroops,
        }
        .publish(&env);

        Ok(())
    }

    /// Withdraw funds from escrow (admin only).
    /// Used to drain platform fees and remaining balance.
    pub fn withdraw_escrow(env: Env, amount_stroops: i128) -> Result<(), CrypnightError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .map_err(|_| CrypnightError::NotInitialized)?;
        admin.require_auth();

        if amount_stroops <= 0 {
            return Err(CrypnightError::InvalidAmount);
        }

        // Get current escrow balance
        let escrow_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowBalance)
            .unwrap_or(0);

        if escrow_balance < amount_stroops {
            return Err(CrypnightError::InsufficientFunds);
        }

        // Update escrow balance
        let new_balance = escrow_balance - amount_stroops;
        env.storage()
            .instance()
            .set(&DataKey::EscrowBalance, &new_balance);

        // Extend TTL
        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        EscrowWithdrawn {
            admin: admin.clone(),
            amount: amount_stroops,
        }
        .publish(&env);

        Ok(())
    }

    /// Get the current escrow balance.
    pub fn get_escrow_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::EscrowBalance)
            .unwrap_or(0)
    }

    /// Get total rewards paid out.
    pub fn get_total_paid_out(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalPaidOut)
            .unwrap_or(0)
    }

    /// Get total fees retained.
    pub fn get_total_fees_retained(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesRetained)
            .unwrap_or(0)
    }

    /// Get the admin address.
    pub fn get_admin(env: Env) -> Result<Address, CrypnightError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .map_err(|_| CrypnightError::NotInitialized)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_initialize_treasury() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightSoloContract);
        let client = CrypnightSoloContractClient::new(&env, &contract_id);

        // Initialize treasury
        let result = client.initialize_treasury(&admin);
        assert!(result.is_ok());

        // Verify admin is set
        let stored_admin = client.get_admin();
        assert_eq!(stored_admin, admin);

        // Verify initial balances
        assert_eq!(client.get_escrow_balance(), 0);
        assert_eq!(client.get_total_paid_out(), 0);
        assert_eq!(client.get_total_fees_retained(), 0);
    }

    #[test]
    fn test_fund_and_pay_reward() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let player = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightSoloContract);
        let client = CrypnightSoloContractClient::new(&env, &contract_id);

        // Initialize
        client.initialize_treasury(&admin);

        // Fund treasury with 1 million stroops
        client.fund_treasury(&admin, &1_000_000i128);
        assert_eq!(client.get_escrow_balance(), 1_000_000i128);

        // Pay reward: 100,000 stroops gross
        // Fee: 100,000 * 300 / 10,000 = 3,000
        // Player payout: 97,000
        let result = client.pay_reward(&player, &100_000i128);
        assert!(result.is_ok());

        assert_eq!(client.get_escrow_balance(), 903_000i128);
        assert_eq!(client.get_total_paid_out(), 97_000i128);
        assert_eq!(client.get_total_fees_retained(), 3_000i128);
    }

    #[test]
    fn test_insufficient_funds() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let player = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightSoloContract);
        let client = CrypnightSoloContractClient::new(&env, &contract_id);

        // Initialize
        client.initialize_treasury(&admin);

        // Try to pay reward without funding
        let result = client.try_pay_reward(&player, &100_000i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_zero_reward_error() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let player = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightSoloContract);
        let client = CrypnightSoloContractClient::new(&env, &contract_id);

        // Initialize and fund
        client.initialize_treasury(&admin);
        client.fund_treasury(&admin, &1_000_000i128);

        // Try to pay zero reward
        let result = client.try_pay_reward(&player, &0i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_withdraw_escrow() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightSoloContract);
        let client = CrypnightSoloContractClient::new(&env, &contract_id);

        // Initialize and fund
        client.initialize_treasury(&admin);
        client.fund_treasury(&admin, &1_000_000i128);

        // Withdraw 500,000
        let result = client.withdraw_escrow(&500_000i128);
        assert!(result.is_ok());

        assert_eq!(client.get_escrow_balance(), 500_000i128);
    }
}
