<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-docs/organization-api-keys.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 组织级 API Key 与 Open API 接入设计（评审稿）

> **状态**：已实施（v0.1 评审稿 2026-09 → 2026-09-09 按 §8 默认建议落地 P1 / P2）。
>
> - 已实现：组织级 API Key 管理（签发 / 列表 / 更新 / 轮换 / 吊销）、
>   `/api/v1/open/*` Open API 通道（鉴权守卫、scope、per-key 限流、幂等、审计落库）、
>   组织维度配额变体。实现细节与文件清单见 §10。
> - 增补（2026-09-16）：Open API 新增 `docs:write` scope 与标红 / 删除端点，见 §10.1 增补记录。
> - 待用户手动执行：Prisma 迁移与 `prisma generate`（见 §7 警示）。
> - 未实现：P3 示例 SDK npm 包（按 D6 默认，先只提供 REST 规范与 curl 示例）。
>
> 主题一句话：**第三方目标 APP 的服务端如何“代表一个已付费组织”安全地调用绕道儿文档的导入/加工能力，并按该组织的配额计费。**

---

## 1. 阅读前提与术语

本文假设读者已了解两个既有契约（本仓库，均已实现）：

- **用户级导入对接**：目标 APP 前端经 SSO 弹窗拿本 APP `Bearer` JWT，直连 `/api/v1/documents/*`（见 [import-api.md](./import-api.md)）。
- **组织计费 / 支付**：组织 = IDStack 租户 = 计费主体；本 APP 不碰钱，只“发起支付 + 消费 webhook 落地配额”（见 [billing.md](./billing.md)）。

| 术语 | 含义 |
|---|---|
| 组织（Organization） | IDStack 租户在本 APP 的落库实体，套餐与配额归属主体 |
| 计费主体 | 组织身份下取组织套餐；个人身份兜底用户套餐（`User.plan`） |
| 组织管理员 | 本 APP 组织身份档 `organization` 角色（成员/密钥管理权），IDStack 侧签发 |
| Open API | 本文拟新增的**服务端直连通道**（带 `X-API-Key`，供目标 APP 后端调用） |
| Org API Key | 组织级接入密钥，Open API 的凭证；本文核心新对象 |
| 目标 APP | 第三方业务系统（如 ERP），绕道儿文档的外部客户 |

---

## 2. 现状缺口与设计目标

### 2.1 现状：两条通道，只通了一条半

```
已实现：目标 APP 前端 ──SSO 弹窗拿 token──▶ /api/v1/documents/*   （Bearer，用户身份）
已实现：组织管理员 ──/billing 升级──▶ 意图表 → IDStack 收款 → payment.verified → Organization.plan 抬档
未实现：目标 APP 后端 ──❌──────▶ 任何“以组织身份”调用的服务端通道（无 Org API Key）
```

- 配额引擎（`QuotaService` 文档数 / `MeterService` 月导入次数）、组织共享计量（`UsageCounter.ownerKey = organization:<id>`）**均已就绪**——缺的只是把它们接到“服务端 API 通道”上。
- `overview.md §3.6` 将“能力集成（SDK / Open API）”列为规划中；同生态 `raodaor-file` 已实现 `X-API-Key / ApiKeyGuard / keyHash(SHA-256) / scope`，**本文方案照搬该范本的组织级变体**，不另起炉灶。

### 2.2 目标

1. 组织管理员在平台控制台**自助签发/吊销/轮换**组织级 API Key；
2. 目标 APP 后端持 Key 调 **Open API**（`/api/v1/open/...`），代表组织消费资源；
3. 每一次调用都**校验 Key 有效性 + 权限 scope + 组织配额**，并把用量**计入该组织的既有配额**（与组织成员 UI 操作共享同一池子）；
4. 全链路可审计、可吊销、超限有明确错误语义；
5. 密钥满足：明文仅一次、库内不存明文、不随请求体传输敏感信息的工程底线。

---

## 3. 组织配额：规则现状（引用，不新设计）

> 配额常数单一数据源：`packages/shared/src/constants/plans.ts → PLAN_QUOTAS`；按身份取套餐：`packages/server/src/common/quota/quota.service.ts`。

| 配额项 | free | basic | pro | enterprise |
|---|---|---|---|---|
| 文档数（存量硬上限） | 10 | 100 | 1,000 | 定制（≈∞） |
| 月导入次数（自然月重置） | 50 | 1,000 | 10,000 | 定制 |
| 单文件最大行数 | 20,000 | 50,000 | 200,000 | 定制 |
| 单文件最大字节 | 5MB | 20MB | 50MB | 定制 |
| 单文档协作者 | 3 | 10 | 50 | 定制 |

- **归属与共享**：组织身份下，同一组织成员共享一份配额（`UsageCounter` 以 `organization:<id>` 聚合；
  文档数按 `Workbook.organizationId` —— **创建时的归属快照**统计，见下文「串台」说明）。
- **套餐回退**：无组织 / `planExpiresAt` 过期 / 非法码 → 一律回落 `free`，不报错不锁死（`quota.service.ts getPlan`）。
- **超额行为**：文档数超限抛 `WORKBOOK_LIMIT_EXCEEDED (3006)`；月导入超限抛 `IMPORT_QUOTA_EXCEEDED (5005)`（`packages/shared/src/constants/errors.ts`），不静默降级。
- **新组织的初始套餐**：一律 `free`（`Organization.plan` 默认 `"free"`）。申请制（`OrganizationRequest`）审批通过**不自动带套餐**，组织真正生效需管理员自行在 `/billing` 升级订阅，或企业版走商务洽谈后人工核销抬档。

> ⚠️ 已知缺口（不在本文主范围，评审可一并拍板）：`maxCollaborators` 目前仅在配额表/前端展示，邀请与共享入口**未做服务端强制**。

---

## 4. 组织如何获得付费套餐：支付链路（现状，引用）

本 APP 不建订单表、不对接支付渠道；收款全部由 **IDStack 托管**。组织管理员（`organization` 角色）在 `/billing` 选择升级：

```
管理员点「升级 basic/pro」
  → POST /billing/checkout：落「待支付意图表」CheckoutSession
      (externalOrderId + targetPlan + organizationId，金额由服务端环境变量锁定)
  → 前端 IdStackEmbed(payment-create)：拉起 IDStack 托管收款页
      ├─① 线上：嵌入页内 微信/支付宝 直接付
      ├─② 分享支付链接：凭证页「分享」→ shareUrl 发给付款人（手机匿名付）
      └─③ 线下/对公：转账后提交凭证 → 收益方管理员在 payment-orders 页核销 voucher
  → IDStack 推 payment.verified（核销成功才推，非付款时点）
  → 本 APP webhook：RS256 签名校验（X-IDStack-Signature）+ 幂等反查 externalOrderId
      → Organization.plan / planExpiresAt 抬档 → 组织成员即刻共享新配额
```

要点：
- **核销后生效**（`payment.verified` 语义），前端 `onPurchaseSuccess` 仅作 UX 提示；
- **当前实现按“当前身份”下单**：组织身份单升级组织、个人身份单升级本人 `User.plan`；
- **企业版无标价**：走 `/plans` 商务洽谈（`POST /sales-leads`）→ 管理员 `/admin/leads` 跟进 → 谈成后在 IDStack 建租户/核销企业单。

> 评审项（见 §8 · D8）：是否支持“申请创建组织时即选择套餐/试用期”。本文默认**否**——统一走“免费起步 + 组织管理员自助订阅”单一权威路径，避免运营手工抬档的双写一致性成本。

---

## 5. 组织级 API Key 设计（核心新增）

### 5.1 凭据形态与生命周期

| 项 | 设计 |
|---|---|
| 格式 | `rdorg_` + 32 字节随机数（`base64url`），如 `rdorg_AbC...`（全程约 45 字符） |
| 存储 | 库中**只存** `SHA-256(hex)` 摘要（`keyHash`，`@unique`）；永不存明文 |
| 明文暴露 | **仅创建接口响应下发一次**；页面提示“复制后不再显示，丢失请轮换” |
| 可识别字段 | `prefix`：`rdorg_` + 摘要前 8 位，仅用于管理列表/日志/审计，不可用于调用 |
| 状态机 | `active → revoked`（人工吊销）；`expiresAt` 到期自动视为无效（不落 revoked） |
| 吊销 | 即时生效（鉴权读库判状态），无 TTL 缓存或缓存 ≤ 5s |
| 防泄漏 | 头部名 `X-API-Key`；仅限服务端持有；密钥不进入 URL / 查询串 / 前端代码 |

### 5.2 数据模型草案（Prisma）

> 沿用项目“单一权威 / 可空键规避 NULL 复合唯一”的建模习惯。迁移名建议 `add_organization_api_keys`（须由用户手动执行 `npx prisma migrate dev`）。

```prisma
/// 组织级接入密钥（Phase 2：Open API 通道凭证）
///
/// 安全要点：
/// - 只存 SHA-256(hex) 摘要，明文仅在创建时下发一次
/// - 吊销/过期即时生效；scope 逗号分隔
/// - 配额计量并入该组织既有 UsageCounter，与成员 UI 操作共享池子
model OrganizationApiKey {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  /// 管理员填写的名称（如「生产 ERP 对接」）
  name           String
  /// `rdorg_` + keyHash 前 8 位，仅展示与审计定位用
  prefix         String
  /// SHA-256(key) 的 hex 摘要（唯一，鉴权查询键）
  keyHash        String   @unique
  /// 权限 scope，逗号分隔（如 `docs:import,docs:read`）；空 = 仅 docs:read
  scopes         String   @default("docs:read")
  /// active / revoked
  status         String   @default("active")
  /// 到期时间；null = 长期有效
  expiresAt      DateTime?
  /// 可选 IP 白名单（JSON 字符串数组）；空数组 = 不限制
  ipAllowlist    Json?
  /// 最近一次成功使用时间（节流更新，见 §5.6）
  lastUsedAt     DateTime?
  revokedAt      DateTime?
  revokedReason  String?
  createdById    String
  createdAt      DateTime @default(now())

  @@index([organizationId, status])
  @@index([keyHash])
}

// Organization 模型补充反向关系：
//   apiKeys OrganizationApiKey[]
```

### 5.3 Scope 清单（MVP 子集，可按需扩展）

| scope | 说明 | 是否入 MVP |
|---|---|---|
| `docs:read` | 读取文档/工作表结构与数据 | ✅（默认） |
| `docs:import` | 上传并导入建文档（配额主消费动作） | ✅（目标 APP 主诉求） |
| `docs:write` | 更新单元格（**校验标红 / 清除标红**）+ 删除文档（暂存清理） | ✅（2026-09-16 增补；定位为交互层标注，不含业务数据写入，`clear: true` 服务端拒绝） |
| `collaborators:manage` | 管理协作者 | ❌ 后续（组织成员管理另有 UI） |

约定：**scope 永远“够用最小”**，签发时默认只勾 `docs:import` + `docs:read`；服务端对每项操作做 scope 交集校验（`required ⊆ key.scopes`）。

### 5.4 签发/管理接口（组织管理员，走既有 `manageMembers` 同款校验）

```
平台侧新模块：modules/organization-keys（后端）+「组织设置 → API 密钥」页（前端）

POST   /api/v1/organization-keys           签发（返回明文一次；需组织管理员身份）
GET    /api/v1/organization-keys           列表（只回 prefix/name/scopes/status/expiresAt/lastUsedAt，不回 keyHash）
PATCH  /api/v1/organization-keys/:id       更新（改名 / 换 scope / 设到期 / 设 IP 白名单）
POST   /api/v1/organization-keys/:id/rotate 轮换（旧 key 立即 revoked，返回新 key 明文一次）
POST   /api/v1/organization-keys/:id/revoke 吊销（幂等；带 revokedReason）
```

- 放行规则：**组织管理员**（`organization` 角色属当前组织，等同 members.service 路径）或平台运营者（`system_admin` / `owner`）；`org_member` 一律无签发权（防止普通成员私自卖额度）。
- 密钥数量上限：per 组织 5 枚（防滥用；MVP 常量 `ORG_API_KEYS_MAX = 5`）。

### 5.5 Open API 通道（核心新增）

**前缀路由统一加 `/api/v1/open`，与用户通道物理隔离，互不认账：**

| 通道 | 凭证 | 配额身份 | 调用方 |
|---|---|---|---|
| `/api/v1/documents/*`（现状） | `Authorization: Bearer <本 APP JWT>` | 当前身份（组织/个人） | 目标 APP 前端（SSO 用户） |
| `/api/v1/open/*`（新增） | `X-API-Key: <Org Key>` | **Key 绑定的组织** | 目标 APP 后端 |

- `OpenApiAuthGuard`（实现 `CanActivate`）：
  1. 取 `X-API-Key` → `sha256` → 查 `keyHash`；查无 / `revoked` / 过期 → `401`；
  2. 校验请求 IP ∈ `ipAllowlist`（若配置）→ 否则 `403`；
  3. scope 交集校验 → 不足 `403`；
  4. 注入 `{ organizationId }`（含 org 套餐）到请求上下文；
  5. `lastUsedAt` **节流更新**（两次写入间隔 ≥ 5 分钟），避免每请求一写。
- **配额拦截是重点**：现有 `QuotaService.assertCanCreateDocument(userId)` / `MeterService` 都从 userId 反推归属。Open API 场景没有自然人，故抽**组织级变体**（复用同一计数逻辑，不动既有业务调用点）：
  - `assertCanCreateDocumentForOrganization(organizationId)`：按该组织套餐上限 + 该组织名下的文档数
    （`Workbook.organizationId` 快照）判断 → 超限抛 `3006`；
  - `meter.incrementForOwner('import_count', 'organization:' + organizationId)`：与成员 UI 导入**共用同一个 `UsageCounter` 行**，天然共享月额度。
- **“落文档给谁”** 见 §8 · D1（推荐：目标 APP 调用时显式传组织内成员 email，服务端校验其属于该组织后以其名义落 owner；配额与权限与成员操作一致，零新概念）。
- **速率限制**：既有 `RateLimitGuard` 按 IP 窗口（内存）不适合 key 语义，Open API 前缀**追加 per-key 固定窗口限流**（如 60 req/min/Key，常量可配）；超限 `429`。
- **审计**：见 §8 · D7（MVP 建议落库最小 AccessLog，关键事件必记）。

### 5.6 目标 Open API 端点草案（MVP）

| 方法 | 路径 | 所需 scope | 行为 |
|---|---|---|---|
| `GET` | `/api/v1/open/organizations/me` | 任意 | 返回组织名、套餐码、配额用量概览（供目标 APP 预检/降级提示） |
| `GET` | `/api/v1/open/workbooks` | `docs:read` | 列出组织下文档（分页 + 软删除过滤与现有查询一致） |
| `GET` | `/api/v1/open/workbooks/:id` | `docs:read` | 读文档结构（sheet/单元格，语义对齐现 `GET /documents/:id`） |
| `POST` | `/api/v1/open/workbooks/:id/import` | `docs:import` | 上传文件导入建文档（复刻现导入内部服务；配额=导入次数+文档数双校验） |
| `GET` | `/api/v1/open/usage` | 任意 | 该组织套餐与用量（文案对齐 `/quota`） |

导入幂等：重试场景需防重复建文档，见 §6.4。

### 5.7 与“IDStack 平台凭证”的边界（防混淆）

| 凭证 | 属于谁 | 用途 | 存放 |
|---|---|---|---|
| `app_id / api_key / secret_key` | 平台应用在 IDStack 的身份 | SSO 授权、token 交换、webhook 验签、JWT 验签（RS256，走 JWKS 公钥，不再共享 `jwt_secret`） | 平台后端 `.env` |
| 本 APP 用户 JWT | 终端用户 | 访问 `/api/v1/documents/*` | 目标 APP 前端 |
| **Org API Key（本文）** | **组织（客户）** | 目标 APP 后端调 `/api/v1/open/*` | 目标 APP 服务端 |

Org API Key **不是** IDStack 那套凭证的子集：前者计量到本平台组织配额，后者是平台与 IDStack 的集成身份。两者都是后端机密，绝不进浏览器。

---

## 6. 目标 APP 对接 SDK 规格与安全规范

### 6.1 接入五步（目标 APP 视角）

1. 组织管理员在平台「组织设置 → API 密钥」**签发 Key**，选择 scope（`docs:import` 为主），复制一次；
2. Key 配置到目标 APP **后端环境变量**（如 `RAODAOR_DOCS_API_KEY`），不进前端代码/仓库；
3. 目标 APP 后端直连 `https://<平台域名>/api/v1/open/...`，携带 `X-API-Key`；
4. 先调 `GET /api/v1/open/organizations/me` 与 `GET /api/v1/open/usage` 做**联调自检**（配额是否够、Key 是否有效）；
5. 生产接入遵守 §6.3 客户端规范。

### 6.2 请求示例

```bash
# 预检：组织身份与配额
curl -s https://docs.example.com/api/v1/open/organizations/me \
  -H "X-API-Key: rdorg_AbC..." | jq

# 导入（配额消费动作：月导入次数 +1，文档数占额）
curl -s -X POST https://docs.example.com/api/v1/open/workbooks/import \
  -H "X-API-Key: rdorg_AbC..." \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./customers.xlsx" \
  -F "ownerEmail=ops@client-corp.com" \
  -F "docName=客户主数据导入" | jq
```

### 6.3 客户端工程规范（写入 SDK/示例代码的要求）

- 只走 **HTTPS（TLS ≥ 1.2）**；Key 存服务端密钥管理（env / Vault），绝不出现于日志、异常消息、URL、页面源码；
- **重试与退避**：`429`/网络错误按 `2^n` 指数退避 + 抖动，最多 3 次；`4xx` 业务错误**不重试**；
- **幂等键**：写操作（导入）支持 `Idempotency-Key` 请求头（UUID）。服务端按“组织 + Key 前缀 + 幂等键”去重，防重试造成重复建文档（MVP 落库去重，先于任务表完成去重，见 §5.6）；
- **超时**：默认连接 10s / 读 60s；大文件导入走同步响应仍返回任务进度（与现有导入能力对齐，不新造异步轮询）；
- 收到配额类错误（`3006` / `5005`）时，**向端上用户提示降级**，不做静默吞掉。

### 6.4 错误语义统一表

| HTTP | body.code | 场景 | 目标 APP 动作 |
|---|---|---|---|
| `401` | `1000` | Key 缺失/无效（查无、吊销、过期） | 提示管理员检查/轮换 Key |
| `403` | `1000` | scope 不足 / IP 白名单外 | 去平台改 Key 配置 |
| `400` | `3006` | 文档数达组织套餐上限 | 提示升级或清理文档 |
| `400` | `5005` | 本月导入次数达上限 | 提示次月再试或升级 |
| `429` | — | per-key 限流 | 指数退避重试 |
| `413` | — | 超单文件大小上限（配额表逐档） | 提示压缩/分片 |

> 沿用现业务码（`3006` / `5005`）而非另造错误码——同一配额体系，目标 APP 与用户端看到的错误同义。

---

## 7. 落地切分（评审通过后执行，含涉及文件）

> ⚠️ 本项目约定：schema 变更后**迁移由用户手动执行**（`npx prisma migrate dev --name <语义名>`），助手不自动运行。

**实现状态**：P1（密钥管理）/ P2（Open API 通道）已落地，按 §8 决策表的默认建议执行；
P3（示例 SDK）待客户反馈后启动。

| 阶段 | 任务 | 主要涉及文件 |
|---|---|---|
| P0 前置（**已具备，仅验证**） | 组织配额/共享计量、`/billing` 支付闭环、`organization` 角色放行可跑通 | `quota.service.ts`、`meter.service.ts`、`billing` 模块 |
| P1 密钥管理 | schema `OrganizationApiKey` + 迁移；shared 常量（前缀/生成/哈希/scope/上限）；后端 `organization-keys` 模块（签发/列表/改/轮换/吊销 + guard 基座）；前端「API 密钥」页 + 侧栏（组织管理员可见）+ i18n | `prisma/schema.prisma`、`packages/shared/src/constants/api-key.ts`、`server/src/modules/organization-keys/*`、`client/src/pages/org-settings/ApiKeysPage.tsx` 等 |
| P2 Open API | `OpenApiAuthGuard`；org 级配额变体（`assertCanCreateDocumentForOrganization` / `incrementForOwner`）；`/api/v1/open/*` 端点；per-key 限流；幂等去重；AccessLog；自检清单文档 | `server/src/common/quota/`、`server/src/modules/open-api/*`、`shared/src/constants/errors.ts`（如需补充） |
| P3 收尾 | 示例 SDK（Node 最小封装或仅文档+curl）、联调自检、上线后观测 | 文档与示例 |

**总览文档同步**：本文对应 [overview.md](./overview.md) §7 入口与 §8 索引，随实现期一并更新。

---

## 8. 评审决策点清单

| # | 决策 | 选项 | 默认建议 |
|---|---|---|---|
| D1 | Open API 导入的文档**owner 落给谁** | A：调用方传组织内成员 email，服务端校验归属后以其名义；B：组织 service account（不登录的特殊用户）；C：后续 Application Tenant | **A**：零新概念、与成员权限/计量一致、迁移最小 |
| D2 | Key 作用域粒度 | A：仅组织级（本文）；B：应用级 sub-tenant（enterprise 远期） | **A**，B 进 backlog |
| D3 | Open API 用量是否并入组织既有配额 | A：并入同一 `UsageCounter` / 文档数池；B：单列 open_api 用量新池 | **A**（同一份套餐，语义简单、防“双倍额度”错觉） |
| D4 | 配额超额 HTTP 语义 | 沿用 `400 + code 3006/5005`；或改 `402` | **沿用 400 + 现业务码**（与既有错误体系一致，客户端解析简单） |
| D5 | MVP scope 范围 | 仅 `docs:import` + `docs:read`；或加 `docs:write` | **前者**（2026-09-16 修订：`docs:write` 已按限定形态落地——仅标红/清理，不含业务数据写入，见 §10.1） |
| D6 | SDK 交付形态 | A：仅 REST 规范 + curl/示例；B：另发 npm 包 | **A**（P3 视客户反馈再评估 B） |
| D7 | Open API 审计 | A：落库最小 AccessLog 表；B：仅结构化日志 | **A**（对 B 端客户可追溯是硬需求），注意写路径异步/低损 |
| D8 | 组织开通是否支持“申请时选套餐/试用期” | A：不支持，统一免费起步 + 自助订阅；B：支持申请带套餐 | **A**（见 §4 评审项） |
| D9 | （顺带）`maxCollaborators` 服务端强制是否本期一并修 | 是 / 否 | 是（小改，风险低，避免配额表失真） |

---

## 9. 相关文档索引

- 面向实施/运维的对接流程与自检清单：[open-api-guide.md](./open-api-guide.md)
- 用户级导入契约：[import-api.md](./import-api.md)
- 套餐计费与支付契约：[billing.md](./billing.md)
- 接入总览（组织/套餐/入驻流程）：[overview.md](./overview.md)
- ApiKey / 应用租户实现范本：RaoDaor File 文件服务文档（同生态 raodaor-file）
- IDStack Web SDK（支付嵌入/核销语义）：`canonical/sdk/idstack-web/features.md`

---

## 10. 实施记录（2026-09-09）

**决策取值**：D1 = A（成员代持，见下）；D2 = A（仅组织级）；D3 = A（并入组织既有配额）；
D4 = 沿用 `400 / 429 + 现业务码`；D5 = 仅 `docs:read` + `docs:import`；D6 = A（仅 REST 规范）；
D7 = A（落库 AccessLog）；D8 = A（不支持申请时选套餐）；D9 = 否（本期不动 `maxCollaborators` 强制）。

**新增 / 修改文件**

| 层 | 文件 | 说明 |
|---|---|---|
| schema | `packages/server/prisma/schema.prisma` | 新增 `OrganizationApiKey` / `OpenApiAccessLog` / `OpenApiIdempotency`；`Organization.apiKeys`、`User.createdApiKeys` 反向关系 |
| shared | `src/constants/api-key.ts`（新）、`src/constants/errors.ts`、`src/index.ts` | 前缀 / scope / 限流常量；新增 8xxx 错误码与消息对 |
| server | `src/common/utils/api-key.util.ts`（新） | 明文生成 + SHA-256 摘要 + 常量时间比较（依赖 `node:crypto`，故不放 shared） |
| server | `src/common/guards/open-api-auth.guard.ts`（新） | 密钥校验 → 吊销/过期 → IP 白名单 → per-key 限流 → 注入上下文 |
| server | `src/modules/organization-keys/*`（新） | 签发 / 列表 / 更新 / 轮换 / 吊销，放行口径与成员管理一致 |
| server | `src/modules/open-api/*`（新） | `open` 控制器、服务（组织概览 / 用量 / 文档读写 / 导入）、审计拦截器 |
| server | `src/common/quota/quota.service.ts`、`src/common/meter/meter.service.ts` | 新增组织维度变体（`getPlanForOrganization` / `assertCanCreateDocumentForOrganization` / `checkForOwner` 等） |
| server | `src/modules/file/file.module.ts`、`src/app.module.ts` | 导出 `ImportWorker`（Open API 入队后立即 kick）；注册两个新模块 |
| client | `src/services/organizationKeysApi.ts`（新）、`src/components/OrganizationApiKeysPage.tsx`（新） | API 封装与管理页（明文一次性弹窗 + 复制 + 两步确认轮换/吊销） |
| client | `src/App.tsx`、`src/components/layout/AppShell.tsx`、`src/i18n/locales/organizationKeys.ts`（新）、`i18n/index.ts`、`locales/common.ts` | 路由 `/admin/organization-keys`、侧栏入口（`manageMembers` 门控）、三语文案 |

**与设计的两处偏差（有意为之）**

1. **导入归属（D1）未要求 `ownerEmail` 必填**：未传时回退到**密钥签发人**，并校验其仍在组织内；
   不在组织内则要求显式传 `ownerEmail`。这样单成员小组织可零配置接入，大组织仍可精确归属。
2. **`Idempotency-Key` 独立落表而非复用 `ImportTask`**：同步导入不建任务记录，
   复用会漏掉小文件场景；独立表 + 唯一键冲突回读，同步 / 异步两条路径都能去重。

### 10.1 增补记录（2026-09-16）：`docs:write` scope + 标红 / 删除端点

FlowPlan × 绕道儿文档导入闭环（FlowPlan 仓库 `docs/plans/2026-09-16-raodaor-docs-integration-design.md`）
需要「服务端标红 + 暂存清理」能力，D5 决策据此**部分修订**：`docs:write` 落地，但严格限定为
**交互层标注 + 暂存文档清理**，不含业务数据写入（不破坏「目标 APP 业务库 = 权威源」范式）。

| 层 | 文件 | 说明 |
|---|---|---|
| shared | `src/constants/api-key.ts` | `API_KEY_SCOPES` 新增 `docs:write` |
| server | `src/modules/open-api/open-api.controller.ts` | 新增 `PATCH /open/workbooks/:id/sheets/:sheetId/cells` 与 `DELETE /open/workbooks/:id?permanent=true`（scope `docs:write`） |
| server | `src/modules/open-api/open-api.service.ts` | 新增 `updateCells` / `deleteWorkbook`：以文档 owner 身份复用 `WorkbookService.batchUpdateCells` 与删除逻辑；抽出 `findOrgWorkbook` 组织归属校验（读/写/删共用，组织外一律 404）；`assertScope` 放宽为 `ApiKeyScope[]` |
| server | `src/modules/open-api/open-api.module.ts` | 引入 `WorkbookModule` |
| client | `OrganizationApiKeysPage.tsx`、`i18n/locales/organizationKeys.ts`、`i18n/locales/help.ts` | 签发弹窗新增 `docs:write` 勾选；三语文案与帮助文档对接步骤更新 |

**关键安全决策**：Open API 通道对 `clear: true` **直接 400 拒绝**——该分支删除整个单元格（含原值与公式），
对第三方是数据丢失脚枪；清除标红唯一合法姿势是 `v: { bg: null }`。
无 schema 变更，无需迁移。**既有密钥需在「API 密钥」页补勾 `docs:write` 后方可调用新端点**（PATCH 即时生效，无需轮换）。
