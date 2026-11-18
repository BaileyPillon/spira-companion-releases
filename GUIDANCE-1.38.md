# Spira Companion 1.38: scene instructions and Cloister guidance

**FFX-2 USA:** Chapter Checklist gives every one of the 525 mapped voice flags an instruction through 218 authored route entries. Related flags are grouped when an action plays them together. Expand **Save details** to see which individual bits were recorded. Search by interaction or place, choose an earlier chapter, or hide conditional routes. The audit distinguishes where to trigger a scene from where its recording takes place: the Crimson Records play at Shinra’s station and the CommSphere scenes are viewed aboard the Celsius. The Status prompt on the Celsius counts checks without a known branch prerequisite. An unrecorded bit does not by itself prove a lockout or a completion deficit.

The instructions cross-reference [Sonicshadowsilver2’s retail PS2 flag research](https://github.com/Sonicshadowsilver2/Final-Fantasy-X-2-Coding/wiki/Percentage-Flags) and [Meth962’s independent save analysis](https://gamefaqs.gamespot.com/boards/562386-final-fantasy-x-2/73771254). The project retains its existing 525-entry PS2 USA bit map. Route entries are original action summaries and do not ship the original dialogue.

**FFX International:** Open **Cloister guide** from Workspace or select the in-temple tip. The next instruction updates from your puzzle state. You can still open the imported offline walkthrough directly at the matching temple.

| Cloister | Signals and guided route |
| --- | --- |
| Besaid | Door and glyph phases, sphere in hand, pedestal and recess state. Guides the entry and chamber on a fresh visit or revisit, the Rod of Wisdom detour and the final pedestal. |
| Kilika | Distinguishes three ordinary spheres, Glyph and Destruction. Watches both burning doors and the actual settled pedestal location. Guides the side recesses, fire switch, Red Armlet and exit. |
| Djose | Separates the entry door, live charged sphere, floating platform and far pedestal, elevator, five upper pedestals and the Destruction alcove. Guides the Magic Sphere and exit. |
| Macalania | Reads the pedestal’s current slide/recall stage, ramp, ice stop and each bridge section. Guides the Luck Sphere exchange and rebuilding the bridge after the treasure. |
| Bevelle | Reads the location of each sphere, both pedestal sockets, and the track and exit bridges. Distinguishes the Glyph Sphere’s purple corridor socket from the Destruction Sphere’s exit switch. Includes the optional Knight Lance path. |
| Zanarkand | Distinguishes the story monitor patterns from the post-airship white squares. Shows the tile sets, live count, sphere pedestal route, and Magistral Rod. Tidus’s marker uses his live world position while he is in the diagram. |

Puzzle steps were cross-checked against [Jegged’s Cloisters reference](https://jegged.com/Games/Final-Fantasy-X/Cloisters/) and traced through event scripts. The native reader is gated on the International disc/CRC, the active script tag, and the expected field variable declarations. It declines contradictory or transitional sphere states. If the player takes an unusual route the current step may need to be reconciled using the displayed recesses and the walkthrough.

| Reader | Verified script fields |
| --- | --- |
| `bsyt0100` | V37 held; V38–46 recesses; V48–52 door/hidden chamber/pedestal/treasure phases. |
| `klyt1000` | V24–34 spheres; V35 burned door stage; worker 6 position confirms the pedestal drop. |
| `djyt0600` | V40 held; V41–52 recesses; V75–77 platform/pedestal/elevator; V80–87 upper and treasure progress. |
| `mcyt0500` | V31–39 held/recesses; V46 pedestal mode; V54/56/58 ice stop, lifted floor and recorded bridge milestone. Current bridge uses V34/V35/V39 and V46 together. |
| `bvyt1100` | V32/33 bridges, V36 Knight Lance chest, and V43 sphere locations. Slot 1 is Tidus’s hand. The reader checks for duplicate sphere locations and occupied slots. |
| `dome0700` | V8 phase; V9–14 held and recesses; V15 overall solved; V17/V19 story tile counts; V24 white count, where 8 signals all seven lit. |

## Gameplay validation

- A separate PCSX2 instance used the International PS2 disc and checkpoints from [HippyJ3’s community memory card](https://hippyj3.blogspot.com/2019/09/pcsx2-full-save-collection-final.html). Bevelle was entered from Priests’ Passage. Test copies of the other checkpoints set the room and spawn for initial reads. All six readers returned their live puzzle states.
- At Bevelle, taking a sphere previously made the live guidance disappear. Version 1.38.1 follows the sphere table through the pickup. On the Thor, returning the sphere to its source brought the pickup step back. Kilika’s entrance pickup advanced to the first door in PCSX2.
- A Zanarkand story save made after the puzzle now resumes at the Spectral Keeper objective, even when the local script counters reset. In PCSX2 the first tile advanced the counter to 1/5. The visible gold marker followed Tidus on the Thor with no general field map. The next action and tile diagram appear above the reference controls.
- The Thor’s FFX-2 USA Chapter 5 save reported **127 of 136 Chapter 5 flags** and opened the missing Crimson Record instructions. The owner’s FFX checkpoint was restored after each Thor test.
- In an isolated copy of the FFX-2 USA Chapter 5 save, the live battle feed tracked a Jahi’s HP from 2,033 to 1,151 after an attack and Yuna’s HP from 2,163 to 1,896 after retaliation.

Full start-to-finish routes and treasure pickups for all six temples, and a Crimson Record becoming recorded after playback, remain separate gameplay verification cases.
