# 我的音樂庫

原生 HTML、CSS、JavaScript 的個人播放器。播放器本機匯入、離線下載及自訂歌名／封面保存在目前裝置與網站來源的 IndexedDB。

## 自動產生線上歌單

GitHub Actions 會在預設分支收到推送時掃描 `audio/`，產生播放器使用的 `songs.json`，並部署精簡網站產物。也可以從 Actions 頁面手動觸發。產生的歌單只放在 Actions 建置產物中，不會自動提交回儲存庫。

- 支援 `.mp3`、`.m4a`，副檔名不分大小寫；會遞迴掃描 `audio/` 子目錄。
- 預設歌名為檔名去掉副檔名；`version` 是音訊內容的 SHA-256，檔案內容改變才會變更。
- `id` 由專案相對音訊路徑穩定產生；新增其他歌曲不會改變既有 ID。
- 同路徑若已出現在儲存庫的 `songs.json`，會保留其中的 `id`、`title` 和有效 `coverUrl`，並重新計算音訊版本。
- 封面會依相對路徑與檔名配對，例如 `audio/album/song-001.mp3` 對應 `covers/album/song-001.jpg`。支援 jpg、jpeg、png、webp；同一檔名有多種格式時依 jpg、jpeg、png、webp 順序選擇。
- 路徑會正確 URL 編碼，支援中文、空白及 `#`、`?`、`%` 等字元。

範例資料夾：

```text
audio/
  album/song-001.mp3
covers/
  album/song-001.jpg
```

重新命名或移動音訊檔會改變路徑與歌曲 ID。播放器會把舊歌曲視為來源已移除，並建立一筆新歌曲；既有下載、自訂歌名與自訂封面不會自動移轉到新路徑。替換同一路徑的音訊內容會更新 `version`，播放器會標示有新版。

GitHub Pages 是公開網站：放進 `audio/` 和 `covers/` 的檔案可被取得網址的人存取。請勿提交私人音訊或封面。播放器中的 IndexedDB 自訂歌名與自訂封面會保留於目前裝置，不會被線上歌單更新覆蓋。

## 本機產生歌單與測試

安裝 Python 3.10 或更新版本（不需要額外套件），在專案根目錄執行：

```powershell
py -3 scripts\generate_songs.py
```

這會將結果寫入根目錄 `songs.json`，然後用 VS Code Live Server 開啟根目錄的 `index.html`。產生清單不會自動提交。若要保持儲存庫中的空白清單，測試後可還原 `songs.json`；部署 workflow 會自行在 `_site/` 產生歌單。

執行自動化測試：

```powershell
py -3 -m unittest discover -s tests -v
```

也可以直接指定本機輸出位置：

```powershell
py -3 scripts\generate_songs.py --output songs.json
```

## 啟用 GitHub Pages 自動部署

1. 將專案放入自己的 GitHub repository，確認 `.github/workflows/pages.yml`、`scripts/generate_songs.py` 與網站檔案已推送到預設分支。
2. 在 repository 開啟 **Settings → Pages**，於 **Build and deployment → Source** 選擇 **GitHub Actions**。
3. 開啟 **Actions**，查看 **Build and deploy music library**。預設分支收到推送會自動執行；也可以在該 workflow 按 **Run workflow** 手動執行。
4. 成功後，workflow 摘要會顯示 Pages 網址。網站使用相對路徑，支援 `https://帳號.github.io/專案名稱/` 子路徑部署。

Workflow 只封裝播放器 HTML、CSS、JavaScript、Service Worker、manifest、必要圖示、支援的音訊及歌單引用到的封面。不會把 `.git`、`.github`、README、測試或私人設定打包。Actions 只有讀取內容與 Pages 部署需要的權限，並以 concurrency 避免同時部署。

Service Worker 快取播放器介面和 `songs.json`，不會預先下載歌曲。線上歌曲要離線播放，需在播放器中選擇下載到 IndexedDB。新版等待使用者在資訊面板套用，不會在播放中強制重新載入。

## 儲存與備份

本機歌曲、離線音訊、自訂歌名與自訂封面都綁定此裝置及網站來源，不會跨裝置同步。清除網站資料可能移除這些資料；下一階段可加入 IndexedDB 備份匯出／匯入功能。
