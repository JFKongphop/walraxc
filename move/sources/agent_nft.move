module walraxc::agent_nft {
  use std::string::String;
  use sui::{bcs, clock::Clock, event, hash};

  //
  // Errors
  //
  const E_NOT_AUTHORIZED: u64 = 2;
  const E_EMPTY_DATA: u64 = 3;

  //
  // Admin Capability
  //
  public struct AdminCap has key {
    id: UID,
  }

  //
  // Supply Tracker
  //
  public struct Registry has key {
    id: UID,
    total_supply: u64,
  }

  //
  // Audit Merkle Tree Tracker (Global)
  //
  public struct AuditRegistry has key {
    id: UID,
    audit_leaves: vector<vector<u8>>,
    audit_merkle_root: vector<u8>,
  }

  //
  // ERC7857 IntelligentData
  //
  #[allow(unused_field)]
  public struct IntelligentData has copy, drop, store {
    data_description: String,
    data_hash: vector<u8>,
  }

  //
  // Historical Snapshot
  //
  public struct AuditSnapshot has copy, drop, store {
    timestamp_ms: u64,
    datas: vector<IntelligentData>,
  }

  //
  // Agent NFT
  //
  public struct AgentNFT has key, store {
    id: UID,
    owner: address,
    agent_address: address,
    intelligent_datas: vector<IntelligentData>,
    history: vector<AuditSnapshot>,
    intelligence_count: u64,
    token_uri: String,
    reputation: u64,
  }

  //
  // Events
  //
  public struct AgentMinted has copy, drop {
    owner: address,
    agent: address,
  }

  public struct Updated has copy, drop {
    agent_id: address,
    update_count: u64,
  }

  public struct AuditLeafAdded has copy, drop {
    nft_id: address,
    leaf: vector<u8>,
    leaf_index: u64,
    new_merkle_root: vector<u8>,
  }

  //
  // Package Initialization
  //
  fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry {
      id: object::new(ctx),
      total_supply: 0,
    });

    transfer::share_object(AuditRegistry {
      id: object::new(ctx),
      audit_leaves: vector[],
      audit_merkle_root: vector[],
    });

    transfer::transfer(
      AdminCap {
        id: object::new(ctx),
      },
      tx_context::sender(ctx),
    );
  }

  //
  // Mint Agent NFT
  //
  public fun mint(
    _cap: &AdminCap,
    registry: &mut Registry,
    to: address,
    agent: address,
    datas: vector<IntelligentData>,
    ctx: &mut TxContext,
  ) {
    assert!(vector::length(&datas) > 0, E_EMPTY_DATA);

    let nft = AgentNFT {
      id: object::new(ctx),
      owner: to,
      agent_address: agent,
      intelligent_datas: datas,
      history: vector[],
      intelligence_count: 0,
      token_uri: std::string::utf8(b""),
      reputation: 0,
    };

    registry.total_supply = registry.total_supply + 1;

    event::emit(AgentMinted {
      owner: to,
      agent,
    });

    transfer::public_transfer(nft, to);
  }

  //
  // Update Intelligence
  //
  public fun update(
    nft: &mut AgentNFT,
    audit_registry: &mut AuditRegistry,
    clock: &Clock,
    new_datas: vector<IntelligentData>,
    ctx: &mut TxContext,
  ) {
    assert!(vector::length(&new_datas) > 0, E_EMPTY_DATA);

    let sender = tx_context::sender(ctx);
    assert!(sender == nft.agent_address || sender == nft.owner, E_NOT_AUTHORIZED);

    // Save snapshot to history
    let snapshot = AuditSnapshot {
      timestamp_ms: clock.timestamp_ms(),
      datas: nft.intelligent_datas,
    };
    vector::push_back(&mut nft.history, snapshot);

    // Update current data
    nft.intelligent_datas = new_datas;
    nft.intelligence_count = nft.intelligence_count + 1;

    // Add audit leaf to Merkle tree (mimics Solidity contract)
    // Leaf = hash(nft_id || data_hash || timestamp)
    let nft_id = object::uid_to_address(&nft.id);
    let first_data_hash = vector::borrow(&new_datas, 0).data_hash;
    let timestamp_bytes = bcs::to_bytes(&clock.timestamp_ms());

    let mut leaf_data = vector[];
    vector::append(&mut leaf_data, bcs::to_bytes(&nft_id));
    vector::append(&mut leaf_data, first_data_hash);
    vector::append(&mut leaf_data, timestamp_bytes);
    let leaf = hash::keccak256(&leaf_data);

    let leaf_index = vector::length(&audit_registry.audit_leaves);
    vector::push_back(&mut audit_registry.audit_leaves, leaf);

    // Recompute Merkle root
    audit_registry.audit_merkle_root = compute_merkle_root(&audit_registry.audit_leaves);

    event::emit(Updated {
      agent_id: nft.owner,
      update_count: nft.intelligence_count,
    });

    event::emit(AuditLeafAdded {
      nft_id,
      leaf,
      leaf_index,
      new_merkle_root: audit_registry.audit_merkle_root,
    });
  }

  //
  // Change Agent Wallet
  //
  public fun set_agent_address(nft: &mut AgentNFT, new_agent: address, ctx: &mut TxContext) {
    let sender = tx_context::sender(ctx);
    assert!(sender == nft.owner, E_NOT_AUTHORIZED);

    nft.agent_address = new_agent;
  }

  //
  // Set Metadata URI
  //
  public fun set_token_uri(_cap: &AdminCap, nft: &mut AgentNFT, uri: String) {
    nft.token_uri = uri;
  }

  //
  // Increase Reputation
  //
  public fun add_reputation(_cap: &AdminCap, nft: &mut AgentNFT, amount: u64) {
    nft.reputation = nft.reputation + amount;
  }

  //
  // Views
  //
  public fun total_supply(registry: &Registry): u64 { registry.total_supply }

  public fun intelligence_count(nft: &AgentNFT): u64 { nft.intelligence_count }

  public fun reputation(nft: &AgentNFT): u64 { nft.reputation }

  public fun owner(nft: &AgentNFT): address { nft.owner }

  public fun agent_address(nft: &AgentNFT): address { nft.agent_address }

  public fun token_uri(nft: &AgentNFT): String { nft.token_uri }

  public fun intelligent_datas(nft: &AgentNFT): vector<IntelligentData> { nft.intelligent_datas }

  public fun history(nft: &AgentNFT): vector<AuditSnapshot> { nft.history }

  //
  // Audit Merkle Tree Functions
  //

  /// Get all audit leaves (one per update call)
  public fun get_audit_leaves(registry: &AuditRegistry): vector<vector<u8>> {
    registry.audit_leaves
  }

  /// Get current Merkle root
  public fun get_audit_merkle_root(registry: &AuditRegistry): vector<u8> {
    registry.audit_merkle_root
  }

  /// Verify an audit leaf with Merkle proof
  public fun verify_audit(
    registry: &AuditRegistry,
    leaf: vector<u8>,
    proof: vector<vector<u8>>,
  ): bool {
    verify_merkle_proof(leaf, proof, registry.audit_merkle_root)
  }

  /// Compute Merkle root from leaves (sorted-pair hashing, OZ compatible)
  fun compute_merkle_root(leaves: &vector<vector<u8>>): vector<u8> {
    let n = vector::length(leaves);
    if (n == 0) {
      return vector[]
    };

    // Copy leaves to mutable layer
    let mut layer = vector[];
    let mut i = 0;
    while (i < n) {
      vector::push_back(&mut layer, *vector::borrow(leaves, i));
      i = i + 1;
    };

    // Build tree bottom-up
    while (vector::length(&layer) > 1) {
      let len = vector::length(&layer);
      let new_len = (len + 1) / 2;
      let mut next = vector[];

      let mut j = 0;
      while (j < new_len) {
        let idx_a = 2 * j;
        let idx_b = 2 * j + 1;

        if (idx_b < len) {
          // Sort pairs for OZ compatibility
          let a = *vector::borrow(&layer, idx_a);
          let b = *vector::borrow(&layer, idx_b);
          let hash = if (compare_bytes(&a, &b)) {
            hash_pair(&a, &b)
          } else {
            hash_pair(&b, &a)
          };
          vector::push_back(&mut next, hash);
        } else {
          // Odd leaf carries up
          vector::push_back(&mut next, *vector::borrow(&layer, idx_a));
        };
        j = j + 1;
      };
      layer = next;
    };

    *vector::borrow(&layer, 0)
  }

  /// Verify Merkle proof (sorted-pair hashing)
  fun verify_merkle_proof(leaf: vector<u8>, proof: vector<vector<u8>>, root: vector<u8>): bool {
    let mut computed = leaf;
    let proof_len = vector::length(&proof);
    let mut i = 0;

    while (i < proof_len) {
      let sibling = vector::borrow(&proof, i);
      computed = if (compare_bytes(&computed, sibling)) {
        hash_pair(&computed, sibling)
      } else {
        hash_pair(sibling, &computed)
      };
      i = i + 1;
    };

    computed == root
  }

  /// Hash two bytes (keccak256(a || b))
  fun hash_pair(a: &vector<u8>, b: &vector<u8>): vector<u8> {
    let mut combined = *a;
    vector::append(&mut combined, *b);
    hash::keccak256(&combined)
  }

  /// Compare bytes lexicographically (a < b)
  fun compare_bytes(a: &vector<u8>, b: &vector<u8>): bool {
    let len_a = vector::length(a);
    let len_b = vector::length(b);
    let min_len = if (len_a < len_b) { len_a } else { len_b };

    let mut i = 0;
    while (i < min_len) {
      let byte_a = *vector::borrow(a, i);
      let byte_b = *vector::borrow(b, i);
      if (byte_a < byte_b) {
        return true
      };
      if (byte_a > byte_b) {
        return false
      };
      i = i + 1;
    };

    len_a < len_b
  }

  //
  // Test-only functions
  //
  #[test_only]
  public fun test_init(ctx: &mut TxContext) {
    init(ctx);
  }

  #[test_only]
  public fun new_intelligent_data(description: String, hash: vector<u8>): IntelligentData {
    IntelligentData {
      data_description: description,
      data_hash: hash,
    }
  }
}
