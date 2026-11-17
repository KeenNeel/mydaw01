# =====================================================================
#  NewMyDaw フォルダ ⇔ GitHub（KeenNeel/mydaw01）差分同期
#  mydaw_sync.bat から実行されます
#   1) このPCで変えたファイルを記録  2) GitHub の新しい変更を受け取る  3) GitHub へ送る
# =====================================================================
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8; $OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$RepoUrl = 'https://github.com/KeenNeel/mydaw01.git'
$Here = $PSScriptRoot
Set-Location -LiteralPath $Here
function Say([string]$m, [string]$c = 'Cyan') { Write-Host $m -ForegroundColor $c }
function Fail([string]$m) { Write-Host ''; Write-Host $m -ForegroundColor Red; exit 1 }
function HasHead { git rev-parse --verify -q HEAD | Out-Null; return ($LASTEXITCODE -eq 0) }
# GitHub は 1 ファイル 100MB まで。大きいファイルは同期の対象から外して知らせる
function Exclude-BigFiles {
  $ex = Join-Path $Here '.git\info\exclude'
  $have = @(); if (Test-Path -LiteralPath $ex) { $have = Get-Content -LiteralPath $ex }
  Get-ChildItem -LiteralPath $Here -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.Length -gt 95MB } |
    ForEach-Object {
      $rel = ($_.FullName.Substring($Here.Length + 1)) -replace '\\', '/'
      if ($have -notcontains $rel) { Add-Content -LiteralPath $ex -Value $rel -Encoding UTF8 }
      Say ("大きすぎるため GitHub へは送りません: {0}（{1} MB）" -f $rel, [math]::Round($_.Length / 1MB)) Yellow
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'Git が見つかりません。先に mydaw_setup.bat を実行してください。' }
if (-not (Test-Path -LiteralPath (Join-Path $Here '.git'))) { Fail 'まだ設定されていません。先に mydaw_setup.bat を実行してください。' }
$Branch = "$(git rev-parse --abbrev-ref HEAD)".Trim()
Say ("=== 同期（{0}） {1} ===" -f $Branch, (Get-Date -Format 'yyyy-MM-dd HH:mm')) White

# 0) 途中で止まったマージが残っていたら片付ける
if (Test-Path -LiteralPath (Join-Path $Here '.git\MERGE_HEAD')) { git merge --abort; Say '前回の途中のマージを取り消しました' Yellow }

# 1) このPCの変更を記録
Exclude-BigFiles
git add -A
$st = @(git status --porcelain)
if ($st.Count -gt 0) {
  Say ("このPCの変更: {0} 件" -f $st.Count)
  $st | Select-Object -First 40 | ForEach-Object { Write-Host "   $_" }
  if ($st.Count -gt 40) { Write-Host "   …ほか $($st.Count - 40) 件" }
  git commit -q -m ("同期（{0} {1}）" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyy-MM-dd HH:mm'))
} else { Say 'このPCの変更はありません' }

# 2) GitHub の変更を受け取る
git fetch -q origin
if ($LASTEXITCODE -ne 0) { Fail 'GitHub に接続できませんでした。ネット接続を確認してもう一度実行してください（このPCの変更は記録済みです）。' }
$remoteRef = "origin/$Branch"
git rev-parse --verify -q $remoteRef | Out-Null
$remoteHas = ($LASTEXITCODE -eq 0)
$got = 0
if ($remoteHas) {
  $got = [int]"$(git rev-list --count "HEAD..$remoteRef")"
  if ($got -gt 0) {
    Say ("GitHub の新しい変更を取り込みます（{0} 回分）:" -f $got)
    git diff --name-status "HEAD...$remoteRef" | Select-Object -First 40 | ForEach-Object { Write-Host "   $_" }
    git merge -q --no-edit $remoteRef 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      $cf = @(git diff --name-only --diff-filter=U)
      Write-Host ''
      Say '両方で同じファイルが変更されていて、自動で合わせられませんでした:' Yellow
      $cf | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
      $ans = Read-Host '[L] このPCを優先 / [R] GitHub を優先 / [Q] やめる（何も変えない）'
      if ($ans -notmatch '^[LlRr]') { git merge --abort; Fail 'やめました。フォルダは受け取る前の状態のままです（このPCの変更は記録済み）。' }
      $side = 'ours'; if ($ans -match '^[Rr]') { $side = 'theirs' }
      git merge --abort
      git merge -q --no-edit -X $side $remoteRef 2>&1 | Out-Null
      foreach ($f in @(git diff --name-only --diff-filter=U)) {   # 片方で消された等、自動で決まらないもの
        git checkout "--$side" -- "$f" 2>$null
        if ($LASTEXITCODE -eq 0) { git add -- "$f" } else { git rm -q -- "$f" }
      }
      if (Test-Path -LiteralPath (Join-Path $Here '.git\MERGE_HEAD')) { git commit -q --no-edit 2>&1 | Out-Null }
      if (Test-Path -LiteralPath (Join-Path $Here '.git\MERGE_HEAD')) { git merge --abort; Fail '合わせられませんでした。フォルダは受け取る前の状態に戻しました。' }
      Say ("{0} を優先して合わせました" -f $(if ($side -eq 'ours') { 'このPC' } else { 'GitHub' })) Green
    }
  } else { Say 'GitHub の新しい変更はありません' }
}

# 3) GitHub へ送る
$send = 1
if ($remoteHas) { $send = [int]"$(git rev-list --count "$remoteRef..HEAD")" }
if ($send -gt 0) {
  git push -q -u origin $Branch
  if ($LASTEXITCODE -ne 0) { Fail 'GitHub へ送れませんでした。別の場所から同時に更新された可能性があります。もう一度 mydaw_sync.bat を実行してください。' }
  Say 'GitHub へ送りました' Green
} else { Say '送る変更はありません' }

Add-Content -LiteralPath (Join-Path $Here '.sync_log.txt') -Encoding UTF8 -Value ("{0}  このPCの変更 {1} 件 / 受け取り {2} 回分 / 送信 {3}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $st.Count, $got, ($(if ($send -gt 0) { 'あり' } else { 'なし' })))
Write-Host ''
Say '同期が完了しました。' Green
