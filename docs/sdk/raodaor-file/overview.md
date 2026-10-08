<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-file/overview.md；修改请提交至 hub 仓库，勿直接编辑 -->

# RaodaorFile 接入总览

> 面向**第三方目标 APP 的开发者**：你要让自有站点具备「头像上传/获取、资源上传/获取」等文件能力，从哪开始、需要什么、该看哪篇详细文档，本文一图说清。
>
> 本文是**唯一入口**：先讲清概念模型与账号体系（最重要的前置），再给对接清单，业务能力分篇深入。

---

## 1. 先搞清楚：你接的是「文件服务」

本平台向目标 APP 开放两类能力，但**本文聚焦文件服务**（头像 / 资源上传获取）。另一类是嵌入 IDStack 功能屏，详见 [embed-integration.md](./embed-integration.md)。

| 你想做的事 | 看哪篇 | 核心 SDK / 端点 |
|------------|--------|----------------|
| 上传头像、上传资源、获取/分享文件、订阅文件审核事件 | [sdk-integration.md](./sdk-integration.md) | `@isudaji/raodaor-file-sdk` · `/api/v1/files` · `/picker` · Webhook |
| 在自有站点嵌入积分商城、任务中心、支付等 IDStack 功能屏 | [embed-integration.md](./embed-integration.md) | `@isudaji/raodaor-sdk-web-features` · `/embed/*` |

---

## 2. 概念模型与账号体系（必读，否则会对接错）

### 2.1 谁在登录？—— 终端用户用「IDStack 账号」

raodaor-file **不自建用户体系**。所有终端用户都用 **IDStack 账号**登录（SSO 统一身份）。目标 APP 只是「嵌了 raodaor-file SDK 的前端站点」，它**共享同一套 IDStack 用户**。

### 2.2 隔离边界是「Tenant（租户）」，不是「目标 APP」

后端实际模型（已对照代码确认），**三种租户类型**对应两种接入模式：

| 租户类型 | 对应模式 | 隔离单位 | 创建方式 | 文件归属 |
|---------|---------|---------|---------|---------|
| **个人租户**（PERSONAL） | 模式 A 网盘 | `personal-<idstackUserId后12位>` | 用户首次 SSO 登录时 `auth.service.upsertUser` 自动建，用户为 OWNER | 用户本人 |
| **组织租户**（ORGANIZATION） | 模式 A 团队/企业 | 多人共享，经 `Membership`（OWNER/ADMIN/MEMBER/VIEWER） | 需**平台方后台/DB 开通**（无租户侧自助端点） | 该组织成员共享 |
| **应用租户**（APPLICATION） | **模式 B OSS 式** | 目标 APP 的「存储桶」，按 `appId` 绑定 IDStack app_id | 由**平台管理员在后台配置 APP 并签发 ApiKey**（`POST /api/v1/admin/application-tenants`），目标 APP 后端从平台获取密钥后使用 | **目标 APP 所有** |

- 隔离单位是 **`Tenant`**。文件、上传会话、分享、Webhook、配额全部按 `tenantId` 强隔离。
- **个人租户（自动创建）**：用户首次经 IDStack SSO 登录时，后端 `auth.service.upsertUser` 会按 `idstackUserId` 落库 `User`，并**自动创建一个个人租户** `personal-<idstackUserId 后12位>`，用户成为该租户 OWNER。即：**1 个 IDStack 用户 = 1 套隔离的文件空间（个人租户）**。
- **「很多 APP」在本模型里 = 很多 IDStack 用户 / 很多租户**，由平台统一按租户隔离，目标 APP 无需各自注册。

> ⚠️ 不要理解为「一个目标 APP = 一个租户」。目标 APP 只是前端入口；真正隔离的是**用户/组织/应用对应的租户**。

#### 2.2.1 目标 APP 用户 ≠ RaoDaor File 用户（最易混的核心区别）

- raodaor-file **只认 `User.idstackUserId`（`@unique`）**，不认目标 APP 自有的 user_id。`upsertUser` 用 `findUnique({ where: { idstackUserId } })` 查找/创建。
- 因此"目标 APP 有 10 万用户"在 raodaor-file 眼里 = **10 万个 IDStack 用户**各自有个人租户（网盘模式）。
- **目标 APP 要落的是映射，不是账号**：`目标APP.user_id ↔ raodaor_file.file_id`（如头像）、可选 `目标APP.user_id ↔ idstackUserId`。raodaor-file 的 User 记录由 SSO 自动建，目标 APP 不碰创建逻辑。
- **raodaor-file 是平台级文件服务，不跟某个目标 APP 走，跟 IDStack 用户走**：用户用同一 IDStack 账号可既登目标 APP、也登 raodaor-file 网站（`/files`）看自己个人租户文件。

#### 2.2.2 两种接入模式（正式架构，详见 PRD §1.2.1）

- **模式 A 网盘/SaaS**：文件归终端用户个人租户，用户可独立上 raodaor-file 网站管理。前端直传（用户 token）。
- **模式 B 私有云存储/OSS 式**：目标 APP 持有**应用租户**，其用户上传的资源归属目标 APP（对标阿里云 OSS Bucket 属于网站）。终端用户**不**直接持文件主权，由目标 APP 后端用应用租户凭据**代理中转上传**。
  - **当前状态**：模式 B **已落地**。应用租户一等公民（`Tenant.type=APPLICATION` + `appId`）、**由平台管理员在后台配置应用并签发 ApiKey**（端点 `POST /admin/application-tenants`）、服务端 ApiKey 校验（`ApiKeyGuard`）、代理上传上下文（文件归应用租户）均已实现。双模式均可运行。
  - **错误示范（不要再写进对接方案）**：让终端用户前端直接用本人 token 调 `uploadAvatar`/`uploadFile`——文件会落回用户个人租户，与目标 APP "资源归我所有"的诉求相悖。

### 2.3 两种 token，别搞混（最常见坑）

| token | 签发方 | 作用 | 怎么用 |
|-------|--------|------|--------|
| **IDStack `access_token`** | IDStack（OAuth 流程） | 代表用户在 IDStack 的身份；用于 raodaor-file 的 SSO 登录换票 | 仅用于 `GET /api/v1/auth/login` 流程，换取本库 token |
| **本库 `access_token`** | raodaor-file（`JWT_ACCESS_SECRET` 签名，payload `{userId, tenantId, isTenantAdmin}`） | **调所有文件 API 的凭证** | `Authorization: Bearer <本库 token>` |

**直接用 IDStack 的 token 当 Bearer 调文件 API 会 401**——因为守护 `JwtAuthGuard` 用 `JWT_ACCESS_SECRET` 验签，且只需要 `{userId, tenantId}`。正确链路见 §3。

---

## 3. 目标 APP 对接清单（必配项）

### 3.1 平台侧（raodaor-file 部署方，目标 APP 不用管）

平台方需在 `.env` 配好 IDStack 对接（缺省时后端走 `x-tenant-id`/`x-user-id` 开发兜底）：

```
IDSTACK_BASE_URL=https://idstack.raodaor.com
IDSTACK_API_BASE_URL=https://idstack.raodaor.com
IDSTACK_APP_ID=<raodaor-file 在 IDStack 注册的应用 UUID>
IDSTACK_APP_SECRET=<对应 secret_key>
JWT_ACCESS_SECRET=<本库 JWT 签名密钥，务必与目标 APP 后端一致（如需验签）>
FILE_SIGN_SECRET=<签名短链密钥，强烈建议显式配置，保证多实例一致>
CORS_ALLOW_ORIGINS=https://yourapp.com,https://anotherapp.com   # 放行各目标 APP 域名
```

> **每个目标 APP 的域名都必须加入 `CORS_ALLOW_ORIGINS`**，否则其浏览器跨域调用文件 API 会被预检拒绝（表现为「无响应」）。

### 3.2 模式 A（网盘/SaaS 模式）目标 APP 侧

> 适用：文件归终端用户自己（头像、个人资源），用户可登 raodaor-file 网站 `/files` 管理。若你要的是"文件归目标 APP 所有"（类 OSS），请直接看 §3.4 **模式 B**，不要按本节前端直传。

1. **前端引入 SDK**：`pnpm add @isudaji/raodaor-file-sdk`（或本地引用 `frontend/vendor/...` 构建产物）。
2. **拿到本库 token（走 SSO 桥接，不要自己对接 IDStack）**：
   - 用户点击登录 → 重定向到 `GET {FILE_ORIGIN}/api/v1/auth/login`（后端会跳 IDStack 授权页）。
   - IDStack 登录成功后回调 `GET {FILE_ORIGIN}/api/v1/auth/callback?code=...` → 后端换取 IDStack token、upsert 用户/租户、签发**本库 JWT**，并以 query 重定向回前端 `/auth/callback?access_token=...&tenant_id=...`。
   - 前端保存 `access_token`，它就是调文件 API 的凭证。
3. **初始化 SDK**：
   ```ts
   const client = new RaoDaorFile({
     origin: 'https://file.raodaor.com',
     getToken: () => myStore.getAccessToken(),   // 返回本库 token（可异步、可刷新）
   });
   ```
4. **调用能力**：`uploadAvatar(file)` / `uploadFile(file)` / `signUrl(fileId)` 等，详见 [sdk-integration.md](./sdk-integration.md)。

### 3.3 token 刷新

本库 `access_token` 默认 15 分钟过期（`JWT_ACCESS_TTL`）。前端应在临近过期时调 `POST /api/v1/auth/refresh`（body `{ refresh_token }`）换新的 `access_token`+`refresh_token`，并让 `getToken()` 返回最新值。

### 3.4 模式 B（私有云存储 / OSS 式）目标 APP 侧

> 适用：**文件归目标 APP 所有**（头像库、UGC 资源、文档附件等），对标阿里云 OSS Bucket 属于网站。终端用户**不直接持文件主权**，由**目标 APP 后端**持有应用租户 ApiKey 代理上传。用户前端**绝不直接拿自己 token 调 `uploadAvatar`/`uploadFile`**（否则文件落回用户个人租户，与你的诉求相悖）。
>
> 前置：raodaor-file 后端需先完成 M6 数据库迁移（`Tenant.type=APPLICATION` + `appId` 列已落库）。**应用租户的开通与 ApiKey 签发不由目标 APP 自助完成，而是由平台管理员在后台操作**——目标 APP 侧只需拿到平台下发的 ApiKey 即可，无需（也不应）自行调用开通端点。

**目标 APP 对接步骤：**

1. **由平台管理员开通应用租户并签发 ApiKey**
   平台运营/管理员在 raodaor-file 管理后台（或调管理员端点 `POST /api/v1/admin/application-tenants`，需 `AdminAuthGuard` 鉴权）为目标 APP 配置应用租户：
   ```bash
   curl -X POST https://file.raodaor.com/api/v1/admin/application-tenants \
     -H "Authorization: Bearer <平台管理员JWT>" \
     -H "Content-Type: application/json" \
     -d '{"appId":"<你的IDStack-App-ID>","name":"<你的APP名，如绕道儿文档>"}'
   ```
   返回（`apiKey` **明文仅此一次**，由平台安全转交目标 APP 后端，立即存入其服务端密钥管理）：
   ```json
   { "code": 0, "data": {
       "tenantId": "tnt_xxx",
       "apiKey": "rdfl_abc123_xxxxxxxxxxxx",
       "appId": "<你的IDStack-App-ID>",
       "name": "<你的APP名>"
   }}
   ```
   后续如需轮换，管理员可 `POST /admin/application-tenants/:id/api-keys` 签发新 Key、`DELETE /admin/application-tenants/:id/api-keys/:keyId` 吊销旧 Key（`GET /admin/application-tenants/:id/api-keys` 可查看，不含明文）。
2. **代理上传（核心，三步分片上传）**：本 APP **仅提供分片式上传，没有「直传/一次性上传」端点**。目标 APP 后端收到终端用户上传请求后，**用 ApiKey 经 `X-API-Key` 通道**依次调用三步，文件 `tenantId`/`appTenantId` 自动记到应用租户：

   **步骤 2.1 — 创建上传会话** `POST /api/v1/uploads`（JSON body，字段见 `CreateUploadDto`）：
   ```bash
   curl -X POST https://file.raodaor.com/api/v1/uploads \
     -H "X-API-Key: rdfl_abc123_xxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "uploadKey": "a1b2c3...",          // 客户端生成的唯一上传标识（用于断点续传），必填 string
       "hash": "<文件内容 SHA-256>",        // 客户端计算，必填 string
       "size": 12345,                       // 文件字节大小，必填 number，>=0
       "name": "cover.png",                 // 文件名，必填 string，<=255 字符
       "mimeType": "image/png"              // 可选 string
     }'
   # 返回 data.uploadId（后续步骤用），例如 {"code":0,"data":{"uploadId":"upl_xxx", ...}}
   ```
   > ⚠️ 这一步**只接受 JSON body**，不接受 query 参数或裸二进制。把二进制直接塞进 body 会触发 `uploadKey must be a string / hash must be a string / name must be a string ...` 的 400 校验错误。

   > 🔑 **关于 `hash` 字段（必读）**：`hash` 必须是**目标文件二进制内容的真实 SHA-256 摘要（64 位小写十六进制）**。本 APP 在 `complete` 时会重新流式计算合并后文件的 SHA-256 并与你声明的 `hash` 比对，不一致则整次上传失败（会话标记 FAILED）。**绝不能**传空串（空串 SHA-256 = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`）或占位值。建议**由客户端在上传前计算**，避免目标 APP 后端重复读取文件。服务端 `CreateUploadDto` 已用正则 `/^[a-f0-9]{64}$/` 预校验，hash 格式非法会在**步骤 2.1 即返回 400**，无需等到 complete。

   **步骤 2.2 — 上传分片** `POST /api/v1/uploads/:uploadId/chunks/:index`（`multipart/form-data`，字段名 `chunk`）：
   ```bash
   curl -X POST https://file.raodaor.com/api/v1/uploads/upl_xxx/chunks/0 \
     -H "X-API-Key: rdfl_abc123_xxxxxxxxxxxx" \
     -F "chunk=@/tmp/cover.part0"           # 二进制分片，字段名固定为 chunk
   # index 从 0 起，按 chunkSize（默认 5MB）切分
   ```

   **步骤 2.3 — 完成上传** `POST /api/v1/uploads/:uploadId/complete`：
   ```bash
   curl -X POST https://file.raodaor.com/api/v1/uploads/upl_xxx/complete \
     -H "X-API-Key: rdfl_abc123_xxxxxxxxxxxx"
   # 返回 data.fileId（文件落库到应用租户），例如 {"code":0,"data":{"fileId":"file_xxx", ...}}
   ```
   - 取消：`POST /api/v1/uploads/:uploadId/cancel`。
   - 列举/下载/分享本应用租户文件，同样带 `X-API-Key`（无需用户 token）。
   - 三步流程与模式 A 完全一致，**唯一区别是鉴权把 `Authorization: Bearer <userJWT>` 换成 `X-API-Key`**。

   > 💡 **目标 APP 入库保存文件地址的建议（重要）**：`complete` 返回的 `url` 是带完整域名（`STORAGE_BASE_URL` + `/blobs/...`）的绝对地址。**目标 APP 入库时请只保存 `fileId` 与 blob 的「相对路径」**（即 `url` 去掉域名后的 `/blobs/4c/4cb16...` 部分），而**不要**把完整域名写死进数据库。
   >
   > **为什么用相对地址**：访问域名由本 APP 后端的 `STORAGE_BASE_URL` 控制——开发环境是 `http://localhost:9001`、生产是 `https://file.raodaor.com`、后续若接入独立 CDN 可改为 `https://cdn.xxx.com`。目标 APP 对外下发文件地址时，在运行时用「`STORAGE_BASE_URL` + 保存的相对路径」拼回绝对 URL 即可，**无需改库、无需迁移数据**就能在 dev / prod / CDN 之间快速切换。
   >
   > **推荐保存结构（目标 APP 侧）**：
   > ```ts
   > // 入库：保存 fileId + 相对路径（去掉协议与域名）
   > interface StoredFile {
   >   fileId: string;                 // 本库文件 ID，用于 signUrl / 列举 / 删除
   >   blobPath: string;               // 相对路径，如 "/blobs/4c/4cb16ff89...d3f1"（不含域名）
   > }
   >
   > // 运行时拼出可访问的绝对 URL（域名来自目标 APP 自己的配置，指向本 APP 的 STORAGE_BASE_URL）
   > const FILE_BASE = process.env.RAODAOR_FILE_BASE_URL; // 开发 http://localhost:9001 / 生产 https://file.raodaor.com
   > const avatarUrl = FILE_BASE + storedFile.blobPath;   // = https://file.raodaor.com/blobs/4c/4cb16...d3f1
   > ```
   > 既能直接用于 `<img src>`，也能在后续切换 CDN 时只改 `RAODAOR_FILE_BASE_URL` 一处即可生效。
3. **前端下发文件访问地址**：终端用户只拿**签名短链/公开 URL**（由目标 APP 后端用 ApiKey 调 `signUrl` 生成，或从保存的 `blobPath` 拼出），不接触 ApiKey、不接触上传通道。

   > ⚠️ **两条易踩坑的事实（对接前务必先看）**：
   > 1. **`/blobs/*` 是公开可读、无任何鉴权的**：只校验路径格式与 blob 是否存在（`main.ts` 的 `/blobs` 中间件），任何人拿到 hash 即可读原图，且**无过期、无法撤销**。因此敏感内容**不要**用裸 `blobPath` 下发，对外一律走 `signUrl` 签名短链（过期 + 签名）。
   > 2. **新上传的文件默认是 `REVIEWING`**：对外签名短链 `serveSigned` 只放行 `ACTIVE`（否则 403），所以「上传完立刻下发 `<img>`」会**先裂图**，审核跑完（秒级）或人工复核后才恢复。目标 APP 应轮询状态或订阅 `file.reviewed` Webhook，UI 上先渲染「审核中」占位。**租户级可配置**：平台管理员可在后台「租户设置」关闭 `autoReview` 开关（关闭后该租户新文件直接 `ACTIVE`）。
   >
   > 完整源码级结论见 [sdk-integration.md §10 高频问答](./sdk-integration.md#10-高频问答源码级结论)。
4. **配额/计量**：按应用租户（`tenantId`）独立聚合存储/流量/请求数，与终端用户个人租户无关。

> ⚠️ **ApiKey 是服务端级凭证，等同持有该应用租户全部文件权限，必须仅存于目标 APP 后端，严禁进前端代码或打包产物。**

### 3.5 应用租户文件的查看与管理边界（重要）

应用租户（模式 B / OSS 式）对标**阿里云 OSS Bucket**：文件**归目标 APP 所有**，raodaor-file 是「存储底座 / 管道」，不是「内容平台」。因此：

- **业务化浏览 / 管理应在目标 APP 内进行**。头像该在目标 APP 的用户中心看、UGC 在内容后台看、附件在业务记录里看。raodaor-file 不持有「这是张三头像还是李四帖子配图」这类业务上下文，做不出有意义的业务化文件管理。
- **raodaor-file 只提供「平台治理视图」与「运维排障能力」，不提供应用租户的文件内容浏览页**。原因：① 文件是目标 APP 资产，越界浏览会耦合存储与业务；② 提供「应用租户图库 / 文件广场」式页面极易成为越权或隐私泄露面（一串 fileId 就能翻目标 APP 全部资源）。

raodaor-file 各层级职责边界（✅ = 已实现）：

| 层级 | raodaor-file 提供 | 不提供 |
|------|------------------|--------|
| 平台治理视图 | ✅ 管理员后台按应用租户看**聚合指标**：`GET /admin/tenants/:id/usage`（存储用量 / 文件数 / 流量 / API 调用 / 配额占比，应用租户传入其租户 ID 即可聚合）、`GET /admin/application-tenants` + ApiKey 列表（不含明文）、`GET /admin/audit-logs` 审计日志、按租户配额调整与**租户级配置开关**（`PATCH /admin/tenants/:id`，如 `{ "autoReview": false }` 关闭该租户上传自动审核，见 SDK §3.7） | 不展示具体文件二进制 / 缩略图 |
| 运维排障 | ✅ `GET /admin/files/:id` 跨租户只读元数据（大小、hash、mimeType、owner、tenantId、appTenantId、blob 相对路径，不触发下载）；✅ `DELETE /admin/files/:id` 强制删除；✅ `GET /admin/files` 全局检索；✅ `POST /admin/files/:id/block` 封禁下线 | 不做「文件广场」「图库」式浏览 |
| 业务管理（目标 APP 职责） | 无。文件如何展示、关联业务实体、审核，全在目标 APP | 不在 raodaor-file 内做业务化文件管理 UI |

> 用量聚合说明：应用租户上传的文件在 `File` / `UsageRecord` 中均以**应用租户 ID** 作为 `tenantId` 落库，因此 `GET /admin/tenants/:id/usage` 传入应用租户 ID 即可正确聚合其用量，无需额外迁移。
>
> 一句话总结：**raodaor-file 提供「能力」（上传 / 列举 / 下载 / 删除 / 计量 / 治理 / 运维只读排障），不提供「业务化浏览」。**

详细的 SDK 调用、代理上传分包、签名短链、Webhook 见 [sdk-integration.md](./sdk-integration.md) §2.4 / §3 / §6.2。

---

## 4. 多 APP / 多用户的隔离与管理

| 诉求 | 平台如何支撑（已代码确认） |
|------|---------------------------|
| 不同用户文件互不可见 | 个人租户：每个 IDStack 用户登录即自动建独立租户，文件按 `tenantId` 隔离 |
| 团队/企业共享文件 | 组织租户 + `Membership`（OWNER/ADMIN/MEMBER/VIEWER），多人同租户共享 |
| 管理员权限 | `User.isTenantAdmin` 来自 IDStack `tenant_admin` 角色；组织内管理由 `Membership.role` 控制 |
| 容量/配额 | 每个 `Tenant` 独立 `planId`，配额以**套餐为唯一权威**并夹紧到服务端硬上限（`QUOTA_MAX_*`，无「无限」语义，见 PRD §3.5.2）；个人租户默认 FREE 套餐，应用租户默认 `ENTERPRISE`（`APPLICATION_TENANT_PLAN_TIER` 可调） |
| 用量与计费 | `UsageRecord` 按 `tenantId` 记录；套餐变更经 IDStack webhook 同步（**实际推送事件名 `user.subscription_changed`、`payment.*`**；`subscription.*` 为旧命名兼容兜底） |
| 审计 | `AuditLog` 记录角色/状态变更等，按 `tenantId` 隔离 |

> 目标 APP **无需自建用户表、租户表、隔离逻辑**——全部由 raodaor-file + IDStack 统一负责。目标 APP 只需保存「本库 `userId` ↔ 自己业务用户」的映射，以及文件 `fileId`。

**目标 APP 之间的隔离语义**：raodaor-file 是**平台级文件服务**，不是"每个目标 APP 一套"。多个目标 APP 共用同一套 IDStack 用户体系与 raodaor-file 部署；隔离发生在**用户/租户**层，而非"APP"层。因此：
- 同一 IDStack 用户用不同目标 APP 登录 → 落到**同一个个人租户**、同一套文件（文件随用户走，不随 APP 走）。
- 不同 IDStack 用户 → 不同个人租户 → 文件互不可见，目标 APP A 的用户看不到目标 APP B 用户的文件。
- 若某目标 APP 希望"自己的用户群共享一个独立空间"，应改用**组织租户**（见上，需平台方开通），而非依赖 APP 边界。

---

## 5. 按路径深入

- 文件服务接入（SDK 用法、头像端到端、签名短链、Webhook、CORS/配额；ApiKey 服务端凭证已实现）→ [sdk-integration.md](./sdk-integration.md)
- 嵌入 IDStack 功能模块（商城/任务/支付）→ [embed-integration.md](./embed-integration.md)
- IDStack SSO / OAuth / 角色权限底层参考：以目标 APP 的 IDStack 接入文档为准；本目录的认证边界与换票要点见 [quickstart.md](./quickstart.md) 和 [errors.md](./errors.md)。

---

## 6. 文档索引

| 文档 | 用途 |
|------|------|
| **[overview.md](./overview.md)**（本文） | 唯一入口：概念模型、账号体系、对接清单、隔离管理 |
| [sdk-integration.md](./sdk-integration.md) | 接入 raodaor-file 文件服务（SDK / picker / 签名短链 / Webhook / CORS·配额；ApiKey 已实现） |
| [embed-integration.md](./embed-integration.md) | 嵌入 IDStack 功能模块（商城/任务/支付等） |
| [quickstart.md](./quickstart.md) | 最短接入路径与上线检查 |
| [errors.md](./errors.md) | 认证、租户、上传、Embed 与 Webhook 排错 |
| [ai-brief.md](./ai-brief.md) | AI 辅助接入时必须遵守的硬约束 |
