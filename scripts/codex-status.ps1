[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$expectedRoot = 'C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao'
$expectedBranch = 'codex/source-of-truth-hardening-20260816'
$expectedOperationalBase = '44504f2a503b4beef5ff4c5b0a0d8a34548c46e3'
$expectedOrigin = 'git@github-vitalismen-ec:GitViltaliesmen/vitalismen-maxlien-painel.git'
$expectedUpstream = 'origin/codex/source-of-truth-hardening-20260816'
$githubAlias = 'github-vitalismen-ec'
$vpsAlias = 'maxlien-vps'
$productionPath = '/opt/vitalismen-automacao/current'
$expectedProductionRelease = '/opt/vitalismen-automacao/releases/20260815T153200Z_ec_manual_product_lead_badge_v12_dbe5f3a'
$expectedProductionHead = 'dbe5f3af960cb0b48009ac81736b552d54e910b5'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$expectedRootNormalized = [System.IO.Path]::GetFullPath($expectedRoot).TrimEnd('\', '/')
$criticalCount = 0
$warningCount = 0

function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "OK: $Message" -ForegroundColor Green
}

function Write-WarningResult {
    param([string]$Message)
    $script:warningCount += 1
    Write-Host "ATENCAO: $Message" -ForegroundColor Yellow
}

function Write-CriticalResult {
    param([string]$Message)
    $script:criticalCount += 1
    Write-Host "RISCO CRITICO: $Message" -ForegroundColor Red
}

function Test-SamePath {
    param(
        [string]$First,
        [string]$Second
    )

    try {
        $firstNormalized = [System.IO.Path]::GetFullPath($First).TrimEnd('\', '/')
        $secondNormalized = [System.IO.Path]::GetFullPath($Second).TrimEnd('\', '/')
        return [string]::Equals(
            $firstNormalized,
            $secondNormalized,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    } catch {
        return $false
    }
}

$gitAvailable = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
$sshAvailable = $null -ne (Get-Command ssh -ErrorAction SilentlyContinue)

$gitRoot = '(indisponivel)'
$branch = '(indisponivel)'
$localHead = '(indisponivel)'
$worktreeClean = $false
$upstream = '(sem upstream)'
$origin = '(indisponivel)'
$githubOk = $false
$vpsOk = $false
$activeRelease = '(indisponivel)'
$productionHead = '(indisponivel)'
$distanceText = '(indisponivel)'

if ($gitAvailable) {
    $gitRootOutput = @(& git --no-optional-locks -C $projectRoot rev-parse --show-toplevel 2>&1)
    $gitRootExit = $LASTEXITCODE
    if ($gitRootExit -eq 0 -and $gitRootOutput.Count -gt 0) {
        $gitRoot = [string]$gitRootOutput[0]
    }

    $branchOutput = @(& git --no-optional-locks -C $projectRoot branch --show-current 2>&1)
    $branchExit = $LASTEXITCODE
    if ($branchExit -eq 0 -and $branchOutput.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$branchOutput[0])) {
        $branch = [string]$branchOutput[0]
    } elseif ($branchExit -eq 0) {
        $branch = '(HEAD destacado)'
    }

    $headOutput = @(& git --no-optional-locks -C $projectRoot rev-parse HEAD 2>&1)
    $headExit = $LASTEXITCODE
    if ($headExit -eq 0 -and $headOutput.Count -gt 0) {
        $localHead = [string]$headOutput[0]
    }

    $statusOutput = @(& git --no-optional-locks -C $projectRoot status --porcelain=v1 --untracked-files=all 2>&1)
    $statusExit = $LASTEXITCODE
    $worktreeClean = $statusExit -eq 0 -and $statusOutput.Count -eq 0

    $upstreamOutput = @(& git --no-optional-locks -C $projectRoot rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>&1)
    $upstreamExit = $LASTEXITCODE
    if ($upstreamExit -eq 0 -and $upstreamOutput.Count -gt 0) {
        $upstream = [string]$upstreamOutput[0]
    }

    $originOutput = @(& git --no-optional-locks -C $projectRoot remote get-url origin 2>&1)
    $originExit = $LASTEXITCODE
    if ($originExit -eq 0 -and $originOutput.Count -gt 0) {
        $origin = [string]$originOutput[0]
    }

    $distanceOutput = @(& git --no-optional-locks -C $projectRoot rev-list --left-right --count "$expectedProductionHead...HEAD" 2>&1)
    $distanceExit = $LASTEXITCODE
    if ($distanceExit -eq 0 -and $distanceOutput.Count -gt 0) {
        $distanceParts = ([string]$distanceOutput[0]).Trim() -split '\s+'
        if ($distanceParts.Count -eq 2) {
            $distanceText = "somente na producao=$($distanceParts[0]); somente no HEAD local=$($distanceParts[1])"
        }
    }
}

if ($sshAvailable) {
    $githubOutput = @(& ssh -T -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes $githubAlias 2>&1)
    $githubExit = $LASTEXITCODE
    $githubText = ($githubOutput | ForEach-Object { [string]$_ }) -join "`n"
    $githubOk = ($githubExit -eq 1 -or $githubExit -eq 0) -and $githubText -match 'successfully authenticated'

    $vpsReadCommand = "printf 'CODEX_VPS_OK=1\n'; printf 'ACTIVE_RELEASE='; readlink -f $productionPath; printf 'PRODUCTION_HEAD='; git -C $productionPath rev-parse HEAD"
    $vpsOutput = @(& ssh -T -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes $vpsAlias $vpsReadCommand 2>&1)
    $vpsExit = $LASTEXITCODE
    $vpsLines = @($vpsOutput | ForEach-Object { [string]$_ })
    $vpsOk = $vpsExit -eq 0 -and $null -ne ($vpsLines | Where-Object { $_ -eq 'CODEX_VPS_OK=1' } | Select-Object -First 1)

    $releaseLine = $vpsLines | Where-Object { $_ -like 'ACTIVE_RELEASE=*' } | Select-Object -First 1
    if ($null -ne $releaseLine) {
        $activeRelease = $releaseLine.Substring('ACTIVE_RELEASE='.Length)
    }

    $headLine = $vpsLines | Where-Object { $_ -like 'PRODUCTION_HEAD=*' } | Select-Object -First 1
    if ($null -ne $headLine) {
        $productionHead = $headLine.Substring('PRODUCTION_HEAD='.Length)
    }
}

Write-Section '1. RAIZ'
Write-Host "Script: $projectRoot"
Write-Host "Git:    $gitRoot"
Write-Host "Oficial: $expectedRootNormalized"

Write-Section '2. BRANCH'
Write-Host $branch
if ($branch -ne $expectedBranch -and $branch -ne 'main') {
    Write-WarningResult "branch diferente da operacional consolidada $expectedBranch"
}

Write-Section '3. HEAD'
Write-Host $localHead
if ($gitAvailable -and $localHead -ne '(indisponivel)') {
    & git --no-optional-locks -C $projectRoot merge-base --is-ancestor $expectedOperationalBase HEAD 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "HEAD contem o baseline operacional $expectedOperationalBase"
    } else {
        Write-WarningResult "HEAD nao descende do baseline operacional $expectedOperationalBase"
    }
}

Write-Section '4. WORKTREE LIMPO OU SUJO'
if ($worktreeClean) {
    Write-Ok 'worktree limpo'
} else {
    Write-Host 'SUJO'
}

Write-Section '5. UPSTREAM'
Write-Host $upstream
if ($branch -eq $expectedBranch -and $upstream -ne $expectedUpstream) {
    Write-CriticalResult "upstream da branch operacional deveria ser $expectedUpstream"
} elseif ($upstream -like 'fork/*' -or $upstream -like 'vps/*') {
    Write-CriticalResult 'upstream aponta para remote nao canonico'
} elseif ($upstream -eq '(sem upstream)') {
    Write-WarningResult 'branch atual nao possui upstream'
}

Write-Section '6. ORIGIN'
Write-Host $origin
if ($origin -eq $expectedOrigin) {
    Write-Ok 'origin oficial confirmado'
} else {
    Write-CriticalResult "origin deveria ser $expectedOrigin"
}

Write-Section '7. TESTE GITHUB'
if ($githubOk) {
    Write-Ok "autenticacao SSH aceita por $githubAlias"
} else {
    Write-CriticalResult "nao foi possivel confirmar autenticacao SSH em $githubAlias"
}

Write-Section '8. TESTE VPS'
if ($vpsOk) {
    Write-Ok "acesso somente leitura confirmado por $vpsAlias"
} else {
    Write-CriticalResult "nao foi possivel confirmar acesso somente leitura por $vpsAlias"
}

Write-Section '9. RELEASE ATIVA VPS'
Write-Host $activeRelease

Write-Section '10. HEAD PRODUCAO VPS'
Write-Host $productionHead

Write-Section '11. DISTANCIA ENTRE HEAD LOCAL E PRODUCAO'
Write-Host $distanceText

Write-Section '12. ALERTA SE ESTIVER EM main'
if ($branch -eq 'main') {
    Write-CriticalResult 'main e legado e nao pode ser usada para trabalho operacional'
} elseif ($branch -eq '(HEAD destacado)') {
    Write-CriticalResult 'HEAD esta destacado; selecione uma branch autorizada antes de trabalhar'
} else {
    Write-Ok 'branch atual nao e main'
}

Write-Section '13. ALERTA SE ESTIVER FORA DA RAIZ OFICIAL'
$rootMatches = Test-SamePath -First $projectRoot -Second $expectedRootNormalized
$gitRootMatches = $gitRoot -ne '(indisponivel)' -and (Test-SamePath -First $gitRoot -Second $expectedRootNormalized)
$markerExists = Test-Path -LiteralPath (Join-Path $projectRoot '.vitalismen-official-root')
if ($rootMatches -and $gitRootMatches -and $markerExists) {
    Write-Ok 'raiz oficial e marcador confirmados'
} else {
    Write-CriticalResult 'script, raiz Git ou marcador nao correspondem ao projeto oficial'
}

Write-Section '14. ALERTA SE EXISTIREM ALTERACOES LOCAIS'
if ($worktreeClean) {
    Write-Ok 'nenhuma alteracao local detectada'
} else {
    Write-CriticalResult 'existem alteracoes locais staged, unstaged ou nao rastreadas'
}

Write-Section '15. ALERTA SE PRODUCAO MUDAR'
if (-not $vpsOk) {
    Write-CriticalResult 'estado da producao nao pode ser validado sem acesso ao VPS'
} elseif ($activeRelease -ne $expectedProductionRelease -or $productionHead -ne $expectedProductionHead) {
    Write-CriticalResult "producao divergiu do baseline: release esperada=$expectedProductionRelease; HEAD esperado=$expectedProductionHead"
} else {
    Write-Ok 'release e HEAD da producao permanecem no baseline conhecido'
}

Write-Section 'RESUMO'
Write-Host "Riscos criticos: $criticalCount"
Write-Host "Avisos: $warningCount"

if ($criticalCount -gt 0) {
    Write-Host 'AMBIENTE BLOQUEADO PARA INICIO AUTOMATICO' -ForegroundColor Red
    exit 2
}

Write-Host 'DIAGNOSTICO BASICO APROVADO' -ForegroundColor Green
exit 0
