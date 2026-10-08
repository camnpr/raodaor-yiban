<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-docs/billing.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 绕道儿文档 —— 套餐计费与支付对接（Phase 2）

> 面向**第三方目标 APP 的开发者**：如何为你的**组织**（IDStack 侧的「租户」）购买并升级「文档用量」套餐，支付结果如何回调到你的系统。
>
> **前提**：已完成 [import-api.md](./import-api.md) 的接入；已理解 [接入总览 §2.3](./overview.md#23-隔离与计费主体组织organization) 的术语映射与计费主体模型。

**术语约定**：IDStack 侧 **租户（tenant）** = 本 APP 语境的 **组织（organization）**。正文一律使用「组织」，仅在描述 IDStack 合同/字段时保留「租户」。

---

## 0. 状态与范围

| 图例 | 含义 |
| :--- | :--- |
| ✅ | **已实现**（代码已落地） |
| ⬜ | **待实现**（后续 Phase） |
| 🗄️ | **代码已就绪，但需执行数据库迁移后才生效** |

> ✅ P1（组织模型）与 P2（支付闭环）的代码**已实现**。
> 🗄️ 但 `Organization` / `CheckoutSession` 等表的落地**依赖数据库迁移**——部署前必须先执行 §7 的迁移步骤，否则全部接口会报错。

---

## 1. 计费模型

### 1.1 计费主体：组织（Organization，IDStack 语境 = 租户 Tenant）

```
一个组织 = 一份套餐 = 一份配额
    │
    ├─ 组织管理员付费升级（IDStack 组织级角色）
    ├─ 该组织下所有成员共享升级后的配额
    └─ 组织之间数据与配额完全隔离

纯个人账号（未挂任何组织）→ 以用户本人为计费主体（free 档兜底）
```

**为什么不是按用户计费**：目标 APP 是 B 端 SaaS，按终端用户计费意味着一家 100 人的公司要买 100 份，不可接受。

**组织从哪来**：IDStack 签发的 JWT `roles[].tenant_id`。绕道儿文档从中读取并落库（本地 `Organization.idstackOrganizationId`），作为配额与计费的归属依据。同一账号可持「个人身份 + 多个组织身份」并通过 `POST /auth/switch-organization` 切换当前生效身份（换配额主体）。

### 1.2 职责划分

| 能力 | 负责方 | 说明 |
| :--- | :--- | :--- |
| 套餐目录、价格、计费周期 | **IDStack** | 在应用编辑页「会员套餐 / 等级配置」中维护 |
| 本地套餐码 → IDStack 套餐 ID / 金额映射 | **绕道儿文档** | 环境变量目录，仅用于给托管下单页**预填并锁定金额**（见 §6.1.1） |
| 订单创建、支付渠道、收款 | **IDStack** | 目标 APP 与绕道儿文档均不接触资金 |
| 凭证核销、状态机 | **IDStack** | 收益方运营者在嵌入页核销 |
| `组织/用户 → 当前套餐` 映射 | **绕道儿文档** | 消费 webhook 后落库 |
| 配额校验与拦截 | **绕道儿文档** | 超额返回明确错误码 |
| 付费入口与订单展示 | **目标 APP**（可选） | 可嵌入 IDStack 模块，或跳转到绕道儿文档的套餐页 |

**绕道儿文档不自建套餐表、不自建订单表、不对接支付渠道。**

---

## 2. 配额与计量

### 2.1 套餐分级

| 套餐 | 文档数上限 | 月导入次数 | 单文件行数 | 协作者 / 文档 |
|------|-----------|-----------|-----------|--------------|
| **Free** | **10（硬上限）** | 50 | 2 万 | 3 |
| **Basic** | 100 | 1,000 | 5 万 | 10 |
| **Pro** | 1,000 | 10,000 | 20 万 | 50 |
| **Enterprise** | 定制 | 定制 | 定制 | 定制 |

> 价格与周期以 IDStack 后台配置为准，本文档不写死金额。

### 2.2 计量维度

| 维度 | 类型 | 说明 |
|------|------|------|
| 文档总数 | 存量 | 主计量项。回收站（软删除）中的文档**仍占用额**，彻底删除后释放。归属以 `Workbook.organizationId`（**创建时的身份快照**）为准 |
| 月导入次数 | 周期 | 导入**成功**次数，自然月重置；用户级 `POST /api/v1/documents/import` 与服务端 `POST /api/v1/open/workbooks/import` **计入同一份组织额度** |
| 单文件规模 | 瞬时 | 文件大小 + 行数上限 |
| 单文档协作者数 | 存量 | `WorkbookMember` 记录数 |

**口径**：计量键 = 当前身份——组织身份按 `Organization` 聚合（同组织成员共享），个人身份按用户维度兜底。前端所有配额判断经 `useQuota()` 统一取值，**禁止硬编码免费档常量**（否则付费组织升级后仍被免费档拦截）。

**⚠️ 文档数按「创建时的归属快照」统计，不按 owner 的当前组织**：用户可在个人 ↔ 组织间切换身份，`User.organizationId` 会随之变化。若按 owner 当前组织聚合，个人时期创建的文档会在切到组织后被算进组织用量（串台），反之亦然。因此 `Workbook` 落 `organizationId` 快照：组织身份创建的文档计入该组织，个人身份创建的（`organizationId` 为 null）只计入个人。

**接近上限的处理（不自动清理）**：`GET /billing/quota` 额外返回 `trashCount`（回收站中**仍占额**的文档数）与 `nearLimit`（用量 ≥ 90%）。
软删除**不自动清理**——宁可多占存储，也不能误删用户可能还需要的数据；改为在用量达 90% 时提示用户自行清理回收站（彻底删除才释放额度）。

**防刷**：新建文档限流 30 次 / 分钟（IP 级）。真正的额度约束是文档数上限（回收站也占额），**新建不占用月导入次数**——否则"删旧建新"会被存量与流量两个维度双重惩罚，属实打实的体验降级。

### 2.3 超额行为

**拒绝操作并返回明确错误码，绝不静默降级**：

| 场景 | 错误码 | 常量 |
| :--- | :--- | :--- |
| 文档数超额 | `3006` | `WORKBOOK_LIMIT_EXCEEDED` |
| 单文档协作者超额 | `3005` | `SHEET_LIMIT_EXCEEDED`（沿用既有码，语义扩展） |
| 月导入次数超额 | 待定 | 需新增错误码 |
| 文件规模超额 | `5001` | `FILE_TOO_LARGE` |

---

## 3. 支付闭环

### 3.1 完整时序

```
① 组织管理员/付费用户在绕道儿文档点「升级套餐」，选择目标套餐
       │ 本 APP 后端：生成 externalOrderId，落 checkout_sessions 意图表
       │   { external_order_id, organization_id, target_plan, status: 'pending' }
       ↓
② 前端嵌入 IDStack payment-create 模块（下单时可选渠道自动生成凭证）
       new IdStackEmbed({ module:'payment-create', externalOrderId, token, redirect, params:{ businessId } })
       ↓
③ 用户在嵌入页付款并提交凭证；可随时在「我的订单」查看进度
       // 我的订单 = payment-orders?scope=own（任意登录用户看本人订单，免白名单）
       订单状态：pending → paid
       ↓
④ 收益方运营者在「管理订单」页核销凭证
       // 管理订单 = payment-orders 管理态（不传 scope），白名单 embed.verifyOrders
       订单状态：paid → verified
       ⚠️ 核销后才推 webhook，付款时不推
       ↓
⑤ IDStack POST → 绕道儿文档 /api/v1/auth/idstack-webhook
       Header: X-IDStack-Signature（RS256）+ X-IDStack-Timestamp + X-IDStack-Event-Id
       Body:   { event:'payment.verified', externalOrderId, tenantId, ... }
       ↓
⑥ 本 APP 校验签名 → 用 externalOrderId 反查意图表
       ↓
⑦ 升级计费主体配额：有组织 → Organization.plan；纯个人账号（organization_id 为空）→ 升级 User.plan
       标记意图表 verified
       ↓
⑧ 用户刷新后看到新配额生效
```

### 3.2 订单状态机

```
pending   （待支付：订单已创建，用户尚未付款）
   │  用户付款并提交凭证
   ▼
paid      （已支付/待核销：等待运营者核销）
   │  运营者核销凭证
   ▼
verified  （已核销：最终成功状态，此时才推送 payment.verified）
```

异常分支：`cancelled`（取消）、`refunded`（退款）。

> **关键认知**：即使用户已付款，只要未核销，就不应落地套餐升级。必须等 webhook。

### 3.3 本 APP 侧端点一览

| 方法 | 路径 | 鉴权 | 说明 |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/v1/billing/quota` | JWT | 查询当前身份的套餐与用量 |
| `POST` | `/api/v1/billing/checkout` | JWT | 创建升级订单（待支付意图） |
| `POST` | `/api/v1/auth/idstack-webhook` | RS256 签名（`X-IDStack-Signature`） | 接收 IDStack 事件（统一入口，按 `event` 分发） |
| `GET` | `/api/v1/billing/admin/sessions` | JWT + 平台运营者 | 待支付意图列表（排障 / 补漏） |
| `POST` | `/api/v1/billing/admin/sessions/:externalOrderId/verify` | JWT + 平台运营者 | 手动核销（webhook 丢失时的兜底补单） |

**① 查询用量**

```http
GET /api/v1/billing/quota
Authorization: Bearer <access_token>
```

```json
{
  "code": 0,
  "data": { "plan": "free", "used": 3, "limit": 10, "hasOrganization": true },
  "message": "success"
}
```

`hasOrganization: false` 表示当前为**个人身份**（未挂组织），正按 free 配额以**用户维度**兜底。

**② 创建升级订单**

```http
POST /api/v1/billing/checkout
Authorization: Bearer <access_token>
Content-Type: application/json

{ "plan": "pro", "billingCycle": "month" }
```

```json
{
  "code": 0,
  "data": {
    "externalOrderId": "chk_9f3c2a...",
    "targetPlan": "pro",
    "status": "pending",
    "createdAt": "2026-09-03T10:00:00.000Z"
  },
  "message": "success"
}
```

- `plan` 仅接受 `basic` / `pro` / `enterprise`（`free` 为默认档，不可购买）
- 计费主体由服务端按**当前身份**决定：组织身份 → 升级该组织；个人身份 → 升级本人（不依赖请求体）
- 返回的 `externalOrderId` 需传给前端 `payment-create` 模块

**③ webhook**

见 §5。注意它是 `Public` 端点（IDStack 不携带本 APP token），且**不参与限流**——否则重试推送可能被误拒。

---

## 4. 待支付意图表（`checkout_sessions`）

webhook 回推时只带 `externalOrderId`，**不含本地业务主键**。因此必须有一张轻量「待支付意图表」用于反查。

Prisma 模型字段（camelCase）：

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | uuid | 主键 |
| `externalOrderId` | string **唯一** | 下单时透传给 IDStack 的值，反查主键（形如 `chk_<uuid32>`） |
| `organizationId` | uuid? | **升级目标组织**（组织身份下单；为 null = 个人身份下单，升级对象为发起者本人） |
| `targetPlan` | string | 要升级到的套餐码（如 `pro`） |
| `tierCode` | string? | 目标等级码 |
| `billingCycle` | string? | 计费周期（`month` / `year` / `lifetime` / `one-time`） |
| `status` | enum | `pending` / `verified` / `failed` |
| `createdById` | uuid? | 发起升级的用户（仅用于审计，个人身份下单时兼作升级对象） |
| `idstackOrderId` | string? | 核销后回填，用于对账 |
| `idstackOrderNo` | string? | IDStack 订单号（展示用） |
| `amount` / `currency` | string? | 金额以字符串存储，避免浮点误差 |
| `createdAt` / `verifiedAt` | datetime | 时间戳 |

> 它不是「支付表」，而是「待支付意图表」——支付与订单由 IDStack 持有，本表只解决「externalOrderId → 组织（或本人） + 目标套餐」的映射。

---

## 5. Webhook 契约

### 5.1 端点与鉴权

```
POST https://docs.raodaor.com/api/v1/auth/idstack-webhook
Content-Type: application/json
X-IDStack-Signature: keyId=<kid>,algorithm=rs256,signature=<base64url>
X-IDStack-Timestamp: <unix 秒>
X-IDStack-Event-Id: <uuid>
```

**鉴权方式**：**RS256 签名**（复用 IDStack 私钥 + JWKS 公钥；不再是共享密钥明文比对）。签名内容为 `${timestamp}.${eventId}.${rawBody}`，服务端拉 JWKS 公钥验签并**钉死 RS256**，同时校验时间窗（±5min）与 `eventId`。

```ts
import { verify as cryptoVerify } from 'node:crypto';

app.post('/api/v1/auth/idstack-webhook', async (req, res) => {
  const { keyId, signature } = parseSig(req.header('x-idstack-signature') || '');
  const timestamp = req.header('x-idstack-timestamp');
  const eventId = req.header('x-idstack-event-id');
  if (!signature || !timestamp || !eventId) {
    return res.status(401).json({ success: false, error: 'missing signature headers' });
  }
  // 时间窗校验（±5min），防重放
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return res.status(401).json({ success: false, error: 'timestamp out of window' });
  }
  // 用 JWKS 公钥验签，算法钉死 RS256
  const publicKey = await selectPublicKey(IDSTACK_JWKS_URI, keyId);
  const ok = cryptoVerify(
    'RSA-SHA256',
    Buffer.from(`${timestamp}.${eventId}.${req.rawBody}`),
    publicKey,
    Buffer.from(signature, 'base64url'),
  );
  if (!ok) return res.status(401).json({ success: false, error: 'invalid signature' });
  handleEvent(req.body);
  res.status(200).json({ success: true });
});
```

> `parseSig` / `selectPublicKey` 见 IDStack 参考实现 `idstack-verify.ts`；`IDSTACK_JWKS_URI` 见 §6 环境变量。
> ⚠️ 签名是对**原始 body 字节**计算的，`req.rawBody` 不可用「已解析的 JSON 再序列化」代替（Nest 需 `NestFactory.create(AppModule, { rawBody: true })`）。

### 5.2 `payment.verified` payload

```json
{
  "event": "payment.verified",
  "userId": "uuid-of-payer",
  "tenantId": "uuid",
  "appId": "uuid",
  "orderId": "uuid",
  "orderNo": "ORDER20260902XXXX",
  "externalOrderId": "your-local-order-id",
  "businessType": "membership",
  "businessId": "plan-uuid",
  "amount": "499.00",
  "currency": "CNY",
  "voucherCode": "ABCD2346789EFGHJ",
  "verificationCode": "VF123456",
  "status": "verified",
  "verifiedAt": "2026-09-02T10:00:00.000Z",
  "planCode": "pro",
  "externalCode": "docs_pro_monthly",
  "tierCode": "pro",
  "tierId": "uuid",
  "membershipLevel": "pro",
  "billingCycle": "month",
  "periodStart": "2026-09-02T10:00:00.000Z",
  "periodEnd": "2026-10-02T10:00:00.000Z",
  "timestamp": "2026-09-02T10:00:00.000Z"
}
```

> ⚠️ 关联本地订单用 **`externalOrderId`**（camelCase），**不要用 `orderId`**（IDStack 内部 UUID，会变且无业务含义）。

### 5.3 消费逻辑（组织/个人两级升级）

IDStack 原生的会员模型是「**绑定到下单用户**」，与我们要的「**绑定到组织**」冲突。采用适配方案：**升级对象不看 webhook 请求体，一律取本地意图表反查结果**。

```ts
async function handlePaymentVerified(body: any) {
  if (body.event !== 'payment.verified') return;

  // 1) 用 externalOrderId 反查本地意图表
  const session = await checkoutSessions.findByExternalId(body.externalOrderId);
  if (!session) return;

  // 2) 幂等：已核销则直接返回成功
  if (session.status === 'verified') return;

  // 3) 升级【本地意图表记录的计费主体】，忽略 body.userId
  //    —— 有组织升 Organization.plan；个人身份（organization_id 空）升发起者本人 User.plan
  //    IDStack 会写一条用户级 user_membership，但我们不消费它
  const subject = session.organizationId
    ? upgradeOrganizationPlan(session.organizationId, { plan: session.targetPlan, periodEnd })
    : upgradeUserPlan(session.createdById, { plan: session.targetPlan, periodEnd });

  // 4) 标记意图表
  await checkoutSessions.markVerified(session.id, body.orderId);
}
```

**三条铁律**：

1. **忽略 `userId`** —— 升级对象是本地意图表记录的计费主体（组织优先；个人身份兜底），不是付款人
2. **幂等** —— 事件可能重复 / 乱序到达，以 `external_order_id` 或 `orderNo` 去重
3. **快速返回 2xx** —— 非 2xx 时 IDStack 会**最多重试 3 次**（指数退避）；先落库再处理，或异步化

---

## 6. 前端嵌入用法

### 6.1 发起支付（`payment-create`）

```ts
import { IdStackEmbed } from '@isudaji/raodaor-sdk-web-features';

const embed = new IdStackEmbed({
  container: '#pay',
  origin: 'https://idstack.raodaor.com',
  module: 'payment-create',
  token: userToken,                       // IDStack access_token
  app_id: IDSTACK_APP_ID,
  externalOrderId: localOrderId,          // 必传！否则订单停在 PENDING 且无法关联
  params: { businessId: planId, businessType: 'membership' },
  redirect: 'https://your-app.com/pay-result',
  onPurchaseSuccess: (d) => {
    // 仅 UX 提示 + 本地意图表落库，配额生效以 webhook 为准
    toast('已提交，等待核销');
  },
  onClose: (d) => {
    if (d.redirect) window.location.href = d.redirect;
  },
});
embed.mount();
```

#### 6.1.1 让下单页直接显示金额（`businessId` + `amount` + `locked`）

**问题现象**：只传 `businessType=membership` 时，IDStack 托管下单页的金额为空——
按 `PaymentCreateScreen` 的入参约定，**`amount` 缺省则需用户在页内输入**。

**解决**：把套餐 ID 与金额一并透传，并锁定字段：

```ts
params: {
  businessType: 'membership',
  businessId: planId,   // IDStack 侧 membership_plan 的 ID（决定订阅哪个套餐）
  amount: '29.00',      // 金额，缺省则用户手填
  currency: 'CNY',      // 币种，默认 CNY
  locked: true,         // 锁定由 URL 预填的字段，用户不可改
}
```

> ⚠️ `locked=true` **仅在确有预填值时才传**：若 `amount` 为空又锁字段，用户会被锁在空金额上无法输入。
> 本项目的 `buildPaymentParams()`（`BillingPage.tsx`）已按此规则处理。

**金额必须由服务端下发**（`POST /billing/checkout` 的响应字段），前端不得自行构造——
否则可被篡改成 0.01 下单。服务端通过环境变量维护「本地套餐码 × 计费周期 → IDStack 套餐 ID + 金额」：

| 环境变量 | 说明 |
| :--- | :--- |
| `BILLING_PLAN_BASIC_MONTH_ID` / `_PRICE` | 基础版月付：IDStack 套餐 ID / 金额 |
| `BILLING_PLAN_BASIC_YEAR_ID` / `_PRICE` | 基础版年付 |
| `BILLING_PLAN_PRO_MONTH_ID` / `_PRICE` | 专业版月付 |
| `BILLING_PLAN_PRO_YEAR_ID` / `_PRICE` | 专业版年付 |
| `BILLING_CURRENCY` | 币种，默认 `CNY` |

- 金额格式：非负数字、最多两位小数（非法值被忽略并输出 warn）。
- **未配置的组合不预填**，回退为「用户在下单页手填金额」（可用，仅体验降级），服务端日志会输出 warn 提示漏配。
- 目录项在创建订单时一并写入 `checkout_sessions.amount / currency`，核销时以 webhook 回传的金额覆盖。

实现见 `server/src/modules/billing/plan-catalog.ts` 与 `billing.service.ts#resolvePlanCatalog`。

### 6.2 其他可用模块

| module | 用途 | 权限（白名单） |
| :--- | :--- | :--- |
| `payment-orders`（params `{ scope: 'own' }`） | **我的订单**：任意已登录身份查看**本人**订单（服务端按 created_by 过滤，免管理权限点与白名单） | 无需 `allowedRoles` |
| `payment-orders`（管理态，不传 scope） | **管理订单**：收益方运营者查看与管理所有人的订单（核对付款、生成凭证、核销） | `embed.verifyOrders`（owner / system_admin + 自定义运营者，**不含**客户侧组织管理员） |
| `payment-verify` | 核销凭证 | 同管理订单 |
| `membership` | 会员中心（等级 / 权益） | 普通用户 |

> ⚠️ 管理类模块的 `allowedRoles` **一律透传服务端 `/auth/me` 下发的 `embed.*`**，本 APP 前端不硬编码角色名。
> ⚠️ IDStack 的 `admin-orders` 模块是**积分商城（points-mall）**订单管理页，与支付域（`payment.*`）订单不是同一套数据，本应用不使用。
> 依赖 SDK 默认放行（含 `tenant_admin`）会误放行客户侧组织管理员，故必须显式传入。

### 6.3 三个必须澄清的点

| 要点 | 说明 |
| :--- | :--- |
| **不要传 `app_id` / `tenant_id`** | 托管支付页不接收这两个参数，订单归属**取自登录用户的 JWT**，服务端显式禁止信任客户端传入 |
| **`businessId` ≠ 本地订单号** | 它是 IDStack 侧的套餐 / 商品 ID（决定订阅哪个套餐）；本地订单号走 `externalOrderId` |
| **回跳不在 URL 里** | 前端回跳由 SDK `onClose` + `redirect` 参数决定，不是托管页 URL 的 `redirect` |

---

## 7. 配额校验改造点（绕道儿文档侧）

当前实现与目标状态的差距，供实施时对照：

| # | 改造内容 | 状态 | 涉及代码 |
| :--- | :--- | :--- | :--- |
| 1 | 读取 IDStack `roles[].tenant_id` → 落库 `Organization`，当前身份随 JWT 下发 | ✅ | `auth.service.ts`、`jwt.strategy.ts`、`auth.controller.ts` |
| 2 | `Organization` + `User.organizationId` + `CheckoutSession` 意图表 | 🗄️ 待迁移 | `schema.prisma` |
| 3 | 身份切换（个人 ↔ 组织，换配额主体） | ✅ | `POST /auth/switch-organization`（请求体空 `idstackOrganizationId` 即切回个人） |
| 4 | `/auth/me` 能力化：`identity` / `organizations` / `capabilities` / `embed` | ✅ | `auth.service.ts`、`auth.controller.ts` |
| 5 | 配额校验按当前身份（组织共享 / 个人兜底，3 处调用点） | ✅ | `common/quota/quota.service.ts` + `workbook.service` ×2、`file.service` |
| 6 | `GET /api/v1/billing/quota` 用量查询 | ✅ | `billing.controller.ts`（返回 `hasOrganization`） |
| 7 | `POST /api/v1/billing/checkout` 创建订单 | ✅ | `billing.service.ts` |
| 8 | `POST /api/v1/auth/idstack-webhook` 事件接收（统一入口，分发支付事件） | ✅ | `idstack-webhook.controller.ts` → `billing.service.ts` |
| 9 | 导入限制按套餐动态取值 | ✅ | `file.service.ts` |
| 10 | 前端门控能力化 + 身份切换器 + 用量展示 | ✅ | `packages/client`（`AppShell` / `authStore` / `useQuota`） |
| 11 | 月导入次数计量与拦截（周期指标） | ✅ | `common/meter/meter.service.ts` |
| 12 | 异步导入（无 Redis 兼容方案） | ✅ | `modules/file/import.worker.ts` |

> 第 11、12 项属于 Phase 4。异步方案不使用 BullMQ——
> 任务落库 + 进程内 worker + 数据库乐观锁，见 [import-api.md §5.2](./import-api.md#52--post-documentsimport--上传即建文档)。

> 配额校验的 3 个调用点：`createWorkbook`、`restoreWorkbook`（易漏）、`importAsDocument`。

### 7.1 🗄️ 迁移命令（按项目规范不自动执行，需手动跑）

```bash
cd packages/server

npx prisma migrate dev --name rename_tenant_to_organization
```

- 命令会顺带刷新 Prisma Client 类型。若只需刷新类型不改库，用 `npx prisma generate`。
- 若本机曾执行过旧迁移（`Tenant` / `CheckoutSession` 表已存在），新旧迁移会按 `migrations/` 历史顺序衔接；Prisma 会在出现 drift 时提示，**不要**自动确认 reset。

> ⚠️ 若输出 `drift detected` / `reset` / `data loss`，**立即停止并确认**——
> 继续可能导致数据丢失。

---

## 8. 自检清单

| # | 检查项 | 通过标准 | 不通过时排查 |
| :--- | :--- | :--- | :--- |
| 1 | webhook 地址已登记 | IDStack 应用配置中能看到 `webhook_url` | §5.1 |
| 2 | 组织 `idstack_webhook_enabled = true` | 事件能收到 | **总开关关闭会抑制全部推送** |
| 3 | 签名校验生效 | 错误签名返回 401，正确返回 200 | 用 JWKS 公钥验 `X-IDStack-Signature`（RS256）+ 时间窗 ±5min |
| 4 | `externalOrderId` 已透传 | webhook 中能拿到下单时的值，非 `hosted-*` | `payment-create` 必传该参数 |
| 5 | 意图表可反查 | 用 `externalOrderId` 能查到 `organizationId` + `target_plan` | §4 |
| 6 | 升级落到组织 | 同组织**其他成员**配额也变了（非仅付款人） | 检查是否误用 `body.userId` |
| 7 | 幂等生效 | 重复推送同一 `orderNo` 不会重复升级 | 以 `order_no` / `external_order_id` 去重 |
| 8 | 响应及时 | webhook 500ms 内返回 2xx | 重逻辑异步化，避免超时触发重试 |
| 9 | 配额拦截生效 | Free 档创建第 11 个文档返回 `3006` | §2.3 |
| 10 | 核销前不生效 | 用户付款但未核销时，配额**未变** | 确认没用 `onPurchaseSuccess` 落地配额 |

---

## 9. 常见坑速记

| 坑 | 后果 | 规避 |
| :--- | :--- | :--- |
| 不传 `externalOrderId` | 订单生成 `hosted-*` 占位值，永远停在 PENDING，无法关联 | 必传，且同组织内唯一 |
| 用 `body.userId` 升级 | 变成「谁付款谁享受」，团队成员用不了 | 用本地意图表记录的组织 `organizationId` |
| 组织身份下单却升级到个人 | 组织成员用不上新配额 | 升级对象以 `session.organizationId` 为准，个人身份单才升本人 |
| 依赖 `onPurchaseSuccess` 落地配额 | 付款即生效，但可能未核销 / 回调丢失 → 资损 | 只用于 UX，以 webhook 为准 |
| webhook 处理过重导致超时 | 触发 3 次重试，可能重复升级 | 先落库返回 2xx，后续异步处理 |
| 忘记幂等 | 重复升级 / 重复延期 | 以 `order_no` 去重 |
| 把 `secret_key` 放前端 | 任何人可伪造 webhook 给自己升配 | 仅后端持有 |
| 前端硬编码免费档上限 | 付费组织升级后被免费档拦截 | 统一走 `useQuota()` / 配额接口 |
| 嵌入管理类模块不传白名单 | 客户侧组织管理员被 SDK 默认放行核销 | `allowedRoles` 透传 `/auth/me` 的 `embed.*` |

---

## 10. 相关文档

| 文档 | 用途 |
| :--- | :--- |
| [接入总览 §3 套餐与计费](./overview.md#3-套餐与计费) | 套餐分级、计量维度、付费闭环简述 |
| [import-api.md](./import-api.md) | 导入加工对接契约（Phase 1） |
| IDStack Web SDK 文档（`canonical/sdk/idstack-web/`） | 完整能力（支付 / 套餐 / 会员 / 角色）与接入五分钟清单 |
