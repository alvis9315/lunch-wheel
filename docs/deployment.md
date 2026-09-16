# 第一次上線：Google 試算表與 Apps Script

本專案由 Apps Script 同時提供網頁與後端，Google 試算表保存共用店家、評論與投票。GitHub 保存程式；把程式上傳 GitHub 不會自動建立試算表或網站。

v6.2 現有網站更新：請先看 [流程更新與分類維護](workflow.md)，這次需替換 `Code.gs` 與 `Index.html` 再部署新版本。

> 已上線的使用者：請閱讀 [v6 更新與 Google 登入設定](google-login.md)，保留原試算表。新評論及投票改為 Google 帳號登入後使用，暱稱選填。

## 1. 建立線上試算表

1. 使用自己的 Google 帳戶開啟 Google Drive。
2. 若已有整理好的匯入用 Excel，選「新增 → 上傳檔案」；上傳後用 Google 試算表開啟，再選「檔案 → 另存為 Google 試算表」。不要停留在 `.xlsx` 相容編輯模式。
3. 若尚未整理店家，可以先建立空白 Google 試算表，命名為 `Lunch Wheel DB`。
4. 記下新 Google 試算表網址中 `/d/` 和 `/edit` 之間的一段，這是 `SPREADSHEET_ID`。`gid` 是分頁編號，不是試算表 ID。
5. 「共用 → 一般存取權」保持「限制」。同事使用網站，不需要試算表編輯權，也不用「發布到網路」。

Excel 轉 Google 試算表的官方說明：[在 Excel 與 Sheets 間使用檔案](https://support.google.com/docs/answer/9331167)。

## 2. 放入網站程式

1. 在剛建立的 Google 試算表，選「擴充功能 → Apps Script」。
2. 專案命名為 `Lunch Wheel`。
3. 從 GitHub 下載並解壓 `Lunch-Club-Apps-Script.zip`，用文字編輯器開啟其中的檔案。也可以使用儲存庫的 `dist/` 目錄。
4. 將打包檔的 **Code.gs 全部內容**貼進 Apps Script 的 `Code.gs`，取代原先的範例函式。
5. 左側「檔案」旁按 `+ → HTML`，名稱填 `Index`；將 **Index.html 全部內容**貼進去。
6. 左側齒輪「專案設定」勾選「在編輯器中顯示 appsscript.json 資訊清單檔案」。回到編輯器，將打包檔的 `appsscript.json` 全部內容貼入同名檔案。
7. 儲存。專案應有 `Code.gs`、`Index.html`、`appsscript.json` 三個檔案。

請使用 ZIP 或 `dist/Code.gs`；`apps-script/Code.gs` 是未打包的原始碼，單獨複製會缺少驗證函式。HTML 必須複製原始文字，不是複製瀏覽器顯示的網頁。

## 3. 設定資料庫與管理密語

Apps Script「專案設定 → 指令碼屬性 → 新增指令碼屬性」：

| 屬性名稱 | 要填的值 |
|---|---|
| `SPREADSHEET_ID` | 第 1 步取得的 Google 試算表 ID |
| `ADMIN_PASSPHRASE` | 自己保管的管理密語；20～256 字元，建議用密碼管理器產生至少 32 字元 |

密語只填在指令碼屬性，不放在試算表、HTML、GitHub 或對話。未設定密語仍能讀取名單，網站的管理員新增功能會關閉。

預設起點可先略過，網站會顯示板橋車站附近「待校正」的位置。若有確認的起點，可另外設定以下三項：

| 屬性名稱 | 用途 |
|---|---|
| `ORIGIN_NAME` | 出發點名稱，例如「板橋車站北二門」 |
| `ORIGIN_LAT` | 確認過的緯度 |
| `ORIGIN_LNG` | 確認過的經度 |

每個人仍可在網站更換自己的出發點。`TILE_URL` 與 `TILE_ATTRIBUTION` 初次部署不用設定。

指令碼屬性的官方操作：[Properties Service](https://developers.google.com/apps-script/guides/properties)。

## 4. 第一次執行與授權

1. 回到 Apps Script 編輯器，頂端函式選單選 `listCandidates`，按「執行」。
2. 若出現授權要求，使用擁有這份試算表的帳戶完成試算表讀寫及外部連線授權。
3. 若顯示未經 Google 驗證，先確認畫面是自己剛建立的 Apps Script 專案，再依 Google 畫面提供的流程繼續。若帳戶政策阻擋執行，需使用允許此部署的帳戶。
4. 成功後，空白資料庫會建立 `RestaurantsFree` 分頁與固定表頭。這一步不會自動把其他分頁的自訂欄位轉成店家。

目前程式的分頁用途：

| 分頁 | 用途 | 建立時機 |
|---|---|---|
| `RestaurantsFree` | 店家基本資料、座標、例行營業時間與篩選標記 | 第一次讀取店家 |
| `Reviews` | 品項、回饋、分數 | 第一次開啟或新增店家評論 |
| `ReviewVotes` | 每則評論的讚／爛 | 第一次開啟評論或投票 |
| `Members` | 經確認的 Google 帳號與選填暱稱 | 第一次成功 Google 登入 |

不需要自己替評論和投票建立表頭。店家的 `id` 是評論關聯依據；日後改店名或電話時不要改 `id`，不要任意調整系統欄位順序。

## 5. 部署正式網站

1. 右上「部署 → 新增部署」。
2. 類型選「網頁應用程式」。
3. 「執行身分」選 **我**，使網站使用你的授權存取私人試算表。
4. 「誰可以存取」選 **擁有 Google 帳戶的任何人**。這是 v6 記名評論的部署設定；網站內另依 [Google 登入指南](google-login.md) 完成帳號確認。選項依帳戶政策而異。
5. 按「部署」，複製「網頁應用程式」網址，結尾通常是 `/exec`。
6. 傳給同事的是這個 `/exec` 網址。`/dev` 是只有專案編輯者可用的測試網址。

可存取網站的人能讀取名單；完成網站內 Google 登入後才能留評論與投票；新增共用店家仍需網站內的管理密語。網站的存取設定與試算表共用設定是兩件事。

官方部署與身分說明：[Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)。

## 6. 上線檢查

1. 開啟 `/exec`，確認讀取後出現類型選擇，「不限」位於第一個。
2. 選類型，設定條件並勾選 2～20 間，按「確認名單」進入獨立轉盤，確認約 2.5 秒後顯示結果。
3. 更換出發點，確認距離更新；測試葷食／素食篩選。
4. 完成 Google 登入設定後，用一則真實用餐經驗測試評論及讚／爛，回到試算表確認 `Reviews`、`ReviewVotes` 有資料。
5. 用無痕視窗登入 Google 後確認能抽選；網站內 Google 登入後能評論，未通過管理密語仍不能新增店家。
6. 用 iPhone Safari 開啟正式網址，確認地圖、對話框、撥號與導航。若定位被拒絕，仍可用地圖選點或輸入座標。

「自己建立」暫停開放，既有私人資料保留。現有名單空白時，請先完成資料匯入或登入管理員新增店家。

## 7. 之後怎麼維護

- **改店家資料**：直接在 Google 試算表維護已知欄位，網站重新載入後讀取更新；不必重新部署。
- **改網站程式**：更新三個部署檔案後，到「部署 → 管理部署 → 編輯」，版本選「新版本」，再部署。編輯原本的部署可保留同一個網站網址。
- **換密語**：更改 `ADMIN_PASSPHRASE` 指令碼屬性；程式會使舊管理登入失效。
- **名單有店卻抽不到**：先確認勾選至少 2 間，再檢查距離、料理、預算、葷素、雨天與例行營業條件。未填寫的資料不會被當作已符合。
- **出現 `RestaurantsFree 表頭不正確`**：系統要求固定英文欄位及順序；不要用中文自訂清單直接覆蓋系統分頁。
- **出現 `LunchCatalog is not defined`**：重新貼上 `dist/Code.gs` 完整內容。

改版操作的官方說明：[Create and manage deployments](https://developers.google.com/apps-script/concepts/deployments)。
