# Lunch Club — 私人 Side Project

此專案與 IISI／RDSS 工作專案無關。
- 專案、規劃文件、測試與產出都保存在本專案目錄內，不寫入 IISI 工作目錄。
- 使用免費互動地圖與手動維護店家資料。兩入口：「自己建立」只存 localStorage；「使用現有資料」讀 Google 試算表，一般訪客可抽選、匿名留品項／回饋／分數及對評論按讚或爛；新增店家仍限管理者後端登入，不提供刪除。
- 評論分數 -100～200 整數，0 為「狗幹難吃」、100 為「頂上人間」。三分頁 RestaurantsFree／Reviews／ReviewVotes 以 ID 關聯；同一瀏覽器每則評論讚／爛互斥、可改票或取消。匿名識別不是防真人灌票保證。
- 管理密語只留在 Apps Script 指令碼屬性，不寫入前端、localStorage 或共用店家資料；每次共用寫入都必須在後端驗證。
- 建置：npm run build；語法檢查：npm run check。
- 完整可攜測試：npm test。GitHub 儲存庫：https://github.com/alvis9315/lunch-wheel 。提交不得包含密語、帳戶設定、本機 QA 或私人路徑；推送依使用者授權執行。
- 葷／素標記支援 unknown／meat／vegetarian／both。出發點為每個瀏覽器的個人設定；避雨路線綁定新增時的出發點，換起點不可沿用未確認路線。
- 文件放 docs/，本機測試工具放 .local-qa/。
- 提供本機檔案時附可複製的 Windows 路徑，勿只提供點擊連結。
