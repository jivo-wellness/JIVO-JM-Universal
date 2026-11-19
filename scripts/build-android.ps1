[CmdletBinding()]
param(
    [ValidateSet('x86_64', 'arm64-v8a')][string] $Architecture = 'x86_64',
    [switch] $Release,
    [switch] $Bundle,
    # JIVO's own signing key (lives outside every repo). Missing keystore = template debug key + warning.
    [string] $KeystorePath = 'C:\JIVO-keys\jivo-jm-upload.jks',
    [string] $KeyAlias = 'jivo-jm'
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$previousCmake = $env:CMAKE_BUILD_PARALLEL_LEVEL
$previousNode = $env:NODE_ENV
$previousStage = $env:JM_NATIVE_APP_STAGE
# Gradle reads ORG_GRADLE_PROJECT_<name> as project property <name>, so the password never appears on a command line.
$signingPasswordVariables = @('ORG_GRADLE_PROJECT_android.injected.signing.store.password', 'ORG_GRADLE_PROJECT_android.injected.signing.key.password')
$mappedDrive = $null
Push-Location -LiteralPath $project
try {
    if ($Bundle) { $Release = $true }
    if ($Release -and -not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) { throw 'Release builds require the existing JM upload key; debug signing is not allowed.' }
    $googleServices = if ($env:GOOGLE_SERVICES_JSON) { $env:GOOGLE_SERVICES_JSON } else { Join-Path $project 'google-services.json' }
    if ($Release -and -not (Test-Path -LiteralPath $googleServices -PathType Leaf)) { throw 'Android push setup is missing: supply google-services.json for com.jivo.jm or set GOOGLE_SERVICES_JSON before building a release.' }
    $configFiles = @('app.json', 'app.config.js', 'package-lock.json')
    if (Test-Path -LiteralPath $googleServices -PathType Leaf) { $configFiles += (Resolve-Path -LiteralPath $googleServices).Path }
    $configHash = ($configFiles | ForEach-Object { $file = if ([System.IO.Path]::IsPathRooted($_)) { $_ } else { Join-Path $project $_ }; (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash }) -join ':'
    $marker = Join-Path $project 'android/.jm-config-hash'
    $generatedHash = if (Test-Path -LiteralPath $marker) { (Get-Content -LiteralPath $marker -Raw).Trim() } else { '' }
    if (-not (Test-Path -LiteralPath (Join-Path $project 'android/gradlew.bat')) -or $generatedHash -ne $configHash) {
        & npx.cmd expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Set-Content -LiteralPath $marker -Value $configHash -Encoding Ascii
    }
    $env:CMAKE_BUILD_PARALLEL_LEVEL = '1'
    # A release APK bundles the JS (runs without Metro). Both debug and release are signed with JIVO's key when it exists.
    $signingArgs = @()
    if (Test-Path -LiteralPath $KeystorePath -PathType Leaf) {
        $password = $env:JM_ANDROID_KEYSTORE_PASSWORD
        if (-not $password) {
            $passwordFile = [System.IO.Path]::ChangeExtension($KeystorePath, '.password.txt')
            if (-not (Test-Path -LiteralPath $passwordFile -PathType Leaf)) { throw "Keystore $KeystorePath found but no password: set JM_ANDROID_KEYSTORE_PASSWORD or create $passwordFile." }
            $password = (Get-Content -LiteralPath $passwordFile -Raw).Trim()
        }
        foreach ($name in $signingPasswordVariables) { [Environment]::SetEnvironmentVariable($name, $password, 'Process') }
        $password = $null
        $signingArgs = @("-Pandroid.injected.signing.store.file=$((Resolve-Path -LiteralPath $KeystorePath).Path)", "-Pandroid.injected.signing.key.alias=$KeyAlias")
        Write-Output "Signing with $KeystorePath (alias $KeyAlias)."
    } else {
        Write-Warning "Keystore $KeystorePath not found: signing with the public React Native template debug key. Production must NOT trust this build for passkeys / app links."
    }
    $tasks = @(if ($Bundle) { 'app:assembleRelease'; 'app:bundleRelease' } elseif ($Release) { 'app:assembleRelease' } else { 'app:assembleDebug' })
    if ($Release) { $env:NODE_ENV = 'production' } elseif (-not $env:NODE_ENV) { $env:NODE_ENV = 'development' }
    # Generated React Native target names are long even after object hashing.
    # Give only CMake's app staging directory a temporary short drive path.
    foreach ($letter in @('Z', 'Y', 'X', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P')) {
        if (-not (Get-PSDrive -Name $letter -ErrorAction SilentlyContinue)) {
            $candidate = "${letter}:"
            & subst.exe $candidate $project
            if ($LASTEXITCODE -eq 0) { $mappedDrive = $candidate; break }
        }
    }
    if (-not $mappedDrive) { throw 'No free drive letter is available for the temporary native build cache.' }
    $env:JM_NATIVE_APP_STAGE = "$mappedDrive\.native-build"
    Set-Location -LiteralPath (Join-Path $project 'android')
    & .\gradlew.bat @tasks --init-script (Join-Path $PSScriptRoot 'short-cmake-paths.gradle') --no-daemon --no-parallel --max-workers=1 '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=768m' '-Pkotlin.compiler.execution.strategy=in-process' "-PreactNativeArchitectures=$Architecture" -x lint -x test --console=plain @signingArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($Release) { Write-Output 'Built android/app/build/outputs/apk/release/app-release.apk. Install it with adb install -r, or copy it to the phone.' }
    else { Write-Output 'Built android/app/build/outputs/apk/debug/app-debug.apk. Start the emulator, then run npm.cmd run android:launch.' }
    if ($Bundle) { Write-Output 'Built android/app/build/outputs/bundle/release/app-release.aab for Google Play.' }
} finally {
    $env:CMAKE_BUILD_PARALLEL_LEVEL = $previousCmake
    $env:NODE_ENV = $previousNode
    $env:JM_NATIVE_APP_STAGE = $previousStage
    foreach ($name in $signingPasswordVariables) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    Pop-Location
    if ($mappedDrive) { & subst.exe $mappedDrive /D }
}
