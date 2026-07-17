#Requires -Version 5.1
<#
.SYNOPSIS
  Bumps app version, commits, tags, and pushes to trigger the GitHub Release workflow.

.EXAMPLE
  .\scripts\release.ps1
  .\scripts\release.ps1 -Bump patch
  npm run release -- -Bump minor
#>
param(
  [ValidateSet("patch", "minor", "major", "")]
  [string]$Bump = "",

  [string]$Version = "",

  [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Get-PackageVersion {
  $pkg = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
  return [string]$pkg.version
}

function Test-SemVer([string]$Value) {
  return $Value -match '^\d+\.\d+\.\d+$'
}

function Get-NextVersion([string]$Current, [string]$Kind) {
  $parts = $Current.Split(".") | ForEach-Object { [int]$_ }
  $major, $minor, $patch = $parts[0], $parts[1], $parts[2]
  switch ($Kind) {
    "major" { return "{0}.0.0" -f ($major + 1) }
    "minor" { return "{0}.{1}.0" -f $major, ($minor + 1) }
    "patch" { return "{0}.{1}.{2}" -f $major, $minor, ($patch + 1) }
    default { throw "Unknown bump kind: $Kind" }
  }
}

function Assert-CleanTree {
  $status = git status --porcelain
  if ($status) {
    Write-Host "Working tree is not clean. Commit or stash other changes first:" -ForegroundColor Red
    git status --short
    exit 1
  }
}

function Assert-OnMain {
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne "main" -and $branch -ne "master") {
    $confirm = Read-Host "You are on '$branch' (not main). Continue? [y/N]"
    if ($confirm -notmatch '^[Yy]$') {
      Write-Host "Aborted." -ForegroundColor Yellow
      exit 1
    }
  }
}

function Set-JsonVersion([string]$Path, [string]$NewVersion) {
  $raw = Get-Content -Raw -Path $Path
  $updated = [regex]::Replace(
    $raw,
    '("version"\s*:\s*")[^"]+(")',
    { param($m) $m.Groups[1].Value + $NewVersion + $m.Groups[2].Value },
    1
  )
  if ($updated -eq $raw) {
    throw "Could not update version in $Path"
  }
  # Preserve UTF-8 without BOM and existing newlines
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $updated, $utf8NoBom)
}

function Set-CargoVersion([string]$Path, [string]$NewVersion) {
  $raw = Get-Content -Raw -Path $Path
  $updated = [regex]::Replace(
    $raw,
    '(?m)^(version\s*=\s*")[^"]+(")',
    { param($m) $m.Groups[1].Value + $NewVersion + $m.Groups[2].Value },
    1
  )
  if ($updated -eq $raw) {
    throw "Could not update version in $Path"
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $updated, $utf8NoBom)
}

$current = Get-PackageVersion
if (-not (Test-SemVer $current)) {
  throw "Current package.json version is not semver x.y.z: $current"
}

Write-Host ""
Write-Host "Persona5 Explorer release" -ForegroundColor Cyan
Write-Host "Current version: $current"
Write-Host ""

$next = $Version.Trim()
if (-not $next) {
  if ($Bump) {
    $next = Get-NextVersion $current $Bump
  }
  else {
    Write-Host "Bump type: patch / minor / major"
    Write-Host "Or type an exact version (e.g. 0.2.0)"
    $answer = (Read-Host "Next version").Trim()
    if ($answer -in @("patch", "minor", "major")) {
      $next = Get-NextVersion $current $answer
    }
    else {
      $next = $answer
    }
  }
}

if (-not (Test-SemVer $next)) {
  throw "Invalid version '$next'. Expected x.y.z (e.g. 0.1.2)"
}

if ($next -eq $current) {
  throw "Next version is the same as current ($current)."
}

$tag = "v$next"
$existingTag = git tag -l $tag
if ($existingTag) {
  throw "Tag $tag already exists locally."
}

Assert-CleanTree
Assert-OnMain

Write-Host ""
Write-Host "Will release: $current -> $next (tag $tag)" -ForegroundColor Yellow
Write-Host "  - package.json / package-lock.json"
Write-Host "  - src-tauri/tauri.conf.json"
Write-Host "  - src-tauri/Cargo.toml"
Write-Host "  - commit + tag"
if (-not $SkipPush) {
  Write-Host "  - push commit + tag (triggers GitHub Actions)"
}
Write-Host ""

$confirm = Read-Host "Continue? [y/N]"
if ($confirm -notmatch '^[Yy]$') {
  Write-Host "Aborted." -ForegroundColor Yellow
  exit 0
}

Write-Host "Updating versions..." -ForegroundColor Cyan
npm version $next --no-git-tag-version --allow-same-version | Out-Null
Set-JsonVersion "src-tauri/tauri.conf.json" $next
Set-CargoVersion "src-tauri/Cargo.toml" $next

$verifyPkg = Get-PackageVersion
$tauriConf = (Get-Content -Raw "src-tauri/tauri.conf.json" | ConvertFrom-Json).version
$cargoMatch = Select-String -Path "src-tauri/Cargo.toml" -Pattern '^version\s*=\s*"([^"]+)"' | Select-Object -First 1
$cargoVer = $cargoMatch.Matches[0].Groups[1].Value

if ($verifyPkg -ne $next -or $tauriConf -ne $next -or $cargoVer -ne $next) {
  throw "Version mismatch after update (pkg=$verifyPkg tauri=$tauriConf cargo=$cargoVer expected=$next)"
}

git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
if (Test-Path "src-tauri/Cargo.lock") {
  # Cargo.lock may change if package version is embedded; include if dirty
  $cargoLockDirty = git status --porcelain -- "src-tauri/Cargo.lock"
  if ($cargoLockDirty) {
    git add src-tauri/Cargo.lock
  }
}

git commit -m "chore: release $tag"
git tag $tag

if ($SkipPush) {
  Write-Host ""
  Write-Host "Done locally (skipped push)." -ForegroundColor Green
  Write-Host "Push when ready:"
  Write-Host "  git push && git push origin $tag"
  exit 0
}

Write-Host "Pushing..." -ForegroundColor Cyan
git push
git push origin $tag

Write-Host ""
Write-Host "Released $tag. Watch the Release workflow in GitHub Actions." -ForegroundColor Green
Write-Host "When it finishes: Releases -> download the installer."
