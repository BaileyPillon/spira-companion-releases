# Spira 1.37: live decisions and playthrough planning

This implements the ten requested development areas. It does **not** establish that the new minigame, Blitzball, Cloister or AP-sharing behavior has passed gameplay acceptance on the AYN Thor. The Thor was unavailable during this work. FFX-2's exact scene naming also remains partial. Keep those limits visible when describing this build.

## Features and boundaries

| Requested area | Implemented behavior | Coverage and remaining acceptance |
| --- | --- | --- |
| 1. Multi-goal plan | Select Anima, Celestial Weapons, AP setup, Dark Aeons, Penance and Arena captures together. Merge shared captures, reserve customization materials across characters, subtract live inventory once, expand Arena prerequisites and group available tasks by area. Add item stock targets. | FFX International. Area grouping is a heuristic, not a shortest travel route. Distinct armor builds reserve distinct materials. AP training is optional; its setup goal can finish. |
| 2. Minigame coaching | Butterfly Catcher route maps, moving player, confirmed caught count, tint-derived blue butterflies and visible red hazards. Route progress stops after a feed gap. Catcher Chocobo reads race time, balloons, bird hits and the adjusted result. | Butterfly route geometry is the post-airship course in rooms 241/242. Invisible hazard volumes are not drawn. Counter/layout decoding has synthetic tests; actual course play is pending. |
| 3. Sphere Grid sandbox | Copy the current Standard or Expert grid, plan legal stat-node replacements and multiple destinations, see Sphere Level and sphere costs, compare stats, pan/zoom, save builds and import/export JSON. | Ability/command nodes cannot be erased. The route activates the nodes it passes. It is a hypothetical plan and never edits the game. Imported builds receive fresh identities. |
| 4. FFX-2 scene diagnosis | Audit all 525 mapped save flags by chapter, location, recorded state and possible recovery. Nineteen critical interactions have individually authored names and instructions. Review current-chapter omissions before advancing; Celsius tips link to this audit. | USA disc. The other 506 flags have location/ordinal labels, not exact interaction names. An absent flag does not prove a permanent miss or a percentage deficit: branches and NG+ matter. Complete named-scene diagnosis remains unfinished. |
| 5. Battle comparison | Compare 42 supported commands/items, using live battle attributes, Cheer/Focus stacks, equipment, HP/MP, status and CTB recovery. Separate command and item views. Show damage ranges, MP costs, base hit/status chances and unsupported conditions. | International Quick Hit uses the revised rank. Static enemy affinities/resistances, temporary immunities, Defend, weapon status procs, AI and counters limit prediction. Celestial scaling is explicitly unavailable. Twelve independent reference cases cover all 32 damage rolls. |
| 6. Live Blitzball | Pool diagram, clock, score, current match stats, ball carrier verified through the ball's attachment, pass-to-space advice, conservative selected-defender break ranges and a close-range shot comparison. | Room 62, exact `bltz0000` script. Advice pauses in flight/uncertain possession. Travel loss and techniques are not a win-probability model. Match gameplay remains unverified. |
| 7. AP participation | Per-character participation readout in battle. Optional recruited-party AP sharing in the hidden Cheats menu. | Sharing defaults off, is session-only, stops when Cheats is hidden, and resets on document reload/profile switch. Native writes require matching disc/CRC, active battle, current room/battle count/pointer and a running emulator. The game's victory status restrictions remain intact. Actual victory/AP payout still needs Thor verification. |
| 8. Cloister companion | Current held sphere in all six temple puzzle rooms; recess contents where decoded; Bevelle pedestal attachments; live destruction-chest flags; exact Besaid next-step rules and direct offline temple walkthrough links. | It is not a complete automatic solver for all six temples. Exact dynamic next-step rules currently cover Besaid; other temples combine state with their walkthrough. Zanarkand's lit-square puzzle is not decoded. Gameplay acceptance is pending. |
| 9. Search and pins | Search tools, FFX items/fiends/equipment abilities/grid abilities/recruits/locations and FFX-2 recovery items and equipment reference data. Pin results and keep notes. Full-screen Guide has a Workspace button and retains its place when returning. | Pins resolve against current ownership. FFX-2 recovery-item names cover the existing recovery catalog, not every game item. No cloud account is needed. |
| 10. Profiles and backups | Separate playthrough settings, checklists, pins, notes and saved grid builds. Create, duplicate, rename, switch, remove with confirmation, and export/import through the Android document picker or browser. | Up to 12 profiles and 20 grid builds per profile. Imports create a separate profile; switching rolls back on storage failure. ROMs, emulator saves, native file grants and cheat credentials are not exported. |

## How to find them

- **Workspace** is in the main navigation and the full-screen walkthrough. Pin the tools you use most.
- **Goal Plan** is in the FFX navigation. Grid sandbox also opens from Sphere Grid. Battle comparison opens from Status during a battle.
- **Blitzball → Live match** shows the new match view. Optional Follow Game opens it when entering the pool.
- **Challenges** contains the live Butterfly Catcher and Catcher Chocobo panels.
- **Workspace → Cloister guide** opens temple state. In-temple suggestions also link there.
- **FFX-2 → Chapter Checklist → Missing-scene diagnosis and chapter exit check** opens the audit.
- **Setup → Playthrough profiles and backups**, or the profile button in Workspace, manages playthroughs.
- **Setup → Show Cheats → Cheats** exposes the optional AP-sharing control. Hiding Cheats disables it.

## Evidence and implementation references

Addresses below apply only to **SLPS-25088 / 658597E2**. Native readers verify the disc and CRC; field readers also verify the eight-character active script tag and exact ATEL variable declaration types, offsets and array counts. Pointer ranges and final field identity are checked before publishing a frame.

- AP flags: `0x31F894 + character`; active battle byte `0x316F80`. Battle attributes: actor `+0x268`; CTB/default delay and six buff stacks: `+0x31C`. Matching executable disassembly and archived Evrae captures corroborate these fields.
- Field controller: pointer `0x58DF58`; event `field+0x48`; workers `field+0x1C`, stride `0xB58`. Scope-6 data is `event + u32(event+0x20)`. Script tag is at `event + u32(event+0x0C)`.
- Blitzball: HP V42, clock V52/V53, AT/EN/PA/SH/BL/CA/SP V57/59/61/63/65/67/69, carrier V166, roster V173 and base worker V175. Active slots are 0–5 and 8–13. Worker 18's character attachment confirms current possession, rather than retaining the last holder during a pass.
- Butterfly: `mcfr0100` V26/V27 and `mcfr0200` V20/V21 track active/caught. Character shade targets identify visible red/blue roles; fading collected actors disappear from the overlay. Route-coordinate facts are attributed to [FFX_TAS_Python](https://github.com/coderwilson/FFX_TAS_Python).
- Catcher: `nagi0000` mode V116, started V149, player phase V117, balloons V135, birds V137, finish V140 and live/result clock variables.
- Cloisters: `bsyt0100`, `klyt1000`, `djyt0600`, `mcyt0500`, `bvyt1100`, `dome0700`. Sphere attachments use worker `+0x9C` character handles and parent/joint at handle `+0x1A8/+0x1AC`. Exact Besaid rules read the separate door/chamber/treasure phase flags.
- Battle reference arithmetic and compact numerical data derive from [Grayfox96/FFX-RNG-tracker](https://github.com/Grayfox96/FFX-RNG-tracker), with the existing bundled MIT notice. `tools/build-battle-model.py` and `tools/build-battle-oracle.py` reproduce the model data and independent test vectors from a local upstream checkout.
- Existing grid topology, Arena data, Blitzball recruiting research and scene-flag sources retain their existing attribution. This update adds no ROM, save state, executable, game dialogue or extracted script assets to Git.

## Acceptance

The implementation was reviewed by an independent critic: **7.4 → 8.3 / 10 over two review rounds**, excluding missing hardware acceptance. Fixes included legal grid edits, independent imported builds, confirmed Blitzball possession, conservative tackle bounds, AP UI/native reset consistency, and honest battle prediction limits.

Reproducible checks:

```powershell
node --test tests/*.test.cjs
python tools/test-live-readers.py --jdk <JDK-directory> --android <android.jar> --json <org.json.jar>
python tools/test-expansion-ui.py --screenshots
```

The browser harness uses local `build/evrae-opening.json` and `build/ffx2-chapter5.json` replay outputs, never committed save files. Native tests construct synthetic RAM without a ROM. Their assertions test production decoding and write guards, not gameplay behavior. The final APK must still be installed and exercised on the Thor.

Outstanding acceptance: live Blitzball pass/shot/turnover, both Butterfly courses, Catcher finish/restart, sphere removal/insertion in each Cloister, native profile document import/export, and AP awards after victory with sharing both off and on. Preserve a save backup for the optional AP write test. Expand the FFX-2 named-scene catalog and non-Besaid puzzle rules before describing those as exhaustive.
