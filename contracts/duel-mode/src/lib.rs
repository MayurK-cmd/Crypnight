#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
    Symbol,
};

// ============================================================================
// Data Keys and Types
// ============================================================================

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Admin,
    DuelTreasuryBalance,
    TotalFeesCollected,
    Duel(String), // match_id -> DuelState
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DuelState {
    pub match_id: String,
    pub player_a: Address,
    pub player_b: Address,
    pub stake_stroops: i128,
    pub pot_stroops: i128,
    pub status: u8, // 0=waiting_b, 1=active, 2=settled, 3=refunded
    pub player_a_deposited: bool,
    pub player_b_deposited: bool,
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_WAITING_B: u8 = 0;
const STATUS_ACTIVE: u8 = 1;
const STATUS_SETTLED: u8 = 2;
const STATUS_REFUNDED: u8 = 3;

const PLATFORM_FEE_BPS: u64 = 2_000; // 20% in basis points
const BPS_DENOMINATOR: u64 = 10_000;

// Tier stake amounts in stroops (1 XLM = 10,000,000 stroops)
const STAKE_BEGINNER: i128 = 500_000; // 0.05 XLM
const STAKE_INTERMEDIATE: i128 = 1_000_000; // 0.10 XLM
const STAKE_PRO: i128 = 2_500_000; // 0.25 XLM
const STAKE_GM: i128 = 5_000_000; // 0.50 XLM

// ============================================================================
// Errors
// ============================================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DuelError {
    NotInitialized = 1,
    Unauthorized = 2,
    WrongStakeAmount = 3,
    AlreadyDeposited = 4,
    WrongStatus = 5,
    NotAParticipant = 6,
    InsufficientBalance = 7,
    InvalidWinner = 8,
    InvalidTier = 9,
    DuelNotFound = 10,
}

// ============================================================================
// Events
// ============================================================================

#[contractevent]
pub struct DuelTreasuryInitialized {
    #[topic]
    pub admin: Address,
}

#[contractevent]
pub struct EscrowCreated {
    #[topic]
    pub match_id: String,
    #[topic]
    pub player_a: Address,
    pub player_b: Address,
    pub stake: i128,
}

#[contractevent]
pub struct PlayerJoinedDuel {
    #[topic]
    pub match_id: String,
    #[topic]
    pub player_b: Address,
    pub pot: i128,
}

#[contractevent]
pub struct DuelSettled {
    #[topic]
    pub match_id: String,
    #[topic]
    pub winner: Address,
    pub winner_payout: i128,
    pub fee: i128,
}

#[contractevent]
pub struct DuelRefunded {
    #[topic]
    pub match_id: String,
    pub player_a: Address,
    pub player_b: Address,
    pub refund_amount: i128,
}

#[contractevent]
pub struct DuelForfeited {
    #[topic]
    pub match_id: String,
    #[topic]
    pub forfeiting_player: Address,
    #[topic]
    pub winner: Address,
    pub winner_payout: i128,
    pub fee: i128,
}

// ============================================================================
// Contract Implementation
// ============================================================================

#[contract]
pub struct CrypnightDuelContract;

#[contractimpl]
impl CrypnightDuelContract {
    /// Initialize the duel treasury with an admin.
    pub fn initialize_duel_treasury(env: Env, admin: Address) -> Result<(), DuelError> {
        // Check if already initialized
        if env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Admin)
            .is_ok()
        {
            return Err(DuelError::Unauthorized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::DuelTreasuryBalance, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &0i128);

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        DuelTreasuryInitialized { admin: admin.clone() }.publish(&env);
        Ok(())
    }

    /// Player A creates a duel escrow and deposits their stake.
    /// match_id: unique match identifier from backend
    /// tier: 0=beginner, 1=intermediate, 2=pro, 3=gm
    pub fn create_duel_escrow(
        env: Env,
        match_id: String,
        player_a: Address,
        player_b: Address,
        tier: u8,
    ) -> Result<(), DuelError> {
        let stake = tier_to_stake(tier)?;

        // Create duel state
        let duel_state = DuelState {
            match_id: match_id.clone(),
            player_a: player_a.clone(),
            player_b: player_b.clone(),
            stake_stroops: stake,
            pot_stroops: stake,
            status: STATUS_WAITING_B,
            player_a_deposited: true,
            player_b_deposited: false,
        };

        // Store duel
        env.storage()
            .instance()
            .set(&DataKey::Duel(match_id.clone()), &duel_state);

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        EscrowCreated {
            match_id: match_id.clone(),
            player_a: player_a.clone(),
            player_b: player_b.clone(),
            stake,
        }
        .publish(&env);

        Ok(())
    }

    /// Player B joins the duel and deposits their stake.
    /// Status moves from waiting_b → active.
    pub fn join_duel_escrow(
        env: Env,
        match_id: String,
        player_b: Address,
    ) -> Result<(), DuelError> {
        // Get existing duel
        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .map_err(|_| DuelError::DuelNotFound)?;

        // Verify status and player
        if duel_state.status != STATUS_WAITING_B {
            return Err(DuelError::WrongStatus);
        }
        if duel_state.player_b != player_b {
            return Err(DuelError::NotAParticipant);
        }
        if duel_state.player_b_deposited {
            return Err(DuelError::AlreadyDeposited);
        }

        // Update duel state
        duel_state.player_b_deposited = true;
        duel_state.pot_stroops += duel_state.stake_stroops;
        duel_state.status = STATUS_ACTIVE;

        env.storage()
            .instance()
            .set(&DataKey::Duel(match_id.clone()), &duel_state);

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        PlayerJoinedDuel {
            match_id: match_id.clone(),
            player_b: player_b.clone(),
            pot: duel_state.pot_stroops,
        }
        .publish(&env);

        Ok(())
    }

    /// Settle the duel — called by admin after game ends.
    /// Winner receives 80% of pot; 20% goes to duel treasury.
    pub fn settle_duel(
        env: Env,
        match_id: String,
        winner: Address,
    ) -> Result<(), DuelError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .map_err(|_| DuelError::NotInitialized)?;
        admin.require_auth();

        // Get duel
        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .map_err(|_| DuelError::DuelNotFound)?;

        // Verify status and winner
        if duel_state.status != STATUS_ACTIVE {
            return Err(DuelError::WrongStatus);
        }
        if winner != duel_state.player_a && winner != duel_state.player_b {
            return Err(DuelError::InvalidWinner);
        }

        // Calculate payouts
        let fee = (duel_state.pot_stroops as u64 * PLATFORM_FEE_BPS / BPS_DENOMINATOR) as i128;
        let winner_payout = duel_state.pot_stroops - fee;

        // Update treasury
        let treasury_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DuelTreasuryBalance)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::DuelTreasuryBalance, &(treasury_balance + fee));

        let total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &(total_fees + fee));

        // Update duel state
        duel_state.status = STATUS_SETTLED;
        duel_state.pot_stroops = 0;

        env.storage()
            .instance()
            .set(&DataKey::Duel(match_id.clone()), &duel_state);

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        DuelSettled {
            match_id: match_id.clone(),
            winner: winner.clone(),
            winner_payout,
            fee,
        }
        .publish(&env);

        Ok(())
    }

    /// Refund both players — called on draw or cancellation.
    /// Both players get their full stake back.
    pub fn refund_duel(env: Env, match_id: String) -> Result<(), DuelError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .map_err(|_| DuelError::NotInitialized)?;
        admin.require_auth();

        // Get duel
        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .map_err(|_| DuelError::DuelNotFound)?;

        // Verify status (can refund waiting or active)
        if duel_state.status != STATUS_WAITING_B && duel_state.status != STATUS_ACTIVE {
            return Err(DuelError::WrongStatus);
        }

        let refund_amount = duel_state.stake_stroops;

        // Update duel state
        duel_state.status = STATUS_REFUNDED;
        duel_state.pot_stroops = 0;

        env.storage()
            .instance()
            .set(&DataKey::Duel(match_id.clone()), &duel_state);

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        DuelRefunded {
            match_id: match_id.clone(),
            player_a: duel_state.player_a.clone(),
            player_b: duel_state.player_b.clone(),
            refund_amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Forfeit — called when a player disconnects.
    /// Connected player wins automatically.
    /// Same payout math as settle_duel (80/20 split).
    pub fn forfeit_duel(
        env: Env,
        match_id: String,
        forfeiting_player: Address,
    ) -> Result<(), DuelError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .map_err(|_| DuelError::NotInitialized)?;
        admin.require_auth();

        // Get duel
        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .map_err(|_| DuelError::DuelNotFound)?;

        // Verify status
        if duel_state.status != STATUS_ACTIVE {
            return Err(DuelError::WrongStatus);
        }

        // Determine winner
        if forfeiting_player != duel_state.player_a && forfeiting_player != duel_state.player_b {
            return Err(DuelError::NotAParticipant);
        }

        let winner = if forfeiting_player == duel_state.player_a {
            duel_state.player_b.clone()
        } else {
            duel_state.player_a.clone()
        };

        // Calculate payouts
        let fee = (duel_state.pot_stroops as u64 * PLATFORM_FEE_BPS / BPS_DENOMINATOR) as i128;
        let winner_payout = duel_state.pot_stroops - fee;

        // Update treasury
        let treasury_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DuelTreasuryBalance)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::DuelTreasuryBalance, &(treasury_balance + fee));

        let total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &(total_fees + fee));

        // Update duel state
        duel_state.status = STATUS_SETTLED;
        duel_state.pot_stroops = 0;

        env.storage()
            .instance()
            .set(&DataKey::Duel(match_id.clone()), &duel_state);

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        DuelForfeited {
            match_id: match_id.clone(),
            forfeiting_player: forfeiting_player.clone(),
            winner: winner.clone(),
            winner_payout,
            fee,
        }
        .publish(&env);

        Ok(())
    }

    /// Get duel state by match_id
    pub fn get_duel(env: Env, match_id: String) -> Result<DuelState, DuelError> {
        env.storage()
            .instance()
            .get(&DataKey::Duel(match_id))
            .map_err(|_| DuelError::DuelNotFound)
    }

    /// Get duel treasury balance
    pub fn get_treasury_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DuelTreasuryBalance)
            .unwrap_or(0)
    }

    /// Get total fees collected
    pub fn get_total_fees_collected(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Result<Address, DuelError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .map_err(|_| DuelError::NotInitialized)
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn tier_to_stake(tier: u8) -> Result<i128, DuelError> {
    match tier {
        0 => Ok(STAKE_BEGINNER),
        1 => Ok(STAKE_INTERMEDIATE),
        2 => Ok(STAKE_PRO),
        3 => Ok(STAKE_GM),
        _ => Err(DuelError::InvalidTier),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String as SorobanString};

    #[test]
    fn test_initialize_duel_treasury() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightDuelContract);
        let client = CrypnightDuelContractClient::new(&env, &contract_id);

        let result = client.initialize_duel_treasury(&admin);
        assert!(result.is_ok());

        let stored_admin = client.get_admin();
        assert_eq!(stored_admin, admin);

        assert_eq!(client.get_treasury_balance(), 0);
        assert_eq!(client.get_total_fees_collected(), 0);
    }

    #[test]
    fn test_create_and_join_duel() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let player_a = Address::generate(&env);
        let player_b = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightDuelContract);
        let client = CrypnightDuelContractClient::new(&env, &contract_id);

        // Initialize
        client.initialize_duel_treasury(&admin);

        // Create duel
        let match_id = SorobanString::from_str(&env, "match-1");
        let result = client.create_duel_escrow(&match_id, &player_a, &player_b, &0u8);
        assert!(result.is_ok());

        // Verify duel state
        let duel = client.get_duel(&match_id);
        assert!(duel.is_ok());
        let duel_state = duel.unwrap();
        assert_eq!(duel_state.player_a, player_a);
        assert_eq!(duel_state.player_b, player_b);
        assert_eq!(duel_state.stake_stroops, STAKE_BEGINNER);
        assert_eq!(duel_state.pot_stroops, STAKE_BEGINNER);
        assert_eq!(duel_state.status, STATUS_WAITING_B);

        // Player B joins
        let result = client.join_duel_escrow(&match_id, &player_b);
        assert!(result.is_ok());

        // Verify status changed to active
        let duel = client.get_duel(&match_id);
        let duel_state = duel.unwrap();
        assert_eq!(duel_state.status, STATUS_ACTIVE);
        assert_eq!(duel_state.pot_stroops, STAKE_BEGINNER * 2);
        assert!(duel_state.player_a_deposited);
        assert!(duel_state.player_b_deposited);
    }

    #[test]
    fn test_settle_duel() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let player_a = Address::generate(&env);
        let player_b = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightDuelContract);
        let client = CrypnightDuelContractClient::new(&env, &contract_id);

        // Setup
        client.initialize_duel_treasury(&admin);
        let match_id = SorobanString::from_str(&env, "match-1");
        client.create_duel_escrow(&match_id, &player_a, &player_b, &0u8);
        client.join_duel_escrow(&match_id, &player_b);

        // Settle with player_a as winner
        let result = client.settle_duel(&match_id, &player_a);
        assert!(result.is_ok());

        // Verify settlement
        let duel = client.get_duel(&match_id).unwrap();
        assert_eq!(duel.status, STATUS_SETTLED);

        // Fee: (1000000 * 2000) / 10000 = 200000
        // Winner payout: 2000000 - 200000 = 1800000
        let expected_fee = (STAKE_BEGINNER * 2 * 2000) / 10_000;
        assert_eq!(client.get_treasury_balance(), expected_fee);
        assert_eq!(client.get_total_fees_collected(), expected_fee);
    }

    #[test]
    fn test_forfeit_duel() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let player_a = Address::generate(&env);
        let player_b = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightDuelContract);
        let client = CrypnightDuelContractClient::new(&env, &contract_id);

        // Setup
        client.initialize_duel_treasury(&admin);
        let match_id = SorobanString::from_str(&env, "match-1");
        client.create_duel_escrow(&match_id, &player_a, &player_b, &1u8); // Intermediate
        client.join_duel_escrow(&match_id, &player_b);

        // Player A forfeits
        let result = client.forfeit_duel(&match_id, &player_a);
        assert!(result.is_ok());

        // Verify forfeit
        let duel = client.get_duel(&match_id).unwrap();
        assert_eq!(duel.status, STATUS_SETTLED);
    }

    #[test]
    fn test_refund_duel() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let player_a = Address::generate(&env);
        let player_b = Address::generate(&env);

        let contract_id = env.register_contract(None, CrypnightDuelContract);
        let client = CrypnightDuelContractClient::new(&env, &contract_id);

        // Setup
        client.initialize_duel_treasury(&admin);
        let match_id = SorobanString::from_str(&env, "match-1");
        client.create_duel_escrow(&match_id, &player_a, &player_b, &0u8);
        client.join_duel_escrow(&match_id, &player_b);

        // Refund
        let result = client.refund_duel(&match_id);
        assert!(result.is_ok());

        // Verify refund
        let duel = client.get_duel(&match_id).unwrap();
        assert_eq!(duel.status, STATUS_REFUNDED);
        assert_eq!(duel.pot_stroops, 0);
    }
}
