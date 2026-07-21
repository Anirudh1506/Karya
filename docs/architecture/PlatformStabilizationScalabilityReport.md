# Platform Stabilization Phase 01 — Scalability Report

## Validated practical envelope

| Entity                 |                   Validated volume | Assessment                                                           |
| ---------------------- | ---------------------------------: | -------------------------------------------------------------------- |
| Profiles               |       24 represented in scale data | Well within practical local use                                      |
| Workspaces             |      250 represented in scale data | Well within practical local use                                      |
| Resources              |                             10,000 | Responsive; Core search under 5 ms and SQLite filtering around 23 ms |
| Search documents       |                             10,000 | Index build under 100 ms; query under 5 ms                           |
| Continue Working items |       10,000 in one active context | Deterministic ranking under 34 ms                                    |
| Activities             |                             50,000 | Indexed limited query around 0.25 ms                                 |
| Notifications          |                             10,000 | Indexed unread count around 0.06 ms                                  |
| SyncOperations         | 50,000 persisted / 20,000 replayed | 25k queue restoration around 27 ms; 20k replay under 43 ms           |
| Editing revisions      |               5,000 in one session | Final content preserved; checkpoint count bounded                    |

## Estimated limits

These are conservative product-operating recommendations, not hard database limits:

- Resources: target up to 25,000 per device with the current metadata query model. Re-measure before supporting 50,000+ because some query repositories deserialize full result sets.
- Workspaces: target up to 1,000; UI navigation usability is likely to constrain users before persistence does.
- Profiles: target up to 100; profile statistics currently derive across Resource and Workspace collections.
- Activities: 250,000 is reasonable with the existing compound indexes and limited queries; validate database growth and retention beyond that point.
- Notifications: 100,000 is reasonable for indexed counts and recent queries, but a user-facing archival/retention policy should precede that volume.
- SyncOperations: process in transport batches of 1,000–5,000 even though 50,000 persisted operations restore quickly. Avoid materializing an unbounded remote queue.

## Growth characteristics

- Resource and Continue Working derivation is approximately linear, with sorting adding `n log n` behavior.
- Search indexing memory grows with unique tokens and document count. Contains matching currently examines indexed terms, so query time scales with vocabulary size.
- Activity and Notification SQLite queries remain index-bound when filters and limits are supplied.
- Sync replay is linear in operation count with constant-time receipt lookup for the tested repositories.
- Acknowledged operations, receipts, Activities, and Notifications are durable by design and therefore require explicit future retention policies rather than implicit deletion.

## Assumptions

- Resource content is not indexed or included in these metadata-scale figures.
- Data is local and single-writer during these tests.
- Payload sizes are representative metadata payloads, not large attachments.
- Cloud latency, encryption, authentication, and remote conflict traffic are excluded.
- Mobile SQLite performance should be re-measured on the oldest supported physical iOS and Android devices.
