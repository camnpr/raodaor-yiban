<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-docs/overview.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 绕道儿文档（Raodaor Docs）接入总览

> 面向**第三方目标 APP 的开发者**：你想让自有站点具备「在线表格 / 文档」能力，从哪开始、需要什么、怎么入驻、怎么计费、该看哪篇详细文档，本文一图说清。
>
> 本文是**唯一入口**：先讲清能力边界与身份体系（最重要的前置），再讲套餐计费与入驻流程，最后给对接清单；具体能力分篇深入。

---

## 1. 先搞清楚：你接的是「在线文档能力」

绕道儿文档是一款多类型协同办公套件（表格 / 富文本 / 演示 / PDF），向目标 APP 开放的是**在线文档的编辑与数据读写能力**，而不是文件存储（存储请见 RaoDaor File 文件服务文档）。

| 你想做的事 | 看哪篇 | 核心端点 |
|------------|--------|----------|
| 让用户上传 Excel → 在线清洗加工 → 结构化读回你的业务库 | [import-api.md](./import-api.md) | `POST /api/v1/documents/import` · `GET /api/v1/documents/:id/export?format=json` |
| **服务端直连**：定时同步、批量导入、无人值守 | [open-api-guide.md](./open-api-guide.md) | `X-API-Key` + `/api/v1/open/*` |
| 了解套餐、配额、如何付费升级 | [billing.md](./billing.md) | `payment-create` · `payment.verified` webhook |
| 在你的页面内嵌入在线表格（规划中，Phase 3） | 待发布 | `/embed/sheet/:id` + Embed SDK |
| 上传 / 存储头像、附件等文件 | RaoDaor File 文件服务文档 | `@isudaji/raodaor-file-sdk` · `/api/v1/files` |

> 本文中的「目标 APP」= 接入绕道儿文档的第三方应用。文档可**整体复制**给任意接入方，只需按 [import-api.md §0.2](./import-api.md#02-复用本文档替换为你的信息) 替换域名与业务占位。

---

## 2. 概念模型与身份体系（必读，否则会对接错）

### 2.1 谁在登录？—— 终端用户用「IDStack 账号」

绕道儿文档**不自建用户体系**。终端用户统一用 **IDStack 账号**登录（SSO 统一身份），目标 APP 只是「调用了文档能力的前端站点」，两边**共享同一套用户**。

目标 APP 无需自建用户表或做账号映射——只需保存 `目标APP.user_id ↔ 文档 documentId` 的关联即可。

### 2.2 三种凭证，别搞混

| token | 签发方 | 作用 | 怎么用 |
|-------|--------|------|--------|
| **IDStack `access_token`** | IDStack（OAuth 流程） | 代表用户在 IDStack 的身份 | 仅用于换取本 APP token 的过程；也可用于嵌入 IDStack 功能屏 |
| **本 APP `access_token`** | 绕道儿文档 | **调所有文档 API 的凭证**（15 分钟有效） | `Authorization: Bearer <本 APP token>` |
| **组织级 `API Key`** | 绕道儿文档（组织管理员签发） | **服务端直连**调用 Open API（无登录态，长期有效可轮换） | `X-API-Key: rdorg_xxx`，仅 `/api/v1/open/*` |

**直接用 IDStack 的 token 当 Bearer 调文档 API 会 401**——后端 `JwtAuthGuard` 只认本 APP 签发的 JWT。

> 三种凭证**各走各的通道，互不认账**：`/api/v1/documents/*` 只认 Bearer，`/api/v1/open/*` 只认 `X-API-Key`。
> API Key 由**组织管理员**在「API 密钥」页签发，代表整个组织，用量计入该组织套餐。详见 [open-api-guide.md](./open-api-guide.md)。

正确取法：目标 APP 前端 `window.open('{DOCS}/api/v1/auth/login')` → 走完 SSO → 页面 postMessage 回传本 APP token（详见 [import-api.md §5.1](./import-api.md#51-用户登录取-token)）。

### 2.3 隔离与计费主体：组织（Organization）

绕道儿文档的**隔离单位与计费主体都是组织（Organization）**（IDStack 语境的「租户 Tenant」），而不是单个终端用户。

- 组织来源：IDStack 签发的 JWT `roles[].tenant_id`——本 APP 落库为 `Organization.idstackOrganizationId`，即计费与配额的归属
- 同一组织下的成员共享该组织的配额（文档数、导入次数等）；同账号可持「个人身份 + 多个组织身份」并切换
- 纯个人账号（未挂组织）以用户本人为计费主体（free 档兜底）
- 不同组织之间数据完全隔离

> ✅ **已上线**：组织模型（`Organization` + 按身份配额 + 身份切换 + `/auth/me` 能力化）已完整落地，按上述模型设计你的产品流程即可。

**配额归属快照（重要，避免误判用量）**：文档记的是**创建时的计费主体**（组织或本人），不是 owner 所属组织的当前值。
因此「个人身份下建的文档」在切到组织身份后**不会**变成组织用量，反之亦然；身份切换不会让历史文档换归属。
移除组织成员时，该成员名下归属本组织的文档会归还给个人，组织配额随即释放。

**可切换身份只包含「组织级角色」所在的组织**：平台侧角色（`owner` / `system_admin` 等）即使带 `tenant_id`，也不会把人放进该组织——平台运营者不会误入客户组织的身份（也就不会误用客户配额）。

---

## 3. 套餐与计费

### 3.1 计费主体：组织，不是用户

**一个组织 = 一份套餐**。目标 APP 的组织管理员购买升级后，该组织下**所有成员**共享升级后的配额。

这对 B 端场景是必需的：若按终端用户计费，一家 100 人的公司需要购买 100 份——不可接受。

付费人是**组织管理员**（本 APP 的组织管理员档 = `organization` 角色，由运营方在 IDStack 侧签发）；纯个人账号可在本人维度单独升级。
（IDStack 内置的 `tenant_admin` 是 IDStack 平台角色，不是本 APP 的组织管理员档——二者不要混用。）

### 3.2 套餐目录托管在 IDStack

绕道儿文档**不自建套餐表**。套餐与等级目录全部托管在 IDStack，本 APP 只维护「当前身份 → 当前套餐」的映射（组织身份存 `Organization.plan`；个人身份存 `User.plan`）。

| IDStack 后台配置 | 在本 APP 的作用 |
|------------------|----------------|
| **会员等级配置**（TierManagementScreen） | 映射为套餐等级（free / basic / pro / enterprise） |
| **会员套餐配置**（PlanManagementScreen） | `name` / `price` / `duration_days` / `tier_id` 即套餐定义 |
| **角色管理**（RoleManagementScreen） | 已用于 SSO 角色同步（按角色计算能力布尔：管理后台 / 成员管理 / 核销） |

两类配置均遵循「**自动继承租户通用目录 + 可新增本应用专属项**」模型，数据按 `app_id` 隔离，随 IDStack 升级自动演进。

> 因此：**价格与周期以 IDStack 后台配置为准**，本文档不写死具体金额，避免与后台不同步。

### 3.3 套餐分级

| 套餐 | 文档数上限 | 月导入次数 | 单文件行数 | 单文件大小 | 协作者 / 文档 |
|------|-----------|-----------|-----------|-----------|--------------|
| **Free** | **10（硬上限）** | 50 | 2 万 | 5 MB | 3 |
| **Basic** | 100 | 1,000 | 5 万 | 20 MB | 10 |
| **Pro** | 1,000 | 10,000 | 20 万 | 50 MB | 50 |
| **Enterprise** | 定制 | 定制 | 定制 | 定制 | 定制 |

- Free 档的 **10 个文档为硬上限**，与代码常量 `FREE_USER_MAX_WORKBOOKS` 一致；超出需升级或删除文档
- 行数与大小上限按**当前套餐**精确校验（付费档的 20 万行 / 50MB 已可用）
- **大文件（> 8MB）自动转异步导入**：接口立即返回 `taskId`，任务落库由 worker 执行，轮询 `GET /api/v1/documents/import/:taskId` 取结果——不会因解析耗时拖垮请求
- 计量周期：文档数为**存量**指标，导入次数为**月度**指标（自然月重置）

### 3.4 计量维度

| 维度 | 类型 | 说明 |
|------|------|------|
| 文档总数 | 存量 | 主计量项；**回收站（软删除）中的文档仍占额**，彻底删除后才释放（与 Google Drive / Dropbox 一致：删除是两步，软删除不释放） |
| 月导入次数 | 周期 | 导入**成功**次数（解析失败不消耗）；用户级 `POST /api/v1/documents/import` 与服务端 `POST /api/v1/open/workbooks/import` **计入同一份组织额度** |
| 单文件规模 | 瞬时 | 文件大小 + 行数上限，按当前套餐精确校验 |
| 单文档协作者数 | 存量 | `WorkbookMember` 记录数（**当前仅展示，服务端未强制拦截**） |

超额行为：文档数 / 导入次数 / 单文件规模超额均**拒绝并返回明确错误码**（`3006` / `5005` / `5001`），**不静默降级**。

### 3.5 付费闭环（简述）

支付由 **IDStack 统一负责**（订单、支付渠道、凭证核销、结果回调），绕道儿文档只做两件事：发起支付、消费 webhook 落地配额。

```
组织管理员点「升级套餐」
  → 本 APP 生成 externalOrderId 并落「待支付意图表」（记录目标组织或本人）
  → 嵌入 IDStack payment-create 模块，用户付款
  → 收益方运营者核销凭证（订单 verified）
  → IDStack 推送 payment.verified webhook
  → 本 APP 校验签名 → 用 externalOrderId 反查 → 升级该组织配额（个人身份单升级本人）
```

> ⚠️ **核销后才生效**：`payment.verified` 在**管理员核销成功**时推送，不是用户付款时。前端 `onPurchaseSuccess` 仅用于 UX 提示，**不可作为配额生效依据**。
>
> 兜底机制（若已核销但套餐迟迟未生效）：运营方可在「管理订单」页按 `externalOrderId` **手动核销**补单（幂等，重复点不会重复升级）；终端用户可在「我的订单」页上报支付异议，运营方在同一处回复，用户可见处理进展。

完整契约（意图表结构、webhook 字段、幂等处理、自检清单）见 [billing.md](./billing.md)。

### 3.6 商务洽谈与销售线索（Phase 3 商务化）

「Enterprise（洽谈）」与「能力集成（服务端 Open API，**已开放**：对接流程见 [open-api-guide.md](./open-api-guide.md)，密钥与安全规范见 [organization-api-keys.md](./organization-api-keys.md)）」在免费 / 订阅之外构成**第 3 层变现**——它们没有固定价目，走**商务洽谈**成交。为此本 APP 提供了完整的「引导 → 留资 → 跟进反馈」闭环：

| 环节 | 位置 / 端点 | 说明 |
|------|------------|------|
| **公开落地页** | `/plans`（PricingPage，无需登录） | 四档套餐卡（配额动态读 `PLAN_QUOTAS`）+ 企业版洽谈 CTA + 「面向开发者」区块（引导获取对接文档） |
| **套餐页入口** | `/billing` 企业版卡片 | 原「联系商务」死按钮已接通洽谈弹窗 |
| **提交询价** | `POST /sales-leads`（`@Public`） | 字段：`company / contactName / contactEmail / contactPhone? / interest(enterprise\|integration\|other) / message / source?(pricing\|billing\|home)`；无需登录，访客亦可留资 |
| **线索管理** | `GET /sales-leads` + `PATCH /sales-leads/:id` | 仅平台管理员（`AdminGuard`），状态流转 `new → contacted → closed`，可填写跟进反馈 `adminNote` |
| **管理入口** | `/admin/leads`（AdminLeadsPage） | 侧栏「洽谈线索」仅平台管理员可见 |

**角色与能力判定**（角色名常量收敛于 `@raodaor-docs/shared`（`constants/roles.ts`），`common/constants/admin.constant.ts` 仅保留纯函数）：

- `ADMIN_ROLE_NAMES = ['system_admin', 'tenant_admin', 'owner']`；`OPERATOR_ROLE_NAMES = ['system_admin', 'owner']`（管理订单刻意排除客户侧 `tenant_admin`）
- SSO 登录时解析 roles → 快照到 `User.idstackRoles`（Json 列）→ 派生为本地 JWT `isAdmin` claim（refresh 时以库内快照重算，不依赖已过期的 IDStack token）
- **平台级 vs 组织级必须分清**：`tenant_admin` 是 IDStack 内置的**组织（租户）级**管理员，属**客户侧**身份；只有 `system_admin` / `owner` 是**平台运营者**。因此 `isAdmin` claim 与 `consoleAccess` 一律取 `OPERATOR_ROLE_NAMES`（**不含** `tenant_admin`）——否则客户组织管理员就能进平台后台审批别人的组织申请、查看全平台洽谈线索（「既当运动员又当裁判」）
- 接口鉴权走 `JwtAuthGuard + AdminGuard`（平台管理端点：洽谈线索、组织申请审批等）；成员管理 / API 密钥等**组织内**能力走服务层按「本组织管理员 / 平台运营者」放行，不用 AdminGuard（否则会误挡组织管理员）
- `/auth/me` 按**当前身份**下发 `capabilities`（`consoleAccess` 管理后台 / `manageMembers` 成员与组织管理 / `verifyOrders` 管理订单含核销）与 `embed` 角色快照（`myOrders` 当前身份角色——「我的订单」走 `payment-orders?scope=own` 免白名单；`verifyOrders` 运营者角色——「管理订单」白名单）
- 组织内分两档角色（组织身份按 `roles[].tenant_id` 归属，管理权按角色名区分）：`organization` = **组织管理员**（成员管理权）；`org_member` = **普通组织成员**（仅归属并共享配额/计费，无管理权）
- `manageMembers` 三条放行路径：① 当前组织的管理员（`ADMIN_ROLE_NAMES` 且角色属当前组织）② **组织管理员 `organization`**（本 APP 组织管理员档，可邀请新成员为 `org_member` / 移除本组织成员）③ 平台运营者（`system_admin` / `owner`）代管。普通成员 `org_member` **不在**放行范围——只有组织管理员能邀人，普通成员不能
- 通过本应用邀请新成员**一律授予 `org_member`**（members.service 只暴露成员档角色并校验 roleId，防"受邀即成管理员"）；`organization` 管理员仅由运营方在 IDStack 侧签发
- `consoleAccess` = `OPERATOR_ROLE_NAMES`（`system_admin` / `owner`）：**不含** `organization` 也**不含** `tenant_admin`——组织身份（无论哪种管理员角色）只管自己的组织，不进平台管理后台（洽谈线索 / 组织申请审批限平台运营者）
- **前端只消费能力布尔与 embed 角色快照，禁止硬编码角色名**（`AppShell` 等导航入口、`OrdersPage` 的 `allowedRoles` 均不再自判角色）

数据模型：`SalesLead`（纯线索为主；含 `status` / `adminNote` / `source` 便于归因；`userId` **可选归属**——登录用户提交时自动写入，访客提交为 null）。

提交方回看通道（Phase 3 补）：
- 登录用户：侧栏「我的洽谈」→ `GET /sales-leads/mine`（按 `userId` 归属；兼容按联系邮箱匹配的历史线索）
- 访客：提交成功页回显**洽谈编号**，凭「编号 + 提交邮箱」在 `/my-leads` 查询（`POST /sales-leads/query`，双因子校验，只返回自己的一条）

即：管理员在 `/admin/leads` 填写的 `adminNote` / `status`，提交方在「我的洽谈」可见，不再是"只有管理员能看到"。相关 i18n 模块：`pricing.*`、`leads.*`。

### 组织（团队）身份如何获得 —— 申请制

组织的权威来源是 **IDStack 租户**（本 APP 只按 `roles[].tenant_id` 做 `Organization` 的 upsert），而创建租户在 IDStack 侧是**系统级权限**（`tenant:manage`，`scope=system`），不能下放给普通用户。因此普通用户采用**申请制**而非自助创建：

| 环节 | 位置 | 说明 |
| :--- | :--- | :--- |
| 提交申请 | 侧栏「申请创建组织」→ `/org-request` | `POST /organization-requests`（登录用户）；同一用户同时仅 1 条 `pending` |
| 查看结果 | 同页「我的申请」 | `GET /organization-requests/mine`，含状态与运营方备注；通过后提示"重新登录即可切换组织" |
| 运营方审批 | `/admin/organization-requests`（platform 管理员） | `GET /organization-requests` + `PATCH /:id`（`approved` / `rejected` + `adminNote`） |
| **真正开组织** | IDStack 管理后台 | 系统管理员创建租户（组织），并给申请人签发 **`organization` 角色**（组织管理员；本 APP 无此权限，也不代持） |
| 生效 | 申请人重新 SSO 登录 | 组织身份来自 IDStack `roles[].tenant_id`，登录后自动出现在侧栏身份切换列表 |

数据模型：`OrganizationRequest`（`userId` / `orgName` / `reason?` / `status` / `adminNote?`）。相关 i18n 模块：`organization.*`。

---

## 4. 入驻流程

### 4.1 五步清单

| # | 步骤 | 责任方 | 产出 |
|---|------|--------|------|
| 1 | 在 IDStack 为你的应用**登记回调白名单** `redirect_uris` | 目标 APP 提供，平台方操作 | 回调地址可用 |
| 2 | **领取凭证** | 平台方下发 | `app_id` / `api_key` / `secret_key` / `jwt_secret` |
| 3 | **提供域名**加入两处白名单 | 平台方操作 | CORS + 令牌回传放行 |
| 4 | **配置 webhook** 地址与密钥 | **平台方**（绕道儿文档部署方）在 IDStack 登记自己的接收端点 | 支付结果可回调至绕道儿文档（**目标 APP 无需实现**） |
| 5 | **联调自检** | 目标 APP | 验收通过 |

### 4.2 凭证一览

| 凭证 | 环境变量 | 用途 | 存放位置 |
|------|----------|------|----------|
| `app_id`（应用 UUID） | `IDSTACK_APP_ID` | 授权跳转、嵌入、套餐归属 | 前端 + 后端 |
| `api_key` | `IDSTACK_APP_API_KEY` | 换 token 时的 `client_id` | **仅后端** |
| `secret_key` | `IDSTACK_APP_SECRET_KEY` | 换 token 的 `client_secret`；webhook 签名 | **仅后端** |
| JWKS 公钥 | `IDSTACK_JWKS_URI` / `IDSTACK_ISSUER` | 后端拉 JWKS 验签读角色（RS256） | **仅后端** |

> 🚨 `api_key` / `secret_key` **绝不进前端**——进浏览器等于把应用权限交出去。JWT 验签改为后端拉 JWKS 公钥（RS256），不再共享 `jwt_secret`。

> ⚠️ `app_id` ≠ `client_id`：授权用 `app_id`（应用 UUID），换 token 用 `client_id = api_key`。

### 4.3 白名单配置（两处，缺一不可）

```bash
# 后端 .env.production —— 管「谁的跨域请求能打到 API」
CORS_ALLOW_ORIGINS=https://your-app.com

# 前端（packages/client）构建期 —— 管「谁能与登录页完成令牌握手」
VITE_AUTH_ALLOWED_ORIGINS=https://your-app.com
```

两者均为**精确匹配**，不支持 `*.your-app.com` 通配，多域名逐一列出，改完需**重启后端 / 重新构建前端**。

### 4.4 webhook 配置

**接收方是绕道儿文档，不是目标 APP**——订单与支付由 IDStack 持有，核销后由 IDStack 推给绕道儿文档，落地配额；目标 APP 不参与，也不需要实现接收端点。

在 IDStack 侧登记（按优先级命中即止）：

| 配置项 | 位置 | 说明 |
|--------|------|------|
| 应用级 `webhook_url` | 应用编辑页（推荐） | 绕道儿文档的 **HTTPS** 端点：`POST https://<DOCS 域名>/api/v1/auth/idstack-webhook` |
| 租户 `idstack_webhook_url` | 租户设置 | 需开启 `idstack_webhook_enabled = true`（无需 secret） |
| 全局 `IDSTACK_WEBHOOK_URL` | 环境变量 | 兜底方案（无需 secret） |

| 请求头 | 说明 |
|--------|------|
| `X-IDStack-Signature` + `X-IDStack-Timestamp` + `X-IDStack-Event-Id` | **RS256 签名**（复用 JWKS 公钥），服务端验签 + 时间窗校验 |

> ⚠️ 这是**统一事件入口**：IDStack 只配一个地址，身份 / 角色 / 会员 / 支付等所有事件都推到这里，绕道儿文档按 `event` 分发（当前处理 `payment.verified`，其余记录后忽略）。
> ⚠️ 地址必须是 IDStack 可访问的公网地址——配成 `localhost` 会导致事件全部 404、订单永远停在待支付。本地联调需内网穿透。

---

## 5. 对接清单（必配项）

### 5.1 平台侧（绕道儿文档部署方配置，目标 APP 不用管）

```bash
# 后端 .env.production
CORS_ALLOW_ORIGINS=https://your-app.com      # 放行目标 APP 域名，精确匹配
IDSTACK_BASE_URL=https://idstack.raodaor.com # SSO 授权页地址
IDSTACK_APP_ID=<绕道儿文档在 IDStack 的应用 UUID>

# 前端（packages/client）构建期环境变量
VITE_AUTH_ALLOWED_ORIGINS=https://your-app.com  # 允许接收登录令牌的宿主来源
```

> 缺 `CORS_ALLOW_ORIGINS` → 浏览器预检被拒，表现为「请求无响应」
> 缺 `VITE_AUTH_ALLOWED_ORIGINS` → 登录后令牌不回传，弹窗不关闭

### 5.2 目标 APP 侧

1. **提供域名**给平台方，加入 §4.3 的两处白名单
2. **前端接入**：跨域 `multipart/form-data` 上传 + JSON 请求（携带 `Authorization` 头）
3. **后端准备**：字段映射与业务校验逻辑（这是目标 APP 的既有职责，不由文档侧提供）
4. **无需实现 webhook**：`payment.verified` 由绕道儿文档接收并落地配额（见 §4.4）；目标 APP 只需处理好支付后的前端交互（关闭弹窗、刷新列表）
5. **先跑自检**：[import-api.md §10 对接自检清单](./import-api.md#10-对接自检清单)（走 Open API 则用 [open-api-guide.md §4 上线自检清单](./open-api-guide.md#4-上线自检清单)）

### 5.3 遇到问题怎么反馈（闭环）

| 你是谁 | 场景 | 通道 |
|--------|------|------|
| 目标 APP 开发者 | 对接疑问、要报价、要定制能力 | 公开落地页 `/plans` 提交洽谈（`POST /sales-leads`，`interest=integration`，无需登录） |
| 终端用户 | 已付款但套餐未生效、金额有疑问 | 「我的订单」页「上报问题」→ 运营方回复，用户可见进展（`POST /billing/disputes`） |
| 组织管理员 | 组织/成员/密钥相关 | 侧栏「团队与身份」「API 密钥」自助处理；需平台侧操作的走洽谈线索 |

---

## 6. 架构原则：单向权威

绕道儿文档推荐并**只支持**一种协作模式：

```
目标 APP 的业务表 = System of Record（权威数据源）
        ↕ 经目标 APP 校验后同步
在线表格 = Interaction Layer（编辑 / 加工 / 批量录入界面）
```

表格不持有权威数据。表格中的改动需经目标 APP 后端校验通过后，才写入业务库；校验失败则在表格中**标红问题单元格**引导用户修正。

> **为什么**：业务数据常含结构化关系与约束（依赖、状态流转、资源冲突），二维表格表达关系只能靠冗余列，长期作为权威源会导致关系断裂与统计困难。
>
> 若你的产品本就是「轻量表格型」，以表格为权威源也成立，但需要关系字段与视图层能力——当前未提供。

**Open API 的能力边界与这套范式一致**：提供 `docs:read`（读取文档列表与结构化数据）、`docs:import`（导入建文档）、`docs:write`（**校验标红 / 清除标红** 与 **删除暂存文档**，2026-09-16 增补）。
也就是说：服务端可以走完「把业务数据推成一篇在线表格 → 用户在线加工 → 读回业务库 → 校验失败标红引导修正 → 导入成功清理暂存」的完整闭环；
但**把业务数据写进表格**仍不在开放范围内——标红只是交互层标注，不是把表格变成权威源，与本节原则不冲突。

---

## 7. 按路径深入

- **导入加工闭环**（上传 → 在线加工 → 结构化读回 → 校验标红）→ [import-api.md](./import-api.md)
- **套餐与支付对接**（意图表、webhook、配额落地）→ [billing.md](./billing.md)
- **组织级 API Key / Open API 接入**（服务端直连通道，已实施）→ [organization-api-keys.md](./organization-api-keys.md)
- **Open API 对接流程**（七步流程、端点、错误兜底、上线自检清单）→ [open-api-guide.md](./open-api-guide.md)
- **技术架构**（数据模型、协同、权限、部署）→ 当前未单独发布
- **嵌入范式参考**（同生态 IDStack 的 postMessage 握手，Phase 3 依据）→ 待发布
- **ApiKey / 应用租户参考**（同生态 raodaor-file，Phase 2 依据）→ RaoDaor File 文件服务文档

---

## 8. 文档索引

| 文档 | 用途 |
|------|------|
| **[overview.md](./overview.md)**（本文） | 唯一入口：能力地图、身份体系、套餐计费、入驻流程、对接清单 |
| [import-api.md](./import-api.md) | 导入加工对接契约（Phase 1，含自检清单与端到端示例） |
| [billing.md](./billing.md) | 套餐计费与支付对接契约（组织级配额、`payment.verified` webhook） |
| [open-api-guide.md](./open-api-guide.md) | 服务端直连：七步对接流程、端点、错误兜底、上线自检清单 |
| [organization-api-keys.md](./organization-api-keys.md) | 组织级 API Key 设计与安全规范（签发 / 轮换 / 吊销 / 限流 / 审计） |
| [quickstart.md](./quickstart.md) | 最短接入路径与上线检查 |
| [errors.md](./errors.md) | 错误码字典与排查路径 |
| [ai-brief.md](./ai-brief.md) | AI 辅助接入时必须遵守的硬约束 |

**同生态参考**（无直接链接，按名查阅）：RaoDaor File 文件服务文档（ApiKey / 应用租户设计参照）、IDStack Web SDK 文档（支付 / 套餐 / 会员能力完整说明）。
