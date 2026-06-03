#[test_only]
module walraxc::agent_nft_test {
  use std::string;
  use sui::test_scenario::{Self as ts, Scenario};
  use sui::clock::Self;
  use walraxc::agent_nft::{
    Self,
    AdminCap,
    Registry,
    AuditRegistry,
    AgentNFT,
    IntelligentData,
  };

  const ADMIN: address = @0xAD;
  const OWNER: address = @0x0F;
  const AGENT: address = @0xAC;
  const NEW_AGENT: address = @0xAB;

  fun setup_test(): Scenario {
    let mut scenario = ts::begin(ADMIN);
    {
      agent_nft::test_init(ts::ctx(&mut scenario));
    };
    scenario
  }

  fun create_sample_data(): vector<IntelligentData> {
    let mut datas = vector[];
    vector::push_back(&mut datas, agent_nft::new_intelligent_data(
      string::utf8(b"Audit Report 1"),
      x"1111111111111111111111111111111111111111111111111111111111111111",
    ));
    datas
  }

  #[test]
  fun test_init() {
    let mut scenario = setup_test();

    // Check Registry exists
    ts::next_tx(&mut scenario, ADMIN);
    {
      assert!(ts::has_most_recent_shared<Registry>(), 0);
      assert!(ts::has_most_recent_shared<AuditRegistry>(), 1);
    };

    // Check AdminCap transferred to admin
    ts::next_tx(&mut scenario, ADMIN);
    {
      assert!(ts::has_most_recent_for_address<AdminCap>(ADMIN), 2);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_mint_agent_nft() {
    let mut scenario = setup_test();

    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(
        &admin_cap,
        &mut registry,
        OWNER,
        AGENT,
        datas,
        ts::ctx(&mut scenario),
      );

      assert!(agent_nft::total_supply(&registry) == 1, 0);

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Check NFT transferred to owner
    ts::next_tx(&mut scenario, OWNER);
    {
      assert!(ts::has_most_recent_for_address<AgentNFT>(OWNER), 1);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_update_intelligence() {
    let mut scenario = setup_test();

    // Mint NFT first
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(
        &admin_cap,
        &mut registry,
        OWNER,
        AGENT,
        datas,
        ts::ctx(&mut scenario),
      );

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Update intelligence from agent
    ts::next_tx(&mut scenario, AGENT);
    {
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);
      let mut audit_registry = ts::take_shared<AuditRegistry>(&scenario);
      let clock = clock::create_for_testing(ts::ctx(&mut scenario));

      let mut new_datas = vector[];
      vector::push_back(&mut new_datas, agent_nft::new_intelligent_data(
        string::utf8(b"Updated Audit Report"),
        x"2222222222222222222222222222222222222222222222222222222222222222",
      ));

      agent_nft::update(
        &mut nft,
        &mut audit_registry,
        &clock,
        new_datas,
        ts::ctx(&mut scenario),
      );

      assert!(agent_nft::intelligence_count(&nft) == 1, 0);
      assert!(vector::length(&agent_nft::history(&nft)) == 1, 1);

      let leaves = agent_nft::get_audit_leaves(&audit_registry);
      assert!(vector::length(&leaves) == 1, 2);

      clock::destroy_for_testing(clock);
      ts::return_to_address(OWNER, nft);
      ts::return_shared(audit_registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_multiple_updates() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(
        &admin_cap,
        &mut registry,
        OWNER,
        AGENT,
        datas,
        ts::ctx(&mut scenario),
      );

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // First update
    ts::next_tx(&mut scenario, AGENT);
    {
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);
      let mut audit_registry = ts::take_shared<AuditRegistry>(&scenario);
      let clock = clock::create_for_testing(ts::ctx(&mut scenario));

      let mut new_datas = vector[];
      vector::push_back(&mut new_datas, agent_nft::new_intelligent_data(
        string::utf8(b"Update 1"),
        x"3333333333333333333333333333333333333333333333333333333333333333",
      ));

      agent_nft::update(&mut nft, &mut audit_registry, &clock, new_datas, ts::ctx(&mut scenario));

      clock::destroy_for_testing(clock);
      ts::return_to_address(OWNER, nft);
      ts::return_shared(audit_registry);
    };

    // Second update
    ts::next_tx(&mut scenario, AGENT);
    {
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);
      let mut audit_registry = ts::take_shared<AuditRegistry>(&scenario);
      let clock = clock::create_for_testing(ts::ctx(&mut scenario));

      let mut new_datas = vector[];
      vector::push_back(&mut new_datas, agent_nft::new_intelligent_data(
        string::utf8(b"Update 2"),
        x"4444444444444444444444444444444444444444444444444444444444444444",
      ));

      agent_nft::update(&mut nft, &mut audit_registry, &clock, new_datas, ts::ctx(&mut scenario));

      assert!(agent_nft::intelligence_count(&nft) == 2, 0);
      assert!(vector::length(&agent_nft::history(&nft)) == 2, 1);

      let leaves = agent_nft::get_audit_leaves(&audit_registry);
      assert!(vector::length(&leaves) == 2, 2);

      clock::destroy_for_testing(clock);
      ts::return_to_address(OWNER, nft);
      ts::return_shared(audit_registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_owner_can_update() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Owner updates (should work)
    ts::next_tx(&mut scenario, OWNER);
    {
      let mut nft = ts::take_from_sender<AgentNFT>(&scenario);
      let mut audit_registry = ts::take_shared<AuditRegistry>(&scenario);
      let clock = clock::create_for_testing(ts::ctx(&mut scenario));

      let mut new_datas = vector[];
      vector::push_back(&mut new_datas, agent_nft::new_intelligent_data(
        string::utf8(b"Owner Update"),
        x"5555555555555555555555555555555555555555555555555555555555555555",
      ));

      agent_nft::update(&mut nft, &mut audit_registry, &clock, new_datas, ts::ctx(&mut scenario));

      assert!(agent_nft::intelligence_count(&nft) == 1, 0);

      clock::destroy_for_testing(clock);
      ts::return_to_sender(&scenario, nft);
      ts::return_shared(audit_registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_set_agent_address() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Change agent address
    ts::next_tx(&mut scenario, OWNER);
    {
      let mut nft = ts::take_from_sender<AgentNFT>(&scenario);

      agent_nft::set_agent_address(&mut nft, NEW_AGENT, ts::ctx(&mut scenario));

      assert!(agent_nft::agent_address(&nft) == NEW_AGENT, 0);

      ts::return_to_sender(&scenario, nft);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_set_token_uri() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Set token URI
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);

      let uri = string::utf8(b"https://example.com/metadata/1");
      agent_nft::set_token_uri(&admin_cap, &mut nft, uri);

      assert!(agent_nft::token_uri(&nft) == uri, 0);

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_to_address(OWNER, nft);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_add_reputation() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Add reputation
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);

      assert!(agent_nft::reputation(&nft) == 0, 0);

      agent_nft::add_reputation(&admin_cap, &mut nft, 100);
      assert!(agent_nft::reputation(&nft) == 100, 1);

      agent_nft::add_reputation(&admin_cap, &mut nft, 50);
      assert!(agent_nft::reputation(&nft) == 150, 2);

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_to_address(OWNER, nft);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_merkle_root_changes() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // First update
    ts::next_tx(&mut scenario, AGENT);
    {
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);
      let mut audit_registry = ts::take_shared<AuditRegistry>(&scenario);
      let clock = clock::create_for_testing(ts::ctx(&mut scenario));

      let root_before = agent_nft::get_audit_merkle_root(&audit_registry);

      let mut new_datas = vector[];
      vector::push_back(&mut new_datas, agent_nft::new_intelligent_data(
        string::utf8(b"Update"),
        x"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ));

      agent_nft::update(&mut nft, &mut audit_registry, &clock, new_datas, ts::ctx(&mut scenario));

      let root_after = agent_nft::get_audit_merkle_root(&audit_registry);
      assert!(root_before != root_after, 0);

      clock::destroy_for_testing(clock);
      ts::return_to_address(OWNER, nft);
      ts::return_shared(audit_registry);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = agent_nft::E_NOT_AUTHORIZED)]
  fun test_unauthorized_update_fails() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Try to update from unauthorized address (should fail)
    ts::next_tx(&mut scenario, @0xBAD);
    {
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);
      let mut audit_registry = ts::take_shared<AuditRegistry>(&scenario);
      let clock = clock::create_for_testing(ts::ctx(&mut scenario));

      let mut new_datas = vector[];
      vector::push_back(&mut new_datas, agent_nft::new_intelligent_data(
        string::utf8(b"Unauthorized"),
        x"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ));

      agent_nft::update(&mut nft, &mut audit_registry, &clock, new_datas, ts::ctx(&mut scenario));

      clock::destroy_for_testing(clock);
      ts::return_to_address(OWNER, nft);
      ts::return_shared(audit_registry);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = agent_nft::E_EMPTY_DATA)]
  fun test_mint_empty_data_fails() {
    let mut scenario = setup_test();

    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);

      let empty_datas = vector[];

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, empty_datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = agent_nft::E_NOT_AUTHORIZED)]
  fun test_non_owner_cannot_change_agent() {
    let mut scenario = setup_test();

    // Mint NFT
    ts::next_tx(&mut scenario, ADMIN);
    {
      let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
      let mut registry = ts::take_shared<Registry>(&scenario);
      let datas = create_sample_data();

      agent_nft::mint(&admin_cap, &mut registry, OWNER, AGENT, datas, ts::ctx(&mut scenario));

      ts::return_to_sender(&scenario, admin_cap);
      ts::return_shared(registry);
    };

    // Try to change agent address from non-owner (should fail)
    ts::next_tx(&mut scenario, @0xBAD2);
    {
      let mut nft = ts::take_from_address<AgentNFT>(&scenario, OWNER);

      agent_nft::set_agent_address(&mut nft, NEW_AGENT, ts::ctx(&mut scenario));

      ts::return_to_address(OWNER, nft);
    };

    ts::end(scenario);
  }
}
