# Google 登入設定

v6.8 可由團長在網站檢查缺漏設定，並重新確認登入是否可用；見 [登入排查說明](browsing-and-login.md)。下方 B、C 節為建立用戶端與指令碼屬性的步驟。

登入機制從 **6.5.0** 起：請先依 [匿名與公開瀏覽指南](review-privacy.md) 更新 Code.gs、Index.html，部署選「我／任何人」。下方 6.0.x 為歷史修正紀錄；Google 用戶端設定步驟繼續沿用。

## 6.0.2：抽選預算與按鈕置中

「開吃!」會重新讀取店家名單。原本讀取驗證只接受數字或明確的 `null`；缺少 budget 或空字串都會拋出「預算請填 1～10000 整數或留空」，發生在篩選之前。本機已重現這兩種輸入的錯誤；尚未直接取得使用者正式網站的回傳內容。現在將讀取的缺值、空字串和純空白統一當作未標記，並讓抽選／重新整理名單使用與入口一致的 JSON 文字傳輸；寫入時的有效金額驗證保留。

「不拘」可以抽未標記預算的店，指定金額上限仍會排除未知或超額店家。真正填入非法金額時，提示會指出是哪間店的資料需要更正，不會靜默略過店家。

原程式在抽選成功或失敗後重新填入全形 `開吃！`；現在所有狀態共用同一個更新方式，還原半形 `開吃!`，保留相同的置中元素。測試涵蓋初始、成功、失敗後的文字與六種寬度。

從 v6／6.0.1 更新時，替換 **Code.gs、Index.html**，編輯原部署並選「新版本」。`appsscript.json`、授權及試算表欄位均未變更。使用說明會顯示「版本 6.0.2」。

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
- 每則評論可選匿名或自訂暱稱；Google 名稱與完整信箱不會自動公開，管理者可經授權查看帳號。
- 每個 Google 帳號對每則評論可按讚、按爛、改票或取消，換裝置登入仍是同一票。

## 為什麼要多設定 Google 登入

v6.5「誰可以存取：任何人」讓未登入者也能瀏覽；登入權限在留言及投票時檢查。網站以擁有者身分執行時，通常無法透過 `Session.getActiveUser().getEmail()` 取得訪客信箱，因此另外使用 Google OAuth 登入，確認訪客選擇的帳號。

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

更新到 v6.5 後，原部署請選 **執行身分：我**；**誰可以存取：任何人**。新登入以短期瀏覽器確認資訊驗證發起者，不再要求訪客先登入 Google 才能進網站；請在同一個瀏覽器完成登入。完整限制與驗收見 [v6.5 說明](review-privacy.md)。

## D. 實際驗收

1. 進入「現有名單」→「Google 登入」→「使用 Google 帳戶登入」。
2. Google 會在新分頁開啟。選擇帳戶，允許基本姓名及信箱資訊。
3. 顯示登入完成後回到原本頁面；網站會自動確認。若尚未更新，按「我已完成登入」。
4. 可選匿名或填寫自訂暱稱後儲存，也可以直接關閉維持預設匿名。關閉或重新整理網頁後需再登入網站，最多維持兩小時。
5. 到一間店分享真實用餐心得，確認匿名顯示「匿名食友」、自訂暱稱顯示填寫的名稱；暱稱選項留空不能送出。
6. 管理者在試算表 `Members` 查看帳號與暱稱；在 `Reviews` 查看該則評論使用的帳號，也可在網站以管理密語登入後按「查看留言者帳號（管理者）」。
7. 用另一個裝置登入同一帳號，確認同一則評論的投票能延續，不會變成兩票。

## 試算表變更

- `RestaurantsFree`：維持 14 欄，83 間店不需要重匯。
- `Reviews`：原本 8 欄後面追加 `author_email`、`author_name`、`author_nickname`；v6.5 再追加 `author_display_mode`。以前的匿名評論不會補造身分。
- `ReviewVotes`：維持 4 欄，新投票依 Google 帳號識別。舊匿名投票保留，無法猜測它屬於哪個帳號。
- `Members`：第一次成功 Google 登入時自動建立。欄位為 `google_id`、`email`、`google_name`、`nickname`、`updated_at`、`display_mode`。`google_id` 使用 `google:` 前綴保留完整識別，避免試算表把長數字四捨五入。

試算表只給管理者存取。會員識別、完整信箱及 Google 密鑰不會寫入前端儲存空間；公開評論只回傳匿名或自行填寫的暱稱。

## 常見問題

### 一開網站就有 iframe／local-network-access 警告

Apps Script 在網站外層加上安全隔離框架。`allow-scripts`、`allow-same-origin` 是 Google 使用的設定；`Unrecognized feature: local-network-access` 是瀏覽器對不認得的權限項目發出的訊息。單憑這些警告不能判斷名單載入失敗，這次沒有移除框架安全設定。[Google HTML 限制](https://developers.google.com/apps-script/guides/html/restrictions)

若名單仍無法開啟，請提供**點擊「現有名單」後畫面上的提示**；管理者也可到 Apps Script 左側「執行項目」查看 `getSharedHome` 是否有失敗紀錄。

### redirect_uri_mismatch

Google 用戶端「已授權的重新導向 URI」與 `GOOGLE_REDIRECT_URI` 必須完全相同，使用 `/exec`，不要填 `/dev`，不要附加參數。也確認已更新原本的部署。

### 登入未完成或已失效

取消舊的登入，從原頁重新開始。確認使用原本發起登入的同一個瀏覽器，且允許該網站的暫存登入資訊；若 Google 應用程式仍是測試狀態，該帳戶需在測試使用者名單中。

### Google 登入沒有打開新分頁

按畫面上的「前往 Google 登入」連結。完成後回原頁按「我已完成登入」。

## 驗證範圍

本機測試以 Google 回應和試算表替身驗證身分流程、公開信箱保護、暱稱、改票、到期、舊資料升級及介面操作。真正的 Google 用戶端設定、正式 `/exec` 登入與 iPhone Safari 仍需按上述步驟在擁有者帳戶驗收。
