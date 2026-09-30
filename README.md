# MapAI - 個人地圖美食景點助理 (PWA)

這是一個專為**手機單手操作**設計的 PWA（Progressive Web App），支援將 Google Maps 的私人清單透過**零隱私疑洩**的方式儲存於手機端，並結合 **手機 GPS 即時定位** 與 **Google Gemini AI**，隨時以自然語言查詢：
* *「離我 2 公里內有哪些拉麵店？推薦一家」*
* *「附近有什麼適合喝咖啡的待去店家？」*
* *「我現在所在位置有哪些我儲存的旅遊景點？」*

---

## 📱 核心特色

1. **100% 純前端、完全注重隱私**：
   - 資料永久保存在手機瀏覽器本地（LocalStorage），**不經過任何第三方雲端伺服器**。
   - 絕不要求將清單對外公開或產生外洩分享連結。
2. **手機即時 GPS 距離計算**：
   - 自動運算你與所有儲存地點的直線距離，並依近到遠智慧排序。
3. **Gemini AI 語意分析與一鍵導航**：
   - 結合你的當前座標與私人清單，精準挑選推薦，並可直接一鍵切換回 Google Maps App 開啟導航。
4. **極簡日常更新（隨手存）**：
   - 在 Google Maps 看到新店家，點「分享」→「複製連結」，切回 App 點「讀取剪貼簿」立即存入。
5. **支援 Google 官方 Takeout 批次檔案匯入**：
   - 支援直接匯入 Google Takeout 產出的 `JSON` 或 `CSV`，內建智慧去重機制。

---

## 🚀 如何發布至 GitHub Pages（免費無伺服器部署）

因為本專案是純前端架構，你可以完全免費架在你的 GitHub 上：

### 步驟 1：建立 GitHub Repository
1. 登入你的 [GitHub](https://github.com)，點選右上角 **New repository**。
2. Repository 名稱自訂（例如：`map-assistant` 或 `google-maps-pwa`），選擇 **Public** 或 **Private**（Private 需 GitHub Pro 方可開 Pages，建議 Public 即可，因為程式碼內不含任何個人資料或金鑰）。

### 步驟 2：上傳專案檔案
在本地終端機（此專案資料夾下）執行：
```bash
git init
git add .
git commit -m "feat: initial commit for MapAI PWA"
git branch -M main
git remote add origin https://github.com/你的使用者名稱/你的專案名稱.git
git push -u origin main
```

### 步驟 3：開啟 GitHub Pages
1. 進入該 GitHub 專案頁面，點擊上方分頁 **Settings**。
2. 左側選單點選 **Pages**。
3. 在 **Build and deployment** 下方的 **Branch**：
   - 選擇 `main` 分頁
   - 目錄選擇 `/(root)`
   - 點擊 **Save**。
4. 等待 1~2 分鐘，GitHub 會顯示你的專屬網址：
   `https://<你的帳號>.github.io/<你的專案名稱>/`

---

## 📲 手機安裝與使用教學

### 1. 將網頁加入手機主畫面（變成 App）
* **iPhone (Safari)**：開啟 GitHub Pages 網址，點瀏覽器底部的 **「分享按鈕（方框加箭頭）」** → 往下滑點選 **「加入主畫面」**。
* **Android (Chrome)**：開啟網址，點右上角選單 `⋮` → 選擇 **「安裝應用程式」** 或 **「加到主畫面」**。

### 2. 設定 Google Gemini API Key（免費）
1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 免費申請金鑰。
2. 在手機 App 切換至右下角 **「設定教學」**，貼上金鑰並按儲存。金鑰僅儲存在您的手機內部。

### 3. 日常如何隨手更新新地點？
1. 在手機 Google Maps App 找到店家，點擊 **「分享」** → **「複製連結」**。
2. 打開 MapAI App，點下方 **「快速新增」** → 點 **「讀取手機剪貼簿」**。
3. 系統自動提取店家名稱並過濾重複，按加入完成！
