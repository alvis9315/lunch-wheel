# Lunch Club — 私人 Side Project

此專案與 IISI／RDSS 工作專案無關。
- v6.7 優先：固定 27 類主清單集中於 src/catalog.js categoryDefinitions，名称／排序／圖示／前後端讀寫檢查／團長選項共用；不自動新增試算表自訂類別。韓式料理讀為韓式，其他清單外分類提示待確認但不改原表。入口只顯示有店家的主清單類別。主清單變更必須重建並更新 Code.gs 與 Index.html。Suggestions 只存投稿，Google 登入後送出、團長才可讀與處理，不自動寫入店家名單。詳見 docs/suggestions-and-categories.md。
- v6.5：匿名／自訂暱稱二選一，新會員預設匿名；公開評論不得回傳 Google 名稱、信箱或匿名時的暱稱。getReviewAuthor 每次驗證管理者，關閉／登出清除私人 DOM 且忽略遲到回應。Reviews 追加 author_display_mode、Members 追加 display_mode；升級只補表頭。公開瀏覽使用「我／任何人」，留言／投票須 Google 登入。OAuth 瀏覽器確認資訊短暫存放，會員／管理者憑證不得持久儲存。詳見 docs/review-privacy.md。
- v6.4 分類以具體餐點為準，同店可有多個類別；沿用 RestaurantsFree.category（G 欄）以頓號分隔，不新增欄位。舊正餐／國別料理等大類不猜成特定餐點，仍包含在不限／尚未分類。類別重複與跨類別不得增加轉盤機率。新類別及別名以 src/catalog.js 為準。
- v6.3 頂端「店家與食評」是獨立入口，不依賴午餐類型或勾選；切換區塊保留進行中的午餐選擇。資料提醒區分基本資料與選填缺漏，填寫指南在 docs/fill-restaurant-data.md。
- v6.2 目前只開放「現有名單」：選類型 → 左側篩選／右側店家卡片 → 確認名單 → 獨立轉盤。「自己建立」暫停開放，保留既有私人資料與程式供後續重做。此規則優先於下方舊版兩入口描述。
- 專案、規劃文件、測試與產出都保存在本專案目錄內，不寫入 IISI 工作目錄。
- 使用免費互動地圖與手動維護店家資料。兩入口：「自己建立」只存 localStorage；「現有名單」讀 Google 試算表，一般訪客可抽選、看評論；經 Google 登入驗證後可留品項／回饋／分數及對評論按讚或爛，可選匿名或自訂暱稱，完整信箱只存私人試算表並限管理者授權查看；新增店家仍限管理者後端登入，不提供刪除。
- 評論分數 -100～200 整數，0 為「狗幹難吃」、100 為「頂上人間」。四分頁 RestaurantsFree／Reviews／ReviewVotes／Members 以 ID 關聯；同一 Google 帳號每則評論讚／爛互斥、可改票或取消。舊匿名評論及投票保留，不補造作者身分。Google OAuth 密鑰只存指令碼屬性，會員憑證只留頁面記憶體，每次寫入由後端驗證。
- 管理密語只留在 Apps Script 指令碼屬性，不寫入前端、localStorage 或共用店家資料；每次共用寫入都必須在後端驗證。
- 建置：npm run build；語法檢查：npm run check。
- 完整可攜測試：npm test。GitHub 儲存庫：https://github.com/alvis9315/lunch-wheel 。提交不得包含密語、帳戶設定、本機 QA 或私人路徑；推送依使用者授權執行。
- 葷／素標記支援 unknown／meat／vegetarian／both。出發點為每個瀏覽器的個人設定；避雨路線綁定新增時的出發點，換起點不可沿用未確認路線。
- 文件放 docs/，本機測試工具放 .local-qa/。
- 資料防呆依 docs/data-quality.md：讀取容錯與新增驗證分開；未知不冒充符合篩選。必要欄位缺漏或重複編號保留店家但暫不抽選，選填格式錯誤標示未知。不得以整理後的缺值覆蓋原始私人店家資料；空白評論分數不當 0 分，異常列不影響其他有效列。
- 提供本機檔案時附可複製的 Windows 路徑，勿只提供點擊連結。
