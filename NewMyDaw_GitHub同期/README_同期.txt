NewMyDaw ⇔ GitHub（KeenNeel/mydaw01）同期ツール

【置き場所】
  4つのファイル（mydaw_setup.bat / mydaw_setup.ps1 / mydaw_sync.bat / mydaw_sync.ps1）を
  デスクトップの「NewMyDaw」フォルダの中に置いてください。
  （スクリプトは自分が置かれたフォルダを同期します。OneDrive のデスクトップでも動きます）

【最初の 1 回】 mydaw_setup.bat をダブルクリック
  ・Git が無ければインストール（winget）→ もう一度実行
  ・名前とメール（未設定のときだけ聞かれます。メールは GitHub の noreply アドレス推奨）
  ・GitHub に接続（初回はブラウザでログイン画面が出ます）
  ・GitHub に既に内容があるときは、同じ名前のファイルでどちらを優先するか聞かれます
  ・最後に GitHub へ送って完了

【次から】 mydaw_sync.bat をダブルクリック
  1) このPCで変えたファイルを記録
  2) GitHub の新しい変更を受け取る
  3) GitHub へ送る
  両方で同じファイルを変えていたときだけ「このPC優先 / GitHub優先 / やめる」を聞きます。

【メモ】
  ・100MB を超えるファイルは GitHub に送れないため、自動で同期の対象から外して知らせます。
  ・同期の記録は .sync_log.txt に残ります（GitHub には送りません）。
  ・削除も同期されます（このPCで消したファイルは GitHub からも消えます。履歴からは戻せます）。
