# Contributing to Spira Companion

A good gameplay report gives someone else enough information to reach the same spot and compare the two screens. A good code change can often be checked with a small fixture before anyone needs a Thor.

## Report a problem

Include the Spira version, game edition and the area, chapter or fight. Describe the last few steps, what happened on the top screen and what the companion showed below. For connection problems, include the status message and, when available, the disc serial and CRC shown in Setup. [Gameplay report](https://github.com/BaileyPillon/spira-companion-releases/issues/new?template=gameplay-report.yml)

For a feature idea, describe the decision you want to make while playing and which lower-screen tool you would expect to help. [Feature request](https://github.com/BaileyPillon/spira-companion-releases/issues/new?template=feature-request.yml)

## Work on the code

| Change | Start here |
| --- | --- |
| Emulator connection, frame reads or guarded writes | [Android reader](app/src/Ps2Feed.java) |
| Android lifecycle, guide import or device integration | [Main activity](app/src/MainActivity.java) |
| Navigation, rendering or a game-specific tool | [Companion interface](app/assets/) |
| Optional Steam bridge | [Windows bridge](bridge/) |
| Player instructions | [Player guide](docs/player-guide.md) |

Fork the repository, create a branch from `main`, and make the change there. The JavaScript suite runs with Node.js 22 or newer and uses the built-in test runner.

```sh
node --test tests/*.test.cjs
```

To check a change on the lower screen, run the browser suite with its built-in fixtures. The build guide lists the Chrome and Python requirements, native reader tests and Android packaging steps. [Build and test instructions](docs/build.md)

## Open a pull request

Describe the player-visible change and how you checked it. For game data, include its source and edition. For layout changes, a before-and-after at **620 × 465** helps reviewers see what fits on the Thor. Say whether your result came from a fixture, recorded gameplay or a live device. Keep ROMs, BIOS files, private game saves and signing keys out of submissions.
