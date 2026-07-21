# Karya Interaction Patterns

**Version 1.0**  
**Status:** Behavioral foundation  
**Scope:** Desktop, Mobile, Tablet, Cloud, SDK, and Karya OS

## Purpose

This document defines how Karya behaves.

The Karya Design Language defines how Karya looks: its color, type, spacing, components, and visual composition. This companion defines interaction, continuity, navigation, capture, search, feedback, and recovery. It is the behavioral contract shared by every Karya product.

The platform may change. The contract must remain recognizable.

## Design philosophy

Karya is organized around work, not applications. A note, task, file, conversation, event, or emerging thought is a resource in a larger working context. People should be able to enter from any device, link, notification, or capture surface and continue without reconstructing that context.

Five principles govern Karya behavior:

1. **Continuity over destination.** Preserve the work, position, and intent behind every transition.
2. **Creation before organization.** Let people begin immediately; structure can emerge later.
3. **Assistance without surprise.** Suggest and anticipate, but keep consequential decisions visible and reversible.
4. **Local confidence, global continuity.** Work should feel safe immediately and become available everywhere without blocking progress.
5. **Recovery over blame.** When reality diverges from expectation, preserve work and offer a clear way forward.

Every interaction should help a person answer three questions without effort: **Where am I? What changed? What can I do next?**

## 1. Navigation behavior

Navigation changes the visible focus of work while preserving the path that gave it meaning.

### Forward navigation

- Opening a resource adds it to the current path when it is a deeper expression of the current work.
- A forward transition preserves the source's position, selection, filters, query, and expanded state.
- Repeatedly opening the same destination must not create duplicate history entries.
- When the source and destination belong side by side, Karya may reveal rather than replace. The behavioral outcome is the same: the source remains recoverable.

### Backward navigation

- Back returns to the previous meaningful state, not merely the previous rendered view.
- The previous state includes scroll position, selection, search query, filters, and transient expansion when they still make sense.
- Back dismisses temporary layers before leaving the underlying work.
- Back never silently discards input. If input cannot be retained, Karya explains the consequence before leaving.
- At the root of a work path, back returns to the originating context or exits according to the host environment's established behavior.

### Nested and related resources

- Parent-child navigation preserves ancestry. A person can always understand how the current resource relates to the path.
- Related resources opened from a contextual recommendation retain a return path to both the source resource and its surrounding collection.
- Following multiple relationships builds a coherent history; it must not reset navigation merely because the resource type changes.
- Switching to a peer resource updates the current focus without erasing the broader context.

### Deep links and notifications

- A deep link opens the smallest complete context required to understand and act on the target.
- If access is unavailable, Karya retains the intended destination while authentication, profile selection, or permission resolution occurs.
- Opening from a notification records that notification as the origin. Back returns to the prior Karya state when one exists; otherwise it returns to a useful containing context.
- An expired or moved target resolves to the nearest meaningful destination and explains what changed.
- Deep links are idempotent: reopening one should focus the existing target rather than multiply it.

### History and restoration

- Navigation history belongs to a working context. Switching contexts suspends the current path instead of destroying it.
- Karya restores the last meaningful state after relaunch, interruption, or device sleep unless privacy, security, or explicit user choice requires a neutral start.
- Restoration prioritizes editable content and explicit selections over temporary menus, tips, or transient messages.
- If a restored resource no longer exists, Karya returns to its containing context and explains whether it was moved, deleted, or became inaccessible.

## 2. Search behavior

Search is a platform capability and a continuation surface. It finds known work, recalls recent work, and helps a person narrow an uncertain intention.

### Entry and focus

- Search opens with focus ready for input when invoked explicitly.
- When entered from a context, search begins with that context understood but makes the scope visible and removable.
- Opening search must not destroy the underlying state. Cancellation returns exactly to it.
- If the invocation includes selected text or a resource, Karya may offer that material as a visible search seed; it must not submit it invisibly.

### Before typing

- Show recent searches only when they are useful and appropriate to the active profile.
- Prefer resumable work and recent resources over generic suggestions.
- Sensitive or private queries obey profile retention settings and should not surface in unrelated contexts.
- Search history is inspectable and clearable. Clearing history does not delete resources or activity records outside search.

### Suggestions and live results

- Suggestions complete intent; they do not replace it. Distinguish queries, resources, people, actions, and filters by meaning.
- Results may update while a person types, but selection and keyboard focus remain stable.
- Ranking combines query relevance with current context, recency, explicit pinning, relationship, and prior use. No single signal should make results feel arbitrary.
- Results already available locally appear immediately. Remote results join without reshuffling the item a person is about to select.
- Explain unusual ranking when a contextual signal materially changes the result order.

### Results and empty results

- A result preview shows enough context to distinguish similarly named resources.
- Opening a result preserves the query and result position for return.
- Empty results say what was searched, which scope was active, and the best next step: broaden scope, change terms, create the resource, or reconnect.
- Offline and incomplete results are labeled as such; absence of a local result is not presented as proof that no result exists.

### Cancellation and restoration

- Cancel means return without changing the originating work.
- Clearing a query is not the same as closing search.
- A submitted query may be restored when returning from a result, after interruption, or when moving between devices as part of an active session.
- Karya should not restore stale exploratory text as if it were an unfinished commitment. Explicit submissions and selected scopes carry more restoration weight than incidental typing.

## 3. Context behavior

Context is Karya's working understanding of who is acting, where the work belongs, what is active, and what is likely relevant. It is alive, visible when consequential, and always correctable.

### Context resolution

Karya resolves context from explicit choice first, then from the opened resource, active work session, profile, workspace, relationships, recency, and device state. Inferred context never overrides an explicit choice without consent.

- Context resolution happens progressively. Work already available should not wait for every signal.
- When ambiguity affects saving, sharing, or visibility, Karya asks before acting.
- When ambiguity only affects ranking, Karya may choose a likely context while making it easy to change.
- Context changes must not alter the underlying resource silently.

### Switching profile or workspace

- A profile switch changes identity, permissions, history, ranking, and notification scope together.
- A workspace switch suspends the current navigation and restores the selected workspace's prior state.
- Unsaved local work is retained with the profile and workspace that created it. Switching never causes it to migrate accidentally.
- If the current resource is available in the new context, Karya may keep it open only when identity and access remain unambiguous.
- If it is unavailable, Karya shows the new context's continuation surface and preserves a return path.

### Living context

- Recent Work updates after meaningful engagement, not incidental exposure.
- Continue Working updates when activity creates a resumable state, when a resource changes elsewhere, or when a person explicitly pins or dismisses an item.
- Search ranking responds to active context but remains grounded in query relevance.
- Context signals decay with time. Old activity should not permanently outweigh current intent.
- People can inspect, correct, pin, or dismiss high-impact contextual suggestions.

## 4. Continue Working

Continue Working is Karya's primary bridge across time and devices. It presents a small, intelligible set of work that has momentum.

### What appears

Eligible items include:

- Work left in an unfinished or explicitly resumable state.
- Work recently and meaningfully edited, viewed, or discussed.
- Work changed by collaborators since the person's last engagement.
- Work pinned for continued attention.
- Drafts, pending captures, interrupted imports, and unresolved conflicts.
- Time-relevant work when a clear relationship exists, such as material for an upcoming event.

Passive impressions, completed work without new activity, and frequently opened but irrelevant utilities should not dominate.

### Ranking

Rank by explicit pinning, unfinished intent, meaningful recency, current context, collaborator change, temporal relevance, and relationship to active work. Balance these signals so the list remains stable enough to learn.

- A pinned item remains available but does not need to occupy the first position forever.
- Newly modified work may rise, but it must not displace an item currently being resumed.
- Group multiple updates to the same work into one continuation.
- Indicate why a surprising item appears: “Edited on desktop,” “Updated by Mira,” or “Draft not yet filed.”
- Dismissal immediately removes an item and becomes a ranking signal, not a deletion.

### Restoration

- Resume to the most recent meaningful position: cursor, selection, page, scroll position, active subresource, or playback point.
- Restore supporting context such as open references or an active query when it is integral to the work.
- Do not restore transient menus, hover states, or expired notices.
- If exact restoration is impossible, open the resource at the nearest stable point and say what could not be restored.

### Cross-device continuation

- The receiving device shows what is locally available immediately and enriches it as remote session state arrives.
- A continuation never implies that edits are synchronized until they are.
- When the same work is active elsewhere, Karya allows safe continuation and makes concurrent editing or handoff state clear.
- Device limitations may adapt presentation, but must preserve content, intent, and a return path.

## 5. Capture behavior

Capture turns an incoming thought or artifact into safe work with the least possible ceremony. Capture precedes organization.

### Universal capture contract

1. Accept input immediately.
2. Preserve the original faithfully.
3. Confirm that it is safe locally.
4. Enrich it progressively.
5. Suggest organization without requiring it.
6. Make the captured resource easy to find and continue.

### Quick Capture

- Quick Capture opens to the fastest useful input state.
- A person may save without choosing a type, destination, title, or taxonomy.
- If context is confidently known, Karya may preselect it and show the choice. Otherwise the capture enters a visible inbox or unfiled state.
- Closing after input preserves a draft. Reopening returns to it until it is saved, dismissed, or superseded deliberately.
- Successful capture offers a brief route to open, organize, or undo without forcing another decision.

### Scanner and camera

- Preserve the original image before enhancement.
- Processing, cropping, text recognition, and classification happen progressively and remain correctable.
- Multi-page capture makes the growing set and order clear.
- A failed enhancement never discards the original.
- Permission denial explains the blocked capability and offers another input path.

### Voice

- Make recording state unmistakable and offer immediate stop and discard controls.
- Save recoverable audio before transcription completes.
- Distinguish recorded audio, generated transcript, and AI summary; edits to one must not silently rewrite another.
- Interrupted recording preserves the recoverable portion and explains the interruption.

### Share sheet and clipboard

- Shared content enters Karya with source attribution when available.
- Accept the content before asking where it belongs.
- Clipboard awareness is opt-in or directly invoked; Karya does not continuously inspect or surface private clipboard content unexpectedly.
- When clipboard material duplicates existing work, offer linking or replacement only after the new capture is safe.

### Drag and drop

- Dragging shows valid destinations and the consequence: move, copy, link, attach, or import.
- The default consequence should preserve the source.
- Dropping into an unavailable or unauthorized destination leaves the source untouched and offers recovery.
- Long operations continue in the background and produce a resumable import state.

### Imports

- Imports begin with an inventory and preserve source fidelity.
- Partial success is reported item by item; one failure does not roll back unrelated successful items.
- Duplicate handling is previewable and reversible.
- Imported work remains usable while indexing and enrichment continue.

## 6. Resource opening

Opening a resource transfers focus without making the person wait for completeness.

- Acknowledge selection immediately and preserve the source state.
- Show the resource identity and locally known content first.
- Load primary editable content before metadata, relationships, previews, and recommendations.
- Keep content stable as secondary information arrives. Do not move the reading or editing target unexpectedly.
- Related resources appear after the primary resource is understandable and must explain their relationship when it is not obvious.
- Opening the same resource reuses its existing navigation memory where appropriate.
- If access changes during opening, preserve the path and explain whether the resource moved, became restricted, or is temporarily unavailable.
- Opening in a new surface creates another view of the same work, not an unrelated copy, unless duplication is explicit.

## 7. Loading behavior

Loading reveals what Karya already knows, then improves it. A blank screen and indefinite spinner are last resorts.

### Progressive loading

- Establish structure and identity first, primary content second, supporting context third.
- Prefer stable placeholders shaped like the expected information only when the structure is known.
- Do not show a skeleton for content that is likely to arrive before the transition completes.
- Replace placeholders in coherent groups to avoid flicker and layout churn.

### Cached and optimistic state

- Show trustworthy cached work immediately and identify staleness only when it matters to a decision.
- Refresh in the background without resetting scroll, selection, input, or navigation.
- Use optimistic updates for actions that are likely to succeed and are safe to reverse.
- If an optimistic action fails, restore the prior state, preserve any user-authored input, and explain the next step.
- Never use optimism to imply completion of an irreversible, permission-sensitive, or financially consequential action.

### Long-running work

- Move long operations out of the critical path whenever possible.
- Show determinate progress when the system can measure it; otherwise explain the stage rather than displaying motion without meaning.
- Allow people to leave and return. Completion or failure should be discoverable later.
- Cancellation states what has completed, what will stop, and what remains safe.

## 8. Synchronization feedback

Synchronization communicates availability across places. Saving communicates safety. Karya never conflates the two.

### State model

- **Saving locally:** the latest input is being committed on this device.
- **Saved locally:** work is safe on this device, regardless of network state.
- **Pending sync:** local work is safe and waiting to become available elsewhere.
- **Syncing:** transfer is active; work remains usable.
- **Synced:** the acknowledged version is available to the relevant service or devices.
- **Conflict:** independent changes require reconciliation or have been preserved as distinct versions.
- **Sync failed:** local work remains safe, and Karya is retrying or needs an explicit remedy.

### Behavioral requirements

- Save locally as input changes; do not make routine safety depend on a manual save action.
- Show persistent sync state only when pending, offline, conflicted, or failed state affects confidence.
- Retry transient failures automatically with restraint.
- Never erase a newer local version because an older remote version arrives.
- Conflicts preserve every authored contribution and identify their source and time.
- Reconciliation offers a safe default, comparison where useful, and a way to retain both versions.
- “Synced” is shown only after acknowledgement, never merely after upload begins.

## 9. Offline behavior

Offline is a normal operating state, not an error page.

- Creating, editing, capturing, organizing, and navigating locally available work continue without interruption.
- New resources receive stable local identity and can be linked before synchronization.
- Captures remain fully recoverable and enter the pending sync queue.
- Search returns complete local results and clearly distinguishes unavailable remote coverage.
- Previously opened resources remain viewable according to local availability and security policy.
- Continue Working uses local activity and cached cross-device state without pretending it is current.
- Relaunch restores local drafts, navigation, and pending operations.
- Actions that require connectivity explain why, preserve the person's intent, and offer to complete automatically after reconnection when safe.
- Reconnection refreshes progressively and never blocks current work.
- If remote changes conflict with offline edits, preserve both and reconcile according to the synchronization contract.

## 10. Error recovery

Errors explain reality, protect effort, and offer a route forward. “Something went wrong” is not an acceptable user-facing diagnosis.

Every error message answers, in this order:

1. What could not be completed?
2. Is the person's work safe?
3. Why did it happen, when known and useful?
4. What can the person do now?

### Recovery principles

- Preserve input before presenting the failure.
- Keep recoverable failures near the affected work rather than replacing the whole surface.
- Offer Retry only when the same attempt may reasonably succeed.
- Offer a changed path—edit, reconnect, choose another destination, request access—when repetition will not help.
- Retain enough diagnostic detail for support without exposing implementation language to the person.
- If Karya caused an inconsistent state, acknowledge it plainly and describe what was retained.
- Partial failure reports successful and unsuccessful parts separately.
- Recovery persists across dismissal, relaunch, and device change when unfinished work remains.

## 11. Undo

Undo allows confident action without turning every decision into a confirmation.

- Provide Undo for frequent, reversible, and easily accidental actions: move, archive, mark complete, unlink, reorder, dismiss, and nonpermanent delete.
- Apply the action immediately, show its outcome, and offer Undo near the affected context.
- The ordinary quick-undo window should be long enough to notice and respond, but expiration must not imply immediate permanent destruction.
- Undo restores the complete prior state, including relationships, order, selection, and visibility where feasible.
- Consecutive similar actions may be grouped only when the grouped consequence is clear.
- A second action must not silently eliminate the ability to undo the first if meaningful recovery still exists.
- Destructive actions enter a recoverable deleted state before permanent removal unless security, policy, or explicit immediate deletion requires otherwise.
- Permanent deletion requires explicit confirmation that names the affected work and explains irreversibility.
- Recovery remains available from a dedicated location for an appropriate retention period.

## 12. Notifications

Notifications are invitations to continue work, not demands for attention.

### Delivery and grouping

- Notify only when information is timely, actionable, and not better discovered in context.
- Group updates by work context and summarize repeated activity.
- Prefer one meaningful summary over a sequence of low-value events.
- Respect profile, workspace, focus, schedule, and device presence to avoid duplicating interruptions.
- Do not notify a person about actions they just performed unless asynchronous completion needs confirmation.

### Opening and dismissal

- Opening a notification deep-links to the affected resource and the exact relevant state when still available.
- Include enough surrounding context to understand the change without forcing a search.
- Preserve the state that existed before opening so back can return to it.
- Dismissing a notification marks the interruption handled, not the underlying work complete.
- If a target is no longer available, explain the change and open the closest useful context.

### Summaries

- Summaries organize by work and consequence, not merely chronology.
- Distinguish items that require action from those that are informational.
- AI-generated summaries are labeled and link back to source activity.
- Reading a summary does not mark individual work complete unless that behavior is explicit.

## 13. AI behavior

AI in Karya is ambient assistance. It reduces effort while preserving authorship, agency, provenance, and predictable control.

### AI may

- Summarize material while linking to its sources.
- Explain content, state, relationships, and possible next steps.
- Suggest organization, titles, links, actions, or relevant resources.
- Predict likely intent to reduce repeated input.
- Draft transformations and actions for review.
- Detect potential conflicts, omissions, and stale assumptions.

### AI must never

- Interrupt work merely because it has a suggestion.
- Present inference as fact or hide uncertainty.
- Reorganize, move, publish, share, delete, or overwrite work automatically.
- Replace navigation with an opaque conversational dead end.
- Take irreversible or externally consequential action without explicit confirmation.
- Impersonate the person or communicate externally without a visible review step.
- Use content outside its permitted profile, workspace, or privacy boundary.
- Conceal which sources or context materially informed an answer.
- Make the safety of saved work depend on successful AI processing.
- Block ordinary workflows when AI is unavailable.

### Suggestions and actions

- Suggestions appear where relevant and remain dismissible.
- Accepting a suggestion previews consequential changes before commitment.
- Generated content is distinguishable until the person adopts or edits it.
- AI actions use the same permission, undo, sync, and error-recovery contracts as direct actions.
- Rejection and correction improve relevance without making future behavior unpredictable.
- People can inspect and manage the context supplied to AI.

### Uncertainty and trust

- Express uncertainty in proportion to its consequence.
- Cite or reveal source material when a claim depends on workspace content.
- Separate extracted facts from inference and recommendation.
- When confidence is insufficient, ask a focused question or offer safe alternatives.
- AI should make the platform feel more understandable, never more mysterious.

## 14. Motion behavior

Motion communicates cause, destination, hierarchy, and continuity. The Design Language defines timing and visual treatment; this chapter defines meaning.

- Forward navigation shows that new work follows from the current state. Backward navigation visibly reverses that relationship.
- Sheet presentation communicates a focused, temporary task above preserved context.
- Expanding content maintains a stable point of origin so the person can follow what changed.
- Resource opening connects the selected source to the resulting focus when that connection aids orientation.
- Restoration minimizes theatrical entrance; returning work should feel present, not newly created.
- Context changes make the boundary clear without implying that underlying work was moved.
- Loading motion indicates pending structure or progress, not activity for its own sake.
- Completion motion confirms a result without delaying the next action.
- Reordering follows the moved object and shows where surrounding objects make room.
- Failed optimistic actions reverse visibly enough to explain the restored state.
- Concurrent updates never animate the reading target away from the person.
- Reduced-motion preferences preserve every state change through simpler transitions or immediate updates.

## 15. Feedback

Feedback closes the loop between intention and result. Its prominence matches the consequence.

### Success

- Routine success is visible in the changed state and needs no separate announcement.
- Use temporary confirmation when the result is not otherwise visible, completes asynchronously, or occurs elsewhere.
- Important success states say what completed and where the result can be found.

### Warnings and confirmations

- Warn before a consequence only when prevention is more valuable than recovery.
- A warning describes the specific consequence and the safer alternative.
- Confirmations use explicit verbs and name the affected work.
- Repeated confirmation should be replaced with undo or a safer default where possible.

### Validation

- Validate as soon as the person has enough information to act on the feedback, not while an entry is still incomplete.
- Place validation near the source, preserve entered values, and explain correction in plain language.
- On submission, focus the first unresolved issue while retaining all valid input.

### Temporary feedback and haptics

- Temporary messages must not contain the only route to essential recovery.
- Repeated events update an existing message rather than stacking interruptions.
- Haptics reinforce a visible state change; they never carry meaning alone.
- Reserve strong feedback for boundaries, destructive commitments, and important failure—not routine navigation.

## 16. Empty states

An empty state is a working state. It answers: **What belongs here, why is it empty, and what should I do next?**

- Describe the specific absence, not “No items.”
- Offer one relevant next action when the person can change the state.
- Distinguish first use, cleared content, filtered emptiness, unavailable remote results, missing permission, and completed work.
- Preserve active filters and queries in the explanation; do not imply content is absent when it is merely hidden.
- For first use, demonstrate the value of adding real work without demanding setup.
- When an empty state represents success, acknowledge completion without inventing more work.
- Do not fill empty space with generic illustration, tips, or promotion that distracts from the next action.
- If the person cannot resolve the state, explain who or what can.

## 17. Multi-device continuity

Karya behaves as one workspace expressed through many devices. A device changes the mode of engagement, not the identity of the work.

### Continuation contract

When work moves between devices, Karya carries:

- Resource identity and current version.
- Meaningful navigation path and surrounding context.
- Editing or viewing position when safe and useful.
- Unsaved or pending local state, accurately labeled.
- Active profile and workspace.
- Supporting selections, queries, and references integral to the task.

### Handoff behavior

1. Desktop activity creates a resumable session.
2. The phone recognizes that session in Continue Working.
3. Opening it shows locally available content immediately.
4. Remote position and context enrich the resource as they arrive.
5. The phone adapts the activity to its capabilities without changing the underlying work.
6. Later return to desktop reflects the phone's acknowledged changes and latest meaningful position.

### Concurrency and presence

- Karya does not assume that opening on one device means closing on another.
- When concurrent activity could conflict, show it calmly and preserve both contributions.
- Presence indicates relevant active editing, not surveillance. Avoid exposing unnecessary device or behavioral detail.
- A person can choose to hand off control, continue independently, or view without editing where those distinctions matter.
- Device loss, logout, or revocation ends access without corrupting shared work.

### Capability differences

- A device may offer capture, scanning, precision editing, or large-context review differently.
- Unsupported operations remain understandable and resumable elsewhere.
- Karya never creates incompatible resource variants merely because a device cannot render every capability.
- The smallest device should still provide a safe way to inspect, capture, respond, and defer.

## 18. Behavioral rules

The following rules are Karya's behavioral constitution. Product convenience, growth goals, and technical shortcuts do not override them.

1. Always preserve user-authored input.
2. Always preserve context across meaningful transitions.
3. Always make the current profile and workspace unambiguous when they affect consequence.
4. Always let people begin work before organizing it.
5. Always acknowledge an intentional action promptly.
6. Always distinguish local safety from synchronization.
7. Always tell the truth about save and sync state.
8. Always keep a return path to the work's origin.
9. Always restore the last meaningful state when safe.
10. Always make consequential inference visible and correctable.
11. Always explain irreversible actions before commitment.
12. Always preserve recovery when recovery is possible.
13. Always provide a non-gesture path to a gesture action.
14. Always show locally available work before waiting for the network.
15. Always retain the original when enrichment can fail.
16. Always separate source material from generated interpretation.
17. Always respect profile, workspace, permission, and privacy boundaries.
18. Always make partial success distinguishable from total success.
19. Always offer a useful next step in an empty state.
20. Always adapt presentation without changing the identity of work.
21. Never block work while synchronizing.
22. Never require connectivity for work that can be completed locally.
23. Never require organization before creation.
24. Never lose input because navigation, authentication, or permission changed.
25. Never use “Something went wrong” as the complete explanation.
26. Never make Retry the only answer to a nontransient failure.
27. Never imply that pending work is synchronized.
28. Never erase a newer local version with an older remote version.
29. Never make a blank surface the default loading experience.
30. Never move a person's reading or editing target during background refresh.
31. Never reset navigation merely because a resource type changes.
32. Never destroy suspended context when switching profiles or workspaces.
33. Never make dismissal mean completion unless explicitly chosen.
34. Never use notifications to manufacture urgency.
35. Never notify people about routine actions they just performed.
36. Never interrupt solely to present an AI suggestion.
37. Never let AI take irreversible action without explicit confirmation.
38. Never let AI reorganize or share work invisibly.
39. Never make ordinary work depend on AI availability.
40. Never present inference as established fact.
41. Never hide a destructive action behind an ambiguous label.
42. Never use confirmation when a reliable Undo creates more confidence.
43. Never make color, motion, sound, or haptics the sole carrier of meaning.
44. Never require a gesture that excludes another input method.
45. Never discard an original capture because processing failed.
46. Never let one failed import invalidate unrelated successful work.
47. Never treat offline as exceptional when safe local work is possible.
48. Never surprise the person with a changed destination, owner, or audience.
49. Never optimize engagement at the expense of calm, trust, or continuity.
50. Never make the interface more memorable than the work.

---

Karya succeeds when a person can stop on one device, return later from another entry point, and continue with confidence—without remembering which application contained the work, rebuilding its context, or wondering whether it is safe.
