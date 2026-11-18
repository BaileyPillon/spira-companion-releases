# Build Spira Companion

The Android app uses a Java activity, a PINE reader and an HTML/JavaScript interface in a WebView. The repository includes the generated game tables, so you can build the APK and run the regression tests from a fresh clone.

```powershell
git clone https://github.com/BaileyPillon/spira-companion-releases.git
cd spira-companion-releases
```

## Build the APK on Windows

Install PowerShell 7, JDK 21, Android SDK Platform 35 and Android SDK Build-Tools 35.0.0. Open PowerShell 7 in the repository and substitute your installed paths.

```powershell
$jdk = 'C:\Tools\jdk-21'
$sdk = 'C:\Android\Sdk'
.\build.ps1 -AndroidOnly -Jdk $jdk `
  -AndroidJar "$sdk\platforms\android-35\android.jar" `
  -BuildTools "$sdk\build-tools\35.0.0"
```

The APK is written to `dist/SpiraCompanion.apk`. The first build generates a local development key in `build/`. Keep that key to install updates over your own builds. Android requires matching signing certificates for updates, so use a separate device or emulator to test a local build alongside an existing release installation.

For the optional Windows bridge, install Visual Studio C++ desktop build tools with x86 support and run the same command without `-AndroidOnly`. The build also produces `dist/SpiraBridge.exe`.

To sign with your own PKCS12 keystore, supply `-Keystore` and `-KeyAlias` and set `SPIRA_KEYSTORE_PASSWORD` in the build environment.

## Run the tests

- **Game logic.** With Node.js 22 or newer, run `node --test tests/*.test.cjs`.
- **Emulator reads and guarded writes.** On Windows, use the JDK and SDK paths above plus a local [org.json JAR](https://central.sonatype.com/artifact/org.json/json/20240303). Run `python tools/test-live-readers.py --jdk "$jdk" --android "$sdk\platforms\android-35\android.jar" --json "<path-to-json.jar>"`. The harness runs a simulated PINE server on local port 28011.
- **Browser interface.** Install Google Chrome and the [Python Playwright package](https://playwright.dev/python/docs/library). Run `python tools/test-expansion-ui.py`. The default fixtures exercise both games without a game save. To supply your own recorded JSON frames, pass `--ffx-frame` and `--x2-frame`.

For tested disc versions, emulator settings and the optional Steam bridge, see the [installation guide](../INSTALL.md). The [validation notes](../THOR-VALIDATION.md) distinguish device tests from capture replays.

For the 1.39 gameplay fixes, run `python tools/test-review-fixes-ui.py` with the same Chrome and Playwright setup. The main browser suite also exercises the farming ledger, chapter bookmarks and the other planning tools.

## Icon artwork

The [Yuna portrait](images/spira-companion.png) is the source image for the GitHub README, Android launcher and companion header. From the repository root, run `pwsh -File tools/export-icon.ps1` with FFmpeg on your PATH to regenerate the bundled WebP images. Both Android launcher modes use the same crop. The themed version preserves the staff petals and facial features in the alpha channel so the launcher can tint them.

<details>
<summary>Illustration prompt (OpenAI ImageGen)</summary>

Design one polished square illustrated launcher emblem for the fan-made Spira Companion. Make Yuna from Final Fantasy X instantly recognizable: tight three-quarter bust, chestnut asymmetrical bob with swept bangs and the long blue bead-and-gold earring on her right ear, calm and determined gaze, white crossed summoner collar, dark camisole, just a trace of lilac. Beside her face, show her iconic royal-blue summoner staff and unmistakable large openwork golden flower-wheel head, its scalloped petal lobes and red center clear in silhouette. Compose as one extremely clear circular movement, with Yuna and staff overlapping, the face and crown centered; use a small ivory gull-wing shape formed by the trailing sleeve to suggest X-2. A few coral / aqua pyrefly accents only if they strengthen the silhouette. Elegant Japanese console-RPG collector pin illustration, crisp hand-inked contours, bold flat cel-shaded shapes, midnight indigo shadow, warm bone-white, saffron gold, and tropical turquoise. Use a substantial outer silhouette, high contrast on very dark teal #132C34. Make head and staff crown large relative to the rest: immediate recognition at 32px; minimal fine lines. A single tight foreground cutout with a sculpted lower contour that feels complete, no square crop through the shoulders, 6% transparent clearance on all sides. Genuine transparent background, no enclosing tile, no medallion rim, no letters, words, watermark or official wordmarks. Deliver just the finished 1:1 artwork, no mockup or presentation sheet.

</details>

## Package the source for a release

From the tagged release, run `git archive --format=zip --prefix=SpiraCompanion-source/ -o dist/SpiraCompanion-source.zip HEAD`. Attach that ZIP to the GitHub release alongside the APK. The README’s source download points to the latest release asset with that filename.
