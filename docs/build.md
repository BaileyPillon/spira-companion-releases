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

## Package the source for a release

From the tagged release, run `git archive --format=zip --prefix=SpiraCompanion-source/ -o dist/SpiraCompanion-source.zip HEAD`. Attach that ZIP to the GitHub release alongside the APK. The README’s source download points to the latest release asset with that filename.
