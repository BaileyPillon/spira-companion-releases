# Live Coach and Follow Game

The gap in Spira was the path between its tools. A player could have an available Mix, an Arena target and a nearby collectible, but still had to decide which tab to inspect. Version 1.36 changes the default Status workflow around a leading action, the evidence for it and a direct link to its detail.

## What changed

- **Prioritized coaching:** usable recovery items, supported boss tactics, Capture opportunities, location-aware pickup alerts, Blitzball rewards and chapter guidance compete for the leading position. Urgent recovery and irreversible pickup deadlines outrank the chosen session focus. FFX focus choices are Story, Arena captures, Blitzball and Completion. FFX-2 gets recovery, dressphere deadline and chapter recommendations.
- **Less repeated advice:** a promoted story hint is not repeated below it. Story-boss details collapse beneath the live turn forecast, keeping boss HP visible and exposing their reference and preparation controls on demand.
- **Optional automatic navigation:** Follow Game brings up Status for a battle, Team Builder for an FFX Blitzball menu, and Techniques in the pool. It returns to the previous view after a stable field transition, preserving a previous Blitzball subview and the guide's full-screen state. It does not change game inputs, equipment, rosters or saves.
- **Control stays with the player:** Follow Game defaults off. Manual tab/subview choices cancel its return. Paused guide following, current reading/input, Setup and Cheats prevent takeovers. Return early or choose Stay here. Feed gaps, pauses, disc changes and detectable save rewinds discard automatic return state.
- **Shared battle-tip correction:** recovery suggestions preserve Zombie protection during Yunalesca, including inside the details opened from the coach. They can still suggest a specific poison cure without substituting Remedy. Evrae's party-heal tip checks for living zombified allies.

## Boundaries

This is explicit prioritization over the companion's existing data and supported encounter advice. It does not infer hidden enemy intent or calculate the optimal move for every battle. A recommendation can be a reference tactic when the game does not expose its trigger. The reason text remains visible, and users can dismiss the current tip. Dismissals are session-local and battle-specific; a later fight or detected save rewind can raise a warning again.

Follow Game confirms changes using distinct feed frames spanning at least 1.2 seconds. Recent local interaction takes priority for 1.8 seconds. A paused or manually browsed guide is respected even after the reading timer expires. FFX-2 uses battle transitions only; its Blitzball system is different. An undetected same-disc save replacement with indistinguishable counters cannot be identified with certainty.

## Verification

95 regression tests pass. Browser checks at 350, 620 and 900 pixels exercise archived Thor frames and scripted transitions; targeted checks cover reading, cancellation, feed interruption, same-tab restoration and shared recovery behavior. A controlled offline-guide iframe fixture retained its instance, scroll offset and full-screen state through a battle detour. The actual imported walkthrough and device gameplay still need verification on the Thor, which was disconnected. The independent critic scored the revised change 8.6/10 after two rounds. See [the complete validation record](THOR-VALIDATION.md).
