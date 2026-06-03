#[test_only]
module walraxc::audit_task_test {
  use std::string;
  use sui::test_scenario::{Self as ts};
  use walraxc::audit_task::{Self, TaskRegistry};

  const REQUESTER1: address = @0xA1;
  const REQUESTER2: address = @0xA2;
  const ANYONE: address = @0xA3;

  #[test]
  fun test_init() {
    let mut scenario = ts::begin(REQUESTER1);

    // Initialize module
    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    // Verify registry was created and shared
    ts::next_tx(&mut scenario, REQUESTER1);
    {
      assert!(ts::has_most_recent_shared<TaskRegistry>(), 1);
      let registry = ts::take_shared<TaskRegistry>(&scenario);
      assert!(audit_task::get_task_count(&registry) == 0, 2);
      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_create_audit_task() {
    let mut scenario = ts::begin(REQUESTER1);

    // Setup
    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    // Create first task
    ts::next_tx(&mut scenario, REQUESTER1);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      let task_id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"MyContract"),
        1000,
        ts::ctx(&mut scenario),
      );
      assert!(task_id == 0, 1);
      assert!(audit_task::get_task_count(&registry) == 1, 2);

      // Verify task details
      assert!(audit_task::get_task_requester(&registry, 0) == REQUESTER1, 3);
      assert!(audit_task::get_task_contract_name(&registry, 0) == string::utf8(b"MyContract"), 4);
      assert!(audit_task::get_task_state(&registry, 0) == 0, 5); // STATE_CREATED
      assert!(audit_task::get_task_created_at(&registry, 0) == 1000, 6);
      assert!(audit_task::get_task_completed_at(&registry, 0) == 0, 7);

      ts::return_shared(registry);
    };

    // Create second task from different requester
    ts::next_tx(&mut scenario, REQUESTER2);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      let task_id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"AnotherContract"),
        2000,
        ts::ctx(&mut scenario),
      );
      assert!(task_id == 1, 8);
      assert!(audit_task::get_task_count(&registry) == 2, 9);
      assert!(audit_task::get_task_requester(&registry, 1) == REQUESTER2, 10);

      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_finalize_audit_task() {
    let mut scenario = ts::begin(REQUESTER1);

    // Setup and create task
    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, REQUESTER1);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      let _task_id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"MyContract"),
        1000,
        ts::ctx(&mut scenario),
      );
      ts::return_shared(registry);
    };

    // Finalize task
    ts::next_tx(&mut scenario, ANYONE);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      let root_hash = x"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      let trace_hash = x"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

      audit_task::finalize_audit_task(
        &mut registry,
        0,
        string::utf8(b"HIGH_RISK"),
        7750, // 77.50%
        root_hash,
        string::utf8(b"replay-001"),
        trace_hash,
        2000,
      );

      // Verify finalized state
      assert!(audit_task::get_task_state(&registry, 0) == 1, 1); // STATE_COMPLETED
      assert!(audit_task::get_task_verdict(&registry, 0) == string::utf8(b"HIGH_RISK"), 2);
      assert!(audit_task::get_task_confidence(&registry, 0) == 7750, 3);
      assert!(audit_task::get_task_root_hash(&registry, 0) == root_hash, 4);
      assert!(audit_task::get_task_replay_id(&registry, 0) == string::utf8(b"replay-001"), 5);
      assert!(audit_task::get_task_trace_hash(&registry, 0) == trace_hash, 6);
      assert!(audit_task::get_task_completed_at(&registry, 0) == 2000, 7);

      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_verify_task() {
    let mut scenario = ts::begin(REQUESTER1);

    // Setup
    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    // Create task
    ts::next_tx(&mut scenario, REQUESTER1);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      let _task_id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"MyContract"),
        1000,
        ts::ctx(&mut scenario),
      );

      // Task not verified yet (not completed)
      assert!(!audit_task::verify_task(&registry, 0), 1);

      ts::return_shared(registry);
    };

    // Finalize task
    ts::next_tx(&mut scenario, ANYONE);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      audit_task::finalize_audit_task(
        &mut registry,
        0,
        string::utf8(b"MEDIUM_RISK"),
        8500,
        x"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        string::utf8(b"replay-002"),
        x"DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
        2000,
      );

      // Task now verified (completed with root_hash)
      assert!(audit_task::verify_task(&registry, 0), 2);

      ts::return_shared(registry);
    };

    // Verify non-existent task returns false
    ts::next_tx(&mut scenario, ANYONE);
    {
      let registry = ts::take_shared<TaskRegistry>(&scenario);
      assert!(!audit_task::verify_task(&registry, 999), 3);
      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_multiple_tasks() {
    let mut scenario = ts::begin(REQUESTER1);

    // Setup
    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    // Create 5 tasks
    ts::next_tx(&mut scenario, REQUESTER1);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      let mut i = 0;
      while (i < 5) {
        let task_id = audit_task::create_audit_task(
          &mut registry,
          string::utf8(b"Contract"),
          1000 + i,
          ts::ctx(&mut scenario),
        );
        assert!(task_id == i, i);
        i = i + 1;
      };
      assert!(audit_task::get_task_count(&registry) == 5, 100);
      ts::return_shared(registry);
    };

    // Finalize some tasks
    ts::next_tx(&mut scenario, ANYONE);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);

      // Finalize task 1
      audit_task::finalize_audit_task(
        &mut registry,
        1,
        string::utf8(b"LOW_RISK"),
        9200,
        x"1111111111111111111111111111111111111111111111111111111111111111",
        string::utf8(b"replay-1"),
        x"2222222222222222222222222222222222222222222222222222222222222222",
        3000,
      );

      // Finalize task 3
      audit_task::finalize_audit_task(
        &mut registry,
        3,
        string::utf8(b"HIGH_RISK"),
        6500,
        x"3333333333333333333333333333333333333333333333333333333333333333",
        string::utf8(b"replay-3"),
        x"4444444444444444444444444444444444444444444444444444444444444444",
        4000,
      );

      // Verify states
      assert!(audit_task::get_task_state(&registry, 0) == 0, 200); // Created
      assert!(audit_task::get_task_state(&registry, 1) == 1, 201); // Completed
      assert!(audit_task::get_task_state(&registry, 2) == 0, 202); // Created
      assert!(audit_task::get_task_state(&registry, 3) == 1, 203); // Completed
      assert!(audit_task::get_task_state(&registry, 4) == 0, 204); // Created

      // Verify verification
      assert!(!audit_task::verify_task(&registry, 0), 300);
      assert!(audit_task::verify_task(&registry, 1), 301);
      assert!(!audit_task::verify_task(&registry, 2), 302);
      assert!(audit_task::verify_task(&registry, 3), 303);
      assert!(!audit_task::verify_task(&registry, 4), 304);

      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = audit_task::E_TASK_NOT_FOUND)]
  fun test_finalize_nonexistent_task_fails() {
    let mut scenario = ts::begin(REQUESTER1);

    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, ANYONE);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);

      // Try to finalize non-existent task
      audit_task::finalize_audit_task(
        &mut registry,
        999,
        string::utf8(b"VERDICT"),
        5000,
        x"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        string::utf8(b"replay-999"),
        x"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        2000,
      );

      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = audit_task::E_TASK_ALREADY_FINALIZED)]
  fun test_finalize_twice_fails() {
    let mut scenario = ts::begin(REQUESTER1);

    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    // Create and finalize task
    ts::next_tx(&mut scenario, REQUESTER1);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      let _task_id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"MyContract"),
        1000,
        ts::ctx(&mut scenario),
      );
      ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, ANYONE);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      audit_task::finalize_audit_task(
        &mut registry,
        0,
        string::utf8(b"VERDICT1"),
        5000,
        x"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        string::utf8(b"replay-1"),
        x"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        2000,
      );
      ts::return_shared(registry);
    };

    // Try to finalize again (should fail)
    ts::next_tx(&mut scenario, ANYONE);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);
      audit_task::finalize_audit_task(
        &mut registry,
        0,
        string::utf8(b"VERDICT2"),
        6000,
        x"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        string::utf8(b"replay-2"),
        x"DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
        3000,
      );
      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = audit_task::E_TASK_NOT_FOUND)]
  fun test_get_nonexistent_task_fails() {
    let mut scenario = ts::begin(REQUESTER1);

    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, ANYONE);
    {
      let registry = ts::take_shared<TaskRegistry>(&scenario);
      let _state = audit_task::get_task_state(&registry, 999); // Should fail
      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun test_different_verdict_types() {
    let mut scenario = ts::begin(REQUESTER1);

    {
      audit_task::test_init(ts::ctx(&mut scenario));
    };

    // Create multiple tasks with different verdicts
    ts::next_tx(&mut scenario, REQUESTER1);
    {
      let mut registry = ts::take_shared<TaskRegistry>(&scenario);

      // Task 0: HIGH_RISK
      let _id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"Contract1"),
        1000,
        ts::ctx(&mut scenario),
      );
      audit_task::finalize_audit_task(
        &mut registry,
        0,
        string::utf8(b"HIGH_RISK"),
        7750,
        x"1111111111111111111111111111111111111111111111111111111111111111",
        string::utf8(b"replay-high"),
        x"2222222222222222222222222222222222222222222222222222222222222222",
        2000,
      );

      // Task 1: MEDIUM_RISK
      let _id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"Contract2"),
        1001,
        ts::ctx(&mut scenario),
      );
      audit_task::finalize_audit_task(
        &mut registry,
        1,
        string::utf8(b"MEDIUM_RISK"),
        8000,
        x"3333333333333333333333333333333333333333333333333333333333333333",
        string::utf8(b"replay-medium"),
        x"4444444444444444444444444444444444444444444444444444444444444444",
        2001,
      );

      // Task 2: LOW_RISK
      let _id = audit_task::create_audit_task(
        &mut registry,
        string::utf8(b"Contract3"),
        1002,
        ts::ctx(&mut scenario),
      );
      audit_task::finalize_audit_task(
        &mut registry,
        2,
        string::utf8(b"LOW_RISK"),
        9500,
        x"5555555555555555555555555555555555555555555555555555555555555555",
        string::utf8(b"replay-low"),
        x"6666666666666666666666666666666666666666666666666666666666666666",
        2002,
      );

      // Verify verdicts
      assert!(audit_task::get_task_verdict(&registry, 0) == string::utf8(b"HIGH_RISK"), 1);
      assert!(audit_task::get_task_verdict(&registry, 1) == string::utf8(b"MEDIUM_RISK"), 2);
      assert!(audit_task::get_task_verdict(&registry, 2) == string::utf8(b"LOW_RISK"), 3);

      // Verify confidences
      assert!(audit_task::get_task_confidence(&registry, 0) == 7750, 4);
      assert!(audit_task::get_task_confidence(&registry, 1) == 8000, 5);
      assert!(audit_task::get_task_confidence(&registry, 2) == 9500, 6);

      ts::return_shared(registry);
    };

    ts::end(scenario);
  }
}
