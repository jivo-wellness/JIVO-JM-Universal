[CmdletBinding()]
param([ValidateSet('x86_64', 'arm64-v8a')][string] $Architecture = 'x86_64', [switch] $Release)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$previousCmake = $env:CMAKE_BUILD_PARALLEL_LEVEL
$previousNode = $env:NODE_ENV
$previousStage = $env:JM_NATIVE_APP_STAGE
$mappedDrive = $null
Push-Location -LiteralPath $project
try {
    $configHash = (@('app.json', 'package-lock.json') | ForEach-Object { (Get-FileHash -LiteralPath (Join-Path $project $_) -Algorithm SHA256).Hash }) -join ':'
    $marker = Join-Path $project 'android/.jm-config-hash'
    $generatedHash = if (Test-Path -LiteralPath $marker) { (Get-Content -LiteralPath $marker -Raw).Trim() } else { '' }
    if (-not (Test-Path -LiteralPath (Join-Path $project 'android/gradlew.bat')) -or $generatedHash -ne $configHash) {
        & npx.cmd expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Set-Content -LiteralPath $marker -Value $configHash -Encoding Ascii
    }
    $env:CMAKE_BUILD_PARALLEL_LEVEL = '1'
    # A release APK bundles the JS (runs without Metro) and is signed with the template's debug key: for device tests, not the store.
    $task = if ($Release) { 'app:assembleRelease' } else { 'app:assembleDebug' }
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
    & .\gradlew.bat $task --init-script (Join-Path $PSScriptRoot 'short-cmake-paths.gradle') --no-daemon --no-parallel --max-workers=1 '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=768m' '-Pkotlin.compiler.execution.strategy=in-process' "-PreactNativeArchitectures=$Architecture" -x lint -x test --console=plain
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($Release) { Write-Output 'Built android/app/build/outputs/apk/release/app-release.apk. Install it with adb install -r, or copy it to the phone.' }
    else { Write-Output 'Built android/app/build/outputs/apk/debug/app-debug.apk. Start the emulator, then run npm.cmd run android:launch.' }
} finally {
    $env:CMAKE_BUILD_PARALLEL_LEVEL = $previousCmake
    $env:NODE_ENV = $previousNode
    $env:JM_NATIVE_APP_STAGE = $previousStage
    Pop-Location
    if ($mappedDrive) { & subst.exe $mappedDrive /D }
}
