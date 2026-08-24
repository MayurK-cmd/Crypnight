#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TreasuryAccount,
    TotalPaidOut,
    TotalFeesRetained,
}

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

#[contractevent]
pub struct TreasuryInitialized {
    #[topic]
    pub admin: Address,
    #[topic]
    pub treasury: Address,
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
pub struct FeesWithdrawn {
    #[topic]
    pub admin: Address,
    pub amount: i128,
}

const PLATFORM_FEE_BPS: i128 = 300;
const BPS_DENOMINATOR: i128 = 10_000;

#[contract]
pub struct CrypnightSoloContract;

#[contractimpl]
impl CrypnightSoloContract {
    pub fn __constructor(env: Env, admin: Address, treasury: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TreasuryAccount, &treasury);
        env.storage().instance().set(&DataKey::TotalPaidOut, &0i128);
        env.storage().instance().set(&DataKey::TotalFeesRetained, &0i128);
        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);
        TreasuryInitialized {
            admin: admin.clone(),
            treasury: treasury.clone(),
        }
        .publish(&env);
    }

    pub fn pay_reward(
        env: Env,
        player: Address,
        gross_reward_stroops: i128,
    ) -> Result<(), CrypnightError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(CrypnightError::NotInitialized)?;
        admin.require_auth();

        if gross_reward_stroops <= 0 {
            return Err(CrypnightError::ZeroReward);
        }

        let fee = (gross_reward_stroops * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        let player_payout = gross_reward_stroops - fee;

        let total_paid_out: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPaidOut)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalPaidOut, &(total_paid_out + player_payout));

        let total_fees_retained: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesRetained)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalFeesRetained, &(total_fees_retained + fee));

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

    pub fn fund_treasury(env: Env, funder: Address, amount_stroops: i128) -> Result<(), CrypnightError> {
        if amount_stroops <= 0 {
            return Err(CrypnightError::InvalidAmount);
        }

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        TreasuryFunded {
            funder: funder.clone(),
            amount: amount_stroops,
        }
        .publish(&env);

        Ok(())
    }

    pub fn withdraw_fees(env: Env, amount_stroops: i128) -> Result<(), CrypnightError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(CrypnightError::NotInitialized)?;
        admin.require_auth();

        if amount_stroops <= 0 {
            return Err(CrypnightError::InvalidAmount);
        }

        let total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesRetained)
            .unwrap_or(0);

        if total_fees < amount_stroops {
            return Err(CrypnightError::InsufficientFunds);
        }

        env.storage()
            .instance()
            .set(&DataKey::TotalFeesRetained, &(total_fees - amount_stroops));

        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        FeesWithdrawn {
            admin: admin.clone(),
            amount: amount_stroops,
        }
        .publish(&env);

        Ok(())
    }

    pub fn get_total_paid_out(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalPaidOut)
            .unwrap_or(0)
    }

    pub fn get_total_fees_retained(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFeesRetained)
            .unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Result<Address, CrypnightError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(CrypnightError::NotInitialized)
    }

    pub fn get_treasury(env: Env) -> Result<Address, CrypnightError> {
        env.storage()
            .instance()
            .get(&DataKey::TreasuryAccount)
            .ok_or(CrypnightError::NotInitialized)
    }
}
