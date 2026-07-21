# Karya Mobile Implementation Partner

**Version 1.0**  
**Status:** Engineering and implementation foundation  
**Scope:** Karya Mobile, with continuity obligations to Desktop, Cloud, SDK, and Karya OS

## Purpose

This document defines how Karya Mobile features are understood, designed, implemented, tested, reviewed, and documented.

Karya is a workspace-centric computing platform built around Resources, Profiles, Workspaces, Context Resolution, Continuity, and cross-device workflows. It is not a conventional productivity application and must not be implemented as a collection of disconnected screens.

The existing product specifications are the source of truth. Implementation translates those specifications into reliable software. It does not silently redesign, simplify, or replace them with familiar mobile application patterns.

## 1. Implementation mandate

Every implementation must:

- Begin with the resource and the work it represents.
- Preserve the active Profile and Workspace boundary.
- Remain usable without permanent connectivity.
- Separate local safety from cloud synchronization.
- Continue coherently across Mobile, Desktop, and future Karya OS surfaces.
- Follow the Karya Design Language for presentation.
- Follow Karya Interaction Patterns for behavior.
- Reuse existing domain and service capabilities instead of reproducing them in UI code.
- Scale beyond demonstration-sized datasets.
- Make missing product behavior explicit before encoding an assumption.

The implementation is successful only when it preserves Karya's product model and produces understandable, testable, and evolvable system behavior.

## 2. Source-of-truth hierarchy

Before implementing a feature, review the documents that define its purpose, behavior, and constraints.

### Product sources

The complete product foundation may include:

- Product Vision
- Interaction Foundation
- Resource Lifecycle
- Context Resolution
- Continuity Framework
- Navigation Architecture
- Resource Experience
- Capture Experience
- Notification Experience
- Synchronization Architecture
- Device Management
- Identity and Authentication
- Platform Architecture
- Mobile Design Language
- Behavioral Foundation / Interaction Patterns
- Mobile UX Blueprint

### Repository sources

- [Architecture](Architecture.md) defines current service ownership and system boundaries.
- [Karya Mobile Design Language](KaryaMobileDesignLanguage.md) defines visual and interaction foundations for Mobile.
- [Karya Interaction Patterns](KaryaInteractionPatterns.md) defines platform-wide behavior.
- [Roadmap](Roadmap.md) identifies intended evolution and known sequencing.
- [Known Limitations](KnownLimitations.md) identifies behavior that is intentionally incomplete.
- [User Guide](UserGuide.md) describes behavior currently exposed to people.
- [Changelog](Changelog.md) records delivered behavior and compatibility expectations.

### Resolving conflict

Use the following precedence:

1. Explicit product behavior and safety requirements.
2. Resource, identity, permission, and data-integrity contracts.
3. Interaction and continuity foundations.
4. Platform architecture and service ownership.
5. Design language and UX blueprint.
6. Existing implementation behavior.

An existing implementation is evidence, not automatically the specification. When two authoritative documents conflict, do not choose silently. Record the conflict, its user and technical consequences, and the proposed resolution before implementation proceeds.

## 3. Feature lifecycle

Every feature follows the same lifecycle:

1. **Understand** — define the work, user need, and desired outcome.
2. **Review existing architecture** — locate applicable specifications, domain concepts, and current behavior.
3. **Identify dependencies** — find services, events, storage, synchronization, navigation, and context capabilities to reuse.
4. **Design the UX** — describe the complete journey, including interruption and recovery.
5. **Design the technical architecture** — assign ownership to components, state, services, storage, and events.
6. **Implement** — build the smallest complete vertical slice.
7. **Test** — verify domain behavior, state transitions, failure modes, performance, accessibility, and continuity.
8. **Review** — compare the result with the source specifications and architectural boundaries.
9. **Document discoveries** — record new principles, decisions, limitations, and follow-up work.

No feature skips directly from a title or mockup to coding.

## 4. Mandatory pre-implementation brief

Before code changes begin, every feature must have a written brief containing the following sections.

### 4.1 Goal

State:

- The work-related problem being solved.
- Who encounters it and in which context.
- The observable outcome when it is solved.
- What is explicitly outside the feature's scope.

The goal describes a product capability, not a screen or implementation task.

**Good:** “Allow a person to capture a thought immediately, keep it safe offline, and organize it later.”  
**Insufficient:** “Build the capture screen.”

### 4.2 Existing architecture

Identify:

- Applicable product specifications.
- Existing domain entities and invariants.
- Current services and repositories that own relevant behavior.
- Existing commands, queries, and events.
- Existing UI behavior that must remain compatible.
- Known limitations or architectural debt affecting the work.

### 4.3 Dependencies

Review whether the feature depends on:

- Resource Lifecycle
- Profile and Workspace ownership
- Context Resolution
- Navigation and navigation restoration
- Search and indexing
- Capture and import
- Continuity and Continue Working
- Local persistence
- Synchronization
- Authentication and authorization
- Notifications
- Device capabilities
- Relationships between resources
- Telemetry, diagnostics, or migration behavior

For each dependency, name the owner and the contract being reused. Do not duplicate rules merely to make a local UI convenient.

### 4.4 UX flow

Describe the complete journey from entry to completion:

- Entry points.
- Initial state and resolved context.
- Primary path.
- Intermediate decisions.
- Feedback after each consequential action.
- Cancellation and Back behavior.
- Interruption and restoration.
- Empty, loading, offline, error, and conflict states.
- Completion and the next useful action.
- Continuation on another device.

The flow must explain what is preserved at every transition.

### 4.5 Technical architecture

Define:

- UI composition and component responsibilities.
- Domain operation or use case.
- State ownership and lifetime.
- Commands and queries.
- Events emitted and consumed.
- Services and repositories involved.
- Local storage and transaction boundaries.
- Synchronization intent and status transitions.
- Navigation state and restoration data.
- Background work.
- Permission and authorization checks.
- Observability and failure diagnostics.

The architecture must make it possible to test business behavior without rendering the UI.

### 4.6 Edge cases

At minimum, consider:

- No network at entry, during action, and during completion.
- Saved locally but pending synchronization.
- Synchronization retry and permanent failure.
- Concurrent edits and conflicts.
- Resource moved, archived, or deleted.
- Permission revoked before or during an action.
- Profile switch.
- Workspace switch.
- Authentication expiry.
- Device restart or process termination.
- Duplicate action or repeated delivery.
- Partial completion.
- Very large resource sets.
- Accessibility and alternate input.
- Insufficient device storage or unavailable capability.

Each applicable edge case needs expected behavior, ownership, and a recovery path.

## 5. Resource-first architecture

Karya implementations begin with Resources, not screens.

Applications and device capabilities may create or edit Resources. Karya owns their lifecycle, identity, context, relationships, storage, synchronization, and continuation. UI surfaces present operations on Resources; they do not become the authoritative owner of resource behavior.

### Resource requirements

Every resource operation must define:

- Stable identity, including before first synchronization.
- Resource type and version.
- Owning Profile and Workspace.
- Lifecycle state.
- Local persistence state.
- Synchronization state.
- Permission state.
- Relationships to other resources.
- Activity required for continuity and search ranking.
- Conflict and recovery behavior.

### Resource lifecycle

Implementations must make lifecycle transitions explicit. Creation, update, archive, deletion, restoration, migration, and conflict resolution are domain operations, not incidental UI mutations.

- Creation must be locally durable before it is represented as safe.
- Updates must preserve ordering and version information needed for synchronization.
- Deletion should remain recoverable according to product policy.
- Restoration must recover meaningful relationships and context when possible.
- Imports and captures must preserve their original material when enrichment fails.

## 6. State ownership

State is separated by meaning and lifecycle. Different categories may be observed together, but they must not be collapsed into one global mutable store.

| State category        | Owns                                                  | Typical lifetime              | Authoritative owner               |
| --------------------- | ----------------------------------------------------- | ----------------------------- | --------------------------------- |
| UI state              | Focus, expansion, transient input presentation        | View or interaction           | UI component / presentation model |
| Navigation state      | Path, history, destination, restoration position      | Work session                  | Navigation service                |
| Context state         | Active Profile, Workspace, resolved work context      | Session and explicit switches | Context service                   |
| Resource state        | Content, metadata, relationships, lifecycle           | Persistent                    | Domain and repositories           |
| Synchronization state | Local save, pending, syncing, synced, conflict        | Persistent and asynchronous   | Synchronization service           |
| Authentication state  | Identity, credentials, session validity               | Security session              | Identity service                  |
| Application state     | Lifecycle, foreground/background, device availability | Process/device session        | Application/platform services     |

### Ownership rules

- The UI may request a state transition; it does not declare that a domain transition succeeded.
- Persistent state does not live only in a component or navigation parameter.
- Derived state should be computed from authoritative sources rather than duplicated.
- Events communicate completed facts. Commands request intent.
- A service exposes behavior through a stable contract and hides persistence details.
- Profile and Workspace identity accompany every resource query and mutation where scope matters.

## 7. Component and service design

### Components

Components should be small, composable, and responsible for presentation and direct interaction only.

A component may:

- Render state supplied through a stable interface.
- Hold brief, nonauthoritative presentation state.
- Collect input.
- Dispatch a command or invoke a use case.
- Announce state changes accessibly.

A component must not:

- Encode Resource Lifecycle rules.
- Write directly to synchronization storage.
- Infer Profile or Workspace from unrelated global state.
- Duplicate a service-owned cache.
- Treat a network response as the only source of truth.
- Decide conflict resolution or permission policy.

### Services

Services own reusable capabilities with clear inputs, outputs, and failure semantics. Prefer extending an existing owner to creating a parallel abstraction.

Service contracts should:

- Express domain intent rather than UI events.
- Accept explicit context where ambiguity is unsafe.
- Return stable domain results and typed failures.
- Remain usable by Mobile, Desktop, SDK, or future Karya OS surfaces where the capability is shared.
- Support asynchronous and offline operation where applicable.
- Avoid exposing database or transport implementation details.

## 8. Local-first data contract

SQLite is the primary working database. The cloud is a synchronization layer.

This establishes the following contract:

1. A valid local action does not wait for network availability.
2. User-authored input becomes locally durable as early as possible.
3. Local identity exists before server acknowledgement.
4. Queries render local data first.
5. Remote changes enrich or reconcile local state without resetting active work.
6. Synchronization is asynchronous, retryable, and observable.
7. Offline behavior is a normal state of the same feature, not a separate reduced product.

### Storage expectations

- Use indexed, paginated queries for unbounded collections.
- Avoid loading entire Workspaces, Resource graphs, or histories into memory.
- Keep transactions small, explicit, and atomic around domain invariants.
- Record enough version and operation metadata for synchronization and conflict recovery.
- Migrations must preserve user data and support interruption-safe recovery.
- Background indexing or enrichment must not block the primary write.
- Sensitive data must respect Profile, Workspace, and device security boundaries at rest.

## 9. Synchronization contract

Every synchronized feature defines behavior for:

- **Saved locally** — the person's latest work is durable on this device.
- **Pending sync** — local work is safe and queued for other locations.
- **Syncing** — transfer or reconciliation is active.
- **Synced** — the relevant remote authority acknowledged the version.
- **Conflict** — independent versions require deterministic merge or human resolution.
- **Offline** — local work continues and synchronization waits.

### Required behavior

- Never block valid local work while synchronization runs.
- Never equate a network request with a successful synchronization.
- Make operations idempotent where redelivery is possible.
- Preserve newer local work when older remote state arrives.
- Retry transient failures without creating duplicate resources or activity.
- Preserve every authored version when automatic reconciliation is unsafe.
- Keep sync status available to the UI without embedding sync logic in it.
- Record failures so they remain recoverable after relaunch.

## 10. Context contract

Every feature must answer:

1. What is the active Profile?
2. What is the active Workspace?
3. What explicit context accompanied the action?
4. What may Context Resolution infer?
5. What happens if context changes before completion?

Explicit user choice has priority over inference. Resource ownership has priority over ambient convenience. When ambiguity affects visibility, sharing, storage, or permissions, require a visible resolution before committing.

### Switching behavior

- Switching Profile changes identity, access, history, and context as one boundary.
- Switching Workspace suspends the previous Workspace state and restores the selected Workspace state.
- Drafts and pending operations remain attached to the Profile and Workspace that created them.
- Background work may continue only under the authority and isolation of its originating context.
- A delayed result must not appear in a newly active context as though it belongs there.

## 11. Navigation and restoration contract

Navigation represents a path through work.

- Resource identity, not component identity, anchors a destination.
- Back restores the previous meaningful state, including query, selection, and position when still valid.
- Deep links retain intent through authentication and context resolution.
- Navigation state is serializable enough to restore after interruption.
- Temporary overlays dismiss before the underlying path is abandoned.
- Navigation does not become the source of truth for resource content.
- If a target disappears or permission changes, return to the closest valid context and explain what changed.

## 12. Continuity contract

Every feature must define how work continues:

- On Mobile after starting on Desktop.
- On Desktop after capture or edit on Mobile.
- Across process termination and device restart.
- While synchronization is pending.
- When another device edits the same Resource.
- In future Karya OS surfaces with different capabilities.

Continuity state should capture meaningful intent: resource, position, active context, unfinished operation, and relevant supporting work. It should not preserve transient controls, expired messages, or platform-specific presentation details.

A receiving device may adapt presentation, but it must preserve Resource identity, ownership, authored content, and the route back to the wider context.

## 13. Performance and scale

Design for millions of Resources, thousands of Workspaces, hundreds of Profiles, and large local databases.

### Required practices

- Use pagination or cursor-based retrieval for unbounded data.
- Index common scope, lifecycle, recency, relationship, and search access paths.
- Keep ranking and filtering close to indexed storage or dedicated query services.
- Avoid repeated full-graph traversal during rendering.
- Subscribe to targeted changes instead of globally rerendering on every event.
- Load primary Resource content before secondary metadata and relationships.
- Cancel or ignore stale asynchronous work when its context is no longer current.
- Bound caches by purpose and lifetime.
- Move expensive indexing, enrichment, and media processing out of the interaction-critical path.
- Measure startup, first useful content, query latency, write durability, and restoration time.

Performance work must not weaken data safety or make state transitions less truthful.

## 14. UX implementation requirements

### Loading

- Render reliable local or cached content first.
- Use progressive loading for supporting metadata.
- Avoid blocking spinners when a stable partial state is available.
- Prevent background refresh from moving the active reading or editing target.

### Feedback

- Acknowledge intent immediately.
- Show routine success through the resulting state.
- Distinguish local save from synchronization.
- Explain failures specifically and preserve input.
- Use Undo for reversible actions instead of repeated confirmation.

### Accessibility

- Expose meaningful names, roles, state, and traversal order.
- Support text scaling and reflow.
- Keep primary behavior operable through touch, keyboard, assistive technology, and non-gesture alternatives.
- Announce asynchronous completion and failure without stealing focus unnecessarily.
- Never communicate status through color, motion, sound, or haptics alone.

### Platform differences

Use native platform conventions where they do not change the Karya behavioral contract. Platform adapters may differ in presentation, input, or lifecycle integration. Domain, synchronization, Resource, Context, and Continuity behavior must remain shared.

Platform-specific exceptions require a documented capability constraint and must not leak into shared domain ownership.

## 15. Error, conflict, and recovery design

Failure is part of the feature architecture.

Each failure defines:

- What operation failed.
- Whether the person's work is safe.
- The authoritative state after failure.
- Whether retry is automatic, manual, or inappropriate.
- What recovery action is available.
- Whether the failure persists across relaunch.
- How it affects synchronization and continuity.
- What diagnostic information is recorded.

### Conflict handling

- Use deterministic automatic reconciliation only where no authored intent can be lost.
- Preserve both versions when intent is ambiguous.
- Keep conflict resolution attached to the Resource and available after navigation or relaunch.
- Do not block unrelated work because one Resource is conflicted.
- A resolved conflict creates an explicit new version and remains auditable.

## 16. Testing strategy

Testing follows system boundaries rather than relying only on rendered screens.

### Domain tests

Verify Resource invariants, lifecycle transitions, ownership, permission rules, conflict handling, and deterministic behavior.

### Service tests

Verify command outcomes, queries, events, repository contracts, idempotency, retry behavior, and context isolation.

### Persistence tests

Verify transactions, migrations, interruption recovery, indexing, pagination, and large-dataset behavior.

### Synchronization tests

Verify saved-local, pending, syncing, synced, conflict, retry, duplicate delivery, ordering, offline, and reconnection behavior.

### UI tests

Verify journey-level behavior, state rendering, navigation, restoration, input preservation, accessibility, and feedback. UI tests should observe domain results rather than substitute for domain tests.

### Continuity tests

Verify interruption, relaunch, Profile and Workspace switches, cross-device resume data, concurrent edits, and receiving-device adaptation.

### Minimum feature matrix

Every applicable feature is tested in these conditions:

| Condition         | Expected proof                                                  |
| ----------------- | --------------------------------------------------------------- |
| Online            | Complete primary journey                                        |
| Offline           | Locally valid work remains available                            |
| Reconnection      | Pending work synchronizes without duplication                   |
| Relaunch          | Durable work and meaningful state restore                       |
| Profile switch    | No cross-profile leakage                                        |
| Workspace switch  | Correct suspension and restoration                              |
| Permission change | Safe failure and recovery                                       |
| Concurrent edit   | Deterministic merge or preserved conflict                       |
| Large dataset     | Bounded retrieval and responsive interaction                    |
| Accessibility     | Complete journey without visual-only or gesture-only dependency |

## 17. Review gates

A feature is not complete until it passes all applicable gates.

### Product fidelity

- The outcome matches the relevant product specifications.
- No Karya concept was silently replaced by a generic application convention.
- The feature begins with Resources and work rather than screens.

### Architecture

- State ownership is explicit and separated.
- Existing services are reused where appropriate.
- Business rules are outside UI components.
- No duplicated authoritative state or global mutable shortcut was introduced.

### Local-first and synchronization

- Valid local work does not require connectivity.
- Local save and sync are distinct.
- Retry, conflict, duplicate delivery, and offline behavior are defined.

### Context and continuity

- Profile and Workspace boundaries are enforced.
- Context changes are safe.
- Navigation and meaningful state restore.
- Cross-device continuation is defined.

### Quality

- Edge cases have tests or a documented reason they do not apply.
- Performance scales beyond demonstration data.
- Accessibility is verified.
- Failures preserve work and provide recovery.
- Documentation and known limitations are updated.

## 18. Documentation of discoveries

Implementation often exposes product behavior that specifications did not make explicit. Do not encode these discoveries silently.

Record:

- The missing or ambiguous rule.
- The scenario that revealed it.
- Why the decision matters to people and system integrity.
- Options considered and their trade-offs.
- The proposed behavioral rule.
- The affected specifications, services, and products.
- Whether the decision is temporary, local, or platform-wide.

Platform-wide decisions belong in the appropriate foundation document. Temporary constraints belong in Known Limitations. Delivered behavior belongs in the Changelog and, when user-facing, the User Guide.

## 19. Missing-specification protocol

When required behavior is missing:

1. Stop before encoding a consequential assumption.
2. State exactly which behavior is undefined.
3. Explain the user, data, security, synchronization, or continuity consequence.
4. Identify the existing principles that constrain the answer.
5. Propose one recommended addition and meaningful alternatives.
6. Record the decision in the correct source-of-truth document.
7. Continue only when the architecture remains internally consistent.

Routine implementation details that do not alter product behavior may use informed engineering judgment. Decisions affecting ownership, visibility, lifecycle, conflict resolution, irreversible actions, or cross-device meaning require explicit resolution.

## 20. Reusable feature brief

Copy this template before beginning a Karya Mobile feature.

```markdown
# Feature: [Capability name]

## 1. Goal

- Problem:
- User and context:
- Successful outcome:
- Out of scope:

## 2. Existing architecture

- Applicable specifications:
- Domain concepts and invariants:
- Existing services, commands, queries, and events:
- Current behavior:
- Known limitations:

## 3. Dependencies

| Capability | Existing owner | Contract reused | Change required |
| ---------- | -------------- | --------------- | --------------- |

## 4. UX flow

- Entry points:
- Primary journey:
- Back and cancellation:
- Loading and empty states:
- Offline journey:
- Failure and recovery:
- Interruption and restoration:
- Cross-device continuation:

## 5. Technical architecture

- Components:
- UI state:
- Navigation state:
- Context state:
- Resource state:
- Synchronization state:
- Authentication state:
- Commands and queries:
- Events:
- Services and repositories:
- SQLite storage and transactions:
- Synchronization:
- Background work:
- Observability:

## 6. Edge cases

| Scenario | Expected behavior | Owner | Verification |
| -------- | ----------------- | ----- | ------------ |

## 7. Implementation slices

1.
2.
3.

## 8. Test plan

- Domain:
- Services:
- Persistence:
- Synchronization:
- UI and accessibility:
- Continuity:
- Performance:

## 9. Review

- Specification conformance:
- Architectural review:
- UX and accessibility review:
- Remaining risks:

## 10. Documentation discoveries

- New or clarified principle:
- Source document updated:
- Known limitation or follow-up:
```

## 21. Definition of done

A Karya Mobile feature is done when:

- Its goal is satisfied as a Resource-centered capability.
- Applicable specifications have been followed or explicitly amended.
- State ownership and service responsibilities are clear.
- The primary journey works online and offline where locally valid.
- Input becomes locally safe and sync state remains truthful.
- Profile and Workspace changes cannot leak or misattribute work.
- Navigation, interruption, and meaningful state restore correctly.
- Conflict, permission change, deletion, and failure have recovery behavior.
- Queries and storage are appropriate for Karya's intended scale.
- The behavior remains coherent across Desktop, Mobile, and future Karya OS.
- Automated tests cover the domain contract and critical journeys.
- Accessibility is verified.
- Newly discovered rules and known limitations are documented.

The implementation partner's role is not merely to make a feature function. It is to ensure each feature becomes a durable part of one continuous workspace without weakening the principles that make Karya distinct.
