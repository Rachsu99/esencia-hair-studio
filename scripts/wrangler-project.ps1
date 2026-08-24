[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $WranglerArguments
)

$ErrorActionPreference = 'Stop'

if (-not $WranglerArguments -or $WranglerArguments.Count -eq 0) {
    throw 'Provide a Wrangler command, for example: .\scripts\wrangler-project.ps1 whoami'
}

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$WrapperPath = Join-Path $ProjectRoot 'scripts\wrangler-project.mjs'
$NodeCandidates = @(
    (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    'C:\Program Files\nodejs\node.exe',
    'C:\Users\Nico\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$NodePath = $NodeCandidates | Select-Object -First 1

if (-not $NodePath) {
    throw 'Node.js could not be found. Install Node.js 22 or run this command through Codex.'
}

& $NodePath $WrapperPath @WranglerArguments
exit $LASTEXITCODE
