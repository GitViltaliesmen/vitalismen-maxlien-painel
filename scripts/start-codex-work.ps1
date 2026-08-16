[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$expectedRoot = 'C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$expectedRootNormalized = [System.IO.Path]::GetFullPath($expectedRoot).TrimEnd('\', '/')
$statusScript = Join-Path $PSScriptRoot 'codex-status.ps1'
$markerPath = Join-Path $projectRoot '.vitalismen-official-root'

$rootMatches = [string]::Equals(
    $projectRoot,
    $expectedRootNormalized,
    [System.StringComparison]::OrdinalIgnoreCase
)

if (-not $rootMatches) {
    Write-Host "RISCO CRITICO: raiz incorreta: $projectRoot" -ForegroundColor Red
    Write-Host "Raiz oficial: $expectedRootNormalized" -ForegroundColor Yellow
    exit 2
}

if (-not (Test-Path -LiteralPath $markerPath)) {
    Write-Host "RISCO CRITICO: marcador oficial ausente: $markerPath" -ForegroundColor Red
    exit 2
}

if (-not (Test-Path -LiteralPath $statusScript)) {
    Write-Host "RISCO CRITICO: diagnostico ausente: $statusScript" -ForegroundColor Red
    exit 2
}

& $statusScript
$statusExit = $LASTEXITCODE

if ($statusExit -ne 0) {
    Write-Host ''
    Write-Host 'AMBIENTE NAO ESTA PRONTO. CORRIJA OS RISCOS ACIMA.' -ForegroundColor Red
    exit $statusExit
}

Write-Host ''
Write-Host 'AMBIENTE PRONTO PARA TRABALHO' -ForegroundColor Green
exit 0
