# 午餐俱樂部 · 免費版（v6.7：統一分類主清單）

**6.7.0：**分類統一為附圖的固定 27 類，名稱、順序、圖示、團長選項及前後端檢查共用一份設定；韓式料理改為韓式，新增飯糰飯捲、鵝肉專賣、燒臘、義式、壽司、泰式、日式定食。試算表決定各店歸類與店數；新增類別要更新程式並部署。完整替換 **Code.gs、Index.html** 並部署新版本。保留推薦店家功能與自動建立的 Suggestions 分頁。詳見 [分類、投稿與更新說明](docs/suggestions-and-categories.md)。

**6.5.0：**評論可選匿名或自訂暱稱，不再自動公開 Google 名稱；管理員登入後可逐則查看對應帳號。入口公開，留言／投票時才要求 Google 登入。更新 **Code.gs、Index.html**，部署設「我／任何人」，試算表維持限制共用。Reviews、Members 各自動追加一欄，原店家不用重匯。操作、部署與隱私範圍見 [v6.5 說明](docs/review-privacy.md)。

本版已移除 Google Maps JavaScript／Places API，不需要 Maps 金鑰、綁卡或啟用 Google Cloud 計費。使用現成免費／開源資源，依各服務允許的用量使用，不會自動升級成付費。

## 歷史版本（分類規則以 v6.7 為準）

**6.4.0 餐點類別更新：**入口改為早餐／早午餐、牛排、牛肉麵等具體餐點，同店可有多個類別。試算表沿用 **G 欄 category**，用頓號分隔，例如 `早餐／早午餐、義大利麵、咖啡／甜點`；不用新增欄位或重匯資料。「正餐」等舊大類保留在不限／尚未分類，不猜餐點。分類為 0 間時顯示尚無分類資料。多類別不會重複列入轉盤或增加機率。先更新 **Code.gs、Index.html** 並部署新版本，再依 [分類填寫範例](docs/fill-restaurant-data.md) 補資料。

**6.3.0 瀏覽與導覽更新：**頂端獨立「抽午餐／店家與食評」入口，不必先挑午餐就能看店家、留言與按讚／爛；切換時保留正在挑選的午餐。三步驟改成大型按鈕，手機也有數字圓標與目前步驟。資料提醒區分基本資料與選填資訊，並列各項待補數量。[管理者補資料指南](docs/fill-restaurant-data.md) 說明每個試算表欄位如何填。更新 **Code.gs 與 Index.html**，部署新版本；不重匯試算表。

**6.2.0 流程更新：**選類型後，左側篩選、右側每排 3 張店家卡片，勾選 2～20 間並確認，才進入獨立大轉盤。手機為單欄及可收合篩選。「自己建立」暫停開放、私人資料保留。原始清單已填的分類可按店家 ID 銜接。請更新 **Code.gs 與 Index.html** 並部署新版本，完整操作見 [v6.2 更新與分類維護](docs/workflow.md)。

**6.1.0 資料防呆：**逐筆處理店家缺值與錯誤資料，缺必要資料的店保留並標示暫不可抽選；未知資訊不通過指定篩選。評論空分數不當零分，異常評論／投票不拖垮其他資料，私人名單讀取保留原內容。完整逐欄處理與驗證範圍見 [資料缺漏與防呆](docs/data-quality.md)。更新 `Code.gs`、`Index.html` 並部署新版本。

**6.0.2 抽選更新：**修正空白／缺少預算在重新讀取名單時被拒絕的問題。「不拘」允許未標記預算的店，選金額上限時仍會排除。抽選成功或失敗後統一還原半形 `開吃!`，避免回到全形驚嘆號造成視覺偏移。更新 `Code.gs`、`Index.html` 後編輯原部署、選「新版本」；使用說明顯示「版本 6.0.2」。

**6.0.1 名單入口更新：**「現有名單」改由 Google 回覆後直接整理店家並切換畫面，回傳採文字格式；逾時處理持續到畫面準備完成。更新 ZIP 中的 `Code.gs` 與 `Index.html`，再編輯原部署、選「新版本」。開啟網站使用說明可確認「版本 6.0.1」。試算表及既有設定保留。

已部署的使用者請先閱讀 [v6 更新與 Google 登入設定](docs/google-login.md)。更新三個部署檔案即可修正首頁、名單與轉盤操作；記名評論需要額外設定免費的 Google OAuth 用戶端。既有 Excel 不需重匯，舊評論及投票保留。

## 目前開放：現有名單

- 讀取管理者的私人 Google 試算表。開啟網站先讀取類型，再篩選並勾選店家，確認後才進入轉盤。
- 一般訪客可以挑選、抽午餐；Google 登入後可評論與投票。新增店家仍限管理員登入，資料由擁有者維護，不提供刪除。
- 「自己建立」暫停開放，既有私人資料與程式保留供後續重做。網站不會清除或改寫私人名單。
- **儲存庫不含 Google 帳戶設定或私人店家名單**；現有名單需完成部署，記名評論另依登入指南設定。

## 功能與取捨

| 功能 | 免費版作法 |
|---|---|
| 地圖 | Leaflet 1.9.4 + OpenStreetMap；點位置新增，收藏店家可點開 |
| 找新店 | 按「到 Google Maps 找店」開新分頁查看，再自行新增；網站搜尋只查目前選用的名單 |
| 店家資訊 | 店名、地址、座標、電話、每週營業時段自行填寫與維護；不自動讀取 Google 資料 |
| Google Maps | 僅使用免金鑰的外部搜尋／導航／分享連結，無 Google API 呼叫 |
| 共用資料庫 | Google 試算表 + Apps Script 原生 SpreadsheetApp，Google 登入使用外部 HTTP 權限 |
| 品項評論 | 共用店家詳情可填品項、回饋、-100～200 整數分數；滑桿與直接輸入連動，即時顯示分級文案 |
| 評論投票 | 同一 Google 帳號對每則評論可選讚／爛，互斥、可改票與取消；不影響原分數或抽選機率 |
| 名單 | 現有名單需管理員登入才可新增；網站不提供刪除；同名及約相同座標去重；總名單可超過 20 間；私人入口暫停 |
| 抽選 | 個人勾選 2～20 間；套用 AND 篩選後至少 2 間；等機率、2.5 秒動畫 |
| 篩選 | 直線距離、雨天可避雨、預算、料理、例行營業時段、避免連續吃同店 |
| 葷／素 | 不限制／葷食／素食；店家可標記葷素皆有，未確認者不通過指定葷素條件 |
| 出發點 | 頁面上方隨時更換：填座標、使用目前位置或在同一張地圖選點；個人瀏覽器保存，更新距離、天氣與導航起點 |
| 天氣 | Open-Meteo 非商業免費 API；用餐區間最大降雨機率 ≥50% 視為雨；失敗可手選 |
| 手機 | 手機切換名單／地圖，適用觸控操作；正式 Safari 還需部署後實機驗收 |

**無法免費保證的部分：** Google 完整店家搜尋、評分、電話、即時營業／特殊假日資料自動同步。免費嵌入 Google 地圖不等於可以從嵌入頁讀出店家資料。此版不使用爬蟲或讀取 Google Maps 網頁內容。

營業篩選預設關閉，開啟後依管理者填寫的營業時間推估。未知日不當作營業或休息。每天可填 1～2 段，支援午休間斷與跨夜；關門早於開門表示翌日，不支援起訖相同代表 24 小時。臨時停業／特殊假日請電話確認。有電話會提供撥號；沒有電話不編造資料。

## 本機預覽與建置

```powershell
git clone https://github.com/alvis9315/lunch-wheel.git
cd lunch-wheel
npm run build
npm test
```

需要 Node.js 18 以上，不用 npm install。Leaflet 固定版本已放在 vendor，下載時核對官方 SHA-256；授權見 `vendor/Leaflet-LICENSE.txt`。部署檔已提供在 dist/，也可直接下載 Lunch-Club-Apps-Script.zip。GitHub 是原始碼儲存庫；Google 共用功能依下列步驟部署到 Apps Script。

直接開啟 `dist/Index.html` 不會連上 Google 試算表；請部署到 Apps Script 後使用現有名單。本機自動化使用試算表替身，不操作真實線上資料。

**正式部署不會加入虛構示範資料。** 新試算表初始空白，等你新增真實店家。

## 部署：只需要 Google 帳戶和試算表

1. 建立一份 Google 試算表，記下網址 `/d/` 與 `/edit` 之間的 ID。**試算表與 Apps Script 編輯權只留給你自己**，不用公開或發布試算表；使用者透過網站讀取名單。
2. 開啟「擴充功能 → Apps Script」，將下列建置產物貼入專案：
   - `dist/Code.gs` → `Code.gs`（已含共用驗證函式；勿只複製 apps-script/Code.gs 原始範本）
   - `dist/Index.html` → HTML 檔 `Index`
   - `dist/appsscript.json` → 開啟專案設定的 manifest 顯示後貼入
3. 在「專案設定 → 指令碼屬性」填寫：

| 屬性 | 說明 |
|---|---|
| SPREADSHEET_ID | 必填：共用試算表 ID |
| ADMIN_PASSPHRASE | 管理員密語。20～256 字元，建議用密碼管理器產生至少 32 字元的隨機值。未設定或太短時，共用新增功能關閉，訪客仍可讀取。請自行在指令碼屬性填入，不要寫入 HTML、程式碼或名單分頁 |
| ORIGIN_LAT | 北二門精確緯度 |
| ORIGIN_LNG | 北二門精確經度 |
| ORIGIN_NAME | 選填：共用預設出發點名稱；預設板橋車站・北二門 |
| TILE_URL | 選填：可切換圖磚服務；預設 https://tile.openstreetmap.org/{z}/{x}/{y}.png |
| TILE_ATTRIBUTION | 更換圖磚服務時必填該服務的署名文字 |

未填原點時，使用車站附近 `25.0143,121.4638` 並標示待校正，**不宣稱這就是北二門精確座標**。

每位使用者可在「更換出發點」設定自己的位置，無須管理員登入；個人設定不改變其他人的起點。ORIGIN_LAT／ORIGIN_LNG 也可填別處作為網站預設出發點，請同步設定 ORIGIN_NAME。

4. 在編輯器執行 `listCandidates`，由擁有者授權讀寫試算表。這是 Google 帳戶授權，不是啟用 Cloud 計費，也不需要 API key。
5. 「部署 → 新增部署 → 網頁應用程式」。以擁有者執行，存取範圍按實際使用者設定。能開網站的人可讀取名單；依 v6 指南設定並完成 Google 登入後才能寫評論與投票；新增店家一定檢查後端管理員憑證。
6. 開啟 `/exec`，選「現有名單」→「管理員登入」，輸入你設定的密語，再透過地圖／新增按鈕輸入店家。用第二個瀏覽器確認可讀取、抽選，且未登入不能新增。iPhone Safari 登入、地圖拖移、撥號、導航需實機驗收。
7. 改版時重跑 build、更新檔案並建立新部署版本。建置出的 HTML 已包入程式、樣式及 Leaflet，不需額外主機。

### 管理登入的保護方式

- `ADMIN_PASSPHRASE` 留在 Apps Script 指令碼屬性；不回傳給瀏覽器、不放試算表店家分頁。指令碼屬性不是對專案編輯者保密的保管庫，因此不要給他人專案編輯權。
- 登入成功取得隨機短期憑證，只存在目前頁面記憶體；密語欄位立即清空，不存 localStorage／sessionStorage。每一次新增都由後端重新驗證憑證，不相信前端「已登入」旗標。
- 憑證最長有效 30 分鐘。重新整理後需重新登入；伺服器快取提早清除時也需重新登入。登出撤銷憑證，變更密語會使所有舊憑證失效。
- 所有訪客合計在 10 分鐘窗口內失敗 10 次，就暫停登入直到窗口結束。這是小型私人專案的全站限制，沒有個人帳號／IP 識別；他人重複嘗試也可能讓你暫時無法登入。擁有者可從指令碼屬性移除 `ADMIN_LOGIN_ATTEMPTS` 重設。
- 公開資料／登入接口為 `getBootstrap`、`listCandidates`、`adminLogin`、`adminLogout`、`addCandidate`。另有 `getSharedHome`、`listReviews`、`addReview`、`setReviewVote`、`beginGoogleSignIn`、`getGoogleSignInResult`、`saveMemberNickname`、`memberLogout`；它們不會授予新增店家的權限。驗證等內部函式以 `_` 結尾，不能由 google.script.run 呼叫。無店家 delete/update 接口；投票可以改票或取消。
- Google 試算表技術上也能讓後端讀密語，但本版刻意將密語與名單分開；隱藏分頁本身不是存取權限控制。

參考：[指令碼屬性](https://developers.google.com/apps-script/guides/properties)、[Apps Script 前後端通訊及私有函式](https://developers.google.com/apps-script/guides/html/communication)。

## 試算表資料

同一份試算表拆為四個分頁，程式自動建立所需表頭：

| 分頁 | 一列代表 | 關聯 |
|---|---|---|
| RestaurantsFree | 一間店家 | id |
| Reviews | 一則品項／回饋／分數 | restaurant_id 對應店家 id |
| ReviewVotes | 一個 Google 帳號對一則評論的投票狀態 | review_id 對應評論 id；同組合改票更新同列 |
| Members | 一個經 Google 驗證的帳號、信箱、名稱及選填暱稱 | google_id |

評論保存經 Google 驗證的信箱、名稱與暱稱，以及建立時間和重試識別碼。公開評論顯示匿名食友或自行填寫的暱稱，不回傳 Google 名稱、完整信箱或帳號識別；同一 Google 帳號換裝置仍共用投票狀態。舊匿名評論及投票保留，無法補造帳號關聯。一人擁有多個帳號仍可分別投票。

店家詳情的分數為所有品項心得平均，附評論筆數；每次載入 20 則，按更多可繼續讀取。3 欄必填、301 個整數都有分級、評論內容當純文字呈現。細節、欄位表與全部分數文案見 `docs/reviews.md`。

店家分頁 `RestaurantsFree`：

`id | name | address | lat | lng | phone | category | budget_twd | covered_route | weekly_hours | maps_url | added_at | diet | covered_origin`

v4 的 12 欄表頭會自動補上最後兩欄，舊列、ID 與評論關聯保留；diet 未填視為 unknown。雨天標記綁定 covered_origin 記錄的出發點，使用者換起點後不能沿用未確認的避雨路線。操作與資料格式見 `docs/preferences.md`。

`weekly_hours` 為網站產生的 7 天 JSON，順序為星期日～星期六；每項包含 `status`（unknown／closed／open）及 `spans`（最多兩段 from／to 時間）。建議先用管理登入表單新增，避免手寫 JSON。店家資料由管理者確認；網站尚未提供修改功能，擁有者可直接在試算表更正，請保留格式。網站不可刪除不等於試算表擁有者失去原生編輯權。

提供初始店家時可依 `docs/restaurant-input.md` 貼文字資料。只有 Google Maps 連結不會自動填入電話／時段；位置必須確認後才新增到地圖。未提供的選填欄位保留未知。

舊版 `Restaurants` 分頁不會刪除或覆寫，也不會再查詢其中 Place ID。若已有舊版真實名單，需補足名稱、位置與營業資料才能加入新版；此版沒有以付費 API 自動搬資料。

共用新增先經伺服器驗證登入權限與欄位，Script Lock 包住授權檢查、去重及寫入；試算表文字以安全字串保存，避免名稱被當作公式。無 Google API 金鑰讀取、僅 Google 登入使用 UrlFetchApp。個人勾選與上次用餐記錄仍存在瀏覽器，與他人分開。

## 免費服務的合理限制

- [OpenStreetMap 圖磚政策](https://operations.osmfoundation.org/policies/tiles/)：公共圖磚供一般互動瀏覽，保留 OSM 署名及有效 Referer，遵守瀏覽器快取；不預抓城市圖磚、不提供離線下載。服務有容量限制，無可用性保證；超量可能被限制。此版自動化測試攔截圖磚，不讓 headless 測試向公共服務下載地圖。
- [Open-Meteo 免費方案](https://open-meteo.com/en/pricing)：只適用其允許的非商業用途及免費用量，需保留來源說明；未來改成商業用途要重新評估。
- [Apps Script 配額](https://developers.google.com/apps-script/guides/services/quotas)：一般 Google 帳戶有每日用量限制，超限會暫停／報錯；本程式沒有接任何按量付費 API。
- **不內建公共 Nominatim 搜尋**：不能直接把它當免費 Google Places 替代品。其[政策](https://operations.osmfoundation.org/policies/nominatim/)要求開發者知情選用、全應用最多每秒 1 次、快取、不做 autocomplete 等。本版搜尋的是自有名單，找新店使用外部 Google Maps 連結。

## 驗證（v6）

- `npm test` 執行語法檢查、建置與 tests/ 中的五組測試，無額外測試套件依賴。
- `tests/data-quality.test.cjs`：逐欄缺值與錯誤格式、壞資料隔離、未知篩選、原列保留、評論與投票完整性及預報缺漏。
- `tests/catalog.test.cjs`：管理員登入及權限邊界、欄位與營業時段、去重、公式安全。
- `tests/reviews.test.cjs`：分級、評論關聯、重試、平均、分頁、投票與頻率限制。
- `tests/identity.test.cjs`：Google 登入、PKCE、登入者綁定、重放拒絕、信箱保護、暱稱、同帳號投票、登出與到期、舊評論升級。
- `tests/preferences.test.cjs`：葷素篩選、未知排除、出發點驗證、距離／雨天起點綁定、舊表頭遷移。
- 本機 Chromium 的 v6 測試通過兩入口、回首頁、取消／重試／逾時、地圖失敗隔離、83 間店、Google 登入替身、暱稱、評論／投票及六種寬度測試；截圖已檢視。這些瀏覽器測試工具與影像保留於本機，不包含於儲存庫。
- Google 服務在自動化測試中以本機替身模擬，並非已連上實際帳戶的證據。
- 入口／轉盤／地圖 375、390、430、768、1024、1440 寬度無水平溢出；截圖已檢視。
- OSM 圖磚與天氣攔截為測試資料，不代表真實道路或預報，也不向公共圖磚服務發自動化請求。
- 實際 Google 試算表帳戶未提供，正式多人讀寫、HTTPS 原站圖磚載入與 iPhone Safari 仍待部署驗收。

## 參考

- [Leaflet](https://leafletjs.com/)／[固定版本下載及校驗值](https://leafletjs.com/download.html)
- [Google Maps URLs：不需 API key](https://developers.google.com/maps/documentation/urls/get-started)
- 視覺操作參考：[Mapstr](https://www.mapstr.com/)、[Picker Wheel](https://pickerwheel.com/)
