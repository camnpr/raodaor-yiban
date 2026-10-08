<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-docs/import-api.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 绕道儿文档 —— 导入加工对接文档（Import API · Phase 1）

> 面向**第三方应用（下称「目标 APP」）的开发者**：把自有的「导入 CSV/Excel」升级为
> 「上传 → 在线加工 → 结构化读回 → 校验入库」的完整闭环，而无需自建在线表格。
>
> **架构定调**：目标 APP 的业务表是**唯一的 System of Record**；绕道儿文档的在线表格是
> **Interaction Layer**（可编辑的导入向导 + 批量录入界面），不持有权威数据。

---

## 0. 适用场景与复用说明

### 0.1 什么场景适合接入

| 你当前的状况 | 接入后 |
| :--- | :--- |
| 有「导入 Excel/CSV」功能，但用户上传的表格很脏（列名乱、有合并单元格、空行、日期格式五花八门） | 上传后进入在线表格，用户可清洗 / 改列名 / 删空行 / 补数据，再读回 |
| 自研导入向导是「字段映射表单」，列一多就难用 | 把映射环节变成可编辑的表格 + 行级校验标注 |
| 想让用户批量录入结构化数据，但自己做表格编辑成本过高 | 直接复用成熟 Canvas 表格引擎（公式 / 协同 / 排序筛选 / 数据验证） |
| 只需要「读写表格数据」，不需要嵌入编辑界面 | 只用 §5.2 + §5.3 两个端点即可，不必走完整流程 |

**不适合**：希望把在线表格当作主数据库长期存放业务数据（见 §1 的原则说明）。

### 0.2 复用本文档：替换为你的信息

本文档可直接复制给任意目标 APP，只需替换以下占位内容：

| 占位 | 替换为 |
| :--- | :--- |
| `https://your-app.com` | 目标 APP 的域名（需加入 §3.1 的两处白名单） |
| `/api/your/import-preview` | 目标 APP 自己的校验端点 |
| 「你的业务表」（如 `WorkItem`） | 目标 APP 的权威数据表 |
| `#ffe6e6` 标红色值 | 可自定义 |

> 文中「任务名 / 负责人 / 工期」等示例数据仅为说明二维数组的形态，替换为你自己的业务列即可。

### 0.3 图例

| 图例 | 含义 |
| :--- | :--- |
| ✅ | **本 Phase 新增，已实现** |
| ♻️ | **现有能力，可直接复用**，无需改动 |
| ⚠️ | 已知限制，见 §7 |

**术语对照**：本文档中的 `documentId` 即绕道儿文档内部的 `workbookId`（`Workbook` 表语义 = 通用文档），两者是同一个值。

---

## 1. 架构定调：单向权威 + 双向同步

```
┌─────────────────────────────────────────────────────────────┐
│  目标 APP 后端                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 业务表 = System of Record                             │  │
│  │ （如 WorkItem：依赖 / 排期 / 工时 / 业务约束）          │  │
│  └───────────────────────────────────────────────────────┘  │
│        ▲ 入库（校验通过后）          │ 字段映射 + 业务校验    │
│        │                            ▼                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 目标 APP 前端：预览 / 错误列表 / 驱动在线表格标红        │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────┬──────────────────────────────────▲─────────────┘
             │ REST（用户 JWT）                  │ JSON 二维数组
             ▼                                  │
┌─────────────────────────────────────────────────────────────┐
│  绕道儿文档 = Interaction Layer                              │
│  Canvas 表格引擎 · 公式 · 多人协同 · 版本 · 单元格级权限       │
│  角色：可编辑的导入向导（清洗 / 改列名 / 删空行 / 补数据）      │
└─────────────────────────────────────────────────────────────┘
```

**为什么不让在线表格持有权威数据**

业务数据的本质往往是**结构化关系 + 约束**（如任务间的依赖、资源冲突、状态流转），而表格是二维结构，表达关系只能靠冗余列（如「前置任务 ID」）。把权威数据放进表格，等于把用户从「Excel 地狱」搬进「在线 Excel 地狱」——关系断裂、无法统计的病根没变。

因此推荐：**业务库做权威，表格做交互**；表格的改动经目标 APP 校验后才写入业务库。

> 若你的产品本就是「轻量表格型」（如多维表格 / 简易台账），反过来让表格做权威源也成立——但那需要关系字段与视图层能力，超出本文档范围。

---

## 2. 能力边界

| Phase 1 **做** | 后续 Phase（**未包含**） |
| :--- | :--- |
| 上传 xlsx/csv → 生成在线文档 | iframe 嵌入到目标 APP 页内（Phase 3） |
| 结构化 JSON 读出 | Webhook 变更通知（Phase 4） |
| 校验结果标红回写 | 图表 / 透视表统计（Phase 5） |
| 暂存文档清理 | —— |
| 用户 SSO 登录取 token | —— |

> 已上线但**不在本契约内**的两项能力（用得上请直接看对应文档）：
> - **组织级隔离与共享**（组织即计费主体，成员共享配额）→ [billing.md](./billing.md)
> - **服务端通道**：组织级 API Key + `/api/v1/open/*` → [open-api-guide.md](./open-api-guide.md) / [organization-api-keys.md](./organization-api-keys.md)

---

## 3. 前置条件

### 3.1 平台侧（绕道儿文档部署方配置）

以下四项**缺一不可**，缺少任一项都会导致对接卡在第一步且现象难以定位。

**后端（`.env.production`）**

```bash
# 1. CORS：必须放行目标 APP 的域名，否则浏览器预检被拒，表现为「请求无响应」
#    逗号分隔；未配置时回退到单值 CORS_ORIGIN
CORS_ALLOW_ORIGINS=https://your-app.com,https://app.your-app.com

# 2. SSO 登录入口：IDStack 授权页地址（前端 VITE_IDSTACK_BASE_URL 的同源值）
IDSTACK_BASE_URL=https://idstack.raodaor.com

# 3. SSO 登录入口：本 APP 在 IDStack 注册的应用 UUID
#    ⚠️ 是 app_id 不是 client_id；未配置时 GET /auth/login 直接报 500
IDSTACK_APP_ID=<raodaor-docs 在 IDStack 的应用 UUID>
```

**前端（`packages/client` 构建期环境变量）**

```bash
# 4. 允许接收登录令牌的宿主来源白名单（逗号分隔）
#    ⚠️ 不配置则 SsoSuccessPage 一律拒绝回传令牌，window.open 登录流程拿不到 token
VITE_AUTH_ALLOWED_ORIGINS=https://your-app.com,http://localhost:5104
```

> ⚠️ **CORS 与来源白名单目前均为「精确匹配」，不支持 `*.your-app.com` 这类通配**。
> 多域名请逐一列出，改完需**重启后端 / 重新构建前端**生效。
>
> 启动时后端会打印 `CORS allowed origins: ...`，可用于确认配置已生效。

### 3.2 目标 APP 侧

- 前端能发起跨域 `multipart/form-data` 上传与 JSON 请求（携带 `Authorization` 头）
- 前端需把自有域名提供给平台方，用于加入 §3.1 的两处白名单
- 后端有「字段映射 + 业务校验」能力（这是目标 APP 的既有职责，本文档不涉及）

> 配置就绪后，建议**先跑一遍 [§10 对接自检清单](#10-对接自检清单) 再开始编码**——
> 环境类问题（CORS / 白名单 / `IDSTACK_APP_ID`）在编码阶段排查成本极高。

---

## 4. 完整调用时序

```
①  用户在目标 APP 点「导入 Excel」
       │
②  目标 APP 前端取得用户在绕道儿文档的 access_token
       │   window.open('{DOCS}/api/v1/auth/login')
       │   → IDStack 授权页 → 用户登录 → 回调 → /auth/sso-success
       │   → 该页检测 window.opener，postMessage 回传 token 后自动关闭
       │   目标 APP 收到 { type:'RAODAOR_DOCS_AUTH', accessToken, refreshToken, ... } 并持久化
       │
③  POST /api/v1/documents/import   (multipart, Bearer token)
       │   → { documentId, sheets:[{id,name}] }
       │
④  window.open('{DOCS}/doc/sheet/{documentId}')   ← Phase 1 用新窗口；Phase 3 换 iframe
       │
⑤  用户在线加工：改列名 / 删空行 / 补数据 / 拆合并单元格（可多人协同）
       │
⑥  用户回到目标 APP 页签点「完成导入」
       │
⑦  GET /api/v1/documents/{id}/export?format=json
       │   → { sheets:[{ id, name, rows: [[...],[...]] }] }
       │
⑧  目标 APP 前端 POST rows → 目标 APP 后端 /api/your/import-preview
       │
⑨  目标 APP 后端：字段映射 + 业务校验
       ├─ 全部通过 → 写入业务表 → 跳 ⑪
       └─ 有错误   → 返回 errors:[{ row, col, message }] → ⑩
       │
⑩  PATCH /api/v1/workbooks/{id}/sheets/{sheetId}/cells   ← 标红问题单元格
       用户回到表格修改 → 回到 ⑦
       │
⑪  DELETE /api/v1/workbooks/{id}?permanent=true          ← 清理暂存文档
```

**11 个步骤中只有 3 个端点是本 Phase 新增的**（②③⑦），其余均复用现有能力。

---

## 5. 接口契约

统一说明：

- `Base URL`：`https://docs.raodaor.com/api/v1`（全局前缀 `api/v1`）
- 鉴权：`Authorization: Bearer <access_token>`（§5.1 获取的绕道儿文档 token）
- 响应信封：`{ code: 0, data, message }`；`code !== 0` 或 HTTP 非 2xx 表示失败
- **坐标系一律 0-based**：`rows[0]` 是表格第 1 行，与 `CellOp.r / CellOp.c` 一致
- ⚠️ `rowCount` / `colCount` 是**逻辑行列数**（受下限约束：行 ≥ 1000、列 ≥ 26，上限 100000 / 500），
  **不代表实际数据行数**。判断数据量请用 `rows.length`。

---

### 5.1 ✅ 用户登录取 token

#### 5.1.1 `GET /auth/login` —— SSO 登录入口

```http
GET /api/v1/auth/login
```

后端生成随机 `state`（写入 cookie，5 分钟有效），构造 IDStack 授权 URL 并 302。

**无参数。** 是否回传令牌由**前端检测 `window.opener`** 决定：

- 由 `window.open` 打开 → 第三方窗口登录，完成后回传令牌并自动关闭
- 直接访问 → 站内登录，跳首页

> 未配置 `IDSTACK_APP_ID` 时本端点返回 `500`，提示「未配置 IDSTACK_APP_ID，无法发起 SSO 登录」。

#### 5.1.2 token 回传（postMessage）

登录成功后，页面 `/auth/sso-success` 检测 `window.opener`，回传令牌后自动关闭：

```js
// 目标 APP 前端
function loginRaodaorDocs() {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${DOCS_ORIGIN}/api/v1/auth/login`,
      'raodaor-docs-login',
      'width=600,height=700',
    );

    const onMessage = (event) => {
      // 🔴 必须校验来源，否则任意站点可注入伪造 token
      if (event.origin !== DOCS_ORIGIN) return;
      if (event.data?.type !== 'RAODAOR_DOCS_AUTH') return;

      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve(event.data);
    };

    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('login_timeout'));
    }, 120_000);

    window.addEventListener('message', onMessage);
  });
}
```

**回传 payload 字段**

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `type` | `'RAODAOR_DOCS_AUTH'` | 固定值，用于识别消息类型 |
| `accessToken` | `string` | 本 APP JWT，调 API 的凭证（15 分钟有效） |
| `refreshToken` | `string` | 刷新令牌，见 §5.1.3 |
| `expiresIn` | `number?` | accessToken 剩余有效秒数（由 JWT `exp` 计算） |
| `idstackAccessToken` | `string?` | IDStack access_token，供嵌入 IDStack 功能屏使用 |
| `user` | `object` | `{ userId, userName, avatar }` |

> **为什么用 postMessage 而不是 URL 回传**：token 进 URL 会落到浏览器历史、`Referer` 头与服务器日志里。postMessage 不落任何日志，且与本生态（IDStack Embed SDK）的握手范式一致。
>
> ⚠️ 令牌**仅回传给 §3.1 白名单内的 opener**；未配置 `VITE_AUTH_ALLOWED_ORIGINS` 时一律拒绝回传（安全默认），此时弹窗不会关闭、目标 APP 收不到消息。

#### 5.1.3 token 刷新

`access_token` 有效期 15 分钟。临近过期时：

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "<refresh_token>" }
```

**响应**

```json
{
  "code": 0,
  "data": { "accessToken": "eyJhbGciOi...", "refreshToken": "eyJhbGciOi..." },
  "message": "success"
}
```

> ⚠️ 刷新成功后**新的 refreshToken 也要一并替换**旧的，否则下次刷新会失败。

---

### 5.2 ✅ `POST /documents/import` —— 上传即建文档

```http
POST /api/v1/documents/import
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <binary>          // xlsx | xls | csv
name?: string           // 文档名；缺省取文件名去扩展名
```

**响应**

```json
{
  "code": 0,
  "data": {
    "documentId": "9f3c2a...",
    "name": "Q4项目计划",
    "sheets": [{ "id": "sheet-uuid", "name": "Sheet1", "index": 0 }],
    "rowCount": 1000,
    "colCount": 26
  },
  "message": "success"
}
```

> `rowCount` / `colCount` 为逻辑行列数（下限 1000 / 26），非实际数据行数。

**同步与异步的分工**

导入按文件体积自动分流，用响应中的 **`async`** 字段区分：

| 文件体积 | 处理方式 | 响应 |
| :--- | :--- | :--- |
| ≤ 8 MB | **同步**，请求内完成 | `{ async: false, documentId, sheets, ... }` |
| > 8 MB | **异步**入队，后台解析 | `{ async: true, taskId }` |

小文件同步返回（体验最好，立即拿到 `documentId`）；大文件若同步解析会长时间阻塞请求，故入队异步。

> **异步方案的背景**：目标环境不具备 Redis，无法使用 BullMQ。因此采用
> **任务状态落库 + 进程内 worker 消费**的兼容方案：
>
> - **入队即唤醒**：创建任务后立即触发处理，无需等待轮询周期
> - **长间隔兜底**（60s）：仅用于捡漏——进程重启遗留的、其他实例入队的任务
> - **多实例安全**：通过数据库乐观锁避免重复处理
> - **资源友好**：空闲时约 1 次查询/分钟，**不做高频轮询**
> - 大文件先落盘再解析，不常驻内存；处理完成（无论成败）都删除临时文件

**查询异步任务** `GET /api/v1/documents/import/:taskId`

```json
{
  "code": 0,
  "data": {
    "id": "task-uuid",
    "status": "completed",
    "progress": 100,
    "documentId": "9f3c2a...",
    "rowCount": 128,
    "error": null,
    "fileName": "plan.xlsx"
  }
}
```

`status`：`pending`（排队）→ `processing`（解析中）→ `completed` / `failed`。
建议 2 秒轮询一次；`completed` 时取 `documentId` 跳转编辑，`failed` 时取 `error` 提示。

**规模上限**（按当前套餐，超出返回 `5001`）

| 约束 | free | basic | pro | enterprise |
| :--- | :--- | :--- | :--- | :--- |
| 文件大小 | 5 MB | 20 MB | 50 MB | 不限 |
| 单文件行数 | 2 万 | 5 万 | **20 万** | 不限 |
| Sheet 数 | 100 | 100 | 100 | 100 |

> 服务端硬天花板为 **50 MB**（`MAX_UPLOAD_BYTES`），超过直接拒绝，不落盘、不入队。

**月导入次数**（周期指标，自然月重置）

| 套餐 | 每月导入次数 |
| :--- | :--- |
| free | 50 |
| basic | 1,000 |
| pro | 10,000 |
| enterprise | 不限 |

超出返回 `429` + `code: 5005`。**只有成功导入才计费**——解析失败不消耗配额。

---

### 5.3 ✅ `GET /documents/:id/export?format=json` —— 结构化读出

```http
GET /api/v1/documents/{documentId}/export?format=json&value=formatted&skipEmptyRows=true
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 0,
  "data": {
    "documentId": "9f3c2a...",
    "name": "Q4项目计划",
    "exportedAt": "2026-09-01T10:00:00.000Z",
    "sheets": [
      {
        "id": "sheet-uuid",
        "name": "Sheet1",
        "rowCount": 1000,
        "colCount": 26,
        "rows": [
          ["任务名", "负责人", "开始日期", "工期(天)"],
          ["登录模块", "张三", "2026-09-01", 5],
          ["支付模块", "李四", "2026-09-05", 8]
        ]
      }
    ]
  }
}
```

#### 参数

| 参数 | 取值 | 默认 | 说明 |
| :--- | :--- | :--- | :--- |
| `format` | `json` / `xlsx` / `csv` | **`json`** | 本端点默认 `json`（⚠️ 与 `workbooks/:id/export` 默认 `xlsx` 不同） |
| `value` | `formatted` / `raw` | `formatted` | 见下方「取值差异」 |
| `sheet` | sheetId | 不传=全部 | 指定导出某个工作表；不存在时返回 `3002` |
| `skipEmptyRows` | `true` / `false` | `true` | 跳过全空行——脏表最常见的噪声 |

**`value` 取值差异**

- `formatted`：取显示值 `m`，与用户在界面上看到的一致
- `raw`：取原始值 `v`

**两路对日期都是 ISO 8601 字符串**（导入时已归一化，见 §6.1），**不存在 Excel serial 数字**。
主要差异在于格式化：`formatted` 是展示文本（如 `¥1,500.00`、`2026-09-01`），`raw` 是底层值（如 `1500`）。

> 推荐默认用 `formatted`（语义贴近用户所见）；需要原始数值做计算时再用 `raw`。

#### 🔴 核心原则：不暴露稀疏矩阵

内部存储格式为 `{ [sheetId]: { "r_c": { v, m, f, bg, ... } } }`。**该结构不会出现在对外契约中**。

一旦把存储格式写进合同，后续增加列类型、更换存储引擎都会破坏所有接入方。对外只暴露**二维数组**这一层稳定抽象——与 CSV / Excel / Google Sheets API 的心智模型一致。

#### 为什么默认不给「按表头的对象数组」

`{ "任务名": "登录模块" }` 用起来更方便，但要求表头非空且唯一。而导入场景面对的恰恰是**脏表**（合并单元格、空列名、重复列名），假设一旦不成立就要报错，反而脆弱。

对象化留给目标 APP 在自己的字段映射步骤完成——**那本来就是目标 APP 的职责**（只有它知道「工期」必须映射为正整数、「负责人」必须是本组织成员）。

---

### 5.4 ♻️ `PATCH /workbooks/:id/sheets/:sheetId/cells` —— 校验标红（复用现有）

目标 APP 后端校验出错误后，把问题单元格标红，引导用户回到表格修改。

```http
PATCH /api/v1/workbooks/{documentId}/sheets/{sheetId}/cells
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operations": [
    { "r": 3, "c": 2, "v": { "bg": "#ffe6e6" } },
    { "r": 7, "c": 1, "v": { "bg": "#ffe6e6" } }
  ]
}
```

`CellOp.v` 是 `Partial<CellValue>`，只传 `bg` 即可，**不影响单元格原值**。`r` / `c` 为 0-based，与 `rows` 数组下标一一对应。

响应：`{ "code": 0, "data": { "updated": 2 }, "message": "success" }`

#### 🔴 清除标记：只能用 `bg: null`，**禁止 `clear: true`**

```json
{ "operations": [{ "r": 3, "c": 2, "v": { "bg": null } }] }
```

> ⚠️ **切勿使用 `clear: true` 来清除标红。** 该分支在服务端执行的是 `delete cellData[sheetId]["r_c"]`——
> 会**删除整个单元格（含原始值与公式）**，等于把用户刚填好的数据抹掉。这是数据丢失，不是清除样式。
>
> `v: { bg: null }` 才是安全做法：仅把背景字段置空，值 / 公式 / 其他样式原样保留；
> 渲染层因 `null` 为假值而回退到默认白底，视觉上即恢复。

**建议流程**：目标 APP 缓存本轮标记过的单元格坐标，下次重新校验时先对这些坐标发一次 `bg: null` 清除，再对新错误单元格标红，避免残留。

---

### 5.5 ♻️ `DELETE /workbooks/:id?permanent=true` —— 清理暂存文档（复用现有）

```http
DELETE /api/v1/workbooks/{documentId}?permanent=true
Authorization: Bearer <access_token>
```

`permanent=true` 为**彻底删除**（不可恢复）；不带该参数则为软删除（移入回收站）。

**响应**：`{ "code": 0, "data": { "deleted": true }, "message": "success" }`

> ⚠️ **建议目标 APP 在导入成功后立即调用**，原因见 §7.1 的配额限制。
>
> 注：删除仅允许文档 owner 执行（协作成员会返回 `403`）。Phase 1 场景 owner 即操作用户，无影响。

---

### 5.6 端到端接入示例（TypeScript，可直接参考）

```ts
const DOCS_ORIGIN = 'https://docs.raodaor.com';
const API = `${DOCS_ORIGIN}/api/v1`;

/** token 存取：建议存内存 + 配合刷新，避免长期暴露在 localStorage */
let tokens: { accessToken: string; refreshToken: string } | null = null;

/** 统一请求封装：自动带 token，401 时刷新并重试一次 */
async function apiFetch(path: string, init: RequestInit = {}) {
  const send = (t: string) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${t}` },
    });

  if (!tokens) throw new Error('not_logged_in');
  let res = await send(tokens.accessToken);

  if (res.status === 401) {
    const rr = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }).then((r) => r.json());

    if (!rr.data?.accessToken) throw new Error('refresh_failed');
    tokens = { accessToken: rr.data.accessToken, refreshToken: rr.data.refreshToken };
    res = await send(tokens.accessToken);
  }
  return res.json();
}

/** ② 登录取 token —— 完整实现见 §5.1.2 */
async function login() {
  /* ... loginRaodaorDocs() ... */
  tokens = { accessToken: '...', refreshToken: '...' };
}

/** ③ 上传并建文档 */
async function importFile(file: File, name?: string) {
  const fd = new FormData();
  fd.append('file', file);
  if (name) fd.append('name', name);
  // ⚠️ 不要手动设置 Content-Type，浏览器会自动补上 multipart boundary
  const res = await apiFetch('/documents/import', { method: 'POST', body: fd });
  return res.data; // { documentId, name, sheets, rowCount, colCount }
}

/** ⑦ 读回结构化数据 */
async function readSheets(documentId: string, sheetId?: string) {
  const qs = new URLSearchParams({ format: 'json', value: 'formatted' });
  if (sheetId) qs.set('sheet', sheetId);
  const res = await apiFetch(`/documents/${documentId}/export?${qs}`);
  return res.data.sheets; // [{ id, name, rows: [[...]] }]
}

/** ⑩ 标红（color 传 null 即清除标记，切勿用 clear:true，见 §5.4） */
async function markCells(
  documentId: string,
  sheetId: string,
  cells: Array<{ r: number; c: number }>,
  color: string | null,
) {
  return apiFetch(`/workbooks/${documentId}/sheets/${sheetId}/cells`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operations: cells.map(({ r, c }) => ({ r, c, v: { bg: color } })),
    }),
  });
}

/** ⑪ 清理暂存文档 */
async function cleanup(documentId: string) {
  return apiFetch(`/workbooks/${documentId}?permanent=true`, { method: 'DELETE' });
}

/** 编排：上传 → 加工 → 读回 → 校验 → 标红或入库 */
let prevMarked: Array<{ r: number; c: number }> = [];

async function runImport(file: File) {
  const { documentId, sheets } = await importFile(file);
  const sheetId = sheets[0].id;

  // ④ 打开在线表格供用户加工（Phase 1 为新窗口，Phase 3 起可内嵌）
  window.open(`${DOCS_ORIGIN}/doc/sheet/${documentId}`, '_blank');

  // ⑥ 用户点「完成导入」后读回
  const rows = (await readSheets(documentId, sheetId))[0].rows;

  // ⑧⑨ 交给目标 APP 后端做字段映射与业务校验
  const { valid, errors } = await fetch('/api/your/import-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  }).then((r) => r.json());

  if (errors.length) {
    // 先清上一轮标记，再标新的；坐标 0-based
    await markCells(documentId, sheetId, prevMarked, null);
    const marked = errors.map((e: any) => ({ r: e.row, c: e.col }));
    await markCells(documentId, sheetId, marked, '#ffe6e6');
    prevMarked = marked;
    return { status: 'need_fix', errors };
  }

  await cleanup(documentId); // 释放配额，见 §7.1
  return { status: 'done', count: valid.length };
}
```

---

## 6. 平台侧实现要点（已完成）

### 6.1 日期归一化

ExcelJS 对日期单元格返回 `Date` 对象，直接 `toString()` 会得到 `Mon Sep 01 2026 00:00:00 GMT+0800 (中国标准时间)` 这类调用方无法解析的串。

导入时统一归一化为 ISO 8601 再落库：

- 纯日期（时分秒均为 0）→ `2026-09-01`
- 带时间 → `2026-09-01T14:30:00`
- 用**本地时区**字段组装（而非 `toISOString()`），避免 UTC 偏移导致日期差一天

因此 `value=formatted` 与 `value=raw` 两路都能取到可解析的日期值。

### 6.2 CORS 多来源白名单

`CORS_ALLOW_ORIGINS`（逗号分隔）优先，未配置时回退到单值 `CORS_ORIGIN`。

⚠️ 字符串项为**精确匹配**，不支持 `*.example.com` 通配，多域名需逐一列出。
启动时后端打印 `CORS allowed origins: ...`，可直接确认配置是否生效。

### 6.3 postMessage 来源白名单

`/auth/sso-success` 回传令牌前校验 `window.opener.origin` 是否在 `VITE_AUTH_ALLOWED_ORIGINS` 内；不在白名单则拒绝回传并在控制台告警。

**未配置该变量时一律不回传**（安全默认），此时弹窗不会关闭、目标 APP 收不到消息。

### 6.4 顺带修复：越权导出

此前 `exportFile` 仅校验文档是否存在，**任何登录用户都能导出他人文档**。现已统一经 `assertAccess`（owner 或协作成员）校验，导入与导出两条链路均受保护，越权返回 `403`。

---

## 7. 已知限制与规避

### 7.1 ⚠️ 文档配额：按当前身份套餐（组织共享 / 个人兜底）

**每次导入都会新建一篇文档**，因此导入同样占用文档数配额，超限报 `code: 3006`。

配额归属**当前身份**：组织身份 → 全组织成员**共享一份组织套餐额度**；个人身份 → 按个人套餐（免费档 10 篇）。详见 [billing.md](./billing.md)。

| 事项 | 说明 |
| :--- | :--- |
| 软删除（回收站）**仍占额** | 只有 `DELETE ...?permanent=true` 彻底删除才释放；平台**不自动清理**回收站（避免误删重要数据） |
| 用量 ≥ 90% | 平台提示用户清理回收站；导入前可用 `GET /api/v1/billing/quota` 预检（返回 `trashCount` / `nearLimit`） |
| 文档归属 | 按**创建时**的身份快照记账，切换身份不会改变历史文档的归属（不会串台） |

**目标 APP 的建议做法**（尤其免费档 / 小套餐）：

| 措施 | 责任方 |
| :--- | :--- |
| 导入加工完成后**立即** `DELETE ...?permanent=true`，让暂存文档只短暂占用配额 | 目标 APP |
| 导入前若报 `3006`，提示用户「请到绕道儿文档**彻底删除**不再需要的文档（回收站中的文档仍占额）」 | 目标 APP |
| 提供「清理我的导入文档」入口（批量彻底删除） | 目标 APP（可选） |
| 高频 / 无人值守的批量导入改用 [Open API](./open-api-guide.md) 服务端通道，配额与界面操作共享同一份，按组织统一治理 | 目标 APP（可选） |

### 7.2 ⚠️ 文档归属与可见性

文档的**计费归属**是「创建时的身份快照」（组织身份导入 → 计到组织；个人身份导入 → 计到个人），切换身份不改变归属。
**可见性**仍按 owner + 协作成员判定：同一组织的其他成员**不会**自动看到该文档。

- 「谁导入谁加工」场景无影响
- 需要团队协同审阅：在绕道儿文档内把其他成员加为协作成员；或由服务端统一读回后再分发（见 [open-api-guide.md](./open-api-guide.md)）

### 7.3 ⚠️ 鉴权为过渡方案

读回数据由 **目标 APP 前端**发起，即目标 APP 后端需信任前端传来的数据。对「用户导入自己的表」这一场景可接受。

**若需服务端直接读回（防伪造、可无人值守）**：已提供**组织级 API Key + Open API**（`X-API-Key` + `/api/v1/open/*`），
由目标 APP **后端**直接调用，前端无法伪造；标红（`PATCH /open/workbooks/:id/sheets/:sheetId/cells`）与暂存清理（`DELETE /open/workbooks/:id`）同样可由服务端完成（scope `docs:write`，2026-09-16 起）。
详见 [open-api-guide.md](./open-api-guide.md)。

### 7.4 ⚠️ Phase 1 未做 iframe 嵌入

加工环节在新窗口进行（步骤 ④）。用户需要在目标 APP 与文档页签间切换，沉浸感弱于内嵌。

Phase 3 提供 `/embed/sheet/:id` 无壳页 + postMessage 握手后，可直接内嵌到目标 APP 页面内，**无需改动本契约的其余部分**。

---

## 8. 错误码

沿用绕道儿文档统一错误码（`packages/shared/src/constants/errors.ts`）：

| code | 常量 | HTTP | 含义 / 排查 |
| :--- | :--- | :--- | :--- |
| `401` | —— | 401 | token 失效或过期。JWT 守卫抛出时响应体无 `code`，按约定**回退为 HTTP 状态码** |
| `3001` | `WORKBOOK_NOT_FOUND` | 404 | 文档不存在或已被删除 |
| `3002` | `SHEET_NOT_FOUND` | 404 | `sheet` 参数指定的工作表不存在 |
| `3003` | `WORKBOOK_ACCESS_DENIED` | 403 | 当前用户无该文档权限（文档归属其他用户） |
| `3005` | `SHEET_LIMIT_EXCEEDED` | 400 | 工作表数超 100 个上限 |
| `3006` | `WORKBOOK_LIMIT_EXCEEDED` | 400 | 文档数达**当前身份套餐**上限（组织共享 / 个人兜底），见 §7.1 |
| `5001` | `FILE_TOO_LARGE` | 413 | 超过当前套餐的文件大小 / 行数上限，提示拆分或升级 |
| `5002` | `FILE_TYPE_NOT_SUPPORTED` | 400 | 仅支持 xlsx / xls / csv；未上传文件也是此码 |
| `5003` | `FILE_PARSE_ERROR` | 400 | 文件损坏、加密或无可解析工作表 |
| `5004` | `FILE_EXPORT_ERROR` | 400 | 不支持的 `format`，或非 sheet 类型文档 |
| `5005` | `IMPORT_QUOTA_EXCEEDED` | 429 | 本月导入次数已达套餐上限（自然月重置） |

> 错误码取自 `packages/shared/src/constants/errors.ts`。

**建议目标 APP 侧处理**：

- `401` → 静默刷新 token 后重试一次，仍失败则重新走 §5.1 登录
- `413` / `5002` / `5003` → 直接提示用户换文件，不重试
- `3006` → 提示用户清理文档（§7.1）
- `403` → 说明该文档不属于当前登录用户，需换账号或重新授权

---

## 9. 演进路线

| Phase | 内容 | 解决的限制 |
| :--- | :--- | :--- |
| **1（本文）** | 文件通道 + 结构化读出 + 校验标红 | —— |
| **2（已上线）** | 组织级配额与隔离 + 组织级 API Key / Open API 服务端通道 | §7.1 配额、§7.2 归属、§7.3 鉴权 |
| **3** | `/embed/sheet/:id` 无壳页 + postMessage 握手 + SDK | §7.4 沉浸感 |
| **4** | Webhook（`document.updated`，签名 + 幂等 + 重试） | 轮询 / 实时同步 |
| **5** | 图表 / 透视表 | 「分析统计」诉求 |

> Phase 1 的契约在后续各 Phase 中**保持稳定**，新增能力均为叠加，不破坏既有接口。

---

## 10. 对接自检清单

### 10.1 环境自检（curl，建议联调前先跑通）

```bash
# 0) 服务探活
curl -i https://docs.raodaor.com/api/v1/health
# 预期：200 + {"code":0,"data":{"status":"ok","database":"up",...}}

# 1) 登录取 token：涉及 IDStack 交互，无法用 curl 完成
#    → 按 §5.1.2 在目标 APP 页面控制台执行 login()，拿到 accessToken
export TOKEN='<access_token>'

# 2) 上传并建文档
curl -X POST https://docs.raodaor.com/api/v1/documents/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./plan.xlsx" \
  -F "name=Q4项目计划"
# 预期：{"code":0,"data":{"documentId":"...","sheets":[{"id":"..."}]}}
# 保存：export DOC_ID='...'  SHEET_ID='...'

# 3) 读回结构化数据
curl "https://docs.raodaor.com/api/v1/documents/$DOC_ID/export?format=json" \
  -H "Authorization: Bearer $TOKEN"
# 预期：data.sheets[0].rows 为二维数组

# 4) 标红
curl -X PATCH "https://docs.raodaor.com/api/v1/workbooks/$DOC_ID/sheets/$SHEET_ID/cells" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"operations":[{"r":1,"c":1,"v":{"bg":"#ffe6e6"}}]}'
# 预期：{"code":0,"data":{"updated":1}}

# 5) 清除标记（务必用 bg:null，切勿用 clear:true，见 §5.4）
curl -X PATCH "https://docs.raodaor.com/api/v1/workbooks/$DOC_ID/sheets/$SHEET_ID/cells" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"operations":[{"r":1,"c":1,"v":{"bg":null}}]}'

# 6) 清理暂存文档
curl -X DELETE "https://docs.raodaor.com/api/v1/workbooks/$DOC_ID?permanent=true" \
  -H "Authorization: Bearer $TOKEN"
# 预期：{"code":0,"data":{"deleted":true}}
```

### 10.2 验收 checklist

| # | 检查项 | 通过标准 | 不通过时排查 |
| :--- | :--- | :--- | :--- |
| 1 | CORS 已放行目标 APP 域名 | 浏览器 Console 无 `blocked by CORS policy` | §3.1 `CORS_ALLOW_ORIGINS`，改完**重启后端** |
| 2 | `VITE_AUTH_ALLOWED_ORIGINS` 含目标 APP 域名 | 登录弹窗自动关闭并收到 `RAODAOR_DOCS_AUTH` | §3.1，改完需**重新构建前端** |
| 3 | `IDSTACK_APP_ID` 已配置 | `/auth/login` 不返回 500 | §3.1 |
| 4 | 上传成功 | 返回 `code:0` 且含 `documentId` | 错误码表 §8 |
| 5 | 读回为二维数组 | `data.sheets[0].rows` 是数组 | 确认带了 `format=json` |
| 6 | 日期可解析 | 形如 `2026-09-01`，**不是** `Mon Sep 01 2026...` | §6.1 日期归一化 |
| 7 | 标红可见 | 打开表格能看到浅红底色 | 坐标 0-based；确认账号有 edit 权限 |
| 8 | 清除标记后数据仍在 | 底色消失，且单元格**原值未丢失** | §5.4，确认没有用 `clear:true` |
| 9 | 清理后配额释放 | 可再次导入，不再报 `3006` | §7.1 配额限制 |

---

## 11. 文档索引

| 文档 | 用途 |
| :--- | :--- |
| [overview.md](./overview.md) | **接入入口**：能力地图、身份体系、套餐计费、入驻流程 |
| **[import-api.md](./import-api.md)**（本文） | 导入加工对接契约，含 §10 自检清单 |
| [billing.md](./billing.md) | 套餐计费与支付对接（组织级配额、`payment.verified` webhook） |
| [open-api-guide.md](./open-api-guide.md) | **服务端直连**：七步对接流程、端点、错误兜底、上线自检清单 |
| [organization-api-keys.md](./organization-api-keys.md) | 组织级 API Key 设计与安全规范（签发 / 轮换 / 吊销 / 限流 / 审计） |
| 技术架构（当前未单独发布） | 绕道儿文档技术架构 |
| 同生态嵌入范式（待发布） | Phase 3 的 postMessage 握手参照 |
| 同生态文件服务接入范式 | RaoDaor File 文件服务文档（ApiKey / 应用租户参照） |
