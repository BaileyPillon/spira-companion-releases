# 1.39 game-tool correctness review

Ten distinct user-visible defects were reproduced or traced to their rendering and feed paths, then corrected. The ranking weighs incorrect battle or equipment decisions first, followed by tracking continuity and repeated live-screen interaction.

## 1. Battle comparison offered actions to incapacitated characters

With Sleep, Petrify or Confuse active, the comparison still displayed an Attack damage range. It also displayed an item forecast for a Berserk actor. The comparison now explains the current restriction and withholds the damage forecast. Berserk Attack keeps its supported calculation.

The regression `battle forecasts reject commands that the acting character cannot perform` checks all four restrictions and the valid Berserk Attack case. The browser test feeds a sleeping Tidus through the real Battle comparison screen and verifies its message.

## 2. Elemental weapon forecasts skipped Nul protection

A Firestrike weapon aimed at a target with NulBlaze produced a normal damage range. The old guard inspected the command’s built-in elements and missed weapon elements. Both damage and protection checks now derive elements from the same helper. Multiple-element weapons require all corresponding Nul effects before the action is blocked, matching the reference implementation. [RNG tracker hit processing](https://github.com/Grayfox96/FFX-RNG-tracker/blob/main/ffx_rng_tracker/events/character_action.py)

Two regressions cover a single-element strike and a Firestrike/Waterstrike combination with one or both Nul effects. Browser verification targets a party member with NulBlaze using a Firestrike weapon.

## 3. FFX-2 Bestiary kept claiming an old target was current

The Bestiary matched enemy forms against the object saved when Look up was tapped. That object remained after the foe died or the fight ended. It could also preserve old maximum HP and level data. The view now resolves the selected enemy’s seat, identity and name against the current living battle actors. The rendering signature observes death, departure and reference-relevant changes.

The regression checks refreshed stats, battle exit, a different enemy in the same seat and a defeated enemy. Browser verification opens a real Bestiary result from a synthetic battle and confirms its current-target label disappears on the next dead-enemy frame.

## 4. AP optimization tied Double AP with Triple AP

Both abilities scored 20, so an equipped Double AP weapon could beat an available Triple AP upgrade through tie preservation. Overdrive bonuses also scored as ordinary AP improvements. With Overdrive to AP, redundant Double and Triple abilities were added together. The score now uses the strongest AP multiplier and strongest Overdrive multiplier, with the latter applying to conversion setups. [Player discussion of AP multiplier stacking](https://www.reddit.com/r/finalfantasyx/comments/q5ljzw/)

The regression proves Triple AP outranks Double AP, ordinary Overdrive gear gains no AP score, and superseded multipliers add no score. The browser checks that Equipment’s AP optimization shows the Triple AP upgrade.

## 5. Capture optimization recommended keeping a weapon without Capture

If the character owned no Capture weapon, the optimizer retained their equipped weapon as the initial best candidate and displayed Keep. Capture optimization now requires the Capture ability and reports No owned match when no eligible weapon exists.

The regression supplies one equipped non-Capture weapon and confirms the missing match. Browser verification checks the same Equipment view and its no-match feedback.

## 6. FFX-2 optimization excluded a legal spare duplicate accessory

The optimizer discarded any accessory matching the other equipped slot, even when a spare copy was in inventory. FFX-2 permits wearing a pair of the same accessory. The spare-stock check now determines availability. Stat scoring still compares the selected slot’s replacement. [Original PS2 walkthrough describing duplicate accessories](https://gamefaqs.gamespot.com/ps2/562386-final-fantasy-x-2/faqs/26991)

The regression equips one copy in the other slot and supplies one spare. It verifies the stronger duplicate and its Strength delta. Browser verification shows the proposed replacement through Equipment’s Compare accessories control.

## 7. Blitzball break selections leaked into later plays

Selected defender seats cleared only when the carrier’s seat changed while Live match was rendered. They survived a missing match, a rewind or a different player entering the same carrier seat. A possession cycle while another tool was open could also retain them. A guarded feed hook now observes every frame. It clears choices on loss, pause, carrier or roster change, halftime, regressed clock, changed score, and discontinuous timestamps.

Two regressions cover stable-frame preservation and the reset conditions. Browser verification checks a possession cycle while Party is open, match disappearance and a reconnecting feed. Returning to Live match shows no old break choices.

## 8. Butterfly guidance survived the end of its course attempt

The route’s waypoint index remained live when the native course became inactive or its caught count reset in the same room. Starting another attempt could keep guidance near the old finish. Route guidance now tracks the course state and stops when an observed attempt ends or its count rewinds.

The regression covers course end, reset to zero and normal count growth. Browser verification starts guidance and feeds an inactive course in the same room, then confirms the old run is gone.

## 9. FFX-2 accessory controls reset during live updates

The selected optimization goal lived inside a single render, and the disclosure’s open state was discarded. An inventory refresh reverted Magic damage to Physical damage and closed the comparison. Goal, slot and disclosure state now survive refreshes within the session.

The regression rebuilds the view after choosing Magic damage and opening it. The browser repeats the interaction, changes the live spare quantity, and checks that both choices survive.

## 10. No Encounters ignored a reserve wearer

Challenges described equipped No Encounters gear on a reserve character as inventory-only. The summary now recognizes an equipped piece anywhere in the supplied party. This matters while preparing a lightning or butterfly run. [Player confirmation of reserve-party behavior and the underwater-party exception](https://www.reddit.com/r/finalfantasyx/comments/u1mtym/)

The regression places the equipped armor on reserve Lulu. Browser verification opens the lightning challenge and checks the equipped summary.

## Validation

- `node --test tests/review-fixes-1.39.test.cjs` exercises 12 focused regressions.
- `node --test tests/*.test.cjs` includes the existing damage-oracle vectors and other game-tool regressions.
- `python tools/test-review-fixes-ui.py` exercises the regular browser entry points, live refreshes and transitions. It captures Equipment, Battle comparison and Blitzball at 350, 620 and 900 pixels under `build/review-fixes-1.39/`. It requires Playwright and Chrome.
- Impeccable’s detector returned an empty finding list for the changed game-tool modules.
- `git diff --check` passed.

The browser uses synthetic game feeds. On-device gameplay acceptance for these new cases is pending. Equipment scores are heuristic priorities. Battle forecasts continue to expose supported model restrictions in the interface.
