# 共用名單：品項評論與讚／爛

## 操作

「現有名單」→ 點店家 →「吃過的人，出來說兩句。」→「我吃過，讓我說」。

- 三欄必填：品項 1～100 字、回饋 1～1500 字、-100～200 整數分數。
- 分數可拖滑桿或直接輸入，兩者連動，並即時顯示嘴砲分級。
- 評論及投票須先用 Google 帳號登入；在帳號設定匿名或自訂暱稱，新評論自動沿用，Google 名稱不自動公開。管理密語授權新增店家及查看留言者帳號，兩種登入分開驗證。詳見 [匿名與公開瀏覽](review-privacy.md)。
- 最新評論在前，每次載入 20 則；可以繼續載入。
- 店家詳情顯示全部品項心得的平均分數與筆數。平均分數不是 Google 評分，也不是按讚加權；沒有評論時顯示尚未有人評分，不當作 0 分。
- 讚／爛是對評論的回應。每個 Google 帳號對每則評論最多一個狀態：讚、爛、未投票；可切換，再按同一個按鈕取消。
- 分數與讚／爛不改變輪盤入選名單或抽中機率。
- 私人 localStorage 名單沒有共用評論功能，亦不會呼叫評論接口。

## 同一份 Google 試算表，四個分頁

### RestaurantsFree：店家

店家資訊與評論分開；v5 在原表頭末尾追加葷素與避雨出發點：

`id | name | address | lat | lng | phone | category | budget_twd | covered_route | weekly_hours | maps_url | added_at | diet | covered_origin`

一列一間店，只有管理者經過後端驗證才能從網站新增。

### Reviews：品項評論

`id | restaurant_id | item | feedback | score | author_key | request_id | created_at | author_email | author_name | author_nickname | author_display_mode`

| 欄位 | 用途 |
|---|---|
| id | 評論的唯一 UUID |
| restaurant_id | 對應 RestaurantsFree.id，改店名仍保留關聯 |
| item | 吃的品項 |
| feedback | 實際回饋，當作純文字顯示 |
| score | -100～200 整數，平均分數以此計算 |
| author_key | Google 帳號識別的 SHA-256，不回傳到公開評論 |
| request_id | 同一次送出重試使用同一 ID，防止重複新增 |
| created_at | 伺服器產生的 ISO 時間；網站以台北時區顯示 |
| author_email | 經 Google 驗證的完整信箱，只給管理者查看 |
| author_name | 留言當時的 Google 名稱 |
| author_nickname | 留言當時填寫的暱稱；匿名時只限管理者查看 |
| author_display_mode | anonymous＝匿名、nickname＝自訂暱稱；舊列留白保留有效自訂暱稱，其餘匿名 |

### ReviewVotes：評論投票

`review_id | voter_key | value | updated_at`

一列為「一個 Google 帳號對一則評論」；以 review_id + voter_key 作為唯一組合。value 為 1（讚）、-1（爛）、0（取消）。改票更新同一列，取消寫 0，不刪資料。

票數由後端統計，不接受前端送來的總票數；按讚不會修改原評論分數。不要另設 likes/dislikes 欄位再手動維護，以免兩份數字不同步。

首次讀取評論時自動建立 Reviews 與 ReviewVotes 表頭；現有 RestaurantsFree 保留。表頭不符會報錯，不覆寫原資料。仍需先設定 SPREADSHEET_ID 並完成 Apps Script 部署。

### Members：Google 帳號

`google_id | email | google_name | nickname | updated_at | display_mode`

第一次成功登入時自動建立。google_id 加上 `google:` 前綴保存為文字，避免試算表把長數字四捨五入。信箱及名稱由 Google 確認，display_mode 保存新評論的預設匿名／暱稱選擇；不要公開分享此試算表。

## 身分與資料保護的實際範圍

- 透過 Google 授權碼流程確認帳號，不相信前端自行填寫的信箱；OAuth 密鑰只留 Apps Script 指令碼屬性。設定見 [Google 登入指南](google-login.md)。
- 網站登入憑證只留頁面記憶體，最長兩小時；每次評論及投票都由後端驗證，登出後撤銷。換裝置以同一 Google 帳號登入仍使用同一個投票身分。
- 一人持有多個 Google 帳號仍能各自投票。舊匿名評論標示「以前的匿名食友」，舊票保留但無法連回 Google 帳號。
- 同一帳號每分鐘最多新增 5 則、滾動 24 小時最多 50 則，重試已寫入的同一則不佔新名額。
- 評論與投票寫入由 Script Lock 序列化，並檢查店家／評論存在。文字防試算表公式注入，前端轉義 HTML，不執行留言中的標籤或程式。
- 公開評論回傳品項、回饋、分數、時間、票數、作者顯示名稱及目前帳號的投票狀態；不回傳完整信箱、作者／投票者識別碼或管理密語。登入者可在自己的帳號畫面看到本人信箱。
- 網站提供管理者逐則查看作者帳號，不提供評論刪除、修改與投票明細管理畫面。擁有者仍可在私人試算表原生管理資料；請保留 ID、欄位格式與關聯。
- 目前依需求面向小群同事使用，後端會讀取分頁資料進行統計，適合小型名單；這次沒有把 Google Sheets 當作大量公開社群的資料庫。

## 分數文案

| 區間 | 顯示文案 |
|---|---|
| -100～-51 | 廚餘桶都申請退貨 |
| -50～-1 | 我付錢，味蕾坐牢 |
| 0～19 | 狗幹難吃 |
| 20～39 | 能吃是它唯一的才華 |
| 40～59 | 吃的是飯，吞的是委屈 |
| 60～79 | 有料，這次先不嘴你 |
| 80～99 | 好吃到想幫老闆洗碗 |
| 100～124 | 頂上人間 |
| 125～149 | 這口下去，直接原諒世界 |
| 150～174 | 廚房是不是藏了小當家 |
| 175～199 | 我吃一點，整盤都是我的 |
| 200 | 好吃到想把戶籍遷過來 |

0 與 100 的用詞由使用者指定，其餘為本專案原創／改寫。平均分數顯示一位小數，其形容詞依四捨五入整數對應區間。完整分級集中在 src/reviews.js，可自行改文字；既有評論儲存分數，不重複存形容詞。

已搜尋 Threads 與台灣迷因資料，未能可靠取得完整脆原貼，因此不宣稱本表是 Threads 既有流行分級。語氣參考：[GQ 的「你好，我吃一點」脆報](https://www.gq.com.tw/article/threads-%E4%BD%A0%E5%A5%BD-%E6%88%91%E5%90%83%E4%B8%80%E9%BB%9E)、[TVBS 記錄的「盤子」Threads 用法](https://news.tvbs.com.tw/life/2629363)。未複製網友的完整評論或梗圖。

## 驗證

- `tests/reviews.test.cjs`（npm test）：301 分級完整、四分頁、無效欄位、不存在店家、重試去重、文字安全、摘要分數、游標分頁、隱私欄位、不同投票者、改票／取消、限制頻率、管理權限分離。
- v6 本機瀏覽器驗證 Google 登入替身、匿名與自訂暱稱顯示、完整信箱不出現在公開評論、評論／投票、私人模式隔離及手機排版；瀏覽器工具與影像未納入公開儲存庫。
- `tests/identity.test.cjs` 驗證登入綁定、重放拒絕、長數字帳號保留、同帳號投票、登出／到期／設定輪替失效與舊評論表頭升級。
- 測試執行實際建置的 Code.gs，Google Sheets／Cache／Lock 使用本機替身。網頁自動化攔截 OSM 與天氣，不向公共圖磚服務下載測試地圖。
- Google 帳戶仍未連接；真正部署、多人使用、iPhone Safari 的滑桿／數字鍵盤與試算表權限需在部署後驗收。
