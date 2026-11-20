<h1 align="center"><img src="docs/images/spira-companion.png" width="72" height="72" align="middle" alt="Yuna holding her summoner’s staff"> Spira Companion</h1>

<p align="center">Play <strong>Final Fantasy X International</strong> or <strong>Final Fantasy X-2 USA</strong> on the AYN Thor’s top screen. Follow your party, map and next objective on the bottom one.</p>

<p align="center"><strong><a href="https://github.com/BaileyPillon/spira-companion-releases/releases/latest/download/SpiraCompanion.apk">Download Android APK</a></strong> &nbsp;·&nbsp; <strong><a href="app/">Browse source code</a></strong> &nbsp;·&nbsp; <a href="docs/player-guide.md">Player guide</a></p>

<p align="center"><a href="https://github.com/BaileyPillon/spira-companion-releases/releases/latest">Release notes &amp; checksums</a> &nbsp;·&nbsp; <a href="https://github.com/BaileyPillon/spira-companion-releases/releases/latest/download/SpiraCompanion-source.zip">Download source ZIP</a> &nbsp;·&nbsp; <a href="docs/build.md">Build from source</a></p>

<picture>
  <source media="(max-width: 640px)" srcset="docs/images/zanarkand-mobile.webp">
  <img src="docs/images/zanarkand-wide.webp" width="960" alt="Two AYN Thor displays at the same moment. Tidus faces the puzzle monitor in Zanarkand on the top screen. On the bottom screen, a gold dot marks his position on the tile diagram, with one of five tiles activated.">
</picture>

*Zanarkand Cloister, captured on the Thor. The gold dot follows Tidus as you move.* [Game screen](docs/images/zanarkand-top.webp) · [Companion screen](docs/images/zanarkand-guide.webp)

## What’s new in 1.44.0

| While playing | Open this on the lower screen |
| --- | --- |
| You have time to finish one Arena region | **Monster Arena → Capture atlas** ranks regions by remaining catches. Tap a missing fiend for its hunting spots. |
| You’re deciding who to train or recruit | In **FFX-2 Equipment**, compare dressphere mastery across all three characters. In **FFX Blitzball**, try a substitute and compare the stats for that position. |
| You’re coming back to a save | **Journal** keeps your checkpoint note and last 24 area changes. **Page index** finds a section in the current tool or imported guide, and **Back** returns to your place. |

[See the four screens](docs/images/field-index-1.44.webp) · [Changes by section](docs/research-1.44.md) · [Release history](https://github.com/BaileyPillon/spira-companion-releases/releases)

## Set up your Thor

Start with your own supported PS2 game in **ARMSX2** and its game entry in **Cocoon**. [Check your disc version](#supported-ps2-versions)

1. **Install Spira.** Open the [APK](https://github.com/BaileyPillon/spira-companion-releases/releases/latest/download/SpiraCompanion.apk) on your Thor.
2. **Connect the emulator.** In ARMSX2 settings, turn on **Enable PINE** and leave the port at **28011**.
3. **Pair the screens.** In Cocoon, edit the game entry, choose **Spira Companion** under **Companion App**, and save with the check mark. Launch the game from Cocoon and load a save.

Open **Status** on the bottom screen. **Live** means Spira is reading the game. It works locally, including after you unplug the Thor. [Help with connection messages](docs/player-guide.md#connection-help)

## Final Fantasy X

- **Prepare for a boss with the gear you own.** Boss Prep compares your party’s equipment and lists materials for upgrades. In battle, Status shows the next 16 turns, your target’s HP and the Overkill threshold.
- **Pick up where you left off.** The map follows your position. Cloister guides use the current puzzle state in all six temples. If you own the compatible offline Jegged export, the full-screen reader can follow your walkthrough too.
- **Track a longer run.** Pin a missing Monster Arena capture, find its hunting area, plan a Sphere Grid route or see when a Blitzball contract expires.

[FFX tools and walkthrough setup →](docs/player-guide.md#final-fantasy-x)

## Final Fantasy X-2

The **Chapter Checklist** can take you from a missing scene to the place you need to visit. In the Chapter 5 save below, Spira found an unrecorded Crimson Record scene and pointed to Shinra’s station on the Celsius. Branch-specific scenes are marked in the checklist.

<details>
<summary>View the Chapter 5 checklist on the Thor</summary>

<a href="docs/images/chapter-checklist.webp"><img src="docs/images/chapter-checklist.webp" width="460" alt="FFX-2 Chapter 5 checklist showing 127 of 136 flags recorded and directions for watching Crimson Records at Shinra’s station."></a>

*Bikanel Oasis is where the first recording takes place. To watch it, open Treasure Spheres at Shinra’s station aboard the Celsius.*

</details>

- **Plan jobs and spherechanges.** Track dressphere pickup deadlines and ability AP, then find a route through the colored gates on a Garment Grid.
- **Read a fight.** Follow party and enemy HP/MP, selected targets, current dresspheres and active effects.
- **Finish the fiend list.** Check Oversouls by Via Infinito floor and see which Blue Bullets each character still needs.

[FFX-2 tools and chapter guidance →](docs/player-guide.md#final-fantasy-x-2)

## Supported PS2 versions

| Game | Disc serial | CRC | Support |
| --- | --- | --- | --- |
| FFX International | `SLPS-25088` | `658597E2` | Primary |
| FFX-2 USA | `SLUS-20672` | `48FE0C71` | Primary |
| FFX-2 International | `SLPM-65478` | `E1FD9A2D` | Limited support, checked with an opening save |

Spira matches both values. Patched discs can report a different CRC. Tracking is read-only by default. [Optional settings](docs/player-guide.md#connection-help)

## Source code

| Component | Where to start |
| --- | --- |
| Android app | [Main activity](app/src/MainActivity.java) and [PINE emulator reader](app/src/Ps2Feed.java) |
| Lower-screen interface | [JavaScript entry point](app/assets/spira.js) and [game-specific tools](app/assets/) |
| Optional Steam HD Remaster support | [Windows bridge source](bridge/) and [bridge setup](INSTALL.md#optional-steam-bridge) |
| Tests and tooling | [Logic tests](tests/), [browser and native harnesses](tools/) and [validation history](THOR-VALIDATION.md) |

[Build from source](docs/build.md) · [Contribute a change](CONTRIBUTING.md) · [View test runs](https://github.com/BaileyPillon/spira-companion-releases/actions/workflows/tests.yml)

Spira’s original code is available under the [MIT License](LICENSE). The bundled reference data and third-party components retain their [upstream notices](docs/player-guide.md#credits). Final Fantasy names and artwork belong to their respective owners.

## Feedback

[Report a gameplay or setup problem](https://github.com/BaileyPillon/spira-companion-releases/issues/new?template=gameplay-report.yml) · [Request a feature](https://github.com/BaileyPillon/spira-companion-releases/issues/new?template=feature-request.yml)

Spira is an unofficial fan project inspired by the [FFXII Thor Companion](https://github.com/Cybranfox/ffxii-thor-companion). Third-party license notices are included in the APK. [Credits](docs/player-guide.md#credits)
