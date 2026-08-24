$ErrorActionPreference = 'Stop'

$ExpectedAccountId = '9997b3a7d9f144f03c921aaef9c0d53d'
$ExpectedProjectRoot = 'C:\Users\Nico\Documents\Esencia Hair Studio'
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$EnvPath = Join-Path $ProjectRoot '.env'
$WranglerPath = Join-Path $ProjectRoot 'node_modules\wrangler\bin\wrangler.js'
$NodeCandidates = @(
    (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    'C:\Program Files\nodejs\node.exe',
    'C:\Users\Nico\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$NodePath = $NodeCandidates | Select-Object -First 1

if ($ProjectRoot -ne $ExpectedProjectRoot) { throw "Wrong project directory. Expected $ExpectedProjectRoot but found $ProjectRoot" }
if (-not (Test-Path -LiteralPath $WranglerPath)) { throw 'Local Wrangler is missing. Run npm install from the Esencia repository root first.' }
if (-not $NodePath) { throw 'Node.js could not be found. Install Node.js 22 or run this task through Codex.' }

& git -C $ProjectRoot check-ignore --quiet .env
if ($LASTEXITCODE -ne 0) { throw '.env is not ignored by Git. Refusing to store the Cloudflare token.' }

$SecureToken = Read-Host 'Paste the Esencia-only Cloudflare API token' -AsSecureString
$TokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
$PreviousAccountId = $env:CLOUDFLARE_ACCOUNT_ID
$PreviousApiToken = $env:CLOUDFLARE_API_TOKEN

try {
    $PlainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPointer)
    if ([string]::IsNullOrWhiteSpace($PlainToken)) { throw 'No token was entered.' }
    $env:CLOUDFLARE_ACCOUNT_ID = $ExpectedAccountId
    $env:CLOUDFLARE_API_TOKEN = $PlainToken
    $IdentityOutput = (& $NodePath $WranglerPath whoami 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0 -or $IdentityOutput -notmatch [regex]::Escape($ExpectedAccountId)) {
        throw "Token verification failed or returned another Cloudflare account. No .env file was written.`n$IdentityOutput"
    }
    $Contents = @(
        '# Esencia-only Wrangler authentication. Never commit or share this file.'
        "CLOUDFLARE_ACCOUNT_ID=$ExpectedAccountId"
        "CLOUDFLARE_API_TOKEN=$PlainToken"
        ''
    ) -join "`r`n"
    [IO.File]::WriteAllText($EnvPath, $Contents, [Text.UTF8Encoding]::new($false))
    Write-Output "Esencia Cloudflare authentication verified for account $ExpectedAccountId."
    Write-Output 'The token was saved only to the Git-ignored project-local .env file.'
}
finally {
    if ($null -eq $PreviousAccountId) { Remove-Item Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue } else { $env:CLOUDFLARE_ACCOUNT_ID = $PreviousAccountId }
    if ($null -eq $PreviousApiToken) { Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue } else { $env:CLOUDFLARE_API_TOKEN = $PreviousApiToken }
    if ($TokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPointer) }
    $PlainToken = $null
}
