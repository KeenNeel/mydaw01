# =====================================================================
#  NewMyDaw フォルダ ⇔ GitHub（KeenNeel/mydaw01）同期の初期設定（最初に 1 回だけ）
#  mydaw_setup.bat から実行されます
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

Say '=== NewMyDaw と GitHub の同期を設定します ===' White
Say "フォルダ: $Here"
Say "GitHub  : $RepoUrl"
Write-Host ''

# 1) Git があるか
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Say 'Git が見つかりません。インストールします（winget）…' Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) { winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements }
  else { Say 'https://git-scm.com/download/win から Git をインストールしてください。' Yellow }
  Fail 'インストールが終わったら、このウィンドウを閉じて mydaw_setup.bat をもう一度実行してください。'
}

# 2) コミットに記録する名前とメール（まだ設定していなければ）
if (-not (git config --global user.name)) {
  $n = Read-Host 'コミットに記録する名前（例: KeenNeel）'
  git config --global user.name "$n"
}
if (-not (git config --global user.email)) {
  Say 'メールアドレスはリポジトリの履歴に残ります（公開リポジトリなら誰でも見られます）。' Yellow
  Say 'GitHub の Settings → Emails にある「…@users.noreply.github.com」のアドレスがおすすめです。' Yellow
  $e = Read-Host 'コミットに記録するメールアドレス'
  git config --global user.email "$e"
}

# 3) このフォルダをリポジトリにする
if (-not (Test-Path -LiteralPath (Join-Path $Here '.git'))) { git init -q; Say 'このフォルダを Git で管理するようにしました' }
git config core.quotepath false      # 日本語のファイル名をそのまま表示
git config core.safecrlf false       # 改行コードの警告を出さない
git config pull.rebase false
$remotes = @(git remote)
if ($remotes -contains 'origin') { git remote set-url origin $RepoUrl } else { git remote add origin $RepoUrl }

# 4) 同期しないもの（.gitignore が無ければ作る）
$gi = Join-Path $Here '.gitignore'
if (-not (Test-Path -LiteralPath $gi)) {
  @('# 同期しないもの', 'Thumbs.db', 'desktop.ini', '.DS_Store', '~$*', '*.tmp', 'node_modules/', '.sync_log.txt') | Set-Content -LiteralPath $gi -Encoding UTF8
  Say '.gitignore を作りました（Windows の一時ファイルなどは同期しません）'
}

# 5) GitHub に接続（初回はブラウザで GitHub のログインが出ることがあります）
Say 'GitHub に接続しています…（ログイン画面が出たらサインインしてください）'
$sym = git ls-remote --symref origin HEAD
if ($LASTEXITCODE -ne 0) { Fail 'GitHub に接続できませんでした。ネット接続・URL・GitHub へのログインを確認して、もう一度実行してください。' }
$Branch = 'main'
foreach ($l in @($sym)) { if ("$l" -match '^ref: refs/heads/(\S+)\s+HEAD') { $Branch = $Matches[1] } }
$remoteHas = [bool](git ls-remote --heads origin $Branch)
if (HasHead) { git branch -M $Branch } else { git symbolic-ref HEAD "refs/heads/$Branch" }
Say "ブランチ: $Branch（GitHub 側に既にあるか: $remoteHas）"

# 6) このPCの内容を記録
Exclude-BigFiles
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -q -m ("初回同期（{0} {1}）" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyy-MM-dd HH:mm')); Say 'このPCのファイルを記録しました' }

# 7) GitHub に既に内容があれば合わせる
if ($remoteHas) {
  git fetch -q origin $Branch
  if (-not (HasHead)) {
    git reset -q --hard "origin/$Branch"
    Say 'GitHub の内容をこのフォルダに取り込みました'
  } else {
    Write-Host ''
    Say '同じ名前のファイルが両方にあって中身が違うときは、どちらを残しますか？' Yellow
    $ans = Read-Host '[L] このPC（デスクトップ）を優先 / [R] GitHub を優先   （Enter = L）'
    $opt = 'ours'; if ($ans -match '^[Rr]') { $opt = 'theirs' }
    git merge --no-edit --allow-unrelated-histories -X $opt "origin/$Branch"
    if ($LASTEXITCODE -ne 0) { git merge --abort; Fail '自動で合わせられませんでした。このフォルダは変わっていません。画面の内容を添えて相談してください。' }
    Say 'GitHub の内容とこのPCの内容を合わせました'
  }
}

# 8) GitHub へ送る
git push -u origin $Branch
if ($LASTEXITCODE -ne 0) { Fail 'GitHub へ送れませんでした。ログインと、このリポジトリへの書き込み権限を確認してください。' }
Write-Host ''
Say '設定と最初の同期が完了しました。' Green
Say '次からは mydaw_sync.bat をダブルクリックすると、差分だけ同期します。' Green
