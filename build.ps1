param(
    [Parameter(Mandatory = $true)][string]$AndroidJar,
    [Parameter(Mandatory = $true)][string]$BuildTools,
    [Parameter(Mandatory = $true)][string]$Jdk,
    [string]$VcVars32,
    [string]$Keystore,
    [string]$KeyAlias,
    [switch]$AndroidOnly
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$root = $PSScriptRoot
$work = Join-Path $root 'build'
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $work,$dist | Out-Null
$AndroidJar = (Resolve-Path -LiteralPath $AndroidJar).Path
$BuildTools = (Resolve-Path -LiteralPath $BuildTools).Path
$Jdk = (Resolve-Path -LiteralPath $Jdk).Path
if ($Keystore -or $KeyAlias) {
    if (!$Keystore -or !$KeyAlias -or !$env:SPIRA_KEYSTORE_PASSWORD) {
        throw 'Custom signing requires -Keystore, -KeyAlias and the SPIRA_KEYSTORE_PASSWORD environment variable.'
    }
    $Keystore = (Resolve-Path -LiteralPath $Keystore).Path
}

if (!$AndroidOnly -and !$VcVars32) {
    $vswhere = Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Microsoft Visual Studio\Installer\vswhere.exe'
    $install = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (!$install) { throw 'Install the Visual Studio C++ desktop build tools or provide -VcVars32.' }
    $VcVars32 = Join-Path $install 'VC\Auxiliary\Build\vcvars32.bat'
}
if (!$AndroidOnly) { $VcVars32 = (Resolve-Path -LiteralPath $VcVars32).Path }
$priorJava = $env:JAVA_HOME
$priorVcVars = $env:SPIRA_VCVARS
$priorSource = $env:SPIRA_BRIDGE_CPP
$stage = Join-Path $work ('package-' + [guid]::NewGuid().ToString('N'))
$keepStage = $false
New-Item -ItemType Directory -Path $stage | Out-Null
Push-Location -LiteralPath $stage
try {
    # Builds share the signing key and the names in dist. Keep one publisher
    # at a time so the archive and checksum always describe the same run.
    $buildLock = [IO.File]::Open((Join-Path $work 'package.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    # Replay and test tools also produce .class files under build. Only compile
    # production sources into this package, even on a reused checkout.
    $classes = New-Item -ItemType Directory -Name classes
    $dex = New-Item -ItemType Directory -Name dex
    $env:JAVA_HOME = $Jdk
    if (!$AndroidOnly) {
        $env:SPIRA_VCVARS = $VcVars32
        $env:SPIRA_BRIDGE_CPP = Join-Path $root 'bridge/bridge.cpp'
        & cmd.exe /d /c 'call "%SPIRA_VCVARS%" >nul && cl /nologo /std:c++17 /EHsc /O2 /MT /W4 /DUNICODE /D_UNICODE /Fo"bridge.obj" /Fe"SpiraBridge.exe" "%SPIRA_BRIDGE_CPP%" user32.lib /link /SUBSYSTEM:WINDOWS /ENTRY:wmainCRTStartup'
    }
    & "$BuildTools\aapt2.exe" compile --dir "$root/app/res" -o resources.zip
    & "$BuildTools\aapt2.exe" link -o base.apk -I $AndroidJar --manifest "$root/app/AndroidManifest.xml" resources.zip
    & "$Jdk\bin\javac.exe" -source 11 -target 11 -Xlint:-options -encoding UTF-8 -cp $AndroidJar -d $classes.FullName "$root/app/src/MainActivity.java" "$root/app/src/Ps2Feed.java"
    & "$Jdk\bin\jar.exe" cf classes.jar -C $classes.FullName .
    & "$BuildTools\d8.bat" --release --min-api 30 --lib $AndroidJar --output $dex.FullName classes.jar
    & "$Jdk\bin\jar.exe" uf base.apk -C $dex.FullName classes.dex -C "$root/app" assets -C $root LICENSE
    & "$BuildTools\zipalign.exe" -f 4 base.apk aligned.apk
    if ($Keystore) {
        $passwordSource = 'env:SPIRA_KEYSTORE_PASSWORD'
    } else {
        # A local development certificate lets contributors install and update their own builds.
        $Keystore = Join-Path $work 'spira-debug.p12'
        $KeyAlias = 'androiddebugkey'
        $passwordSource = 'pass:android'
        if (!(Test-Path -LiteralPath $Keystore)) {
            & "$Jdk\bin\keytool.exe" -genkeypair -storetype PKCS12 -keystore $Keystore -storepass android -alias $KeyAlias -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Android Debug'
        }
    }
    & "$BuildTools\apksigner.bat" sign --ks $Keystore --ks-pass $passwordSource --ks-key-alias $KeyAlias --out SpiraCompanion.apk aligned.apk
    & "$BuildTools\apksigner.bat" verify --verbose SpiraCompanion.apk

    [xml]$manifest = Get-Content -Raw -LiteralPath "$root/app/AndroidManifest.xml"
    $version = $manifest.DocumentElement.GetAttribute('versionName', 'http://schemas.android.com/apk/res/android')
    $archive = "SpiraCompanion-$version.zip"
    $package = @("$stage/SpiraCompanion.apk","$root/LICENSE","$root/INSTALL.md","$root/THOR-VALIDATION.md","$root/EXPANSION-1.37.md","$root/GUIDANCE-1.38.md")
    if (!$AndroidOnly) { $package += "$stage/SpiraBridge.exe" }
    Compress-Archive -LiteralPath $package -DestinationPath $archive
    $artifacts = @('SpiraCompanion.apk', $archive)
    if (!$AndroidOnly) { $artifacts += 'SpiraBridge.exe' }
    $hashes = foreach ($file in $artifacts) {
        (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $file
    }
    $hashes | Set-Content -LiteralPath SHA256SUMS.txt -Encoding ascii
    $published = [Collections.Generic.Stack[string]]::new()
    try {
        foreach ($file in ($artifacts + 'SHA256SUMS.txt')) {
            $source = Join-Path $stage $file
            $destination = Join-Path $dist $file
            if ([IO.File]::Exists($destination)) {
                [IO.File]::Replace($source, $destination, "$source.previous")
            } else {
                [IO.File]::Move($source, $destination)
            }
            $published.Push($file)
        }
    } catch {
        $publishError = $_
        $keepStage = $true
        while ($published.Count -gt 0) {
            $file = $published.Pop()
            $source = Join-Path $stage $file
            $destination = Join-Path $dist $file
            if ([IO.File]::Exists("$source.previous")) {
                [IO.File]::Move("$source.previous", $destination, $true)
            } else {
                [IO.File]::Move($destination, $source)
            }
        }
        $keepStage = $false
        throw $publishError
    }
} finally {
    if ($buildLock) { $buildLock.Dispose() }
    Pop-Location
    $env:JAVA_HOME = $priorJava
    $env:SPIRA_VCVARS = $priorVcVars
    $env:SPIRA_BRIDGE_CPP = $priorSource
    $stagePath = (Resolve-Path -LiteralPath $stage).Path
    if (!$keepStage -and (Split-Path -Parent $stagePath) -eq (Resolve-Path -LiteralPath $work).Path -and (Split-Path -Leaf $stagePath) -match '^package-[a-f0-9]{32}$') {
        Remove-Item -LiteralPath $stagePath -Recurse -Force
    }
}
