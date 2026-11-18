[CmdletBinding()]
param(
    [string] $KeystorePath = 'C:\JIVO-keys\jivo-jm-upload.jks',
    [string] $KeyAlias = 'jivo-jm'
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$target = Join-Path $project 'credentials.json'
if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) {
    throw 'Existing JM upload keystore is required. Do not generate a replacement key for an existing Play app.'
}
if (Test-Path -LiteralPath $target) { throw 'credentials.json already exists. Preserve it and verify its signing identity before building.' }
$password = $env:JM_ANDROID_KEYSTORE_PASSWORD
if (-not $password) {
    $passwordFile = [System.IO.Path]::ChangeExtension($KeystorePath, '.password.txt')
    $password = (Get-Content -LiteralPath $passwordFile -Raw).Trim()
}
if (-not $password) { throw 'The keystore password is missing.' }
$credentials = @{ android = @{ keystore = @{
    keystorePath = (Resolve-Path -LiteralPath $KeystorePath).Path
    keystorePassword = $password
    keyAlias = $KeyAlias
    keyPassword = $password
} } }
try {
    # Protect the empty file before writing any secrets. EAS uploads these to sign the build.
    [System.IO.File]::WriteAllText($target, '')
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $target /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict credentials file access.' }
    [System.IO.File]::WriteAllText($target, ($credentials | ConvertTo-Json -Depth 5))
    Write-Output 'Prepared ignored credentials.json using the existing JM upload key. No passwords were printed.'
} catch {
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target }
    throw
} finally { $password = $null; $credentials = $null }
