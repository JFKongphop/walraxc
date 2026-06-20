// VulnerableVault — Sui Move contract with security issues
module vulnerable::vault {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{TxContext, sender};
    use sui::transfer;
    use sui::balance::{Self, Balance};

    // ❌ Issue 1: Shared object with no access control on withdrawals
    public struct Vault has key {
        id: UID,
        balances: vector<address>,  // ❌ parallel vector — should use Table
        amounts: vector<u64>,
        admin: address,
        fee_percent: u64,
    }

    // ❌ Issue 2: Admin can be anyone — no capability check on init
    fun init(ctx: &mut TxContext) {
        transfer::share_object(Vault {
            id: object::new(ctx),
            balances: vector[],
            amounts: vector[],
            admin: sender(ctx),  // first deployer = admin, but no AdminCap
            fee_percent: 10,
        });
    }

    // Deposit — safe
    public entry fun deposit(vault: &mut Vault, coin: Coin<SUI>, ctx: &mut TxContext) {
        let amount = coin::value(&coin);
        let depositor = sender(ctx);
        let (found, idx) = find_index(&vault.balances, depositor);
        if (found) {
            vault.amounts[idx] = vault.amounts[idx] + amount;
        } else {
            vault.balances.push_back(depositor);
            vault.amounts.push_back(amount);
        };
        // ❌ Issue 3: Coin not deposited — it's destroyed without transfer
        // coin should be put into a Balance, but here it's just dropped
        let _ = coin;
    }

    // ❌ Issue 4: No sender check — anyone can withdraw any amount
    public entry fun withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
        let withdrawer = sender(ctx);
        let (found, idx) = find_index(&vault.balances, withdrawer);
        assert!(found, 0);
        assert!(vault.amounts[idx] >= amount, 1);
        vault.amounts[idx] = vault.amounts[idx] - amount;
        // ❌ Balance created but never transferred — funds trapped
        let bal = balance::zero<SUI>();
        balance::join(&mut bal, balance::create_for_testing(amount));
        // bal dropped without transfer — funds lost
    }

    // ❌ Issue 5: Anyone can change the fee — no access control
    public entry fun set_fee(vault: &mut Vault, new_fee: u64, _ctx: &mut TxContext) {
        vault.fee_percent = new_fee;
    }

    // ❌ Issue 6: Anyone can drain to any address
    public entry fun drain(vault: &mut Vault, to: address, _ctx: &mut TxContext) {
        // No permission check, no balance verification
        // Just drains everything
        let total: u64 = 0;
        let i = 0;
        while (i < vault.amounts.length()) {
            total = total + vault.amounts[i];
            i = i + 1;
        };
        let bal = balance::zero<SUI>();
        balance::join(&mut bal, balance::create_for_testing(total));
        transfer::public_transfer(coin::from_balance(bal, _ctx), to);
    }

    // Helper
    fun find_index(vec: &vector<address>, target: address): (bool, u64) {
        let i = 0;
        while (i < vec.length()) {
            if (vec[i] == target) return (true, i);
            i = i + 1;
        };
        (false, 0)
    }
}