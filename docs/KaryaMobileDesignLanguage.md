# Karya Mobile Design Language

**Status:** Foundation 1.0  
**Scope:** Karya Mobile for iOS and Android  
**Principle:** Work first. Interface second.

Karya Mobile is a calm continuation of work. It does not behave like a grid of apps or ask people to reorganize their thinking around product features. It keeps the current work, its context, and the next useful action close at hand.

This document defines the shared visual and interaction foundations for every Karya Mobile surface. It establishes defaults, not decoration. When a new pattern is needed, prefer the solution that preserves reading flow, reduces decisions, and feels native on the current platform.

## 1. Product character

Karya is:

- **Content-first.** Work receives the strongest visual emphasis. Controls recede until needed.
- **Quiet.** Color, motion, elevation, and badges communicate state rather than personality.
- **Fast.** Common actions are immediate, predictable, and reachable with one hand.
- **Professional.** Language is direct, layout is orderly, and states are explicit.
- **Trustworthy.** Saving, syncing, destructive actions, and permissions always have legible outcomes.
- **Native.** Karya shares one identity across platforms while respecting each platform's navigation, typography, gestures, and system conventions.

### Design test

Before introducing an element, ask:

1. Does it clarify the work or its context?
2. Is it necessary at this moment?
3. Can a native platform pattern solve it more clearly?
4. Does it remain readable under large text, dark mode, and reduced motion?

If not, remove or defer it.

## 2. Foundation tokens

Token names express purpose, not appearance. Platform implementations may differ while preserving the same semantic role.

### 2.1 Spacing

Use a 4-point base grid. All fixed spacing and component dimensions should be multiples of 4, except hairline borders and platform-controlled metrics.

| Token      | Value | Typical use                          |
| ---------- | ----: | ------------------------------------ |
| `space.0`  |     0 | Flush relationships                  |
| `space.1`  |     4 | Icon-to-label, tight metadata        |
| `space.2`  |     8 | Related inline elements              |
| `space.3`  |    12 | Compact component padding            |
| `space.4`  |    16 | Default page gutter and card padding |
| `space.5`  |    20 | Comfortable internal spacing         |
| `space.6`  |    24 | Section spacing                      |
| `space.8`  |    32 | Major content groups                 |
| `space.10` |    40 | Large section separation             |
| `space.12` |    48 | Touch controls and major rhythm      |
| `space.16` |    64 | Rare structural separation           |

Rules:

- Use 16-point horizontal page gutters on compact phones and 24 points on large phones or split views.
- Let safe-area insets define outer edges; never hardcode around notches, home indicators, or system bars.
- Prefer whitespace to dividers. Use a divider only when spacing alone cannot explain grouping.
- Keep vertical rhythm consistent within a surface. Do not use more than three adjacent spacing sizes in one component.

### 2.2 Typography

Use the system typeface: San Francisco on iOS and Roboto on Android. Never substitute a brand font for working content. Support Dynamic Type and Android font scaling without clipping or truncating primary information.

| Role            | Size / line height | Weight   | Use                                      |
| --------------- | -----------------: | -------- | ---------------------------------------- |
| `display`       |            32 / 38 | Semibold | Rare, high-level empty or welcome states |
| `title.large`   |            28 / 34 | Bold     | Top-level destination title              |
| `title`         |            22 / 28 | Semibold | Page or sheet title                      |
| `heading`       |            18 / 24 | Semibold | Section and card heading                 |
| `body`          |            16 / 24 | Regular  | Default reading and editing              |
| `body.emphasis` |            16 / 24 | Semibold | Important inline content or action       |
| `label`         |            14 / 20 | Medium   | Controls, tabs, compact labels           |
| `caption`       |            12 / 16 | Regular  | Metadata and secondary status            |

Rules:

- Use sentence case everywhere, including navigation and buttons.
- Keep body copy at 16 points minimum. Captions may be 12 points only for nonessential metadata.
- Use weight before color to create hierarchy; avoid more than three weights on one screen.
- Use tabular numerals for timers, dates in columns, and changing counts.
- Prefer wrapping over truncation for titles. Truncate only repeated list content where the full value is accessible on entry.
- At 200% text size, primary tasks must remain usable. Reflow horizontal groups vertically when needed.

### 2.3 Color philosophy

Karya uses a mostly neutral canvas with one restrained accent. Color communicates interaction, selection, status, or urgency; it is never a decorative background treatment.

#### Semantic palette

| Token               | Light intent                     | Dark intent                  |
| ------------------- | -------------------------------- | ---------------------------- |
| `surface.canvas`    | Warm-neutral near-white          | Near-black, not pure black   |
| `surface.raised`    | White or subtly distinct neutral | One step lighter than canvas |
| `surface.sunken`    | Quiet neutral fill               | One step darker or outlined  |
| `content.primary`   | Near-black                       | Near-white                   |
| `content.secondary` | Mid-neutral                      | Light mid-neutral            |
| `content.tertiary`  | Low-emphasis neutral             | Muted neutral                |
| `border.subtle`     | Low-contrast neutral             | Low-contrast light neutral   |
| `accent`            | Calm blue                        | Slightly lighter calm blue   |
| `accent.subtle`     | Low-chroma blue tint             | Translucent blue tint        |
| `status.success`    | Green                            | Lighter green                |
| `status.warning`    | Amber                            | Lighter amber                |
| `status.danger`     | Red                              | Lighter red                  |
| `status.info`       | Blue                             | Lighter blue                 |

Implementation guidance:

- Start with platform semantic colors and map them to Karya tokens.
- Meet WCAG AA: 4.5:1 for normal text, 3:1 for large text and meaningful graphics.
- Never rely on color alone. Pair status color with an icon, label, shape, or position.
- Reserve accent for the current selection, primary action, links, and active controls.
- Do not use gradients. Photography and user content may contain natural gradients.
- Avoid large saturated surfaces. Status fills should normally use a subtle tint with strong foreground content.

### 2.4 Dark mode

Dark mode is designed, not inverted.

- Use near-black canvas surfaces to preserve depth and reduce halation.
- Raise surfaces by making them slightly lighter; do not add stronger shadows.
- Reduce the saturation of large fills while keeping small status marks distinguishable.
- Recheck disabled and tertiary content independently; they must remain legible.
- Keep pure white for rare maximum-emphasis content, not all text.
- Respect the system appearance by default and update without restarting.

### 2.5 Shape and border radius

Shape is restrained and functional.

| Token           | Radius | Use                                   |
| --------------- | -----: | ------------------------------------- |
| `radius.small`  |      6 | Tags, small fields, compact controls  |
| `radius.medium` |     10 | Search, rows with a contained surface |
| `radius.large`  |     14 | Cards, dialogs, floating controls     |
| `radius.sheet`  |     20 | Top corners of mobile sheets          |
| `radius.full`   |    999 | Circular or pill controls only        |

- Do not nest rounded containers without at least 8 points of visual separation.
- A card, field, and button should not all become pills. Pills are reserved for filters, compact statuses, and explicitly toggleable chips.
- Allow system components to use platform-native radii when replacing them would reduce familiarity.

### 2.6 Elevation

Structure comes from layout and surface contrast before shadow.

| Level | Meaning                            | Treatment                                               |
| ----- | ---------------------------------- | ------------------------------------------------------- |
| `0`   | Base content                       | No shadow                                               |
| `1`   | Sticky or grouped surface          | Subtle border or tonal change                           |
| `2`   | Floating control, menu, sheet      | Soft, broad, low-opacity shadow plus surface separation |
| `3`   | Dialog or critical transient layer | Strongest allowed scrim and restrained shadow           |

- Never use elevation decoratively.
- Use a 1-pixel/physical-pixel border where shadow is unreliable or visually noisy.
- In dark mode, prefer tonal separation over shadow.
- Only one transient elevation hierarchy should be active at a time.

## 3. Iconography

Use SF Symbols on iOS and Material Symbols on Android. Select optically equivalent concepts rather than forcing identical silhouettes.

- Default icon size: 20–24 points; compact metadata icons: 16 points.
- Default style: simple outline with consistent optical weight. Use filled variants for selected navigation states where platform conventions support them.
- Icons must remain recognizable at their rendered size. Avoid custom detail, badges within icons, and mixed stroke styles.
- Pair unfamiliar icons with text. Never use an icon alone for a destructive or irreversible action.
- Mirror directional icons in right-to-left layouts. Do not mirror universal media or object symbols.
- Give every actionable icon an accessible name that describes the action, not the artwork.

## 4. Content surfaces

### 4.1 Cards

Cards are for coherent objects or resumable work, not generic grouping.

**Standard card**

- `surface.raised`, `radius.large`, 16-point padding.
- Use either a subtle border or level-1 elevation, not both unless contrast requires it.
- Establish one primary text region, optional metadata, and at most one visible trailing action.
- Entire-card tapping is allowed only when it has one destination. Secondary actions need independent touch targets.

**Compact card**

- 12-point padding and `radius.medium`.
- Use for context previews and horizontal collections, never long-form reading.

Avoid cards when a simple list, section heading, or whitespace communicates the relationship more clearly.

### 4.2 Lists

Lists are the default pattern for repeated work.

- Minimum row height: 48 points; default: 56; two-line: 64–72.
- Align primary text to a consistent leading edge.
- Use leading icons only when they improve scanning or identify object type.
- Trailing content is reserved for concise metadata, state, disclosure, or one action.
- Dividers begin at the primary text edge when a leading visual is present. Full-width dividers mark larger section boundaries.
- Group with short sentence-case headings. Avoid boxed sections inside boxed screens.
- Swipe actions must be discoverable elsewhere and require confirmation or undo when destructive.
- Preserve scroll position, selection, and expanded state when returning.

## 5. Navigation

Navigation follows the structure of work, not a catalogue of app modules.

### Principles

- Keep top-level destinations stable and few.
- Preserve context when moving between a work item and its supporting information.
- Use platform-native back behavior and edge gestures.
- Titles describe the current place or work object, never the product name.
- Do not combine multiple competing navigation models on one level.
- Deep links must restore the destination, context, and safe back path.

### Top app bar / navigation bar

- Use native large-title behavior only at top-level destinations; collapse naturally on scroll.
- Show no more than two visible actions. Move low-frequency actions into an overflow menu.
- Keep the back action at the platform-standard leading position.
- Do not center custom branding in working views.

### Bottom navigation

Use bottom navigation for three to five peer, top-level destinations that people switch between frequently.

- Each item has an icon and a short persistent label.
- Do not hide labels, horizontally scroll items, or change destinations by role or context.
- Use the accent color for the active item and neutral secondary color for inactive items.
- Tapping the active item returns to its root; a second tap may scroll to top when expected.
- Preserve each destination's navigation and scroll state.
- Badges show meaningful, actionable change. Use a dot when the count is not useful; cap numeric badges at `99+`.
- Respect bottom safe-area insets. The bar must not obstruct the quick capture button or system gesture region.

## 6. Persistent work controls

### 6.1 Context bar

The context bar answers: **What work am I in, and what state is it in?** It may show a workspace, project, active session, people, sync state, or a concise combination.

- Place it below the top bar or directly above the bottom navigation, based on whether it describes the page or the ongoing session.
- Height: 44–52 points, expanding only for accessibility text sizes.
- Show one primary context label, optional secondary state, and one disclosure or compact action.
- Use a quiet tonal surface and subtle separator. It must not resemble an alert.
- Tapping opens a context sheet; it does not unexpectedly navigate away.
- Keep the bar stable while its text updates. Announce important state changes accessibly without stealing focus.
- Hide it only when no meaningful context exists or immersive input requires the space.

### 6.2 Search bar

Search is a direct path back to work.

- Default height: 48 points; `radius.medium`; subtle filled surface.
- Use a leading search icon, plain placeholder such as “Search work,” and a trailing clear action only when text exists.
- On focus, give search enough space and show a platform-native cancel affordance.
- Search across useful work types by default; expose scopes as chips only after they become relevant.
- Show recent work or queries before typing, useful results while typing, and a clear empty state.
- Preserve the query when opening a result and returning.
- Never place promotional or unrelated content in search results.

### 6.3 Quick capture button

Quick capture creates a new piece of work without first choosing an app.

- Use one circular or compact extended floating control, 52–56 points high, with a plus or capture symbol. Include “Capture” when space and platform patterns permit.
- Place it in the bottom trailing reach zone, at least 16 points from screen edges and clear of the bottom navigation and safe area.
- Keep it in a consistent location across top-level destinations.
- Tapping opens the lightweight capture sheet immediately with keyboard focus where appropriate.
- Long press may reveal a small set of common capture types, but the primary tap stays generic and fast.
- Hide or dock it during full-screen editing, keyboard conflict, or when it would cover a required action.
- It uses the accent color but must not visually dominate the work content.

## 7. Overlays and transient surfaces

### 7.1 Sheets

Sheets handle focused, reversible tasks without losing the underlying work.

- Prefer a bottom sheet on phones and a centered/form sheet on larger layouts when native conventions support it.
- Use three meaningful states at most: compact, medium, and full. Do not create arbitrary stopping points.
- Give the sheet a clear title, optional close affordance, and a visible primary action only when completion is explicit.
- Keep primary actions reachable near the bottom, above the safe area and keyboard.
- Use a drag indicator only when the sheet is actually draggable.
- Allow swipe-to-dismiss for reversible tasks. Protect unsaved work with a confirmation.
- The scrim dims but does not erase context. Avoid stacking sheets.

### 7.2 Dialogs

Dialogs interrupt work and are therefore rare.

Use them for destructive confirmation, required permission rationale, a blocking decision, or acknowledgement of an exceptional state. Do not use dialogs for success messages, tips, routine filters, or multi-step forms.

- Keep the title outcome-oriented and the message concise.
- Use explicit action labels such as “Delete note,” not “Yes.”
- Present one primary action and one cancel action. Destructive actions use danger styling.
- The safest action receives initial keyboard or accessibility focus where platform behavior permits.
- Never show a dialog immediately on launch unless the app cannot function safely without the decision.

### 7.3 Feedback

- Use inline validation close to the field and explain how to recover.
- Use snackbars/toasts for brief, nonblocking confirmation. Offer Undo for reversible destructive actions.
- Persistent or blocking system states belong inline or in the context bar, not repeated toasts.
- Progress indicators appear only when delay is perceptible. Prefer determinate progress when duration is knowable.

## 8. Motion

Motion explains continuity, hierarchy, and result. It does not entertain.

| Motion                  |     Duration | Use                                      |
| ----------------------- | -----------: | ---------------------------------------- |
| Immediate feedback      |    80–120 ms | Press, toggle, selection                 |
| Small transition        |   160–220 ms | Menu, chip, inline expand                |
| Screen/sheet transition |   220–320 ms | Navigation, sheet presentation           |
| Complex continuity      | up to 400 ms | Rare shared-element or structural change |

Rules:

- Use platform-standard easing and navigation transitions by default.
- Animate opacity and transform before layout properties to protect performance.
- Keep spatial direction consistent: new detail enters from the forward direction; dismissal reverses it.
- Never animate every list item on routine load.
- Do not delay interaction while an animation finishes.
- Target smooth rendering at the device's native refresh rate and avoid effects that require continuous expensive blur.
- Under Reduce Motion, replace travel, scale, parallax, and shared-element motion with short crossfades or no animation.
- Loading placeholders may use a subtle, slow luminance shift; stop it once content arrives and disable it under reduced motion.

## 9. Interaction and ergonomics

### One-handed interaction

- Place frequent and constructive actions in the lower half of the screen.
- Keep destructive, global, and low-frequency actions away from the easiest accidental reach zones.
- Bring selection and capture controls closer through sheets rather than requiring repeated top-edge travel.
- Do not require two-handed gestures. Every gesture action must have a visible alternative.
- Reposition floating controls when the keyboard, system bars, or foldable posture changes the safe working area.

### Touch targets

- Minimum interactive target: **44 × 44 points on iOS** and **48 × 48 dp on Android**.
- Visual icons may be smaller but their hit areas must meet the minimum.
- Keep at least 8 points between adjacent targets where accidental activation is plausible.
- Rows that navigate should make the full row tappable, excluding independent controls.
- Provide visible pressed, selected, focused, disabled, and loading states.
- Do not disable an action without making the reason discoverable.

### Gestures and input

- Treat tap as the primary interaction. Gestures accelerate; they do not gate functionality.
- Respect system back, home, text selection, keyboard, stylus, pointer, and predictive-back behaviors.
- Keep focus visible for keyboard and switch users.
- Use native text controls, input types, autofill, and return-key semantics.
- Never block paste into fields that accept user-authored content.

## 10. Accessibility

Accessibility is a release requirement, not a later audit.

- Support screen readers with concise names, roles, values, hints, and logical traversal order.
- Group related card content into a useful accessible unit without hiding independent actions.
- Support Dynamic Type and Android font scaling to at least 200%; test common screens at the largest accessibility settings.
- Meet contrast requirements in every state, including placeholders, disabled controls, focus rings, and dark mode.
- Use more than color to express state.
- Respect Reduce Motion, Reduce Transparency, Bold Text, Increased Contrast, and platform equivalents.
- Provide captions or transcripts for meaningful audio and alternatives for meaningful images.
- Announce asynchronous completion, errors, and sync changes politely; do not repeatedly interrupt.
- Keep plain language concise. Avoid unexplained acronyms and ambiguous action labels.
- Localize layouts from the start: allow text expansion, bidirectional content, locale-aware dates, times, and numbers.

## 11. Responsive and platform behavior

Karya shares information architecture and semantic tokens across platforms, not pixel-for-pixel layouts.

### iOS

- Prefer native navigation bars, sheets, menus, context menus, swipe-back, haptics, and SF Symbols.
- Use bottom tabs for stable top-level navigation.
- Follow Dynamic Type metrics and safe areas.

### Android

- Prefer native app bars, modal/standard bottom sheets, menus, predictive back, ripple/pressed feedback, and Material Symbols.
- Use navigation bar patterns appropriate to compact width and navigation rail at larger widths.
- Follow system insets, font scaling, and edge-to-edge guidance.

### Larger and adaptive layouts

- At wider sizes, increase information density through panes, not oversized content.
- Preserve reading measures: aim for 45–75 characters per line for prose.
- A navigation rail may replace bottom navigation; a context panel may appear beside content.
- Do not stretch phone cards across tablet widths. Use grids or bounded content columns.
- Adapt to rotation, split screen, foldables, and resizable windows without losing work state.

## 12. Language and states

- Write short, direct, human labels: “Move task,” “Try again,” “Saved.”
- Describe outcomes, not system implementation.
- Empty states explain what belongs here and offer one relevant next action.
- Errors state what happened, whether work is safe, and how to recover.
- Offline states distinguish between saved locally, waiting to sync, and unavailable.
- Never imply that work is saved or synced before confirmation from the system.
- Use relative time only when precision is unimportant; make exact time available.

## 13. Composition rules

Every Karya Mobile screen should follow this order of emphasis:

1. **Current work** — title, content, or object.
2. **Current context** — where it belongs, who is involved, and its state.
3. **Next useful action** — one clear primary action when needed.
4. **Supporting navigation and metadata** — present but quiet.

Default composition:

- Safe-area-aware system/top bar
- Optional search or context bar when relevant
- Scrollable content with 16-point compact-width gutters
- Persistent action only when it is repeatedly useful
- Bottom navigation only at the top level

Do not place a search bar, context bar, segmented control, banners, and filters together by default. Reveal secondary controls progressively and keep the work visible.

## 14. Definition of done

A new Karya Mobile pattern is ready only when it:

- Uses semantic tokens and an existing component before introducing a new one.
- Works in light and dark mode.
- Supports system text scaling and screen readers.
- Meets platform touch-target and safe-area requirements.
- Has loading, empty, error, offline, disabled, pressed, and success behavior where applicable.
- Respects reduced motion and increased contrast.
- Works with one hand for its most common action.
- Uses native platform behavior where users already have a strong expectation.
- Preserves work and communicates saving or syncing truthfully.
- Removes any visual element that does not clarify content, context, state, or action.

The measure of the design language is not how recognizable the interface looks in a static image. It is how little interface a person must notice to continue meaningful work with confidence.
