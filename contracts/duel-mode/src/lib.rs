#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Admin,
    TreasuryAccount,
    TotalFeesCollected,
    Duel(String),
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DuelState {
    pub match_id: String,
    pub player_a: Address,
    pub player_b: Address,
    pub stake_stroops: i128,
    pub pot_stroops: i128,
    pub status: i32,
    pub player_a_deposited: bool,
    pub player_b_deposited: bool,
}

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

#[contractevent]
pub struct DuelTreasuryInitialized {
    #[topic]
    pub admin: Address,
    #[topic]
    pub treasury: Address,
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

const STATUS_WAITING_B: i32 = 0;
const STATUS_ACTIVE: i32 = 1;
const STATUS_SETTLED: i32 = 2;
const STATUS_REFUNDED: i32 = 3;

const PLATFORM_FEE_BPS: i128 = 2_000;
const BPS_DENOMINATOR: i128 = 10_000;

const STAKE_BEGINNER: i128 = 500_000;
const STAKE_INTERMEDIATE: i128 = 1_000_000;
const STAKE_PRO: i128 = 2_500_000;
const STAKE_GM: i128 = 5_000_000;

#[contract]
pub struct CrypnightDuelContract;

#[contractimpl]
impl CrypnightDuelContract {
    pub fn __constructor(env: Env, admin: Address, treasury: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TreasuryAccount, &treasury);
        env.storage().instance().set(&DataKey::TotalFeesCollected, &0i128);
        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);
        DuelTreasuryInitialized {
            admin: admin.clone(),
            treasury: treasury.clone(),
        }
        .publish(&env);
    }

    pub fn create_duel_escrow(
        env: Env,
        match_id: String,
        player_a: Address,
        player_b: Address,
        tier: i32,
    ) -> Result<(), DuelError> {
        let stake = tier_to_stake(tier)?;

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

    pub fn join_duel_escrow(
        env: Env,
        match_id: String,
        player_b: Address,
    ) -> Result<(), DuelError> {
        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .ok_or(DuelError::DuelNotFound)?;

        if duel_state.status != STATUS_WAITING_B {
            return Err(DuelError::WrongStatus);
        }
        if duel_state.player_b != player_b {
            return Err(DuelError::NotAParticipant);
        }
        if duel_state.player_b_deposited {
            return Err(DuelError::AlreadyDeposited);
        }

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

    pub fn settle_duel(
        env: Env,
        match_id: String,
        winner: Address,
    ) -> Result<(), DuelError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(DuelError::NotInitialized)?;
        admin.require_auth();

        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .ok_or(DuelError::DuelNotFound)?;

        if duel_state.status != STATUS_ACTIVE {
            return Err(DuelError::WrongStatus);
        }
        if winner != duel_state.player_a && winner != duel_state.player_b {
            return Err(DuelError::InvalidWinner);
        }

        let fee = (duel_state.pot_stroops * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        let winner_payout = duel_state.pot_stroops - fee;

        let total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &(total_fees + fee));

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

    pub fn refund_duel(env: Env, match_id: String) -> Result<(), DuelError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(DuelError::NotInitialized)?;
        admin.require_auth();

        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .ok_or(DuelError::DuelNotFound)?;

        if duel_state.status != STATUS_WAITING_B && duel_state.status != STATUS_ACTIVE {
            return Err(DuelError::WrongStatus);
        }

        let refund_amount = duel_state.stake_stroops;

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

    pub fn forfeit_duel(
        env: Env,
        match_id: String,
        forfeiting_player: Address,
    ) -> Result<(), DuelError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(DuelError::NotInitialized)?;
        admin.require_auth();

        let mut duel_state: DuelState = env
            .storage()
            .instance()
            .get(&DataKey::Duel(match_id.clone()))
            .ok_or(DuelError::DuelNotFound)?;

        if duel_state.status != STATUS_ACTIVE {
            return Err(DuelError::WrongStatus);
        }

        if forfeiting_player != duel_state.player_a && forfeiting_player != duel_state.player_b {
            return Err(DuelError::NotAParticipant);
        }

        let winner = if forfeiting_player == duel_state.player_a {
            duel_state.player_b.clone()
        } else {
            duel_state.player_a.clone()
        };

        let fee = (duel_state.pot_stroops * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        let winner_payout = duel_state.pot_stroops - fee;

        let total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesCollected, &(total_fees + fee));

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

    pub fn get_duel(env: Env, match_id: String) -> Result<DuelState, DuelError> {
        env.storage()
            .instance()
            .get(&DataKey::Duel(match_id))
            .ok_or(DuelError::DuelNotFound)
    }

    pub fn get_total_fees_collected(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesCollected)
            .unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Result<Address, DuelError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(DuelError::NotInitialized)
    }

    pub fn get_treasury(env: Env) -> Result<Address, DuelError> {
        env.storage()
            .instance()
            .get(&DataKey::TreasuryAccount)
            .ok_or(DuelError::NotInitialized)
    }
}

fn tier_to_stake(tier: i32) -> Result<i128, DuelError> {
    match tier {
        0 => Ok(STAKE_BEGINNER),
        1 => Ok(STAKE_INTERMEDIATE),
        2 => Ok(STAKE_PRO),
        3 => Ok(STAKE_GM),
        _ => Err(DuelError::InvalidTier),
    }
}
