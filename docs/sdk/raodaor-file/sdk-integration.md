<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-file/sdk-integration.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 目标 APP 接入 raodaor-file 指南（产品级）

> 面向**第三方目标 APP 的开发者**：如何以产品级方案接入 raodaor-file 的文件上传、获取与管理能力（以「上传头像」为典型场景）。
>
> 全文以 **IDStack SSO 签发的 access_token（JWT）** 作为统一身份凭据，文件数据按 `tenant_id` 自动隔离，目标 APP 无需自建文件表、用户体系或上传后端。

---

## 1. 三种接入方式（按推荐度排序）

| 方式 | 适用 | 封装度 | 说明 |
|------|------|--------|------|
| **① SDK 编程式** | 自有前端（Web） | 高 | 引入 `@isudaji/raodaor-file-sdk`，一行代码完成分片上传 / 头像上传 / 签名短链 |
| **② /picker 嵌入** | 想复用官方文件选择 UI | 中 | 用 `openPicker()` 或自写 iframe，复用官方文件选择器；**必须传 origin 做双向校验** |
| **③ 直连 REST API** | 特殊后端/服务端编排 | 低 | 直接调 `/api/v1/files`、`/api/v1/uploads` 等接口，需自行实现分片与秒传逻辑 |

绝大多数场景推荐 **① + ②**：上传/头像用 SDK，选文件用 picker。

---

## 2. 认证模型（两种 token，别搞混）

raodaor-file 的所有文件接口（除公开访问端点外）都需要 **本库签发的 `access_token`**（不是 IDStack 的 token）：

```
Authorization: Bearer <本库 access_token>
```

> ⚠️ **最关键的坑**：本库守护 `JwtAuthGuard` 用 `JWT_ACCESS_SECRET` 验签，且 payload 只需 `{userId, tenantId, isTenantAdmin}`。
> **直接用 IDStack 的 `access_token` 当 Bearer 调文件 API 会 401**。必须先把 IDStack token 换成「本库 token」。

### 2.1 正确链路：IDStack SSO → 本库 token

raodaor-file 已内置完整桥接（`auth.service.handleCallback`），目标 APP **无需自己对接 IDStack OAuth**：

```
1. 目标 APP 前端把用户重定向到：
     GET {FILE_ORIGIN}/api/v1/auth/login
   （后端跳转到 IDStack 授权页；state 存 httpOnly cookie 防 CSRF）

2. 用户在 IDStack 登录成功 → IDStack 回调：
     GET {FILE_ORIGIN}/api/v1/auth/callback?code=xxx&state=yyy

3. 后端自动完成：
     code → 向 IDStack 换 access_token
          → 解析 idstackUserId / 角色
          → upsert 本库 User + 自动建「个人租户」(personal-<idstackUserId后12位>)
          → 签发本库 JWT（access_token + refresh_token）
          → 以 query 重定向回前端：/auth/callback?access_token=...&refresh_token=...&tenant_id=...&user_id=...

4. 目标 APP 前端保存 access_token（就是调文件 API 的凭证）
```

### 2.2 token 时效与刷新

- 本库 `access_token` 默认 **15 分钟**过期（`JWT_ACCESS_TTL`，默认 `15m`）；`refresh_token` 默认 7 天。
- 临近过期时调 `POST /api/v1/auth/refresh`（body `{ refresh_token }`）换新的 `access_token` + `refresh_token`，并让 `getToken()` 返回最新值。
- 前端 `RaoDaorFile` 的 `getToken` 支持异步返回，建议内部封装「取缓存 → 过期前自动 refresh」逻辑。

### 2.3 隔离与账号

- 文件数据按 JWT 中的 `tenant_id` 隔离：**用户只能访问自己租户（个人租户或所在组织租户）的文件**，跨租户返回 403。
- 终端用户用 **IDStack 账号**登录；raodaor-file 不另建用户体系，只在 `User.idstackUserId` 做映射。
- 「很多 APP」= 很多 IDStack 用户 / 很多租户，由平台按租户统一隔离，目标 APP 无需各自注册应用。

> ⚠️ token 只应在 **Bearer 头**或 **SDK 内存**中传递，**绝不写入 URL**（公开头像场景改用下方「签名短链」）。

### 2.4 两种接入模式：网盘模式 vs 私有云存储模式（OSS 式）⚠️ 必读

这是目标 APP 接入前**必须想清楚**的架构选择，直接决定「文件到底归谁」。raodaor-file 当前代码默认偏向**网盘模式**，但很多目标 APP 实际需要的是**私有云存储模式**（类阿里云 OSS）——两种模式的文件归属、用户能否独立登录查看，结论**完全相反**。

#### 模式 A：网盘 / SaaS 模式（当前代码默认）

- **语义**：raodaor-file 把每个**终端用户**当一等公民。用户用 IDStack 账号登录 → `upsertUser` 自动建**个人租户**（`personal-<idstackUserId后12位>`）→ 上传的文件物理归属该用户的个人租户。
- **文件归属**：归**用户自己**。用户在目标 APP 传的文件，自己也能去 raodaor-file 网站（`/files`）登录看到同一批文件（因为是同一个个人租户）。
- **用户能独立登录网站看文件吗**：✅ **能**。frontend 是独立可登录网站（`AuthCallbackPage` 走 IDStack OAuth），用户拿同一 IDStack 账号即可登录。
- **数据主权**：在**用户侧**。目标 APP 只能管自己 UI 里展不展示，管不了用户在 raodaor-file 侧的原始数据；目标 APP 下线也不影响用户文件。
- **适用**：raodaor-file 作为独立文件产品直接给终端用户用；或目标 APP 本身就想做"用户自己的云盘"。

#### 模式 B：私有云存储模式（OSS 式，目标 APP 把文件当自有资产）

> **正式架构定位（非临时方案，已落地）**：模式 B 是平台的一等公民能力，对标阿里云 OSS / AWS S3 被网站私有化使用的范式。其依赖的 **PRD §9 M6 里程碑** 已完成代码层落地：应用租户一等公民（`Tenant.type=APPLICATION` + `appId`）、自助开通端点 `POST /api/v1/tenants/application`、服务端 ApiKey 签发/校验（`ApiKeyGuard`）、代理上传上下文（`actingTenantId`，文件归应用租户）均已实现，下列接口为可调用能力。

- **语义（对齐阿里云 OSS）**：目标 APP 在阿里云开一个 **Bucket（属于网站）**，10 万用户上传全落在这个 Bucket，由网站后端用 AccessKey 统一管。用户根本不知道 OSS 是什么，也不可能拿 OSS 账号登录看自己文件。**Bucket 属于网站，不属于某个用户**。
- **raodaor-file 如何原生对齐（M6 落地后）**：
  1. **应用租户（APPLICATION）**：目标 APP 经 IDStack SSO 后调用 `POST /api/v1/tenants/application`，raodaor-file 创建 `Tenant.type=APPLICATION`、`appId` 绑定该目标 APP 的 IDStack app_id；返回应用租户凭据（JWT 或 **ApiKey**）。
  2. **服务端代理上传**：目标 APP 后端用应用租户凭据调 `uploadOnBehalf(appTenantId, ...)`（M6 新增），文件 `tenantId` 记应用租户、`ownerId` 记平台代理/服务身份。**终端用户前端不直接持文件主权**，也不直接拿自己 token 调上传——彻底避免"文件落回用户个人租户"。
  3. **隔离**：用户登录 raodaor-file 网站只看到自己个人租户，看不到目标 APP 应用租户资源（对标 OSS：用户无 Bucket 访问权）。
- **文件归属**：归**目标 APP 的应用租户**，不是归某个用户个人租户，也不是借组织租户凑合。
- **用户能独立登录网站看文件吗**：❌ **看不到目标 APP 的资源**（它们不在用户个人租户里）。用户只能看到自己个人租户的文件。
- **M6 已落地的真实状态**：
  - 当前代码**已有应用租户一等公民**（`Tenant.type=APPLICATION` + `appId`），`POST /tenants/application` 自助开通，`SDK` 经 `X-API-Key` 通道代理上传。
  - 服务端 ApiKey **已实现**（`ApiKeyGuard` + 签发链路，SHA-256 存储 + scope 校验），详见 §6.2。
  - 模式 B **已可原生落地**，文件 `tenantId/appTenantId` 记应用租户，终端用户不直接持文件主权。

#### 如何选（给你做产品决策）

| 维度 | 模式 A 网盘模式 | 模式 B 私有云存储（OSS 式） |
|------|----------------|---------------------------|
| 文件归属 | 用户个人租户 | 目标 APP 应用租户（已实现） |
| 用户能否独立上 raodaor-file 网站看这些文件 | ✅ 能 | ❌ 不能（不在其个人租户） |
| 目标 APP 对文件的控制权 | 弱（用户主权） | 强（OWNER 统一管理/清理） |
| 用户下线/流失后文件 | 仍在用户个人租户 | 仍归目标 APP，可保留 |
| 当前代码支持度 | ✅ 原生（默认，可运行） | ✅ 已实现（应用租户 + 自助开通 + ApiKey + 代理上传上下文） |
| 典型类比 | Dropbox / 网盘 | 阿里云 OSS Bucket 属网站 |

> **模式 B 已落地**：若你的目标 APP 要把用户上传的资源当**自有资产**（模式 B，类 OSS），直接走「应用租户 + 后端代理上传」——开通应用租户拿到 ApiKey，后端用 `X-API-Key` 通道调上传接口，文件主权归应用租户，不要给终端用户直传（否则文件会落回用户个人租户，与你的诉求相悖）。

---

## 3. SDK 接入（推荐）

### 3.1 构建 SDK

SDK 源码位于 `frontend/vendor/@isudaji/raodaor-file-sdk/`，已纳入 pnpm workspace。首次使用前需本地构建出 `dist`：

```bash
cd frontend/vendor/@isudaji/raodaor-file-sdk
pnpm install
pnpm build      # 产出 dist/index.cjs.js 与 dist/index.esm.js
```

目标 APP 可将其作为本地依赖引用，或发布到内部 npm 源后 `npm install @isudaji/raodaor-file-sdk`。

### 3.2 初始化客户端

```ts
import { RaoDaorFile } from '@isudaji/raodaor-file-sdk';

const client = new RaoDaorFile({
  origin: 'https://file.raodaor.com',                 // raodaor-file 服务源
  getToken: () => myTokenBroker.getAccessToken(),     // 返回【本库】access_token（可异步、可刷新）
});
```

### 3.3 核心能力

| 方法 | 作用 | 关键参数 |
|------|------|----------|
| `uploadFile(file, opts?)` | 分片上传，自动秒传/断点续传/并发/重试 | `onProgress` / `chunkSize`(默认5MB) / `concurrency`(默认3) / `folderId` / `mimeType` |
| `uploadAvatar(file, opts?)` | 上传头像并**直接返回可公开访问的签名 URL** | `size`(默认200) / `expiresIn`(默认3600) |
| `signUrl(fileId, opts?)` | 为已有文件生成签名公开短链（全套餐可用） | `expiresIn` / `size` / `inline` |
| `getFile(fileId)` | 查询文件详情（需鉴权） | — |

### 3.4 头像上传（端到端示例）

```ts
// 用户在表单选择头像文件后
const input = document.querySelector<HTMLInputElement>('#avatar')!;
const file = input.files![0];

const { fileId, avatarUrl } = await client.uploadAvatar(file, {
  size: 200,            // 生成 200px 缩略图
  expiresIn: 3600,      // 链接 1 小时后过期
});

// avatarUrl 形如 /api/v1/files/access/<id>?expires=...&sig=...&inline=1&size=200
// 不含任何 token，可直接写入 <img src>，也可安全存入数据库供展示
document.querySelector<HTMLImageElement>('#preview')!.src = avatarUrl;
await saveAvatarToMyApp(fileId, avatarUrl);   // 回写目标 APP 自身用户表
```

`uploadAvatar` 内部 = `uploadFile` + `signUrl`，返回的 `avatarUrl` 是**签名公开链接**：
- **不含 token**，写入 `<img src>` 不会泄露用户凭证；
- **不在 URL 暴露原始存储路径**；
- 仅服务端持有签名密钥（见 §6），伪造链接会被拒绝；
- 链接过期后可调用 `signUrl(fileId)` 重新签发。

> ⚠️ **raodaor-file 不感知"这是头像"**：它只当一次普通文件上传处理，文件归属到**调用者本人的个人租户**（按 JWT `tenantId`）。是否作为头像、属于哪个业务用户，完全是目标 APP 的业务逻辑。**目标 APP 必须自己入库映射**，否则无法在用户资料页还原头像。

#### 3.4.1 目标 APP 侧入库职责（必做）

raodaor-file 只托管二进制与访问链接，**不替你存"谁的头像"**。目标 APP 需在自己库里落一张映射表（或字段）：

```sql
-- 目标 APP 自己的用户档案表（示意）
ALTER TABLE user_profile ADD COLUMN raodaor_file_id VARCHAR;  -- uploadAvatar 返回的 fileId
ALTER TABLE user_profile ADD COLUMN avatar_url      VARCHAR;  -- 签名短链（可缓存，注意有有效期）
-- 展示：<img src={avatar_url}>
-- 换头像：重新 uploadAvatar → 更新 raodaor_file_id / avatar_url（旧 fileId 可调用删除接口或留待清理）
```

- `uploadAvatar` 返回的 `fileId` 是**稳定 ID**（换头像后旧 ID 失效、新 ID 不同），用 `fileId` 做关联比用 `avatarUrl` 更稳；
- `avatarUrl` 是**签名短链、有有效期**，展示时可缓存，但过期前要重新 `signUrl(fileId)`。

#### 3.4.2 头像存在哪种租户？（分模式：网盘模式 vs 私有云存储模式）

> ⚠️ 本节默认描述的是 **§2.4 模式 A（网盘模式）**。若你的目标 APP 要把用户上传的资源当**自有资产**（模式 B，类阿里云 OSS，文件应归目标 APP 而非用户），**不要按本节直接给终端用户直传**——见下方「模式 B 做法」。

**模式 A（网盘模式，默认）：**
- 头像属于**具体某个用户**，raodaor-file 里 **1 个 IDStack 用户 = 1 个个人租户**（登录自动创建），因此头像文件物理上落在**该用户自己的个人租户**里。用户自己也能去 raodaor-file 网站 `/files` 看到它。
- **不要用组织租户存个人头像**——组织租户是多人共享空间，语义不符。
- 边界对照（模式 A）：

| 场景 | 用哪种租户 | 文件归属 |
|------|-----------|---------|
| 用户个人头像 | **个人租户**（该用户自己的） | 该用户独占（物理归属） |
| 用户上传的普通资源 | **个人租户**（该用户自己的） | 该用户独占（物理归属） |
| 团队/企业共享素材库 | **组织租户** | 该组织成员共享 |
| APP 官方 logo / 默认头像等公共素材 | ⚠️ **当前模型无"跨用户公共空间"** | 需平台方开通一个专用组织租户，或用某服务账号的个人租户托管 |

**模式 B（私有云存储 / OSS 式，文件归目标 APP，已实现）：**
- 诉求：10 万目标 APP 用户上传的资源，应属于**这个目标 APP**，不属于用户个人。对标阿里云 OSS——Bucket 属于网站，用户传的文件全在网站的 Bucket 里，用户不可能拿 OSS 账号登录看自己文件。
- 做法：目标 APP 后端 `POST /tenants/application` 开通**应用租户**（返回 ApiKey），**由目标 APP 后端用该 ApiKey 经 `X-API-Key` 通道代理上传**，把所有用户上传落进此应用租户（`tenantId/appTenantId` 记应用租户）。用户前端**不直接拿自己 token 调 `uploadAvatar`/`uploadFile`**，否则文件会落回其个人租户。
- 结果：文件物理归属目标 APP 的应用租户，目标 APP 作为 OWNER 统一管理/清理；用户登录 raodaor-file 网站只能看到自己个人租户，看不到目标 APP 的资源。
- 接入步骤与后端代理上传示例见 [overview.md §3.4](./overview.md#34-模式-b私有云存储--oss-式目标-app-侧)；ApiKey 签发/校验见 §6.2；双模式架构对照见 §2.4。

#### 3.4.3 公开签名链接的安全边界（关键：用户 B 能看到用户 A 的头像吗？）

**能。** 头像走的是**公开签名通道**而非 Bearer 隔离通道，这是预期且正确的设计。

raodaor-file 有两条访问通道，租户隔离**只作用于其中一条**：

| 通道 | 端点 | 隔离行为 | 头像用的哪条 |
|------|------|----------|--------------|
| **Bearer 鉴权通道** | `GET /api/v1/files/:id`、`/download`、`/direct-url`、`/sign`、`/list` 等 | **强租户隔离**：`if (file.tenantId !== user.tenantId) throw Forbidden` | ❌ 不走 |
| **公开签名通道** | `GET /api/v1/files/access/:id?expires=&sig=` | **无租户比对**：只校验 ① 签名有效 ② 未过期 ③ 文件 `ACTIVE`；服务端以**文件拥有者自己的租户身份**读存储 | ✅ **头像走这条** |

因此真实语义是：

- **用户 B 查看用户 A 的个人信息页** → 前端渲染 `<img src={A.avatarUrl}>`（`A.avatarUrl` = `/files/access/:id?...sig=`）→ **B 能看到 A 的头像**。因为 `avatarUrl` 是服务端用 `FILE_SIGN_SECRET` 签发的公开链接，签发后即**任何拿到链接的人（含其他用户、其他 APP 访客）都能访问**，与访问者是谁无关。
- **用户 B 用 Bearer 调 `GET /api/v1/files/:id` 想拿 A 头像的元数据/详情** → ❌ 403，B 不是 A 租户。
- **用户 B 猜 A 的 `fileId` 直接打 `/files/access/:id`** → 若知道 UUID 且能伪造/持有有效 `sig` 则能访问；但 `fileId` 是 UUID 不可枚举，无有效签名会被拒。

> 这正是头像/公开资源**想要**的语义：头像就是要"对外公开可被任意访客查看"，所以走签名公开通道而非 Bearer 隔离通道。raodaor-file 的隔离是「**文件管理/下载/元数据的操作按租户隔离，但已签发的公开展示链接本身不限租户**」。

**对接启示 / 红线：**
1. **只有"该公开"的文件才用 `signUrl` / `uploadAvatar`**：头像、公开分享图、公共素材——这些本来就该让任意访客看。
2. **敏感文件切勿生成公开签名链接**：私密文档、账单、未公开草稿等，必须走 Bearer 通道（`getFile` / `streamDownload`），绝不对它们 `signUrl`，否则等于对外公开（任何拿到链接的人都能读，且 `fileId` 虽不可枚举，但链接一旦发出/缓存/进 referer 日志就泄露）。
3. **公开链接有有效期**：`expiresIn` 到期需重新 `signUrl(fileId)`；不要把签名链接当"永久 URL"硬编码。
4. 上轮"不同用户文件互不可见"的结论需加限定：**仅指 Bearer 通道下的操作/元数据隔离；已签发的公开签名链接不限租户**。

### 3.5 大文件 / 进度示例

```ts
const result = await client.uploadFile(bigFile, {
  chunkSize: 5 * 1024 * 1024,
  concurrency: 3,
  onProgress: ({ uploaded, total, percent }) => {
    console.log(`进度 ${percent}%`);
  },
});
// result: { fileId, url, size, hash }
```

秒传：SDK 先用 `crypto.subtle` 计算 SHA-256，调 `/api/v1/files/check` 预检；服务端已存在相同哈希文件时直接返回 `fileId`，**不再传输字节**。

### 3.6 签名短链（公开展示任意文件）

对**已上传**的文件（如用户头像、公开头像列表），无需每次都走上传：

```ts
const publicUrl = await client.signUrl(fileId, { size: 200, expiresIn: 3600 });
```

返回相对路径，需自行按 `origin` 拼成绝对链接：

```ts
const absoluteUrl = `${client.origin}${publicUrl}`;
```

> 公开访问端点 `GET /api/v1/files/access/:id` **不要求 Bearer 头**，仅校验：① 签名有效 ② 未过期 ③ 文件状态为 `ACTIVE`。**该端点不做租户比对**——任何拿到合法签名链接的人（含其他用户、其他 APP 访客）都能访问，与访问者身份无关。因此可安全用于 `<img src>`、邮件、分享页等公开场景，但**绝不能**把敏感文件 `signUrl` 生成公开链接（详见 §3.4.3）。

### 3.7 上传后默认进入 REVIEWING：审核态与「先裂图」（重要）

> 本节结论均对照源码确认。

`complete` 创建的文件**默认状态就是 `REVIEWING`**（`uploads.service.ts`：`status: 'REVIEWING'`），随后异步跑 `moderateFile`（文件名敏感词 + 图片审核），取最严结论更新状态：`PASS → ACTIVE`、`REVIEW → REVIEWING`（需人工复核）、`REJECT → BLOCKED`（`moderation.service.ts`）。

各通道在 `REVIEWING` 期间的行为（这是"先裂图"的根源）：

| 通道 | REVIEWING 期间 | 后果 |
|------|----------------|------|
| **签名短链 `serveSigned`**（对外主力） | ❌ **403** `文件不可访问`（`files.service.ts`：`if (file.status !== 'ACTIVE') throw ForbiddenException`） | 对外 `<img>` **直接裂图** |
| **签发端 `/files/:id/sign`** | `inline=false`（下载型）仅允许 `ACTIVE`；`inline=true` 允许 `ACTIVE`+`REVIEWING` | 想给审核中的文件签「下载型」公开链接会被拒 |
| **用户态 `streamDownload`** | `inline`（预览）允许 `ACTIVE`+`REVIEWING`；下载仅 `ACTIVE` | owner 自己能预览，公开下载拿不到 |
| **列表 `list` / 配额计数** | 默认同时展示/计入 `ACTIVE`+`REVIEWING` | owner 在列表里能看到审核中的文件 |

典型踩坑路径：**上传完成 → 立刻 `signUrl` 下发给终端用户 `<img>` → 403 裂图 → 审核跑完（通常秒级）或人工复核（可能长期停留 `REVIEWING`）后才恢复显示。**

**目标 APP 应对（推荐）：**
1. 上传后**轮询 `getFile(fileId)` 的 `status`**，或订阅 **`file.reviewed` Webhook**（见 §5），确认变为 `ACTIVE` 后再对外展示/下发。
2. UI 对 `REVIEWING` 文件先渲染「审核中」占位图/骨架屏，避免裂图与布局抖动。
3. 若你的内容已自带审核、不需要 raodaor-file 二次审核，可由平台管理员在后台「租户设置」中关闭该租户的**「上传后自动内容审核」开关**（`PATCH /api/v1/admin/tenants/:id`，body `{ "autoReview": false }`）；关闭后该租户新上传的文件**直接 `ACTIVE`**，跳过审核，彻底避免「先裂图」。

### 3.8 `/blobs/*` 裸地址：公开可读、无鉴权（安全提示）

`STORAGE_BASE_URL` 指向本项目且 `STORAGE_DRIVER=local` 时，后端在 `main.ts` 挂了 `/blobs` 静态路由。**它只校验路径格式（2 位前缀 / 64 位十六进制 hash）与 blob 是否存在，完全不做租户 / 签名 / 登录校验**：

```ts
const m = /^\/([a-f0-9]{2})\/([a-f0-9]{64})(?:\/.*)?$/.exec(req.path);
if (!m) return res.status(400).end('invalid blob path');
const blob = await prisma.fileBlob.findUnique({ where: { hash }, select: { contentType: true } });
if (!blob) return res.status(404).end('blob not found');
// 直接 sendFile，无任何鉴权
```

含义：

- ✅ **可以直出**：`<img src="https://file.raodaor.com/blobs/4c/4cb16...">` 或后端 302 重定向都行，浏览器无需任何凭证即可回显。
- ⚠️ **hash 即权限**：任何人拿到 hash 就能读到原图二进制，且**没有过期时间、无法单独撤销**（除非物理删除 blob）。hash 一旦出现在页面源码、分享链接、`Referer` 日志里，等同于公开原图。
- ⚠️ **带宽走 raodaor-file 后端**：直出也是本项目在 serve，当前无独立 CDN（见 §10 Q5）。
- ⚠️ 该路由**仅在 `STORAGE_DRIVER=local` 时挂载**；切到 s3 兼容存储后由对象存储 / CDN 承接，访问控制随存储策略而定。

**做法建议：**
- 对外访问**统一用 `signUrl` 签名短链**（带 `expires` + `sig`，可过期、可重新签发），不要让终端用户长期持有裸 `/blobs` 地址。
- **敏感内容（私密文档、账单、未公开草稿等）切勿用裸 `/blobs` 下发**，也不要对其 `signUrl`（见 §3.4.3）。
- `blobPath` 只作为目标 APP 内部存储字段（见总览 §3.4），不要直接吐给前端页面。

---

## 4. /picker 嵌入式文件选择器

当目标 APP 想复用官方文件选择 UI（而非自己实现上传表单）时，使用 picker。

### 4.1 SDK 调用（推荐）

```ts
import { openPicker } from '@isudaji/raodaor-file-sdk';

const files = await openPicker({
  origin: 'https://file.raodaor.com',
  multiple: false,
  type: 'image',        // 可选：image / video / audio / document ...
  folderId: 'xxx',      // 可选：限定目录
});

// files: SelectedFile[]，用户取消返回 []
if (files.length) {
  const f = files[0];
  // f: { fileId, name, size, mimeType, url }
}
```

### 4.2 安全约束（重要）

- 宿主**必须向 `/picker` 传入 `origin=自身域名`**（SDK 的 `openPicker` 已自动传 `window.location.origin`）。
- picker 端**严格校验** `e.origin === originRef`；缺 `origin` 时**拒绝一切跨窗口通信**，并渲染拦截页（防止被任意站点嵌入窃取文件）。
- 宿主**只接受来自 `origin`（raodaor-file 源）的消息**，忽略其它来源。
- 自写 iframe 时务必携带 `?origin=<你的域名>`，否则无法通信：

```html
<iframe src="https://file.raodaor.com/picker?origin=https://yourapp.com"></iframe>
```

---

## 5. Webhook 事件（异步感知文件状态变更）

当 raodaor-file 触发关键事件（如文件审核完成），会**主动推送**到目标 APP 登记的服务端地址，无需轮询。

### 5.1 当前支持的事件

| 事件 | 触发时机 | 载荷 `data` 字段 |
|------|----------|------------------|
| `file.reviewed` | 文件审核完成（自动或人工 `approve`/`reject`） | `fileId` / `name` / `mimeType` / `size` / `status`(`ACTIVE`/`BLOCKED`) |

### 5.2 自助登记 webhook（目标 APP 调用）

目标 APP 在自己的租户下登记接收端点（鉴权后调用）：

```http
POST /api/v1/webhooks
Authorization: Bearer <你的 access_token>
Content-Type: application/json

{
  "url": "https://yourapp.com/api/raodaor/webhook",
  "events": ["file.reviewed"],
  "secret": "至少8位的签名密钥"
}
```

- `events` 支持通配 `["*"]`。
- 按 `tenant_id` 隔离：只能收到本租户的事件，看不到其他接入方。
- 列出 / 删除：`GET /api/v1/webhooks`、`DELETE /api/v1/webhooks/:id`。

### 5.3 接收端实现要点（最佳实践）

```ts
// 目标 APP 服务端（Express 示例）
app.post('/api/raodaor/webhook', express.json(), (req, res) => {
  // 1) 校验签名（secret 为你登记时填的值）
  const sig = req.header('X-RaoDaor-Signature') || '';   // 形如 sha256=...
  const expected =
    'sha256=' + createHmac('sha256', process.env.RAODAOR_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body)).digest('hex');
  if (sig !== expected) return res.status(400).json({ success: false });

  const { event, data } = req.body;
  if (event === 'file.reviewed' && data.status === 'ACTIVE') {
    // 2) 幂等更新本端（基于 fileId，事件可能重复到达）
    myAvatarService.markReviewed(data.fileId);
  }
  // 3) 尽快返回 2xx；非 2xx 会触发最多 3 次重试
  res.status(200).json({ success: true });
});
```

要点：
- **校验签名**：比对 `X-RaoDaor-Signature` 头（HMAC-SHA256，密钥=登记时填的 `secret`）。
- **幂等**：事件可能重复/乱序，基于 `fileId` 去重。
- **快速响应**：成功返回 2xx；失败会按指数退避重试最多 3 次。
- **best-effort**：推送失败仅记日志，**绝不阻塞**主流程（上传/审核仍正常完成）。

---

## 6. 服务端配置（raodaor-file 侧）

目标 APP 无需改动，但部署/联调 raodaor-file 时需关注以下环境变量：

| 变量 | 作用 | 默认值 |
|------|------|--------|
| `FILE_SIGN_SECRET` | 签名短链的 HMAC 密钥（**建议显式配置**，保证多实例一致） | 回退到 `IDSTACK_APP_SECRET` / `JWT_ACCESS_SECRET` |
| `IDSTACK_APP_SECRET` | 应用密钥，作为签名密钥回退 | — |
| `JWT_ACCESS_SECRET` | 本库 JWT 签名密钥；`access_token` 验签与签发都依赖它 | — |
| `JWT_ACCESS_TTL` | 本库 `access_token` 时效 | `15m` |
| `CORS_ALLOW_ORIGINS` | 追加可信来源（如 `https://yourapp.com`），逗号分隔 | — |

> ⚠️ **强烈建议显式配置 `FILE_SIGN_SECRET` 与 `JWT_ACCESS_SECRET`**：若未配置，`FILE_SIGN_SECRET` 回退到 `JWT_ACCESS_SECRET`，多实例/重启后环境变量不一致会导致已签发的公开链接失效；`JWT_ACCESS_SECRET` 未配置会使用默认弱密钥，存在被伪造 token 的风险。

CORS：开发期 `localhost`/`127.0.0.1` 默认放行；**每个目标 APP 的域名都必须通过 `CORS_ALLOW_ORIGINS` 追加并重启后端**，否则其浏览器跨域调用文件 API 会被预检拒绝（表现为「无响应」）。

### 6.1 配额与套餐（多用户/多 APP 的容量边界）

- **套餐（`Plan`）是配额的唯一权威值**：`Tenant.planId` 决定 `fileSizeLimit` / `storageQuota` / `trafficQuota` / `fileCountLimit` / `shareCountLimit` / `apiCallPerDay` / `apiKeyLimit`；`Tenant.storageQuota` / `Tenant.trafficQuota` 仅为历史镜像列（`0` = 继承套餐），不参与任何计算。
- 个人租户默认 FREE 套餐；超出配额的上传会被拒绝。组织/企业场景需由平台配置对应套餐额度。
- **不存在「无限」**：每个维度都会被服务端硬上限（`QUOTA_MAX_*`，见 PRD §3.5.2）夹紧；套餐里的 `0` 含义是「不额外限制」，实际生效值等于硬上限，因此单租户不可能耗尽服务器存储/带宽。
- 用量经 `UsageRecord` 按 `tenantId` 记录；套餐变更由 IDStack webhook（`subscription.*` / `payment.*`）同步到本库 `billing`。
- 目标 APP 自身**无需管理配额**——它只看到本用户所在租户的额度；额度不足时由平台侧处理。
- 应用租户（OSS 式）开通时挂载哪个套餐由后端环境变量 `APPLICATION_TENANT_PLAN_TIER` 决定（默认 `ENTERPRISE`），请在接入前与平台确认。

### 6.2 服务端到服务端凭证（ApiKey，已实现）

> ApiKey 体系已落地：签发、校验、scope 控制、租户绑定均已实现。

`ApiKey` 模型与校验链路：

- `POST /api/v1/tenants/application`（Bearer JWT 鉴权）开通应用租户时**自动签发** ApiKey，明文仅返回一次，格式 `rdfl_<prefix>_<random>`，以 SHA-256 哈希存储（`keyHash`），对外只暴露 `keyPrefix`。
- `ApiKeyGuard`（`src/tenants/apikey.guard.ts`）从 `X-API-Key` 头解析并校验哈希，注入 `actingTenantId = 应用租户`，使后续上传/列举/分享均归属该应用租户。支持 scope 校验（`file:write` / `file:read` / `share:manage` / `*`）。
- 管理：`GET /tenants/application/api-keys` 列举、`DELETE /tenants/application/api-keys/:id` 吊销。

**调用示例（目标 APP 后端，模式 B 代理上传）：**

```bash
# 1) 开通应用租户（仅首次，Bearer JWT 为平台管理员/目标APP后端持有）
curl -X POST https://file.raodaor.com/api/v1/tenants/application \
  -H "Authorization: Bearer <admin_jwt>" \
  -d '{"appId":"raodaor-doc","name":"绕道儿文档"}'
# => { "tenantId":"tnt_xxx", "apiKey":"rdfl_abc123_...", "appId":"raodaor-doc" }

# 2) 用 ApiKey 代理上传（文件落入应用租户，终端用户无主权）
curl -X POST https://file.raodaor.com/api/v1/uploads/sessions \
  -H "X-API-Key: rdfl_abc123_..." \
  -d '{"fileName":"cover.png","size":12345,"mimeType":"image/png"}'
```

> 注意：ApiKey 是**服务端级**凭证，等同持有对应应用租户的操作权限，**必须仅在目标 APP 后端保存，严禁进前端代码**。

> 模式 B 完整对接步骤（开通 → 代理上传 → 前端收签名短链）见 [overview.md §3.4](./overview.md#34-模式-b私有云存储--oss-式目标-app-侧)。

---

## 7. 端到端：目标 APP「上传头像」完整流程

```
目标APP 前端                           raodaor-file
─────────────                         ─────────────
1. 走 raodaor-file SSO 桥接（GET /api/v1/auth/login → IDStack 登录 → 回调签发本库 token）→ 拿到【本库 access_token】
2. new RaoDaorFile({ origin, getToken })   // getToken 返回本库 token
3. client.uploadAvatar(file, { size:200 })
       │ POST /api/v1/files/check (sha256 秒传预检)
       │ POST /api/v1/uploads (建分片会话)
       │ POST /api/v1/uploads/:id/chunks/:i (并发分片)
       │ POST /api/v1/uploads/:id/complete
       │ POST /api/v1/files/:id/sign (签发公开 URL)
       ▼
4. 得到 { fileId, avatarUrl }
       │ avatarUrl 写 <img src>（无 token，安全）
       ▼
5. 回写目标 APP 自身用户表（raodaor_file_id + avatar_url）—— raodaor-file 不感知"这是头像"，必须自己落库映射
6. （可选）订阅 file.reviewed：审核通过后刷新头像展示态
```

> 头像文件落在**该用户的个人租户**（raodaor-file 按 JWT tenantId 隔离），非组织租户。公共素材（官方 logo 等）当前无跨用户空间，需平台方开通专用租户。详见 §3.4.1 / §3.4.2。

---

## 8. 常见坑与排查

| 现象 | 原因 | 解法 |
|------|------|------|
| 公开头像链接 403「签名无效」 | 多实例 `FILE_SIGN_SECRET` 不一致 / 未配置回退到不同密钥 | 显式配置 `FILE_SIGN_SECRET` 且多实例一致 |
| 公开链接 403「链接已过期」 | `expiresIn` 到期 | 重新 `signUrl()` |
| 公开链接 403「文件不可访问」 | 文件处于 `REVIEWING`/`BLOCKED` | 仅 `ACTIVE` 可公开；等 `file.reviewed` 事件或查 `getFile` |
| picker 不通信 / 拦截页 | 嵌入时未带 `origin` 参数 | iframe/src 必须带 `?origin=<你的域名>` |
| 上传接口「无响应」 | CORS 预检被拒 | 用 `CORS_ALLOW_ORIGINS` 追加来源并重启后端 |
| 上传 401 | token 过期 | 用新 token 刷新（`getToken` 返回最新值） |
| 上传 400 `MISSING_TENANT` | token 非 IDStack 合法用户令牌 | 确认走 IDStack SSO 签发的 access_token |
| webhook 收不到 | 未登记 / `events` 不匹配 / 地址不可达 | 调 `POST /api/v1/webhooks` 登记并确认地址公网可达 |
| **刚上传的图对外展示裂图** | 文件默认 `REVIEWING`，`serveSigned` 只放行 `ACTIVE` → 403 | 轮询状态或订阅 `file.reviewed`，变 `ACTIVE` 再展示；UI 先放占位图（详见 §3.7） |
| `signUrl` 报「文件状态不可生成公开链接」 | 文件仍在 `REVIEWING`，且 `inline=false`（下载型）只接受 `ACTIVE` | 等审核通过再签；或先签 `inline=true` 预览型（详见 §3.7） |
| 裸 `/blobs/<hash>` 地址被外部刷/泄露 | 该路由公开可读、无鉴权、无过期 | 对外改用 `signUrl` 短期签名链接，敏感内容绝不裸发（详见 §3.8） |

---

## 9. 安全红线

1. **token 绝不进 URL**：公开展示一律用签名短链（`/files/access/:id?...&sig=`）。
2. **picker 必须带 origin**：否则无法通信，且避免被任意站点嵌入窃取文件。
3. **webhook 必须验签**：比对 `X-RaoDaor-Signature`，不一致直接拒绝。
4. **签名密钥仅服务端持有**：`FILE_SIGN_SECRET` 严禁进入前端包；前端只消费已签发的 URL。
5. **租户隔离由 JWT 保证（仅限 Bearer 通道）**：目标 APP 经 Bearer 头调文件接口时，仅能访问本租户文件，无需自行实现多租户隔离。**但已签发的公开签名链接（`/files/access/:id`）不限租户**——任何拿到链接的人都能访问，因此敏感文件切勿 `signUrl`（详见 §3.4.3）。
6. **不要把裸 `/blobs/*` 当"私有地址"**：它是公开可读、无鉴权、无过期、无法撤销的（hash 即权限）。`blobPath` 只能作为目标 APP 内部字段，对外一律用 `signUrl` 签名短链（详见 §3.8）。
7. **不要假设"上传完就能对外访问"**：新文件默认 `REVIEWING`，对外签名通道会因状态 403 而裂图。要么等 `ACTIVE` 再下发，要么让平台关闭该租户自动审核（详见 §3.7）。

---

## 10. 高频问答（源码级结论）

目标 APP 对接时最常问、且**文档此前未写清**的五个问题。结论均对照 `backend/src` 源码确认。

### Q1 `/blobs/*` 是否公开可读？决定走「后端代理」还是「302 直出」

**结论：公开可读、无任何鉴权，可走 302 直出（甚至 `<img src>` 直接引用）。**

证据 `main.ts` 的 `/blobs` 中间件（详见 §3.8）：只对路径格式（2 位前缀 / 64 位 hex hash）与 blob 是否存在做校验，完全没有租户 / 签名 / 登录校验。

- ✅ **可以「302 直出」**：前端直接引用或后端 302 都行，浏览器直接回显。
- ⚠️ **带宽走 raodaor-file 后端**：直出也是本项目在 serve，不是 CDN 直吐（除非把 `STORAGE_BASE_URL` 指向独立 CDN，见 Q5）。
- ⚠️ **安全提示**：hash 一旦泄露（页面源码、分享链接、`Referer`）就等于公开原图，且无过期、无法撤销。**不要把带敏感内容的图用裸 `/blobs` 公开下发**；需要受控访问时走 `signUrl` 签名短链（过期 + 签名）或分享 `accessToken` 通道。

> 推荐：对外访问用 `signUrl` 生成的签名短链，不要让终端用户长期持有裸 `/blobs` 地址。

### Q2 ApiKey 申请：应用租户由平台管理员签发

**结论：与文档一致，目标 APP 不自助开通，由平台管理员签发。**

- 开通：`POST /api/v1/admin/application-tenants`，body `{ appId, name }`，需 `AdminAuthGuard`（平台管理员 JWT）。
- 返回 `apiKey`（**明文仅一次**），目标 APP 后端存入密钥管理，**严禁进前端**。
- 鉴权：上传 / 列举 / 下载 / 删除应用租户文件统一用 `X-API-Key` 头，无需用户 token（详见 §6.2、总览 §3.4）。
- scope：`file:write` / `file:read` 由 ApiKey 通道整体授予，**当前实现是「持有 ApiKey = 拥有该应用租户全部文件权限」**，不做细粒度拆分。

### Q3 文件是否默认进 REVIEWING？审核期间能否读？会不会「先裂图后恢复」

**结论：会默认进 `REVIEWING`，且期间对外访问受限制，确实存在「先裂图后恢复」风险，需目标 APP 侧处理。**（详见 §3.7）

- `uploads.service.ts` 的 `complete` 建文件时 `status: 'REVIEWING'`，随后异步 `moderateFile` 改为 `ACTIVE` / `REVIEWING`（人工）/ `BLOCKED`。
- 读取侧：**签名短链 `serveSigned`** 直接 `403`（`file.status !== 'ACTIVE'`）→ **裂图**；**用户态下载** `inline` 预览允许 `ACTIVE`+`REVIEWING`、下载仅 `ACTIVE`；**列表**默认同时展示 `ACTIVE`+`REVIEWING`。
- 若审核结论为需人工复核，文件会**长期停留在 `REVIEWING`**，不会自动恢复。
- **租户级开关（已支持）**：`Tenant.autoReview`（默认 `true`）。平台管理员在后台「租户设置」中关闭后，该租户新上传文件直接 `ACTIVE`、跳过审核（`PATCH /api/v1/admin/tenants/:id`，body `{ "autoReview": false }`）。

**目标 APP 侧建议：** ① 轮询状态或订阅 `file.reviewed` Webhook，变 `ACTIVE` 后再对外展示；② UI 对 `REVIEWING` 显示「审核中」占位图；③ 若内容已自带审核，请平台管理员在后台租户设置中关闭该租户的 `autoReview` 开关。

### Q4 秒传共享导致误删？相同 hash 秒传后 fileId 被多文档共用

**结论：当前实现已用 refCount 引用计数防护，不会误删别人共用的 blob。**

- 秒传去重（`uploads.service.ts`）：命中已有 blob 时删掉本次合并的冗余文件，并 `refCount: { increment: 1 }` 复用已有 blob。
- 删除：owner 删文件先**软删除**（`RECYCLED`），回收站二次删才 `physicalDelete`；`physicalDelete` 先 `refCount: { decrement: 1 }`，**仅当 `refCount <= 0` 才真删底层存储与 `FileBlob` 记录**。
- ⚠️ 澄清：**`File` 记录各自独立，`fileId` 并不共用**——共用的是底层 `FileBlob`（按 hash）。多文档各有各的 `fileId`，`DELETE /files/:id` 只减引用，互不影响。

✅ 因此目标 APP 调 `DELETE /files/:id` 是安全的，**无需自己实现解绑逻辑**。

### Q5 配额 / 单文件上限 / 是否有独立 CDN / 缩略图

| 项 | 现状（代码确认） |
|----|------------------|
| **单文件上限** | `Plan.fileSizeLimit`（BigInt，按套餐）。Free = 20MB，Pro = 2GB，由 `quota.service.ts` 校验。应用租户挂载哪个套餐就以该套餐上限为准；套餐为「不额外限制」时实际生效的是硬上限 `QUOTA_MAX_FILE_SIZE`（默认 20GB） |
| **配额** | 由套餐权威决定（`storageQuota` / `trafficQuota` / `fileCountLimit` / `shareCountLimit` / `apiCallPerDay` / `apiKeyLimit`），按 `tenantId` 聚合用量（`UsageRecord`）。应用租户独立计量，与终端用户个人租户无关（`GET /admin/tenants/:id/usage`）。所有维度都被 `QUOTA_MAX_*` 硬上限夹紧，**不存在真正的「无限」**（见 PRD §3.5.2） |
| **独立 CDN** | 当前**无独立 CDN**。`STORAGE_BASE_URL` 已存在（开发 `http://localhost:9001`），`/blobs` 直出走本项目域名。后续接 CDN 只需把 `STORAGE_BASE_URL` 改为 CDN 域名、`STORAGE_DRIVER` 切 s3 兼容适配器；目标 APP 侧按总览 §3.4「相对 blobPath + 运行时拼 BASE_URL」**无需改库** |
| **缩略图** | **后端已支持按需缩略图**：`getThumbnail` 按 `size` 生成 WebP 并磁盘缓存；`serveSigned` 带 `size` 参数即返回缩略图。目标 APP 无需自建，直接用 `size` 参数即可（Free 套餐对外预览会带水印，见水印文档） |
| **限速** | 按套餐 `downloadSpeed`（bytes/s，`0` = 不限速）对下载做限速（`streamDownload`） |

**对接时需与平台确认：** ① 你的应用租户挂载哪个套餐（决定上限与配额）；② 是否需要独立 CDN 域名（影响 `STORAGE_BASE_URL` 与带宽成本）；③ 是否需要关闭自动审核（见 Q3）。

### 一句话总结

| 问题 | 答复 |
|------|------|
| 1. `/blobs` 公开？ | **公开可读、无鉴权**，可 302 直出；但带宽走后端、hash 泄露即公开，敏感内容请走 `signUrl` |
| 2. ApiKey | 平台管理员签发 `POST /admin/application-tenants`，`X-API-Key` 调用，服务端保密 |
| 3. 默认审核？ | **默认 `REVIEWING`**，签名短链对外 403 → 会先裂图；请轮询状态或订阅 `file.reviewed` Webhook 后再展示 |
| 4. 秒传误删？ | **已用 refCount 防护**，删除只减引用、归零才删，不会误删共用 blob |
| 5. 配额 / CDN / 缩略图 | 配额以套餐为唯一权威并夹紧到 `QUOTA_MAX_*` 硬上限（无「无限」）；当前无独立 CDN（`STORAGE_BASE_URL` 可切）；后端已支持 `size` 缩略图 |
