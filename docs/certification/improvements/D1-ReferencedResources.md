# D1 Product Improvement — Referenced Resources

- **Evidence source:** Day 1 internal dogfood session
- **Evidence reported:** 2026-07-17
- **Status:** Implemented; automated validation passed; observed workflow revalidation pending
- **Permitted categories:** UX, workflow, navigation, continuity, product, performance
- **Certification effect:** Does not certify the workflow

## Observed evidence

1. Importing a large project prevented the participant from doing other work in Karya and offered no useful escape from the experience.
2. Double clicking a linked folder opened an empty Karya folder surface instead of the system folder.
3. Importing an entire project was unacceptably slow. The participant preferred references and explicitly limited Karya Account synchronization to Karya-owned resources, with external resources represented by metadata only.

No philosophical defense applies. Folder import, folder activation, and external-content ownership failed the observed workflow.

## Reproduction and causes

### Blocking folder import

The folder import path called `walkDirectory` and awaited a complete recursive traversal before queuing the import job. Large projects therefore monopolized the initiating experience before cancellation or progress behavior became useful.

### Empty Karya folder

Every Resource with folder type was routed to `OpenFolderResourceCommand`, which deliberately opened Karya's internal folder surface. The routing did not distinguish an imported Karya folder model from a system-owned linked folder.

### External content crossing the metadata boundary

Linking a text file read the complete file to build indexed-note attributes. Synchronization serialized the Resource payload as supplied, so content-bearing attributes on linked or legacy imported Resources could enter a metadata operation.

## Product improvement

- Removed Import File and Import Folder from Desktop product entry points.
- Replaced them with Reference File and Reference Folder. The latter explicitly covers folders, projects, and repositories.
- Reference creation reads filesystem metadata only. It does not traverse a directory or read a referenced text file.
- File-picker cancellation creates no Resource. There is no post-selection traversal or metadata job to monopolize Karya.
- Opening a referenced folder delegates to the platform's `openPath`; Karya no longer opens its internal folder surface.
- Single click remains Resource selection and exposes metadata through the existing Inspector.
- A referenced-folder context menu now offers the system reveal action, Open in VS Code when detected, Copy Path, Remove Reference, and Show Metadata.
- Removing a reference deletes Karya metadata only. It does not delete or move the system-owned folder.
- Reference creation publishes `ResourceReferenced`, not `FolderImported`.
- Activity and continuity avoid recording a linked Resource as a Karya-created duplicate before recording the reference.
- Synchronization preserves reference metadata but strips external note content, indexed content, headings, and content-store addresses.
- Existing queued Resource operations are sanitized when read for transport or replay, preventing legacy reference payloads from carrying embedded external text forward.
- Autosaved content is queued only for Karya-owned Resources.

The underlying historical import service remains for compatibility with existing data and tests but has no v1.0 Alpha Desktop entry point. No new engine, provider, background crawler, filesystem synchronization, or ownership layer was introduced.

## Automated workflow validation

The focused product test verifies:

- a referenced folder and a 4 MB Markdown reference are created without calling `readTextFile`;
- opening the referenced folder calls the system path provider;
- the active Karya surface does not become a folder surface;
- reference operations preserve their external path;
- deliberately injected external text is absent from synchronization payloads;
- a Karya-native note still emits its owned editable content operation.

Focused result: **4/4 tests passed**, including the existing Synchronization Engine integration tests.

Repository validation after implementation:

- TypeScript: **35/35 tasks passed**.
- Tests: **44/44 tasks passed**.
- Kernel: **48/48 tests passed**.
- Builds: **35/35 tasks passed**, including Desktop and Android/iOS Hermes exports.
- Revised Desktop build: **32/32 dependency and application build tasks passed**.
- Electron SQLite native binding: rebuilt and directly validated after Node-based tests.

The existing Desktop renderer chunk-size advisory remains non-blocking and unchanged.

## Required observed revalidation

This improvement is not certified until a participant completes all of the following without coaching:

1. Reference the same large project that exposed D1-001.
2. While the reference exists, navigate Profiles, Workspaces, Resources, Search, and Editing without waiting for project traversal.
3. Cancel the native folder picker and confirm that nothing is added.
4. Single click the reference and confirm that the expected metadata is visible.
5. Double click the reference and confirm that the system file manager opens the actual folder.
6. Use each referenced-folder context action that is available on the test system.
7. Confirm that removing the reference leaves the actual folder unchanged.
8. Inspect synchronization evidence to confirm that reference metadata is present and external content is absent.

Record elapsed time, interactions, participant language, abandonment, and any external-tool substitution. Missing observed evidence remains a failure to certify.
