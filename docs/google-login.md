# v6：Google 帳號、暱稱與改版部署

## 6.0.1：現有名單一直等待

本次追查的點擊順序為 `choose-shared → enterSource('live') → getSharedHome → 整理店家 → 顯示轉盤`。線上執行紀錄顯示 `getSharedHome` 在 1.95 秒內完成；這能確認函式完成，不能確認瀏覽器已接收結果或完成畫面切換。Google 框架的 `BUSY → IDLE` 亦不代表應用程式已顯示名單，尚未取得足以證實原始故障根因的線上紀錄。

6.0.1 將這個入口改用 Google 成功回呼直接執行畫面切換，名單以 JSON 文字跨越通訊層，並保留舊版物件回應相容性。20 秒逾時計時保留到畫面準備完成；失敗、取消、逾時後忽略遲到回應。瀏覽器主控台新增 `[Lunch Club 6.0.1] shared entry` 階段紀錄：`request`、`received`、`prepared`、`visible`，以及失敗的 `failed`／`timeout`。只記階段、筆數或一般錯誤提示，不記名單內容、信箱或密語。

已使用 v6 者更新 ZIP 中的 **Code.gs、Index.html**，到原本「管理部署 → 編輯 → 新版本 → 部署」。這次沒有新增授權、試算表欄位或登入設定；不要重匯資料。網站的使用說明會顯示「版本 6.0.1」。四組可攜測試、83 間店的直接回呼測試與六種寬度操作測試於本機執行，正式網址仍需部署後確認。

## 這次改了什麼

- 首頁入口改稱「現有名單」，左上角「午餐俱樂部」回到選擇名單的首頁。
- 修正「開吃!」文字置中、名單載入失敗的畫面復原、取消與重試；地圖失敗不會阻止選店。
- 營業篩選預設關閉。沒有營業時間的店仍能抽選，使用者可自行開啟「用餐時有營業」。
- 讀名單、抽午餐、看評論不需要網站內的會員登入。新增評論及投票必須使用 Google 帳戶登入。
- Google 帳號確認後才寫入信箱，不採用訪客自行填寫的信箱。
- 暱稱選填，評論顯示暱稱或 Google 名稱；完整信箱只保存在管理者的私人試算表。
- 每個 Google 帳號對每則評論可按讚、按爛、改票或取消，換裝置登入仍是同一票。

## 為什麼要多設定 Google 登入

「誰可以存取：擁有 Google 帳戶的任何人」是 Apps Script 的網站入口限制。網站以擁有者身分執行時，通常無法透過 `Session.getActiveUser().getEmail()` 取得訪客信箱，因此另外使用 Google OAuth 登入，確認訪客選擇的帳號。

網站仍以「我」執行，讓資料庫保持私人；不要改成以訪客執行，也不用給同事試算表編輯權。Google 官方說明：[Session](https://developers.google.com/apps-script/reference/base/session)、[OAuth 網站流程](https://developers.google.com/identity/protocols/oauth2/web-server)。

這次使用 Google 基本帳號登入，沒有新增 Maps／Places 或其他按量付費 API。需要建立 OAuth 用戶端 ID 與密鑰，但不是 Google Maps API 金鑰。

## A. 先更新網站，修正畫面與名單操作

1. 下載儲存庫最新版 `Lunch-Club-Apps-Script.zip`，解壓縮。
2. 在原 Apps Script 專案取代以下三個檔案的完整內容：`Code.gs`、`Index.html`、`appsscript.json`。請使用 ZIP 內的檔案；不要只貼未打包的 `apps-script/Code.gs`。
3. 保留既有 `SPREADSHEET_ID`、`ADMIN_PASSPHRASE` 及出發點設定。
4. 儲存後執行 `listCandidates`。資訊清單新增了外部連線權限，Google 如再次要求授權，由專案擁有者完成授權。
5. 「部署 → 管理部署 → 編輯」，版本選「新版本」後部署。更新原本的部署可以保留原 `/exec` 網址。
6. 重新開啟正式網址，確認按「現有名單」能看見 83 間店，左上角可回首頁。未設定 Google 登入前仍可抽選，但新評論及投票會要求登入。

**不用重新匯入 Excel，也不要覆蓋已累積的評論。** v6 會自動擴充舊評論表頭，保留原有列和 ID。

## B. 建立 Google 登入用戶端

使用自己的 Google 帳戶進入 [Google Cloud Console](https://console.cloud.google.com/)。

1. 選擇或建立這個私人 side project 專用的 Google Cloud 專案。
2. 開啟 **Google Auth Platform**，第一次使用先完成「開始使用」的基本資料：應用程式名稱填「午餐俱樂部」，支援及聯絡信箱填自己的信箱。
3. **目標對象（Audience）** 選「外部」，適合一般個人 Google 帳戶。若目前為測試狀態，在測試使用者加入自己及要試用的同事。正式提供其他人使用時，依 Google 畫面完成發布狀態設定。
4. **資料存取權（Data Access）** 僅使用基本身分範圍：`openid`、`https://www.googleapis.com/auth/userinfo.email`、`https://www.googleapis.com/auth/userinfo.profile`。不要額外要求同事的試算表、雲端硬碟或 Gmail 權限。
5. **用戶端（Clients）→ 建立用戶端 → 網頁應用程式**，名稱填「Lunch Wheel Web」。
6. **已授權的重新導向 URI** 填目前正式網站的完整 `/exec` 網址，必須完全相同，不加其他參數。
7. 本版使用後端授權碼流程，**已授權的 JavaScript 來源不用填**。
8. 建立後，保管好「用戶端 ID」和「用戶端密鑰」。密鑰只填下一節的指令碼屬性，不貼到 GitHub、HTML、試算表或聊天裡。

如果 Google 畫面名稱略有不同，請找 OAuth 用戶端及重新導向 URI 的對應設定。[官方用戶端設定](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)

## C. 把登入設定連到 Apps Script

原 Apps Script「專案設定 → 指令碼屬性」新增：

| 名稱 | 內容 |
|---|---|
| `GOOGLE_CLIENT_ID` | 上一步的用戶端 ID，結尾為 `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | 上一步的用戶端密鑰，只留在這裡 |
| `GOOGLE_REDIRECT_URI` | 上一步設定的完整正式 `/exec` 網址 |

儲存後重新開啟網站；指令碼屬性變更不需要再次更新部署版本。

原部署請保持 **執行身分：我**；**誰可以存取：擁有 Google 帳戶的任何人**。這也讓登入確認能綁定原本開啟網站的人，避免把別人的登入結果領走。若同時登入多個 Google 帳戶，請用同一個帳戶開啟原網頁與登入回來的頁面；無痕視窗只登入一個帳戶較容易確認設定。

## D. 實際驗收

1. 進入「現有名單」→「Google 登入」→「使用 Google 帳戶登入」。
2. Google 會在新分頁開啟。選擇帳戶，允許基本姓名及信箱資訊。
3. 顯示登入完成後回到原本頁面；網站會自動確認。若尚未更新，按「我已完成登入」。
4. 可填暱稱後儲存，也可以直接關閉。關閉或重新整理網頁後需再登入網站，最多維持兩小時。
5. 到一間店分享真實用餐心得，確認評論顯示暱稱；留空暱稱時顯示 Google 名稱。
6. 管理者在試算表 `Members` 查看帳號與暱稱；在 `Reviews` 查看該則評論使用的帳號。
7. 用另一個裝置登入同一帳號，確認同一則評論的投票能延續，不會變成兩票。

## 試算表變更

- `RestaurantsFree`：維持 14 欄，83 間店不需要重匯。
- `Reviews`：原本 8 欄後面追加 `author_email`、`author_name`、`author_nickname`。以前的匿名評論不會補造身分。
- `ReviewVotes`：維持 4 欄，新投票依 Google 帳號識別。舊匿名投票保留，無法猜測它屬於哪個帳號。
- `Members`：第一次成功 Google 登入時自動建立。欄位為 `google_id`、`email`、`google_name`、`nickname`、`updated_at`。`google_id` 使用 `google:` 前綴保留完整識別，避免試算表把長數字四捨五入。

試算表只給管理者存取。會員識別、完整信箱及 Google 密鑰不會寫入前端儲存空間；公開評論只回傳名稱與暱稱顯示結果。

## 常見問題

### 一開網站就有 iframe／local-network-access 警告

Apps Script 在網站外層加上安全隔離框架。`allow-scripts`、`allow-same-origin` 是 Google 使用的設定；`Unrecognized feature: local-network-access` 是瀏覽器對不認得的權限項目發出的訊息。單憑這些警告不能判斷名單載入失敗，這次沒有移除框架安全設定。[Google HTML 限制](https://developers.google.com/apps-script/guides/html/restrictions)

若名單仍無法開啟，請提供**點擊「現有名單」後畫面上的提示**；管理者也可到 Apps Script 左側「執行項目」查看 `getSharedHome` 是否有失敗紀錄。

### redirect_uri_mismatch

Google 用戶端「已授權的重新導向 URI」與 `GOOGLE_REDIRECT_URI` 必須完全相同，使用 `/exec`，不要填 `/dev`，不要附加參數。也確認已更新原本的部署。

### 登入未完成或已失效

取消舊的登入，從原頁重新開始。確認原頁和回來的頁面使用同一個 Google 帳戶；若 Google 應用程式仍是測試狀態，該帳戶需在測試使用者名單中。

### Google 登入沒有打開新分頁

按畫面上的「前往 Google 登入」連結。完成後回原頁按「我已完成登入」。

## 驗證範圍

本機測試以 Google 回應和試算表替身驗證身分流程、公開信箱保護、暱稱、改票、到期、舊資料升級及介面操作。真正的 Google 用戶端設定、正式 `/exec` 登入與 iPhone Safari 仍需按上述步驟在擁有者帳戶驗收。
