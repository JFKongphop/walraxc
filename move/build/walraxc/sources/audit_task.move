/// @title RaxcAuditTask8183
/// @notice ERC-8183 autonomous audit task lifecycle for RAXCLAW
/// @dev Minimal implementation: createAuditTask + finalizeAuditTask + verifyTask
module walraxc::audit_task {
  use std::string::{Self, String};
  use sui::{event, table::{Self, Table}};

  // Error codes
  const E_TASK_NOT_FOUND: u64 = 1;
  const E_TASK_ALREADY_FINALIZED: u64 = 2;

  // Task states
  const STATE_CREATED: u8 = 0;
  const STATE_COMPLETED: u8 = 1;

  /// Shared registry holding all audit tasks
  public struct TaskRegistry has key {
    id: UID,
    tasks: Table<u64, AuditTask>,
    task_count: u64,
  }

  /// Audit task data structure
  public struct AuditTask has store {
    requester: address,
    contract_name: String,
    state: u8,
    verdict: String,
    confidence: u64,
    root_hash: vector<u8>,
    replay_id: String,
    trace_hash: vector<u8>,
    created_at: u64,
    completed_at: u64,
  }

  // Events
  public struct AuditTaskCreated has copy, drop {
    task_id: u64,
    requester: address,
    contract_name: String,
    timestamp: u64,
  }

  public struct AuditTaskCompleted has copy, drop {
    task_id: u64,
    verdict: String,
    root_hash: vector<u8>,
    replay_id: String,
    timestamp: u64,
  }

  /// Module initializer
  fun init(ctx: &mut TxContext) {
    let registry = TaskRegistry {
      id: object::new(ctx),
      tasks: table::new(ctx),
      task_count: 0,
    };
    transfer::share_object(registry);
  }

  /// Submit a new audit task on-chain
  public fun create_audit_task(
    registry: &mut TaskRegistry,
    contract_name: String,
    timestamp: u64,
    ctx: &mut TxContext,
  ): u64 {
    let task_id = registry.task_count;
    registry.task_count = registry.task_count + 1;

    let task = AuditTask {
      requester: tx_context::sender(ctx),
      contract_name,
      state: STATE_CREATED,
      verdict: string::utf8(b""),
      confidence: 0,
      root_hash: vector[],
      replay_id: string::utf8(b""),
      trace_hash: vector[],
      created_at: timestamp,
      completed_at: 0,
    };

    event::emit(AuditTaskCreated {
      task_id,
      requester: tx_context::sender(ctx),
      contract_name: task.contract_name,
      timestamp,
    });

    table::add(&mut registry.tasks, task_id, task);
    task_id
  }

  /// Finalize an audit task with cryptographic proof
  public fun finalize_audit_task(
    registry: &mut TaskRegistry,
    task_id: u64,
    verdict: String,
    confidence: u64,
    root_hash: vector<u8>,
    replay_id: String,
    trace_hash: vector<u8>,
    timestamp: u64,
  ) {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow_mut(&mut registry.tasks, task_id);
    assert!(task.state == STATE_CREATED, E_TASK_ALREADY_FINALIZED);

    task.state = STATE_COMPLETED;
    task.verdict = verdict;
    task.confidence = confidence;
    task.root_hash = root_hash;
    task.replay_id = replay_id;
    task.trace_hash = trace_hash;
    task.completed_at = timestamp;

    event::emit(AuditTaskCompleted {
      task_id,
      verdict: task.verdict,
      root_hash: task.root_hash,
      replay_id: task.replay_id,
      timestamp,
    });
  }

  /// Verify that an audit task has valid proof attached
  public fun verify_task(registry: &TaskRegistry, task_id: u64): bool {
    if (!table::contains(&registry.tasks, task_id)) {
      return false
    };
    let task = table::borrow(&registry.tasks, task_id);
    task.state == STATE_COMPLETED && !vector::is_empty(&task.root_hash)
  }

  /// Get task count
  public fun get_task_count(registry: &TaskRegistry): u64 {
    registry.task_count
  }

  /// Get task requester
  public fun get_task_requester(registry: &TaskRegistry, task_id: u64): address {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.requester
  }

  /// Get task contract name
  public fun get_task_contract_name(registry: &TaskRegistry, task_id: u64): String {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.contract_name
  }

  /// Get task state
  public fun get_task_state(registry: &TaskRegistry, task_id: u64): u8 {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.state
  }

  /// Get task verdict
  public fun get_task_verdict(registry: &TaskRegistry, task_id: u64): String {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.verdict
  }

  /// Get task confidence
  public fun get_task_confidence(registry: &TaskRegistry, task_id: u64): u64 {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.confidence
  }

  /// Get task root hash
  public fun get_task_root_hash(registry: &TaskRegistry, task_id: u64): vector<u8> {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.root_hash
  }

  /// Get task replay ID
  public fun get_task_replay_id(registry: &TaskRegistry, task_id: u64): String {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.replay_id
  }

  /// Get task trace hash
  public fun get_task_trace_hash(registry: &TaskRegistry, task_id: u64): vector<u8> {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.trace_hash
  }

  /// Get task created timestamp
  public fun get_task_created_at(registry: &TaskRegistry, task_id: u64): u64 {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.created_at
  }

  /// Get task completed timestamp
  public fun get_task_completed_at(registry: &TaskRegistry, task_id: u64): u64 {
    assert!(table::contains(&registry.tasks, task_id), E_TASK_NOT_FOUND);
    let task = table::borrow(&registry.tasks, task_id);
    task.completed_at
  }

  //
  // Test-only functions
  //
  #[test_only]
  public fun test_init(ctx: &mut TxContext) {
    init(ctx);
  }
}
