# D2 — Preserve Explicit User Intent

## Status

Implemented. Automated verification passed; observed workflow revalidation remains pending.

## Reported evidence

1. Referenced `.txt` files opened Notes.app instead of TextEdit.
2. Clicking a Profile opened its most recent Workspace instead of the Profile Overview.
3. Desktop Profile and Workspace creation invented names and required a later rename.
4. A new database displayed invented Resources and references alongside required platform defaults.
5. Loading indicators needed to be limited to operations where the user actually waits.
6. Important behavioral values were embedded as string and numeric literals.

These are treated as product failures. No onboarding or philosophical defense is proposed.

## Corrections

- `.txt` Resources bypass automatic application preference resolution and return to the system adapter. On macOS the adapter explicitly opens them with TextEdit. Other extensions retain their existing resolution behavior. Explicit **Open With** remains available.
- UI Profile activation uses the Profile Overview path and clears the active Workspace from continuity. It does not select a recent or default Workspace. Context-resolution `switchProfile` remains capable of restoring context for Search, Notifications, and Continue Working.
- Desktop creation entry points now open required-name dialogs. Empty names are rejected in the UI, Kernel, Profile Service, and Workspace Service.
- Creating a Profile no longer creates a Default Space. The Profile Overview remains empty until the user explicitly creates a named Workspace.
- Fresh Desktop and Mobile stores contain only the constitutional Default Profile, Default Spaces, settings, and required session state. They contain no Resources, references, or demo data. This corrects the earlier implementation, which incorrectly treated required platform state as invented user content.
- Creating an additional user Profile still does not invent a Workspace for that Profile. The constitutional startup defaults and user-created context are separate rules.
- Existing loaders were audited. Startup/restoration, search execution, synchronization status, transport status, and asynchronous creation retain waiting feedback. Immediate navigation and small state changes did not receive new loaders.
- Product-significant file extensions, application identifiers, limits, placeholders, native commands, errors, MIME mappings, and filesystem limits were moved to scoped `constants.ts` modules in the packages and clients that own them. Ordinary one-use literals remain local where extraction would reduce readability.

## Automated evidence

- A production Core boot produces one Default Profile, the required Default Spaces, and zero Resources or references.
- Empty Profile and Workspace names are rejected.
- A named Profile is created without a hidden Workspace.
- SQLite schema version 8 preserves existing Profiles while allowing a new Profile to persist without a default Workspace.
- Opening a Profile ends on the Profile surface with no active Workspace in continuity.
- A Workspace opens only after an explicit Workspace command.
- A `.txt` reference bypasses an installed default text-capable application and delegates to the platform filesystem provider.
- Kernel product and reliability suites remain green.

## Manual revalidation

1. Start against a genuinely new database and verify that only the Default Profile and required Default Spaces appear. Verify that no Resource, reference, or sample item appears.
2. Create a Profile and verify that the name is requested before creation.
3. Verify the new Profile Overview contains no automatically created Workspace.
4. Create a named Workspace and verify it exists only after confirmation.
5. Open another Workspace, click the Profile, and verify the Profile Overview opens without redirecting to a Workspace.
6. Reference a `.txt` file and open it normally. Verify TextEdit opens on macOS.
7. Open a non-TXT reference and verify its prior system/application behavior is unchanged.
8. Observe startup, restoration, search, and synchronization status. Record any loader that blocks useful work or appears for an immediate interaction.

Record elapsed time, interaction count, whether prompting occurred, and the participant's exact words. Primary Work Environment certification remains pending until this workflow is observed.
