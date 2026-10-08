<!-- 由 ai-docs 同步自 canonical/sdk/idstack-web/features.md；修改请提交至 hub 仓库，勿直接编辑 -->

# @isudaji/raodaor-sdk-web-features

IDStack 功能模块 **Web 嵌入 SDK**。让接入方以插拔式方式在自己的网站中展示 IDStack 已有功能（积分商城、任务中心、收藏、喜欢、支付等），**无需重复开发**。

底层通过 `<iframe>` 加载 IDStack 的 `/embed/*` 无壳页面，并用 **postMessage 安全握手**注入令牌（token 不进 URL，避免泄露到 referer/日志）。

## 特性

- ✅ **零重复开发**：直接复用 IDStack 现有功能屏，IDStack 升级后自动生效
- ✅ **安全握手**：token 经 postMessage 传递 + 双向 origin 校验，绝不进 URL
- ✅ **两种用法**：编程式 `IdStackEmbed` 类 / 声明式 `<idstack-embed>` 自定义元素
- ✅ **真·插拔式**：`destroy()` 或移除标签即彻底卸载
- ✅ **TypeScript**：完整类型定义
- ✅ **UMD/ESM 打包**：支持 CDN、npm、本地多种引入

## React 组件（官方）

SDK 额外提供 React 组件封装 `IdStackEmbed`（位于包导出的 `IdStackEmbedReact`），适合 React / Next.js 宿主项目直接以 JSX 使用：

```tsx
import { IdStackEmbedReact as IdStackEmbed } from '@isudaji/raodaor-sdk-web-features';

function BillingPanel({ token }: { token: string }) {
  return (
    <IdStackEmbed
      origin="https://idstack.raodaor.com"   // 必填：IDStack 前端域名
      token={token}                            // 必填：SSO 换得的 access_token
      module="payment-orders"                  // 已注册模块名
      className="mb-6"
    />
  );
}
```

**关键约束（与核心类一致）：**
- `origin` 与 `token` **必填**。两者缺失都会**立即抛出明确错误**（`[IdStackEmbed] ... 为必填项`），便于开发期早发现，而不是静默加载错误页面或回退登录页。
- `module` 必须是 `EMBED_MODULE_PATHS` 的合法 key（`payment-orders` / `admin-orders` / `payment-verify` 等），非法值会**立即抛错**而非静默加载 `/undefined` 空白页。
- 组件自动管理挂载/卸载，回调（`onReady` / `onError` / `onClose` / `onPurchaseSuccess` 等）通过 props 透传；回调变化不会重建 iframe。
- 需宿主项目安装 `react>=17`（作为 peerDependency，SDK 不打包 react）。

> React 组件本质是核心 `IdStackEmbed` 类的 `useRef`+`useEffect` 薄封装，行为与「类实例化」「`<idstack-embed>` 自定义元素」三种用法完全一致。

## 5 分钟接入清单（新接入方必读）

把散落各处的要点收敛成有序步骤，照做即可跑通。详细解释见后文对应小节。

1. **登记回调白名单**：在 IDStack 后台为你的 app 登记 `redirect_uris`（SSO 回调地址，须字节级一致）。
2. **领取凭证**：拿到 `app_id`（`IDSTACK_APP_ID`，即应用 UUID）、`api_key` / `secret_key`（仅服务端用，换 token 时作 `client_id`/`client_secret`）。JWT 验签**不再需要共享密钥**——后端直接拉取 IDStack 的 `/.well-known/jwks.json` 公钥（RS256）验签后读 `roles`。
3. **SSO 登录**：运行时动态拼 `/oauth/authorize?app_id=<APP_UUID>&redirect_uri=<白名单>&response_type=code&scope=openid+profile+offline_access&state=<随机>`；**不要**把整条 URL 写成静态配置。
4. **换 token**：`POST /oauth/token`，`grant_type=authorization_code`，`client_id=<api_key>`，取 **`data.access_token`**（非顶层）。需要续签时带 `scope` 里的 `offline_access`，用 `data.refresh_token` 走 `grant_type=refresh_token`（refresh_token 会旋转，覆盖本地旧值）。
5. **嵌入看板**：用 `client_credentials`/用户 token 是**错误**做法。正确做法：`<idstack-embed module="analytics-dashboard" app-id="<APP_UUID>">`（声明式注意属性是连字符 `app-id`），或 `GET /embed/dashboard?app_id=<APP_UUID>&module=analytics`。看板走 `x-app-id` 应用凭证通道，**豁免 MFA、无需传用户 token**。
6. **角色同步**：一律**解码 `access_token` 读 JWT `roles` claim** 为权威来源，**不要**依赖 `data.user.roles`（可能缺失，会导致误判最小权限）。
7. **联调跨域**：若嵌入页在宿主源调用 IDStack 后端，确认 IDStack 后端已放行你的来源（开发期 `localhost` 默认放行；生产用 `CORS_ALLOW_ORIGINS`）；同时把你的域名加入 IDStack 客户端 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`（改完重启前端生效）。

> 关键防坑提醒：`app_id` ≠ `client_id`（授权用 `app_id`，换 token 用 `client_id=api_key`）；所有响应字段在 `data` 下；看板必须传 `app_id` 否则 403 `MFA_REQUIRED`。

## 统一能力由 IDStack 负责（避免重复造轮子）

SDK 的核心理念是：**接入方只做"嵌入"，重活交给 IDStack**。其中最关键、最不该由各接入方各自实现的两块能力由 IDStack 统一沉淀：

- **订单创建**：积分商城的兑换下单、问卷奖励发放等产生的订单，统一由 IDStack 后端创建、落库与状态流转，接入方无需自建订单表与下单接口。
- **在线支付**：积分/现金混合支付、支付凭证核验、支付结果回调等由 IDStack 统一处理（见 `/embed/payment/create`）。接入方不必重复对接支付渠道、重复实现支付安全与对账逻辑。

> 为什么强调"统一"？订单与支付一旦由各接入方自行实现，就会变成彼此孤立、无法互通的私有逻辑——同一用户在不同 App 的积分/订单无法共享，平台级的营销（跨 App 任务、统一积分体系）也无法落地，**SDK 原本的"公用性"就丧失了**。交给 IDStack 统一负责，所有接入方共用同一套订单/支付内核，既能保证数据一致与安全合规，又能让接入方以"插拔"方式零成本获得这些能力。

### 即插即用的功能场景

除订单与支付外，以下高频运营场景都已封装为开箱即用的嵌入模块，接入方无需开发对应页面与后端逻辑，直接 `<idstack-embed module="...">` 即可挂载：

| module | 场景 | 接入方省去的工作 |
|--------|------|------------------|
| `points-mall` | 积分商城 | 商品列表、兑换下单、库存与积分扣减逻辑 |
| `task` | 任务中心 | 任务配置、完成校验、奖励发放与积分变动 |
| `collection` | 我的收藏 | 收藏的增删查、与用户体系的数据隔离 |
| `like` | 我的喜欢 | 点赞关系维护、去重与计数 |
| `survey/:surveyId` | 填写问卷 | 问卷渲染、提交收集、数据统计 |
| `payment-create` | 创建支付 | 支付渠道对接、支付凭证与回调处理 |

这些模块复用 IDStack 同一套功能屏，随 IDStack 升级自动生效；数据天然按 JWT 中的 `app_id` / `user_pool_id` / `tenant_id` 三级隔离，接入方无需关心多租户隔离细节。

## 应用侧配置 → SDK 对接（会员体系 / 角色管理）

IDStack 的「应用编辑」页（`AppEditScreen`）提供三类应用级配置，配置完成即**自动对接收入方，无需目标 APP 自建对应后台**：

| 配置项 | 在应用编辑页的入口 | 自动继承 | 目标 APP 可对接的能力 |
|--------|-------------------|----------|----------------------|
| **角色管理** | `RoleManagementScreen` | 租户通用角色目录 | SSO 登录时经 JWT `roles` claim 把角色同步给目标 APP |
| **会员等级配置** | `TierManagementScreen` | 租户通用等级目录 | 用户当前等级/权益随账户下发，目标 APP 可直接读取 |
| **会员套餐配置** | `PlanManagementScreen` | 租户通用套餐目录 | 目标 APP 支付时选择套餐，与用户账户绑定 |

> 三类配置都遵循「**自动继承租户通用目录 + 可新增本应用专属项**」模型：应用未单独配置时沿用租户级目录，应用新增的专属项仅在该应用 `app_id` 下可见。数据按 `app_id` 隔离，互不串台。

### 1. 角色管理：SSO 登录即同步角色

在应用编辑页「角色管理」中新增/启用的角色（`name`、`description`），会在用户通过 SSO 登录、IDStack 签发 `access_token` 时，被写入 JWT 的 `roles` claim（`[{ role_id, role_name, tenant_id }]`）。

**目标 APP 对接方式**：登录换 token 后，一律**解码 `access_token` 读 `roles` claim** 作为权威来源（不要依赖 `data.user.roles`，可能缺失）。SDK 已封装好解析工具：

```ts
import { decodeJwt, parseRoles, hasRole, isTenantAdmin } from '@isudaji/raodaor-sdk-web-features';

// 1) 换 token 后拿到 access_token
const accessToken = data.access_token; // 注意：在 data 下，非顶层

// 2) 读取该用户在本应用下的全部角色
const roles = parseRoles(accessToken);
// => [{ role_id, role_name: 'editor' | 'viewer' | ..., tenant_id }]

// 3) 按角色做前端路由/能力鉴权
if (hasRole(accessToken, 'editor', MY_TENANT_ID)) {
  showAdminEntry();
}

// 4) 判租户管理员（务必传 tenant_id 防止跨租户误判）
if (isTenantAdmin(accessToken, MY_TENANT_ID)) {
  enableTenantConsole();
}
```

> 服务端敏感场景（如管理接口放行）：必须用 **JWKS 公钥（RS256）** 先验签再读 `roles`（见后文「JWKS 公钥验签配置（迁移后：RS256，不再共享 JWT_SECRET）」）；浏览器侧 `decodeJwt` 仅做解码、不验签，不可用于安全决策。

### 2. 会员等级配置：随账户下发当前等级

在应用编辑页「会员等级配置」中为应用新增的专属等级项（`name`、`description`），会进入该应用的会员等级目录。用户当前的等级/权益随 IDStack 账户体系维护，目标 APP 可通过账户接口读取，用于差异化展示与权益解锁。

**目标 APP 对接方式**：登录后携带 `access_token` 调用 IDStack 账户接口获取当前用户等级；或在嵌入会员中心时由 IDStack 按 `app_id` 自动呈现本应用的等级体系：

```html
<!-- 嵌入本应用的会员中心，等级/权益按 app_id 隔离展示 -->
<idstack-embed
  module="membership"
  token="USER_TOKEN"
  app-id="<APP_UUID>"
  origin="https://idstack.raodaor.com"
></idstack-embed>
```

> 等级目录"继承租户 + 应用专属"：目标 APP 只看到本应用生效的合并目录，无需自己维护等级表。

### 3. 会员套餐配置：支付时选择并与用户绑定

在应用编辑页「会员套餐配置」中为应用新增的专属套餐项（`name`、`description`、`price`、`duration_days`、`tier_id`），会进入该应用的会员套餐目录。目标 APP 在支付环节可让用户**选择已配置的套餐**，下单成功后套餐与用户账户绑定（开通对应等级/权益）。

**目标 APP 对接方式**：用 `payment-create` 嵌入模块发起支付，并通过 `externalOrderId` 关联本地订单；支付成功后由 `onPurchaseSuccess` / `payment.verified` webhook 回传，目标 APP 据此把套餐与用户绑定：

```ts
import { IdStackEmbed } from '@isudaji/raodaor-sdk-web-features';

const embed = new IdStackEmbed({
  container: '#pay',
  origin: 'https://idstack.raodaor.com',
  module: 'payment-create',
  token: USER_TOKEN,
  app_id: '<APP_UUID>',
  // 本地订单号，用于对账与回写用户套餐
  externalOrderId: 'order_' + localOrderId,
  // 透传选中的套餐（由本应用套餐目录提供）
  params: { planId: 'plan_vip_monthly', tierId: 'tier_vip' },
  onPurchaseSuccess: (data) => {
    // 前端回调仅做 UX 提示；真正"套餐绑定"以服务端 webhook 为准（见下节）。
    // 用 externalOrderId 落本地"待支付意图表"，待 payment.verified 回推时定位租户。
    createCheckoutSession({ externalOrderId: data.externalOrderId, tenantId, targetPlan });
  },
  onClose: (data) => {
    if (data.redirect) window.location.href = data.redirect; // 回跳目标 APP
  },
});
```

#### 3.1 托管支付页地址（IDStack 侧 URL 入参）

除了用 SDK 嵌入，也可以直接重定向到 IDStack 托管的支付页。两种路径都可用：

- 全页托管：`{IDSTACK_BASE_URL}/payment/create`
- 嵌入路由（iframe）：`{IDSTACK_BASE_URL}/embed/payment/create`

**实际接收的 URL 入参（来自 `PaymentCreateScreen` 路由解析，参数名为驼峰式）：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `businessType` | 否 | 业务类型：`membership`（会员）/ `product`（商品）/ `custom`（自定义，默认值）。对应订单 `business_type`。 |
| `businessId` / `orderId` | 否 | **套餐/商品在 IDStack 的 `plan_id`**（即 `business_id`）。决定用户订阅哪个套餐，进而 webhook 回推正确的 `planCode`/`tierCode`。**它不是你的本地订单号**。 |
| `amount` | 否 | 金额（数字）。缺省则需用户在页内输入。 |
| `currency` | 否 | 币种，默认 `CNY`。 |
| `externalOrderId` | 否（强烈建议传） | **你的本地订单号**，透传为订单 `external_order_id`，并在 `payment.verified` webhook 中原样回传（`externalOrderId` 字段），用于对账/回写。**这是你反查本地记录的主键，缺省时 IDStack 会生成 `hosted-*` 占位值，导致无法关联。** |
| `callback` | 否 | 透传为订单 `callback` 字段，非浏览器回跳地址。 |
| `locked` | 否 | 为 `true` 时锁定 `businessType`/`amount` 等由 URL 预填的字段，用户不可改。 |

示例（会员订阅，跳全页托管）：

```
{IDSTACK_BASE_URL}/payment/create
  ?businessType=membership
  &businessId=<IDStack 侧 membership_plan 的 ID>
  &amount=<金额>
  &currency=CNY
  &externalOrderId=<你的本地订单号，用于 webhook 关联回写>
  &locked=true
```

> ⚠️ **三个必须澄清的要点（避免接错）：**
> 1. **不要传 `app_id` / `tenant_id`**：托管支付页**不接收**这两个参数，订单的 `app_id` / `tenant_id` 取自**当前登录用户的 JWT**（服务端显式禁止信任客户端传入）。所以发起托管支付前，用户必须已用本应用登录并持有合法 token。
> 2. **`orderId`（`businessId`）≠ 你的本地订单号**：它映射到 `business_id`（套餐/商品 ID），用于决定订阅哪个套餐；本地订单号请走 `externalOrderId`。
> 3. **回跳地址不在 URL 里**：支付完成的前端回跳由 SDK `onClose` / SSO 应用配置的 `redirect_uris`、`callback_url` 决定，而非托管页 URL 的 `redirect` 参数。托管全页场景下，请在跳转前自行保存"来源页"，或在应用后台配置好回跳白名单。

> 注意：通过 SDK 嵌入（`module: 'payment-create'`）时，上述参数通过 `params` / `externalOrderId` 选项传入，命名一致（`externalOrderId` 直传，`businessId` 经 `params.businessId`），底层同样是 `/payment/create` 路由。

> 前端的 `onPurchaseSuccess` 只用于 UX 与本地"待支付意图"落库；**套餐是否真正生效，必须以服务端收到的 `payment.verified` webhook 为准**，不能依赖前端回调（前端回调可被绕过/丢失）。

---

### `payment.verified` Webhook 契约（目标 APP 必须实现的服务端端点）

IDStack 在支付核销成功后，会向目标 APP 主动推送 `payment.verified` 事件（fire-and-forget）。下方回答对接时最常卡住的四个问题。

#### ① 目标 APP 要暴露什么端点？
目标 APP **自己**暴露一个 HTTPS 端点（路径自定义，如 `POST /api/idstack/webhook`），Body 为 JSON。IDStack 不会替你建端点，它只负责把事件 POST 到你在后台配置的地址。

#### ② 怎么配置推送地址？
在 IDStack 后台按以下**优先级**配置（命中即止）：
| 优先级 | 配置位置 | 需同时配置 |
|--------|----------|-----------|
| 1（最高） | 应用编辑页 → 应用级 `webhook_url` | 无需 secret（RS256 签名） |
| 2 | 租户设置 → `idstack_webhook_url` | **`idstack_webhook_enabled = true`**（总开关，关闭则抑制该租户全部推送） |
| 3（兜底） | 全局环境变量 `IDSTACK_WEBHOOK_URL` | 无需 secret |

#### ③ 用什么鉴权？
**RS256 签名**（复用 IDStack 私钥 + JWKS 公钥，不再是共享密钥明文比对）。请求头：

```
POST /api/idstack/webhook
X-IDStack-Signature: keyId=<kid>,algorithm=rs256,signature=<base64url>
X-IDStack-Timestamp: <unix 秒>
X-IDStack-Event-Id: <uuid>
Content-Type: application/json
```

签名内容为 `${timestamp}.${eventId}.${rawBody}`；消费方用 JWKS 公钥验签并钉死 RS256。

目标 APP 服务端校验示例（Node，用 JWKS 公钥验签）：

```ts
app.post('/api/idstack/webhook', async (req, res) => {
  const { keyId, signature } = parseSig(req.header('x-idstack-signature') || '');
  const timestamp = req.header('x-idstack-timestamp');
  const eventId = req.header('x-idstack-event-id');
  if (!timestamp || !eventId) return res.status(401).end();
  // 时间窗校验（±5min）
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return res.status(401).end();
  const pub = await selectPublicKey(JWKS, keyId);
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${timestamp}.${eventId}.${req.rawBody}`), pub, Buffer.from(signature, 'base64url'));
  if (!ok) return res.status(401).json({ success: false, error: 'invalid signature' });
  // 校验通过，处理事件
  handleIdStackEvent(req.body);
  res.json({ success: true });
});
```

（`parseSig` / `selectPublicKey` 见 IDStack 参考实现 `idstack-verify.ts`；签名验签算法必须钉死 RS256。）

> 注意：webhook 本身不携带 JWT，靠 RS256 签名（`X-IDStack-Signature` + 时间戳 + eventId）验证来源；若需更高安全级，可在目标 APP 侧再结合 `tenantId`/`appId` 字段二次校验。

#### ④ `payment.verified` 事件完整 payload
```ts
{
  event: 'payment.verified',
  userId: string,            // 下单用户 ID（IDStack 侧该订单的创建人）
  tenantId: string,          // 租户 ID（= 路径中的 tenantId）
  appId: string,             // 应用 ID
  orderId: string,           // IDStack 内部订单 ID
  orderNo: string,           // 订单号
  externalOrderId?: string,  // 目标 APP 下单时透传的本地订单号（对账主键）
  businessType: string,      // 如 'membership'（会员）/ 'payment'（普通支付）
  businessId: string,        // 套餐/等级 ID
  amount: number,
  currency: string,
  voucherCode: string,       // 核销码
  verificationCode: string,  // 校验码
  verifiedAt: string,        // ISO 时间
  status: 'verified',        // 强制支付核销状态
  // —— 当 businessType === 'membership' 时额外附带（单事件即可完成会员等级同步）——
  planCode?: string,         // 套餐 code
  externalCode?: string,     // 套餐外部编码
  tierCode?: string,         // 等级 code（normal/silver/gold/diamond…）
  tierId?: string,           // 等级 ID
  membershipLevel?: string,  // 会员等级
  billingCycle?: string,     // 计费周期（月/季/年/终身/一次性）
  periodStart?: string,      // 当前周期开始（ISO）
  periodEnd?: string,        // 当前周期结束（ISO）
}
```
> 会员订单会**同时**再推一个 `user.subscription_changed` 事件（向后兼容），字段同上；新接入方只需处理 `payment.verified` 即可。

#### 套餐绑定维度：绑定到"用户"还是"租户"？
**IDStack 原生模型是"套餐绑定到下单用户"**（`user_membership` 表的 `user_id` 必填，核销时 `applySubscription(order.created_by, ...)`）。这与「租户管理员统一购买、绑定到租户、与成员无关」的租户级模型存在冲突。

**推荐采用方案 A（目标 APP 侧适配，改动最小、最可行）：**
- 消费 `payment.verified` 时**忽略 `userId` 维度**，只用 `externalOrderId` + `tenantId` 在本地找到对应的租户订单，升级**该租户**而非单个用户。
- IDStack 仍会写一条 `user_membership`（绑定到下单人），但 FlowPlan 不消费这个用户维度，以本地租户级状态为准。

```ts
async function handleIdStackEvent(body: any) {
  if (body.event !== 'payment.verified') return;
  // 1) 用 externalOrderId 反查本地"待支付意图表" → 拿到 tenantId 与目标套餐
  const session = await checkoutSessions.findByExternalId(body.externalOrderId);
  if (!session) return;                       // 未知订单，忽略
  // 2) 升级"租户"（忽略 body.userId），而非绑定到单个用户
  await upgradeTenantPlan(session.tenantId, session.targetPlan, {
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    idstackOrderId: body.orderId,
  });
  // 3) 标记意图表为已核销
  await checkoutSessions.markVerified(session.id, body.orderId);
}
```

**为什么不建"订单表"也要有 `externalOrderId` 映射表？**
webhook 回推时只带 `externalOrderId`（不含你本地业务主键），你若"不建订单表"，仍需一张轻量 **`checkout_sessions`（待支付意图表）** 留存映射，否则无法从 `externalOrderId` 反查到租户与目标套餐。它不是"支付表"，而是"待支付意图表"：

| 字段 | 说明 |
|------|------|
| `external_order_id` | 唯一主键，下单时透传给 IDStack 的值 |
| `tenant_id` | 目标租户（升级对象） |
| `target_plan` / `tier_code` | 要升级到的套餐/等级 |
| `status` | `pending` / `verified` / `failed` |
| `idstack_order_id` | 核销后回填，用于对账 |

> 方案 B（改 IDStack 增加"租户级套餐"类型，`user_membership.user_id` 可空）可实现真正的原生租户绑定，但改动较大；当前默认按方案 A 对接即可落地。

> 支付与订单由 IDStack 统一负责（见"统一能力由 IDStack 负责"），目标 APP 只需：① 配好 webhook 地址+密钥；② 落本地 `checkout_sessions` 意图表；③ 消费 `payment.verified` 升级对应租户。无需自建支付/订单系统。

> ⚠️ **`module` 必须是 `EMBED_MODULE_PATHS` 的合法 key**：只接受 `points-mall` / `task` / `collection` / `like` / `payment-create` / `payment-orders` / `admin-orders` / `payment-verify` / `analytics-dashboard` 等已注册值。传入拼写错误（如 `payment-order`）或未经注册的字符串时，SDK **会立即抛出明确错误**（`非法的 module: "xxx"。合法值为: ...`），**不会再静默加载 `/undefined` 空白页/错误登录页**。若需加载未注册路由（如带 `:orderId` 的订单详情），请改用 `path: '/embed/order/' + orderId`。

#### 3.2 订单列表嵌入与状态机（含管理员核销 → 业务落地）

一个订单从发起到"真正成功"需经过状态机，**只有管理员核销通过才算最终成功**，此时才推送 `payment.verified` 让目标 APP 落地业务。

**订单状态机（`payment_order.status`）：**
```
pending   （待支付：订单已创建，用户尚未付款）
  │  用户付款并提交凭证
  ▼
paid      （已支付/待核销：付款凭证已提交，等待管理员核销）
  │  目标 APP 管理员在 IDStack 核销页核验凭证
  ▼
verified  （已核销：最终成功状态，此时推送 payment.verified webhook）
```
异常分支：`cancelled`（取消）、`refunded`（退款）。

**关键认知：`payment.verified` 只在"核销成功"时推送，不是在"用户付款"时。** 也就是说，即使用户在支付页付了钱，只要还没核销，目标 APP 不应落地套餐/等级——必须等 webhook 到达。

**① 目标 APP 如何嵌入订单列表 / 核销页？**

IDStack 已提供这些嵌入路由：`/embed/payment/orders`（订单列表）、`/embed/admin-orders`（管理员订单）、`/embed/payment/verify`（核销）、`/embed/order/:orderId`（订单详情）。

> ✅ Web SDK 的 `EMBED_MODULE_PATHS` 已注册 `payment-create` / `payment-orders` / `admin-orders` / `payment-verify`，可直接用 `module` 嵌入（如下方示例）。带动态参数的 `order-detail`（需拼 `:orderId`）仍建议用 `path: '/embed/order/' + orderId`。
```ts
// 目标 APP 嵌入"订单列表"，供用户查看自己的订单状态
new IdStackEmbed({
  container: '#orders',
  origin: 'https://idstack.raodaor.com',
  module: 'payment-orders',        // 已注册模块
  token: userToken,                // 订单维度取自 JWT 的 app_id/tenant_id
});

// 目标 APP 的"网站管理员"后台嵌入核销页，核销后订单变 verified 并触发 webhook
new IdStackEmbed({
  container: '#verify',
  origin: 'https://idstack.raodaor.com',
  module: 'admin-orders',          // 或 'payment-verify'
  token: adminToken,               // 须为租户管理员/系统管理员 token，否则核销接口 403
});
```

**② 核销动作由谁触发？**
核销是**目标 APP 管理员在 IDStack 嵌入页手动操作**（核验用户提交的付款凭证/核销码），IDStack 后端 `verifyVoucher` 校验通过后把订单置 `verified`，并推送 `payment.verified`。权限：仅 `isTenantAdmin || isSystemAdmin`，且只能核销本租户凭证（跨租户 403）。**目标 APP 无需自己实现核销接口**，嵌入上述页面即可。

**③ 核销成功后，目标 APP 业务如何落地？**

完整闭环：
```
用户付款提交凭证 ──► 订单 paid
   │
目标 APP 管理员在 /embed/admin-orders 核验 ──► 订单 verified
   │  (IDStack 推送 payment.verified)
   ▼
目标 APP 服务端 webhook 收到 ──► 消费 externalOrderId 反查 checkout_sessions
   │
   ▼
落地业务：升级租户套餐 / 会员等级 / 开通权益（见 3.1 方案 A 代码）
   │
   ▼
回写本地业务表，标记"已生效"
```

> 即：IDStack 负责"收钱 + 凭证核销 + 状态机 + 推送事件"，目标 APP 负责"收到 `payment.verified` 后把业务真正落地并回写本地状态"。两侧通过 `externalOrderId` 对齐，各管各的，互不侵入。

> 注：会员类订单核销时，IDStack 侧**已自动** `applySubscription` 升级下单用户的 `user_membership`（写一条用户级会员记录）；目标 APP 若采用"租户级绑定"（方案 A），仍以本地 `checkout_sessions` 反查到的租户为准，不消费 IDStack 这层用户级记录。

### 配置 ↔ 对接 速查

| 想实现的效果 | 在应用编辑页配置 | 目标 APP 侧动作 |
|--------------|----------------|----------------|
| 登录后按角色控制菜单/权限 | 角色管理 → 新增角色 | 解码 `access_token.roles`，用 `hasRole` 鉴权 |
| 展示用户会员等级与权益 | 会员等级配置 → 新增等级 | 读账户等级 / 嵌入 `membership` 模块 |
| 用户付费开通会员套餐 | 会员套餐配置 → 新增套餐 | `payment-create` 选套餐 + `externalOrderId` 回写绑定 |

## 安装

```bash
npm install @isudaji/raodaor-sdk-web-features
# 或 CDN
# <script src="https://cdn.raodaor.com/js/sdk-web-features/dist/features.umd.min.js"></script>
```

## 用法一：声明式（Web Component，最省事）

```html
<idstack-embed
  origin="https://idstack.raodaor.com"
  module="points-mall"
  token="USER_TOKEN"
  app-id="<APP_UUID>"
  locale="zh-CN"
  theme="light"
  height="600px"
></idstack-embed>

<script src="https://cdn.raodaor.com/js/sdk-web-features/dist/features.umd.min.js"></script>
<script>
  const el = document.querySelector('idstack-embed');
  el.addEventListener('ready', () => console.log('嵌入就绪'));
  el.addEventListener('error', (e) => console.warn('鉴权失败', e.detail));
  el.addEventListener('feature-event', (e) => console.log('业务事件', e.detail));
  el.addEventListener('points-changed', (e) => console.log('积分变动', e.detail));
  el.addEventListener('purchase-success', (e) => console.log('购买成功', e.detail));
  el.addEventListener('close', (e) => { console.log('用户离开', e.detail); closeOverlay(); });
  el.addEventListener('forbidden', (e) => console.log('权限不足', e.detail));
  el.addEventListener('auth-expired', () => { /* 续签 token 或销毁重建 */ });
</script>
```

UMD 引入后会**自动注册** `<idstack-embed>` 元素，同时把包导出挂到全局变量 **`window.RaodaorSdkWebFeatures`**（即 rollup 的 UMD `name`）。

- 想要**声明式**嵌入：直接用 `<idstack-embed>` 标签即可，无需引用全局对象。
- 想要**编程式**初始化：`const { IdStackEmbed } = window.RaodaorSdkWebFeatures; new IdStackEmbed({...})`。
- ESM 环境如需自定义标签名，可手动调用 `window.RaodaorSdkWebFeatures.defineIdStackEmbedElement('my-tag')`。

> ⚠️ 全局对象名是 **`RaodaorSdkWebFeatures`**（不是 `RaodaorFeaturesSDK` 之类）。引入 UMD 的核心副作用是「自动注册 `<idstack-embed>` 自定义元素」，它**不要求**你去读取 `window.RaodaorSdkWebFeatures`；只有当你要编程式 `new IdStackEmbed` 时才需要这个全局名。

> ⚠️ **自动注册的前提（务必满足，否则标签不生效）**
> 1. **必须在浏览器环境加载打包产物**（如 `dist/features.umd.js` / `dist/features.umd.min.js` 或 `dist/features.esm.js`）。注册语句位于包入口顶层，引入即执行；`src` 源码直接引入不会注册。
> 2. **自定义元素只在客户端生效**：`defineIdStackEmbedElement` 内部有 `typeof window === 'undefined' || !window.customElements` 守卫，SSR（Next.js / Nuxt 服务端渲染阶段）下不会注册——这是预期行为，标签应仅在浏览器挂载。
> 3. **声明式标签的属性名用连字符**：`webComponent.ts` 读取的是 `app-id`（`getAttribute('app-id')`）、`origin`/`module`/`token`/`locale`/`theme`/`redirect`/`width`/`height` 同理。**不要写成 `app_id`（下划线）**，否则拿不到 `app_id`，看板会落到用户 JWT 通道而 `403 MFA_REQUIRED`。
> 4. **`origin` 填嵌入页真实可访问地址**（如 `https://idstack.raodaor.com` 或 `http://localhost:8081`），不是后端 API 域名（详见「嵌入页握手来源白名单」）。

## 用法二：编程式（IdStackEmbed 类）

```ts
import { IdStackEmbed } from '@isudaji/raodaor-sdk-web-features';

const embed = new IdStackEmbed({
  container: '#box',
  origin: 'https://idstack.raodaor.com',
  module: 'points-mall',        // 或用 path: '/embed/survey/123'
  token: userToken,
  locale: 'zh-CN',
  theme: 'light',
  height: '600px',
  onReady: () => console.log('就绪'),
  onError: (msg) => console.warn(msg),
  onEvent: (evt) => console.log(evt),           // 通用透传
  onPointsChanged: (d) => console.log('积分变动', d.currentBalance),
  onPurchaseSuccess: (d) => console.log('购买成功', d.orderId),
  onClose: (d) => { console.log('用户离开', d.redirect); closeOverlay(); },
});


embed.mount();

// 令牌刷新后热更新
embed.updateToken(newToken);

// 卸载
embed.destroy();
```

## 内置模块

| module | 说明 | 对应路径 |
|--------|------|----------|
| `points-mall` | 积分商城 | `/embed/points-mall` |
| `task` | 任务中心 | `/embed/task` |
| `collection` | 我的收藏 | `/embed/collection` |
| `like` | 我的喜欢 | `/embed/like` |
| `payment-create` | 创建支付 | `/embed/payment/create` |
| `analytics-dashboard` | 数据分析看板（上报数据报表） | `/embed/dashboard` |

需要带参数的页面（如问卷 `/embed/survey/:surveyId`）使用 `path` 传完整路径。

> **`analytics-dashboard`（数据分析看板）鉴权说明（重要）**
>
> 看板展示的是**按 `app_id` 隔离的聚合分析数据**（PV/UV/趋势/维度/实时），不依赖某个具体终端用户的私有数据，因此其读接口采用**应用级鉴权**而非用户级鉴权：
>
> - 服务端 `dashboardAuth` 中间件接受**双通道**：① 合法的用户 JWT（`Authorization: Bearer <token>`，仍受 MFA 校验）；② **应用凭证** `x-app-id`（SDK 自动带上，与事件上报一致）。
> - 应用凭证通道**豁免 MFA**：即使目标 APP 的终端用户未完成 MFA，看板也能正常加载，**不会再出现 `MFA_REQUIRED` 报错**。
> - 因此嵌入看板时**不需要**为目标 APP 用户换取并传递 `token` 参数；只需在 `IdStackEmbed` 初始化时传入 `app_id`（即你的 `IDSTACK_APP_ID`），SDK 会在握手时下发、嵌入页自动以 `x-app-id` 头携带（见上方配置项表）。**若不传 `app_id`，嵌入页会尝试从用户 JWT 兜底，但若该用户未开启 MFA 仍将返回 `403 MFA_REQUIRED`，生产环境务必显式传入 `app_id`。**
> - ⚠️ **「应用凭证通道」= `x-app-id` 请求头，绝不是 OAuth `client_credentials`**：本平台 `/api/v1/oauth/token` **仅支持 `grant_type=authorization_code`**，**不支持 `client_credentials`**，也没有「用 `api_key`/`secret_key` 换短期应用 token 再走看板」的端点。请勿自行构造 `client_credentials` 请求（会收到 `400 UNSUPPORTED_GRANT_TYPE`）。看板的隔离由后端从 `app` 表反查 `api_key`/`secret_key` 与 `app_id` 的对应关系后注入，前端/SDK 只需正确传 `app_id`、让 `x-app-id` 头带上即可。
> - 推荐嵌入形态（完整参数，避免拼错）：`/embed/dashboard?app_id=<APP_UUID>&module=analytics`。`app_id` 用你的 `IDSTACK_APP_ID`，**不要**传终端用户的 `token`。
> - 安全边界：应用凭证通道强制从可信的 `app` 表反查真实的 `tenant_id / user_pool_id / app_id` 注入隔离过滤，绝不信任前端传入的租户归属，跨租户访问仍被 `tenantIsolation` 拦截。

## 配置项（IdStackEmbedOptions）

| 字段 | 必填 | 说明 |
|------|------|------|
| `container` | 是 | 挂载容器，CSS 选择器或 DOM 元素 |
| `origin` | 是 | **IDStack 嵌入页实际可访问的服务源**（即 iframe 最终加载的地址基址，如 `http://localhost:8081` 或 `https://idstack.raodaor.com`），同时用作 postMessage `targetOrigin` 与消息来源校验基址 |
| `module` / `path` | 二选一 | 内置模块名 / 自定义嵌入路径 |
| `token` | 否 | 用户访问令牌（IDStack 签发） |
| `locale` | 否 | `zh-CN` / `en-US` |
| `theme` | 否 | `light` / `dark` |
| `app_id` | **嵌入 `analytics-dashboard` 时必填** | 目标 APP 的应用标识（即 `IDSTACK_APP_ID`）。SDK 在握手时以 `payload.app_id` 下发，嵌入页据此在后续看板请求中携带 `x-app-id` 头，走**应用凭证通道（豁免 MFA）**。缺失会导致看板请求落到用户 JWT 通道、因该用户未完成 MFA 而返回 `403 MFA_REQUIRED`。其他模块（积分商城、任务等）如不需要按 APP 隔离可不传 |
| `externalOrderId` | 用 `payment-create` 时**必填** | 目标 APP 本地订单号（如 cuid）。挂载时透传到嵌入页 URL 的 `externalOrderId` 参数，落库为订单 `external_order_id`，并在 `payment.verified` webhook 以 `externalOrderId` 原样回推。**不传则托管页会生成 `hosted-*` 占位值，无法关联你的本地订单**（订单会停在 PENDING）。同一租户内需唯一 |
| `redirect` | 否 | 回跳 deep link（如 `myapp://pay-result`）。挂载时透传到嵌入页 URL 的 `redirect` 参数，嵌入页 `emitClose` 时原样回传至 `onClose` 的 `data.redirect`，宿主据此关闭嵌入层并跳回目标 APP（用于支付/兑换完成后的闭环） |
| `allowedRoles` | 否 | 管理类模块（`payment-orders` / `payment-verify` / `admin-orders`）的角色白名单，透传为嵌入 URL `roles` 参数。默认 `['system_admin', 'tenant_admin']`（IDStack 租户管理员即"目标 APP 拥有者"的标准映射）；目标 APP 拥有者使用自定义角色（如 OWNER，IDStack 已签发 `owner` 角色）时传 `['owner']`。未命中白名单 → 嵌入页展示"无权访问"占位页 + `onForbidden('no_permission')`。仅决定判定标准，角色由 JWT 保证可信 |
| `width` / `height` | 否 | iframe 尺寸，默认 `100%` / `600px` |
| `onReady` / `onError` / `onEvent` | 否 | 回调（通用） |
| `onPointsChanged` / `onPurchaseSuccess` / `onClose` | 否 | 类型化业务回调（见下） |
| `onForbidden` | 否 | 权限不足回调（管理类模块被非管理员访问 / token 失效），载荷 `{ reason: 'no_permission' \| 'auth_expired', page? }` |
| `onAuthExpired` | 否 | token 失效回调：续签后调 `updateToken(newToken)`，续签失败则 `destroy()` 重建 |

## SSO 单点登录（目标 APP 作为 RP 接入）

> 本节面向**第三方目标 APP 的开发者**：如何通过 IDStack 的标准 OAuth 2.0 授权码流程，让用户用 IDStack 账号登录你的应用（IDStack 作为 IdP / 授权服务器）。
>
> 流程走完后拿到的 `access_token` 就是给本 SDK 的 `token` 参数（见下节「Token 来源说明」）。

**功能**：标准 OAuth 2.0 授权码流程（Authorization Code Grant），供第三方应用实现 SSO 单点登录。

### 正确的接入流程（请照此实现）

```
1. 第三方应用（RP）把用户重定向到 IDStack 的授权端点：
     {IDSTACK_BASE_URL}/oauth/authorize?app_id=<APP_UUID>&redirect_uri=<CALLBACK>&response_type=code&scope=openid+profile+offline_access&state=<RANDOM_STATE>

2. IDStack 前端 OAuthAuthorizeScreen 接收参数，重定向到 LoginScreen（携带所有 OAuth 参数）

3. 用户登录成功后，LoginScreen 自动调用：
     POST {IDSTACK_API_BASE_URL}/api/v1/oauth/authorize
     body: { app_id, redirect_uri, state }
   → 返回 redirect_url（含一次性授权码 code）

4. 浏览器重定向回你的回调地址：
     {CALLBACK}?code=<CODE>&state=<RANDOM_STATE>

5. 第三方应用后端用 code 换取 access_token（后端 → 后端，不在浏览器暴露密钥）：
     POST {IDSTACK_API_BASE_URL}/api/v1/oauth/token
     body: { grant_type: "authorization_code", code, redirect_uri, client_id: <API_KEY>, client_secret: <SECRET_KEY> }
   → { success: true, data: { access_token, token_type: "Bearer", expires_in: 3600, scope, user } }
     ⚠️ access_token 在 data 之下（response.data.access_token），不是顶层字段！详见下方「响应格式说明」
```

### 必读：授权端点参数说明

| 参数 | 取值 | 说明 |
|------|------|------|
| 路径 | **`/oauth/authorize`** | 固定路径。注意不是 `/sso/authorize`（详见下方「常见误用」） |
| `app_id` | 目标应用在 IDStack 的 **UUID**（即 `IDSTACK_APP_ID`） | 授权请求用 **`app_id`**（不是 `client_id`）。登录流程只认 `app_id` 字段 |
| `redirect_uri` | 你的回调地址（须提前在应用 `redirect_uris` 白名单登记） | 必须与第 5 步 `token` 调用时传的一致；未登记会被 `INVALID_REDIRECT_URI` 拒绝 |
| `response_type` | `code` | 固定为授权码模式 |
| `scope` | `openid profile offline_access` | `offline_access` 用于获取 refresh_token |
| `state` | **每次请求重新生成的随机串** | 防 CSRF / 跨用户重放，必须随机且一次性；回调时原样回传供你校验 |

> **`app_id` 与 `client_id` 是两回事，请勿混用**：
> - 授权端点（第 1、3 步）用 **`app_id`** = 应用 UUID。
> - 换 token（第 5 步）用 **`client_id`** = 应用的 `api_key`，`client_secret` = 应用的 `secret_key`。
> 很多接入方把这两处都写成 `client_id`，导致第 1 步参数名错误、登录流程收不到 `app_id` 而失败。

### 正确的 URL 构造方式（动态拼接，不要写死）

`redirect_uri` 与 `state` 必须在**每次登录时动态生成**，因此**不要**把整条授权 URL 当作一个静态配置项（如 `"ssoUrl": "..."`）硬编码。请在运行时拼接：

```ts
// 目标 APP 前端：构造授权 URL（每次生成新的 state）
function buildAuthorizeUrl() {
  const base = process.env.IDSTACK_BASE_URL;        // 如 https://idstack.raodaor.com
  const appId = process.env.IDSTACK_APP_ID;          // 应用 UUID
  const redirectUri = process.env.IDSTACK_REDIRECT_URI; // 须已在应用白名单登记

  // state 必须随机且一次性，用于防 CSRF / 绑定本次会话
  const state = crypto.randomBytes(16).toString('hex');

  const url = new URL(`${base}/oauth/authorize`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile offline_access');
  url.searchParams.set('state', state);

  // 把 state 存到会话（后端或 HttpOnly Cookie），回调时比对
  sessionStorage.setItem('oauth_state', state);
  return url.toString();
}

> **`state` 校验、过期与存储策略（部署必读）**
>
> IDStack 登录页（`/login` 内置 SSO）生成的 `state` 是**由 `SSO_STATE_SECRET` 签名的 JWT**（迁移 P0 起为**必填**，**不再回退 `JWT_SECRET`**），自带时间戳，**无状态、自校验**。这意味着：
> - **默认 TTL 为 10 分钟**（`SSO_STATE_TTL_MS` 环境变量可覆盖，单位毫秒）。用户停留超过 TTL 回来，回调返回 `401 INVALID_STATE`（文案 `State expired`）——这是预期的防重放保护，**请提示用户「请重新点击登录」**。
> - **重启 / HMR / 多实例部署不会丢 state**：因为 state 是自包含的签名串，不依赖进程内存，无需落库 `SsoState` 表，也无需 Redis。如果你自行实现了「内存存储 state」的方案，才会遇到重启/HMR 丢 state 的问题——**直接用 IDStack 的授权跳转、不自己拦截 state 即可规避。**
> - **两种 401 需区分**：① `state` 不存在 / 签名非法 → `401 INVALID_STATE`（消息 `State payload is malformed`）；② `state` 已超 TTL → `401 INVALID_STATE`（消息 `State expired`）。接入方应据此分别提示「请重新发起登录」与「登录超时，请重试」。
> - **`state` 还绑定了用户与 app**：`INVALID_STATE` 也可能是 `State does not match the authenticated user` / `State does not match the requested app`——通常是用错账号或 app 登录导致，不是 TTL 问题。

// 用户点击「使用 IDStack 登录」→ window.location.href = buildAuthorizeUrl();
```

```ts
// 目标 APP 后端：回调里用 code 换 token
// GET {CALLBACK}?code=xxx&state=yyy
app.get('/api/idstack/callback', async (req, res) => {
  const { code, state } = req.query;
  // 1) 校验 state 与发起登录时一致（防 CSRF）
  if (state !== sessionStorage/读取的 state) return res.status(400).send('invalid state');

  // 2) 后端用 code 换 access_token（密钥只在服务端，绝不进浏览器）
  const tokenRes = await fetch(`${IDSTACK_API_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: IDSTACK_REDIRECT_URI,
      client_id: IDSTACK_APP_API_KEY,     // 应用的 api_key
      client_secret: IDSTACK_APP_SECRET_KEY, // 应用的 secret_key
    }),
  }).then((r) => r.json());

  // ⚠️ access_token 在 data 之下，务必按 tokenRes.data.access_token 读取（不是 tokenRes.access_token）
  const { access_token } = tokenRes.data;
  // 3) 把 access_token 交给前端 → 传给 IdStackEmbed 的 token 参数
});
```

### SSO 登录按钮 UI 与 Logo 配置

目标 APP 的登录 / 注册页应提供一个「使用 IDStack 登录 / 注册」入口。点击后跳转到 IDStack 授权页（即上方 `buildAuthorizeUrl()` 的结果）。按钮上建议展示 IDStack 的官方 Logo，保持品牌一致性。

**前端环境变量（Logo 地址）**

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_IDSTACK_LOGO_URL` | SSO 登录入口展示的 IDStack Logo | `https://idstack.raodaor.com/images/logo/icon-128x128.png` |

> 该变量为 Vite 前端构建期环境变量，实际读取写法是 `import.meta.env.VITE_IDSTACK_LOGO_URL`，需在 `.env` / `.env.production` 中配置并重新构建生效。若前端框架非 Vite，按对应方式注入（如 CRA 用 `REACT_APP_` 前缀）。

**按钮示例（React + Vite）**

```tsx
// 读取 Logo 地址（构建期注入的前端环境变量，缺省回退到官方默认地址）
const IDSTACK_LOGO_URL = import.meta.env.VITE_IDSTACK_LOGO_URL
  || 'https://idstack.raodaor.com/images/logo/icon-128x128.png';

function IdStackLoginButton() {
  const handleLogin = () => {
    // 复用上方 buildAuthorizeUrl()：动态拼接授权地址，每次生成新 state
    window.location.href = buildAuthorizeUrl();
  };

  return (
    <button onClick={handleLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <img src={IDSTACK_LOGO_URL} alt="IDStack" width={20} height={20} />
      使用 IDStack 登录 / 注册
    </button>
  );
}
```

**要点**

- Logo 仅作展示，不参与鉴权；真正发起 SSO 的是点击后的 `window.location.href = buildAuthorizeUrl()`（见「正确的 URL 构造方式」）。
- 注册与登录复用同一入口：IDStack 登录页本身支持「新用户自动注册」，因此同一个按钮即可同时服务「登录 / 注册」两种意图，无需拆成两个按钮。
- `VITE_IDSTACK_LOGO_URL` 缺省回退到官方默认地址，本地未配置时也不会出现裂图。

### 响应格式说明（所有 OAuth 端点统一信封）

> **⚠️ 必须遵守（否则必踩坑）**
> 1. **所有业务字段都在 `data` 之下**，顶层只有 `success` 等元信息。直连 HTTP 的目标 APP 必须从 `response.data.xxx` 取值，绝不要读顶层 `response.xxx`（常见报错「未返回 access_token」即源于此）。
> 2. **角色以 JWT `roles` claim 为权威来源**，`data.user.roles` 仅作冗余兜底、可能缺失。判权限/角色一律解码 `access_token` 读 `roles`，不要依赖响应体（详见「角色与权限管理」节开头）。
> 3. **`app_id` 与 `client_id` 是两回事**：授权端点用 `app_id`（应用 UUID），换 token 用 `client_id`=`api_key`（对照表见下）。

IDStack 所有接口（含 OAuth 端点）返回**统一信封**：业务数据在 **`data`** 字段下，顶层只有 `success` 等元信息。**直连 HTTP 的目标 APP 必须从 `response.data.xxx` 取值，而不是顶层 `response.xxx`。**

> 常见报错「未返回 access_token」的根因：代码写了 `resp.access_token`（顶层），而 IDStack 把它放在 `resp.data.access_token`。请改读 `resp.data.access_token`。

**`POST /api/v1/oauth/token` 成功响应：**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "scope": "openid profile offline_access",
    "user": {
      "id": "uuid-of-user",
      "user_name": "alice",
      "email": "alice@example.com",
      "phone": "13800000000",
      "roles": [
        { "role_id": "role-tenant-admin-xxxx", "role_name": "tenant_admin", "tenant_id": "uuid-of-tenant" }
      ]
    }
  }
}
```

**`POST /api/v1/oauth/authorize` 成功响应**（IDStack 前端内部调用，目标 APP 一般不直接调；但同样是 `data` 包裹）：

```json
{
  "success": true,
  "data": {
    "redirect_url": "https://your-app.com/callback?code=abc123&state=xyz",
    "code": "abc123",
    "state": "xyz"
  }
}
```

**`GET /api/v1/oauth/userinfo` 成功响应**（Header 携带 `Authorization: Bearer <access_token>`）：

```json
{
  "success": true,
  "data": {
    "sub": "uuid-of-user",
    "name": "alice",
    "email": "alice@example.com",
    "phone": "13800000000",
    "avatar": "https://.../avatar.png",
    "status": "active"
  }
}
```

**错误响应（统一格式，HTTP 状态码非 2xx）：**

```json
{
  "success": false,
  "error": "redirect_uri mismatch",
  "code": "REDIRECT_URI_MISMATCH"
}
```

`/api/v1/oauth/token` 可能返回的错误 `code`（目标 APP 建议按此分支排查，不要笼统提示「授权码无效」）：

| `code` | HTTP | 含义 / 排查方向 |
|--------|------|-----------------|
| `INVALID_PARAMS` | 400 | 缺少 `grant_type`/`code`/`redirect_uri`/`client_id`/`client_secret` 之一 |
| `UNSUPPORTED_GRANT_TYPE` | 400 | `grant_type` 不是 `authorization_code` |
| `INVALID_CLIENT` | 401 | `client_id`/`client_secret` 不匹配（须为该 app 的 `api_key`/`secret_key`） |
| `INVALID_CODE` | 400 | 授权码不存在（可能取错字段或已被别处消费） |
| `CODE_ALREADY_USED` | 400 | 授权码已用过（一次性，勿重复换取） |
| `CODE_EXPIRED` | 400 | 授权码超 10 分钟过期，需重新发起登录 |
| `REDIRECT_URI_MISMATCH` | 400 | 换 token 的 `redirect_uri` 与发起授权时**不字节级一致** |
| `APP_MISMATCH` | 400 | `client_id` 对应的 app 与发码的 app 不是同一个 |

> 提示：成功响应目前不含 `code`/`message` 字段，仅 `success` + `data`；解析时以 `success === true` 判断成功，再读 `data`。

### 令牌续签（refresh_token）契约

IDStack 的 `access_token` 有过期时间（默认 `expires_in` 见上），过期后须用 `refresh_token` 续签。**契约如下，接入方请按此实现，不要凭猜测：**

- **`refresh_token` 在 `scope` 含 `offline_access` 时一定会返回**，字段位于 **`data.refresh_token`**（不是 `data.access_token.refresh_token`，也不是顶层）。上面的授权 URL 示例已带 `scope=openid profile offline_access`，因此正常换 token 必得 `refresh_token`。
- **续签请求**：`POST /api/v1/oauth/token`，`grant_type=refresh_token`，`refresh_token=<data.refresh_token>`，并以该 app 的 `client_id`（`api_key`）/ `client_secret`（`secret_key`）做客户端认证（与换码一致）。响应结构与首次换码相同（`data.access_token` / `data.refresh_token` / `data.expires_in`）。
- **`refresh_token` 会旋转（rotate）**：每次续签回包都会下发**新的** `refresh_token`，旧值作废。接入方**必须以回包中的新 `refresh_token` 覆盖本地存储的旧值**，否则下次续签会因旧码失效而失败。
- **应用凭证 token（`x-app-id` 看板通道）无需续签**：看板读接口走 `x-app-id` 应用凭证通道（非 OAuth token），没有 token 过期问题，也就不存在 refresh 流程。需要续签的只有「用户级 `access_token`」（用于积分商城、任务等需要用户身份的嵌入模块）。
- 续签失败（如 `INVALID_GRANT` / `refresh_token` 已旋转失效）时，应引导用户重新走 SSO 登录换取全新令牌，不要无限重试旧 `refresh_token`。

> 说明：`refresh_token` 续签端点同样遵循「统一信封 + `data` 包裹」与上方错误码表（`UNSUPPORTED_GRANT_TYPE` / `INVALID_CLIENT` 等同样适用）。

### 错误码字典（集中查阅）

为避免接入方把各类错误笼统提示为「授权失败」，下表按**授权 / 换 token / 看板**三组列出全部 `code`、HTTP 状态、含义与排查方向。所有错误响应均为统一信封 `{ success:false, error, code }`。

**① 授权跳转 / SSO state**

| `code` | HTTP | 含义 / 排查方向 |
|--------|------|-----------------|
| `INVALID_STATE` | 401 | state 非法/过期/不匹配。细分：`State payload is malformed`（签名非法或不存在，多为自实现内存方案丢 state）→ 改用 IDStack 签名 state；`State expired`（超过 `SSO_STATE_TTL_MS`，默认 10 分钟）→ 提示用户重新发起登录；`State does not match the authenticated user/app` → 用错账号或 app 登录，非 TTL 问题 |

**② 换 token（`/oauth/token`）**

| `code` | HTTP | 含义 / 排查方向 |
|--------|------|-----------------|
| `INVALID_PARAMS` | 400 | 缺少 `grant_type`/`code`/`redirect_uri`/`client_id`/`client_secret` 之一 |
| `UNSUPPORTED_GRANT_TYPE` | 400 | `grant_type` 不是 `authorization_code`（本平台**不支持 `client_credentials`**） |
| `INVALID_CLIENT` | 401 | `client_id`/`client_secret` 不匹配（须为该 app 的 `api_key`/`secret_key`） |
| `INVALID_CODE` | 400 | 授权码不存在（可能取错字段或已被别处消费） |
| `CODE_ALREADY_USED` | 400 | 授权码已用过（一次性，勿重复换取） |
| `CODE_EXPIRED` | 400 | 授权码超 10 分钟过期，需重新发起登录 |
| `REDIRECT_URI_MISMATCH` | 400 | 换 token 的 `redirect_uri` 与发起授权时**不字节级一致**（大小写/尾斜杠/端口都要一致） |
| `APP_MISMATCH` | 400 | `client_id` 对应的 app 与发码的 app 不是同一个 |

**③ 看板（`/analytics/dashboard/*`）**

| `code` | HTTP | 含义 / 排查方向 |
|--------|------|-----------------|
| `MFA_REQUIRED` | 401/403 | 看板走了用户 JWT 通道但该用户 `mfaVerified=false`。**根因：嵌入未传 `app_id`**。修正：在 `IdStackEmbed` 初始化显式传 `app_id`，或嵌入 URL 带 `?app_id=xxx`，使请求走 `x-app-id` 应用凭证通道（豁免 MFA） |
| `MISSING_TENANT` | 401 | JWT 缺 `tenant_id`（token 非 IDStack 合法用户令牌）。检查传的是否是 IDStack 签发的 token |
| `INVALID_APP` | 401 | `x-app-id` 对应的 app 不存在或 `status` 非 `active`。在后台确认 app 已激活 |

> 排查顺序建议：先看 HTTP 状态与 `code` 定位大组（授权/换token/看板），再按「排查方向」逐条核对参数名、字节级一致性、是否漏传 `app_id`。

### 目标 APP 如何判断租户管理员 / 同步身份与角色

SSO 登录后，目标 APP 往往需要知道「当前登录人是谁、是不是该租户的管理员」，以便决定要不要开放自身的系统管理能力（如后台入口、管理接口鉴权）。IDStack 已在登录/换 token 时把用户角色写入返回体与 JWT，接入方**无需自建角色表，也无需再调额外接口**。

> 「无需自建角色表」成立的前提是：**IDStack 后台已为租户管理员提供给用户分配角色的能力**——包括 `teacher` / `parent` / `student` 等业务角色。这些角色由租户在 IDStack 中创建（`POST /api/v1/roles`，可带 `app_id` 做成应用级角色）并分配给用户（`POST /api/v1/admin/users/roles`），目标 APP 只消费 JWT 中的 `roles[]`，详见下方「角色与权限管理 API」。

**roles 字段结构**（出现在 `data.user.roles` 与 `access_token` 的 JWT payload 中）：

```json
[
  { "role_id": "role-tenant-admin-xxxx", "role_name": "tenant_admin", "tenant_id": "uuid-of-tenant" }
]
```

- `role_name`：角色标识。基础平台角色取值 `system_admin` / `tenant_admin` / `platform_user`；此外各租户可按自身业务自定义**业务角色**（如教育类租户常用的 `teacher` 教师 / `parent` 家长 / `student` 学生）。业务角色不是固定枚举，由租户管理员在 IDStack 后台创建与管理（见下方「角色与权限管理 API」一节）。接入方**不应硬编码**角色名，而应在运行时从 `GET /api/v1/roles` 拉取本租户可用角色。
- `tenant_id`：该角色所属的租户；**判租户管理员时必须连同 `tenant_id` 一起比对**，避免跨租户误判

> **⚠️ 角色以 JWT `roles` claim 为准（权威且安全）**
>
> - **唯一可信来源是 `access_token`（JWT）里的 `roles` claim**，不是响应体 `data.user.roles`。
> - JWT 由 IDStack 服务端用密钥（HS256）签名，**不可伪造、不可篡改**，是服务端下发的权威身份声明；`data.user.roles` 只是**冗余方便字段**。
> - **`data.user.roles` 可能在某些端点 / 部署下缺失**（例如 SSO 回调 `POST /api/v1/sso/callback` 的某些版本仅返回 `id/user_name/email/phone`，不含 `roles`）。一旦缺失，读取它的代码会拿到 `undefined/[]`，被误映射为默认最小权限（如 `PLAYER`）——**这正是多个目标 APP「IDStack 没同步角色」的根因**。
> - **正确做法**：优先解码 `access_token` 读取 `roles`（见「方式一（推荐）」）；`data.user.roles` 仅作冗余兜底，绝不作为唯一依据。

**方式一（推荐）：解码 `access_token` JWT 读取 `roles`**

`access_token` 的 payload 直接包含 `roles`，是权威来源，无需额外网络请求。敏感鉴权务必先验签：

```ts
import { jwtVerify, createRemoteJWKSet } from 'jose';
// 用 JWKS 公钥验签（RS256）后读取——唯一权威来源（迁移后不再共享 JWT_SECRET）
const JWKS = createRemoteJWKSet(
  new URL(process.env.IDSTACK_JWKS_URI ?? 'https://idstack.raodaor.com/.well-known/jwks.json'),
);
const { payload } = await jwtVerify(access_token, JWKS, {
  algorithms: ['RS256'],
  issuer: process.env.IDSTACK_ISSUER ?? 'https://idstack.raodaor.com',
});

// ⚠️ 用户主键 claim 名是 `id`，**不是** OIDC 标准的 `sub`（详见下方「⚠️ 注意事项」第 5 条）
const idstackUserId = payload.id as string;   // = 目标 APP 侧的 idstackUserId
const roles = (payload.roles ?? []) as Array<{ role_name: string; tenant_id: string; app_id: string }>;

const MY_TENANT_ID = process.env.IDSTACK_TENANT_ID!;
const isTenantAdmin = roles.some(r => r.role_name === 'tenant_admin' && r.tenant_id === MY_TENANT_ID);
const isSystemAdmin = roles.some(r => r.role_name === 'system_admin');

// 据此决定目标 APP 自身的系统管理能力鉴权
if (isTenantAdmin) enableAdminConsole();
```

**方式二（便利，但不保证存在）：换 token 响应里的 `data.user.roles`**

第 5 步 `POST /api/v1/oauth/token` 的成功响应里，`data.user` **通常**携带 `roles`（见上方响应示例），但**并非所有端点 / 部署都返回**（见上方警告）。仅在你已确认该端点返回 `roles` 时可用作参考，且**必须与 JWT 中的 `roles` 保持一致**：

```ts
// 目标 APP 后端：回调用法（仅作冗余，主判定仍以 JWT 为准）
const { access_token, user } = tokenRes.data;
const rolesFromResponse = user?.roles ?? [];   // ⚠️ 可能为空数组，勿据此单独决策
```

> 若 `data.user.roles` 缺失 / 与你从 JWT 解出的 `roles` 不一致，**一律以 JWT 为准**。

**方式三：仅持有 `access_token` 的纯前端解码（不验签，仅用于展示/路由）**

若登录后只保存了 `access_token`（如嵌入页用法），可 base64 解码 payload 取 `roles`，但**仅可用于展示 / 路由**，**不可单独用于敏感鉴权决策**：

```ts
// 仅解码 payload（base64），不验签——仅可用于展示/路由，不可单独用于敏感鉴权决策
const payload = JSON.parse(atob(access_token.split('.')[1]));
const isTenantAdmin = (payload.roles ?? []).some(
  (r: any) => r.role_name === 'tenant_admin' && r.tenant_id === MY_TENANT_ID
);

// 若要把 roles 用于敏感的管理接口鉴权，务必先验签（JWKS 公钥 RS256，见方式一）
```

**`tenant_admin` 与目标 APP 自身管理能力的映射**

IDStack 的 `tenant_admin` 表示该用户是**对应租户**（由 `roles[].tenant_id` 指定）的管理员。由于目标 APP 本身就是该租户下的一个应用，二者天然对应：**当用户在某个 `tenant_admin` 角色上的 `tenant_id` 与目标 APP 所属租户一致时，即可认定其为「目标 APP 的超级管理员」，开放后台、管理接口等系统管理能力。** 无需再为用户在目标 APP 侧单独建管理员表——IDStack 的角色体系即权威来源。

### JWKS 公钥验签配置（迁移后：RS256，不再共享 JWT_SECRET）

目标 APP 要做**安全验签**（而不是只 `atob` 解码），只需拉取 IDStack 发布的**公钥**（JWKS），配置在**目标 APP 自己的后端**环境变量里：

```bash
# 目标 APP 的 .env.development 与 .env.production
IDSTACK_JWKS_URI=https://idstack.raodaor.com/.well-known/jwks.json   # 可选，缺省由 IDSTACK_API_BASE_URL 推导
IDSTACK_ISSUER=https://idstack.raodaor.com                            # 可选，缺省默认
```

**验签材料是「公钥」，不是「密钥」**：目标 APP 只需拉取 `/.well-known/jwks.json` 里的 RSA 公钥即可验签，**无需也不应再持有任何共享密钥**。验签时**钉死 `algorithms:['RS256']`** 并校验 `iss`（防 RS256→HS256 算法混淆）。

> **🚨 安全红线（务必遵守）**
>
> - **验签只能放在目标 APP 的【后端】**（Node/服务端读取）。前端**绝不**做权限决策，也不持有任何验签材料。
> - **前端（RN / Web）只做 base64 解码、不验签**，用于展示/路由即可（如本仓库 `client` 管理后台的 `decodeJwtPayload`），敏感鉴权一律交给后端验签后的结论，**前端不该信任本地解码结果做权限决策**。
> - 若目标 APP 没有后端（纯前端 SPA），则**不要在客户端验签**，改为：在你自己的后端服务（API 网关 / BFF）拉 JWKS 验签并下发放行结论，前端只消费后端已验证过的角色。

**⚠️ 注意事项（务必阅读）**

1. **`GET /api/v1/oauth/userinfo` 不返回 `roles`**（仅 `sub/name/email/phone/avatar/status`）。需要角色时请用方式一/二，不要依赖 userinfo。
2. **角色在登录换 token 时固化进 JWT，之后变更不会自动生效**：若租户管理员在 IDStack 后台调整了某用户的角色（如把家长改为教师），目标 APP 必须等该用户重新走一次 SSO 换 token（拿到新 `access_token`）才能感知。为缩短生效延迟，IDStack 在角色变更时会触发实时事件 `user.role_changed`（见 `POST /api/v1/admin/users/roles` 说明）并可经应用配置的 `webhook_url` 推送；目标 APP 订阅该事件后即可**主动提示用户重新登录 / 重新获取 token**，而无需被动等待用户自行登出。
3. **鉴权决策必须验签**：方式三中若只 `atob` 解码而不验签，token 可能被伪造，绝不能据此开放管理接口。敏感场景请用 JWKS 公钥（RS256）先验签再读 `roles`（即方式一的写法）。**验签仅由目标 APP 的【后端】完成**，详见上方「JWKS 公钥验签配置」。
4. **`tenant_id` 必须参与比对**：`tenant_admin` 是"某租户"的管理员，跨租户不能复用；务必用 `r.tenant_id === 本租户ID` 收口。
5. **JWT 内的用户主键 claim 名是 `id`，不是 OIDC 标准的 `sub`**：`generateToken()` 签发的 payload 为 `{ id, user_name, email, tenant_id, user_pool_id, app_id, status, roles, permissions, mfaVerified, scope }`。**`sub` 只出现在 `GET /api/v1/oauth/userinfo` 的响应体里**（值同为 `user.id`），**JWT 内不存在**——按 OIDC 惯例读 `payload.sub` 会拿到 `undefined`，表现为「用户主键为空」而导致登录直接失败（真实案例：某目标 APP 因读 `claims.sub` 报 `9004 JWT 缺少 sub`，所有 SSO 登录 100% 失败）。同理，**展示名读 `user_name`**（不是 `name` / `nickname` / `preferred_username`）。

### 常见误用（请勿这样做）

| 误用 | 为什么错 | 正确做法 |
|------|----------|----------|
| 把整条授权 URL 写成静态配置 `"ssoUrl": "https://idstack.raodaor.com/sso/authorize?client_id=xxx&redirect_uri=xxx&state=xxx"` | ① `state` 写死就失去防 CSRF 作用；② `app_id`/`redirect_uri` 写死后无法按环境切换，极易被其它会话的残留值污染、错位（见下方案例）；③ 路径与参数名都错 | 用上方 `buildAuthorizeUrl()` 在运行时动态拼接，每次生成新 `state` |
| 用 `/sso/authorize` 作为授权端点 | `/sso/*` 是 **IDStack 出站 SSO**（IDStack 作为 SP 去对接外部 IdP）的服务端接口，**没有** `/sso/authorize` 这个前端授权页；客户端深链也未注册该路径，会导致参数解析不到、登录后回退到错误应用 | 使用 **`/oauth/authorize`** |
| 授权端点用 `client_id=xxx` 而非 `app_id=xxx` | 登录流程（`LoginScreen`）只读取 `app_id` 字段触发 OAuth 分支；传入 `client_id` 时会被忽略，登录后直接跳首页、拿不到授权码 | 授权端点用 **`app_id`** = 应用 UUID；`client_id` 仅用于第 5 步换 token（= `api_key`） |
| `redirect_uri` 未在应用白名单登记 | 服务端 `oauth/authorize` 会校验 `redirect_uri` 必须在应用的 `redirect_uris` 白名单内，否则返回 `INVALID_REDIRECT_URI` | 在 IDStack 应用配置里预先登记回调地址 |
| 浏览器端直接拿 `client_secret` 换 token | 密钥会暴露在前端代码/网络里 | 换 token 必须走**后端 → 后端**调用 |
| 从顶层读 `resp.access_token`（导致「未返回 access_token」） | IDStack 统一信封把数据放在 `data` 下，顶层无 `access_token` | 读 **`resp.data.access_token`**；先判 `resp.success === true` 再取 `data`（见「响应格式说明」） |
| 用响应体 `data.user.roles` 作为角色**唯一**来源 | SSO 回调等端点可能根本不返回 `roles`，代码读到 `[]` 被误映射为默认最小权限（如 `PLAYER`），表现为「IDStack 没同步角色」 | **角色以 JWT `roles` claim 为准**：解码 `access_token` 读取（见上方「角色以 JWT roles claim 为准」），`data.user.roles` 仅作冗余兜底 |
| 读 **`payload.sub`** 作为 JWT 里的用户主键（OIDC 惯例） | IDStack 的 JWT **没有 `sub` claim**（用户主键叫 `id`），`sub` 只出现在 `GET /api/v1/oauth/userinfo` 的**响应体**里；读取结果为 `undefined`，导致「用户主键为空」的登录失败（如报 `9004 IDStack JWT 缺少 sub`，SSO 100% 无法登录）。另注意展示名是 `user_name`，读 `name`/`nickname` 会永远走兜底昵称 | 读 **`payload.id`**（= 目标 APP 侧的 `idstackUserId`，与 webhook 事件载荷的 `userId` 同源）；展示名读 `user_name`（见上方「⚠️ 注意事项」第 5 条） |

> **真实踩坑案例**：某目标 APP 把 `ssoUrl` 写成静态串，且使用了错误的 `/sso/authorize?client_id=...`。由于该路径未被前端深链识别，OAuth 参数没有传入登录页，登录页便复用了浏览器 `AsyncStorage` 里上一次（另一个 embed 应用）留下的 `app_id`/`redirect_uri`，结果地址栏变成了 `/login?app_id=<embed 的 app>&redirect_uri=<embed 的 5101 回调>`，授权码发到了错误的应用。**动态构造 + 正确路径/参数名** 可彻底避免这类错位。

## 角色与权限管理 API（目标 APP 作为租户管理员调用）

SSO 登录后，目标 APP 拿到的是**用户令牌**（JWT）。除了在登录时读取 `roles` 判断租户管理员（见上节「目标 APP 如何判断租户管理员」），目标 APP 还经常需要在**运行时查询 / 分配用户角色、校验权限**——例如为在本 App 注册的用户分配 `platform_user`、在自有后台展示「该用户有哪些角色、能否访问某管理功能」。IDStack 提供了一组标准角色与权限接口，目标 APP 用 `tenant_admin` 身份调用即可，**无需自建角色 / 权限表**。

### 当前用户的角色从哪来（没有「我的角色」接口）

IDStack **没有**独立的「获取当前登录用户角色」接口。角色在登录 / 注册换 token 时由 `generateToken` 直接写入 JWT 的 `roles[]`，且 `/auth/profile` 仅返回用户表字段（不含角色）。因此：

- 想知道「当前用户是谁、有什么角色」→ **解析 JWT payload 的 `roles[]`**（见上节方式一 / 二）。
- 登录时角色按当前 `app_id` 收敛：仅下发「当前应用分配 + 租户级分配（空串）」的角色，避免跨应用角色泄漏。

`roles[]` 中每项的完整结构：

```json
{ "role_id": "role-tenant-admin-xxxx", "role_name": "tenant_admin", "tenant_id": "uuid-of-tenant", "app_id": "" }
```

- `role_name`：角色标识。平台内置角色：`system_admin`（系统管理员）/ `tenant_admin`（租户管理员）/ `platform_user`（平台用户）/ `provider_admin`（接入方管理员）。**业务角色由各租户自定义**，例如教育类租户常用的 `teacher`（教师）、`parent`（家长）、`student`（学生）——它们与平台角色结构完全相同，只是 `role_name` 由租户管理员建角色时自行命名。分配 / 判断时一律以运行时数据为准，不要假定固定集合。
- `tenant_id`：该角色所属租户；判租户管理员必须连同 `tenant_id` 比对
- `app_id`：空串 `''` 表示「**租户级**」（对该租户下所有应用生效）；非空表示该角色是「**应用级**」分配（仅指定 app 生效）

**业务角色示例（teacher / parent / student）**

| `role_name` | 含义 | 通常分配给 | 分配方式 |
|-------------|------|-----------|----------|
| `teacher` | 教师，可在本 App 进行教学 / 管理类操作 | 教师用户 | 租户管理员在 IDStack 后台（或 `POST /api/v1/admin/users/roles`）分配；可指定 `appId` 仅限某应用生效 |
| `parent` | 家长，可查看 / 管理关联学生 | 家长用户 | 同上 |
| `student` | 学生，普通学习用户 | 学生用户 | 同上 |

这些角色由租户先在 IDStack 通过 `POST /api/v1/roles` 创建（可带 `app_id` 做成**应用级角色**），再通过分配接口挂到具体用户。目标 APP 拿到的 JWT `roles[]` 会带上对应的 `role_name` 与 `app_id`，按下方「基于 `app_id` 收敛」原则过滤即可正确区分。

### 角色 / 权限相关接口一览

| 方法 & 路径 | 说明 | 鉴权 |
|------|------|------|
| `GET /api/v1/admin/users/:userId/roles` | 查某用户在指定 APP / 租户下的角色 | Bearer JWT；租户管理员仅本租户 |
| `POST /api/v1/admin/users/roles` | 给用户分配角色（如 `platform_user`） | 同上 |
| `DELETE /api/v1/admin/users/:userId/roles/:roleId?appId=` | 按维度移除用户角色 | 同上 |
| `GET /api/v1/admin/roles` | 本租户可分配角色（含权限清单） | 同上 |
| `GET /api/v1/roles` | 全部角色（含 `permissions` id 列表） | Bearer JWT + `role:read` 权限点（租户管理员 / 系统管理员默认可用；自定义或业务角色需由租户管理员绑定该权限点） |
| `GET /api/v1/permissions?scope=` | 权限清单，可按 `scope` 过滤 | Bearer JWT + `permission:read` 权限点（租户管理员 / 系统管理员默认可用；自定义或业务角色需绑定该权限点） |

> ⚠️ **安全约束（已实现）**：
> - 角色管理路由 `POST / PUT / DELETE /api/v1/roles` 在**路由层即要求 `requirePermission('role:manage')`**（租户管理员 / 系统管理员可通过，普通 `platform_user` 直接 403）。
> - `GET /api/v1/roles` 要求 `role:read`（租户管理员 / 系统管理员默认放行，其它角色需显式绑定该权限点）；数据仍按 JWT 可信 `tenant_id` 隔离（租户管理员仅见本租户角色，系统管理员见全部）。
> - 若目标 APP 需要用**终端用户** token 拉取「角色 → 权限」映射，请让租户管理员在 IDStack 后台为该业务角色绑定 `role:read`；否则会返回 403 `no_permission`。
> - 权限路由 `POST / PUT / DELETE /api/v1/permissions` 在**路由层即要求 `requireSystemAdmin`**（仅系统管理员可维护平台级权限定义）。
> - `GET /api/v1/permissions` 要求 `permission:read`（租户管理员 / 系统管理员默认放行，其它角色需显式绑定该权限点）。若目标 APP 需以终端用户 token 解析权限码，请让租户管理员为该业务角色绑定 `permission:read`。
> - 创建 / 修改角色时，`app_id` 由服务端校验归属当前租户，请求体中的 `tenant_id` / `user_pool_id` / `app_id` 一律不信任（可信来源仅 JWT）。
> - 因此务必只让 `tenant_admin` / `system_admin` 身份调用管理类接口。
>
> `tenant_admin` 仅能操作**本租户**的用户与角色；`system_admin` 可操作全平台。

### 查询某用户角色

```http
GET /api/v1/admin/users/{userId}/roles
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "success": true,
  "data": {
    "user_id": "uuid-of-user",
    "tenant_id": "uuid-of-tenant",
    "user_name": "alice",
    "roles": [
      { "role_id": "role-platform-user-xxxx", "role_name": "platform_user", "tenant_id": "uuid-of-tenant", "app_id": "" }
    ]
  }
}
```

`userId` 即 IDStack 用户主键（目标 APP 也称 `idstackUserId`）。

### 分配 / 移除角色

**分配**（如在目标 APP 注册成功后，确保用户持有 `platform_user`）：

```http
POST /api/v1/admin/users/roles
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{ "userId": "uuid-of-user", "roleId": "role-platform-user-xxxx", "appId": "" }
```

- `appId` 留空 / 不传 = **租户级**（对该租户下所有应用生效）；传具体 app id = **应用级**（仅该 app 生效）。
- 成功返回 `{ success: true, data: { user_id, roles: [...] } }`，并触发实时事件 `user.role_changed`（目标 APP 若订阅事件总线可即时刷新前端权限态）。

**移除**（精确维度）：

```http
DELETE /api/v1/admin/users/{userId}/roles/{roleId}?appId=
Authorization: Bearer <ACCESS_TOKEN>
```

- `appId` 查询参数精确匹配：`''` 移除租户级；传具体 app id 移除该应用级；不传则移除该角色**全部维度**。

> 复合主键 `(user_id, role_id, app_id)` 决定了「同一用户对同一角色」在租户级与应用级可分别持有、互不影响。目标 APP 通常只需关心本 app 或本租户级角色。

### 如何校验「某用户是否拥有某权限」

权限（`permission`）模型字段：`permission_name`（唯一权限码）、`description`、`scope`（`system` / `tenant` / `user`，默认 `user`）。角色与权限是多对多，经 `role_permission` 中间表维护（**不是** `user_role` 直接带权限）。

推荐两条链路：

- **轻量（前端 / 边缘鉴权）**：解析用户 JWT 的 `roles[]`，本地比对你们缓存的「角色 → 权限」映射。映射可一次性由 `GET /api/v1/roles` 拉取并缓存（响应里的 `permissions` 是权限 id 列表）。
- **完整（服务端权威校验）**：
  1. `GET /api/v1/admin/users/:userId/roles` 取角色；
  2. `GET /api/v1/roles` 取每个角色对应的 `permissions`（权限 id）；
  3. `GET /api/v1/permissions?scope=` 解析 `permission_name` / `scope`，得到可读权限码。

```ts
// 目标 APP 服务端：基于 JWT 角色做能力门控（示例）
const MY_APP_ID = process.env.IDSTACK_APP_ID!;
// 务必先验签（JWKS 公钥 RS256，见「方式一（推荐）」）
const { payload } = await jwtVerify(access_token, JWKS, { algorithms: ['RS256'] });

// ⚠️ 仅采纳「租户级（app_id 空串）」或「本应用级（app_id === 本App）」的角色，
//    过滤掉用户在其他 APP 的角色，避免「A 应用是教师、B 应用是家长」时误判。
const roles = (payload.roles ?? []).filter(
  (r: any) => r.app_id === '' || r.app_id === MY_APP_ID
);

const isTenantAdmin = roles.some(
  (r: any) => r.role_name === 'tenant_admin' && r.tenant_id === MY_TENANT_ID
);

// 把角色映射到自有业务权限（从 GET /api/v1/roles 缓存得到 permission_name 列表）
const roleNames = roles.map((r: any) => r.role_name);
const allowed = new Set(rolePermissionCache[roleNames[0]] ?? []);
if (allowed.has('order:refund')) { /* 允许退款 */ }
```

### 给目标 APP 的接入建议（小结）

1. **鉴权决策以 JWT `roles[]` 为准，且仅在登录换 token 时刷新**——角色在 IDStack 后台被改后，目标 APP 需等用户重新 SSO（拿新 `access_token`）才能感知；可结合 `user.role_changed` 实时事件提示用户重新登录。
2. **不要自建管理员表**：以 `tenant_admin` + `tenant_id === 本租户` 作为「目标 APP 超级管理员」的权威判定，IDStack 角色体系即唯一来源。
3. **需要给用户在本 App 分配 / 撤销角色**，直接调 `POST /api/v1/admin/users/roles` / `DELETE .../roles/:roleId`，无需目标 APP 维护用户-角色关系。
4. **权限码**以 `permission_name` 为准（如 `user:read`、`order:write`），`scope` 标示作用域；敏感功能建议服务端用 `GET /api/v1/roles` + `GET /api/v1/permissions` 实时解析，而非仅前端硬编码。
5. **验签仅在目标 APP 后端**：敏感验签拉 JWKS 公钥（RS256，钉死算法 + 校验 `iss`），**前端不做权限决策**；纯前端无后端时不要在客户端验签，改由你自己的后端/BFF 拉 JWKS 验签后下发结论（见上方「JWKS 公钥验签配置」）。

## Token 来源说明（SSO 登录后直接用 `access_token`）

SDK 的 `token` 参数就是 **IDStack 签发的用户访问令牌（access_token）**，无需单独再申请。

**关键点**：只要目标 APP 通过 **IDStack 自身的 SSO / OAuth 流程**登录，回调返回的 `access_token` 就是它。嵌入页拿到 token 后会写入本地存储，并用它调用 IDStack 后端的功能接口（积分商城、任务中心等），因此 token 必须是 IDStack 后端能验过的 JWT——而 SSO/OAuth 签发的正是这种 token（含 `tenant_id` / `user_pool_id` / `app_id` / `roles`，由 IDStack 私钥 RS256 签名、消费方用 JWKS 公钥验签）。

| 目标 APP 的登录方式 | 该 JWT 能否直接给 SDK？ |
|------|------|
| 通过 **IDStack 的 SSO / OAuth** 登录（IDStack 即 IdP） | ✅ 能，就是用户令牌 |
| 用第三方 IdP（微信/企业微信/自研 SSO 等）登录，再经 IDStack 桥接 | ✅ 能——IDStack 内部用第三方 token 换到用户身份后，**重新签发 IDStack JWT** 返回给你（第三方 token 只在 IDStack 服务端内部使用，不会返给目标 APP） |
| 与 IDStack 无关的纯第三方 IdP 登录，且不经 IDStack 桥接 | ❌ 不能——第三方 JWT 用别的密钥签发，IDStack 验不过，必须先走 IDStack 桥接换成 IDStack JWT |

> 注意：`access_token` 默认 `expires_in: 3600`（1 小时）。过期前请用 `embed.updateToken(newToken)` 热更新，避免嵌入页接口 401。

### SSO 集成示例

目标 APP 完成 IDStack SSO/OAuth 登录后，把后端返回的 `access_token` 传给 SDK 即可（token 走 postMessage 握手，**绝不进 URL**）。

```ts
// 1. 目标 APP 后端完成 IDStack SSO / OAuth，拿到 access_token
//    POST /api/v1/oauth/token   → { data: { access_token, expires_in } }
//    或  POST /api/v1/sso/callback → { data: { access_token, expires_in } }
//    （这两个接口返回的 access_token 均为 IDStack 签发的用户令牌）

// 2. 前端从自己的会话/接口取出 token，传给 SDK
import { IdStackEmbed } from '@isudaji/raodaor-sdk-web-features';

let embed: IdStackEmbed | null = null;

function mountFeature(userToken: string) {
  if (embed) embed.destroy();
  embed = new IdStackEmbed({
    container: '#box',
    origin: 'https://idstack.raodaor.com', // IDStack 服务源
    module: 'points-mall',                  // 要嵌入的功能
    token: userToken,                        // ← 直接用 SSO 登录拿到的 access_token
    locale: 'zh-CN',
    height: '600px',
    onReady: () => console.log('嵌入鉴权成功'),
    onError: (msg) => console.warn('鉴权失败', msg),
    onPointsChanged: (d) => console.log('积分变动', d.currentBalance),
  });
  embed.mount();
}

// SSO 登录成功后调用
const { access_token } = await fetch('/api/your-sso-callback').then((r) => r.json());
mountFeature(access_token);

// 令牌临近过期时刷新（如 access_token 续期接口返回 newToken）
// embed.updateToken(newToken);
```

声明式等价写法（`access_token` 来自目标 APP 自身的前端状态即可）：

```html
<idstack-embed
  origin="https://idstack.raodaor.com"
  module="points-mall"
  token="__ACCESS_TOKEN_FROM_SSO__"
  locale="zh-CN"
  theme="light"
  height="600px"
></idstack-embed>
```

> 域名白名单（前端侧变量）：嵌入页只接受白名单来源发来的鉴权握手。`EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS` 是 **IDStack 客户端（前端）** 的环境变量（逗号分隔，如 `https://app.example.com,http://localhost:3000`），须配置在 IDStack 客户端的 `.env` / `.env.development` 中，**修改后需重启前端 dev server 才生效**。若目标 APP 与 IDStack 同域，可复用登录会话，连 token 都不用传。注意：这个白名单与下方「服务端 CORS 白名单」是两件事——前者管"谁能与嵌入页握手"，后者管"谁的跨域请求能打到后端 API"，联调时两者都要配到位。

### 本地联调 CORS 白名单配置（服务端侧）

嵌入页本身由 IDStack 托管、只与 IDStack 后端同源交互时无需额外配置；但**当嵌入页运行在宿主页的源（如本地 `localhost:8081`）、并跨域调用 IDStack 后端接口（如支付下单 `POST /api/v1/payment/orders`）时，IDStack 服务端必须允许该来源，否则浏览器预检被拒，请求表现为"无响应"**。

IDStack 后端（`server`）的 CORS 白名单由环境变量控制，满足以下任一即放行：

| 条件 | 变量 / 规则 |
|------|------------|
| 精确匹配主源 | `CORS_ORIGIN`（开发期通常为 `http://localhost:8081`，生产为 `https://idstack.raodaor.com`） |
| 追加可信来源 | `CORS_ALLOW_ORIGINS`（逗号分隔，如 `https://app.example.com,http://localhost:3000`） |
| 子域通配 | `*.raodaor.com`（含任意端口） |
| 本地联调 | `localhost` / `127.0.0.1`（任意端口，**开发期默认放行，无需配置**） |

```bash
# server/.env.development 或 .env.production
# 开发期 localhost / 127.0.0.1 已默认放行，无需改动
CORS_ORIGIN=http://localhost:8081
# 接入方联调/生产追加域名时，用下面这个：
# CORS_ALLOW_ORIGINS=https://app.example.com,http://localhost:3000
```

**排查清单（接口"无响应"时）**：

1. 打开浏览器 DevTools → Console：若报 `blocked by CORS policy`、Network 中该请求状态 `(failed) net::ERR_FAILED` → 即 CORS 预检被拒。
2. 确认 IDStack 后端实际加载的环境：开发期 `.env.development` 的 `CORS_ORIGIN=http://localhost:8081`，若后端误以 production 启动则 `CORS_ORIGIN` 变为 `https://idstack.raodaor.com`，`localhost:8081` 被拒。**直接用 `CORS_ALLOW_ORIGINS` 或依赖默认放行的 localhost 规则最稳妥**（开发期 localhost 已默认放行）。
3. 若宿主页是非 localhost 的自定义联调域名（如 `https://dev.partner.com`），在 `.env` 设 `CORS_ALLOW_ORIGINS=https://dev.partner.com`，并**重启后端服务**生效。
4. 修完 CORS 后仍失败，再按 `401`（token 失效，用 `embed.updateToken(newToken)` 刷新）/ `400 MISSING_TENANT`（JWT 缺 `tenant_id`，token 非 IDStack 合法用户令牌）定位。

### 嵌入页握手来源白名单（前端侧，高频坑）

除了「服务端 CORS 白名单」，**嵌入页本身还有一个来源白名单**，专管「哪些宿主来源发来的鉴权握手（`AUTH_REQUEST`）会被接受」。这是「等待宿主页面鉴权超时」的最常见根因——若宿主页 origin 不在白名单，握手消息会被嵌入页直接拒绝，`applyIdentity` 永不触发，15 秒后超时。

- **控制变量**：`EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`（**IDStack 客户端**的环境变量，逗号分隔，如 `https://app.example.com,http://localhost:3000`）。
- **默认放行范围**（无需配置即可握手成功的情形）：
  - **开发期（`__DEV__`）**：`localhost` / `127.0.0.1` 的**任意端口**默认放行（如 `http://localhost:5173`、`http://localhost:3001` 等），与目标 APP 用任意本地端口联调无需逐个加白名单。
  - 始终包含 IDStack 自身站点 `WEBSITE_URL`。
- **生产环境**：`__DEV__` 为 false，**不会**对任意 localhost 放行。必须把目标 APP 的正式 origin 加入 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`，否则握手被拒 → 超时。
- **改完需重启 IDStack 客户端 dev server 才生效**（该变量在前端构建期注入）。

```bash
# IDStack 客户端 .env.development / .env.production
# 生产环境务必显式列出接入方 origin（开发期 localhost 已默认放行，可不写）
EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

> 注意区分两个白名单：**`CORS_ALLOW_ORIGINS`（服务端）** 管"谁的后端 API 跨域请求能放行"；**`EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS（前端）** 管"谁的宿主页能与嵌入页完成鉴权握手"。接入方联调时两者都要配到位，缺一不可。若控制台出现 `[Embed] 拒绝来自非白名单来源的鉴权消息: <origin>`，即前者（握手白名单）未放行该 origin。

### 「等待宿主页面鉴权超时」完整排查路径

握手链路：`嵌入页加载完 → 广播 READY → 宿主 SDK 收 READY 触发 AUTH_REQUEST → 嵌入页 applyIdentity → 广播 AUTH_OK → 宿主 SDK onReady`。任一步断掉都会 15s 超时。按以下顺序排查：

1. **嵌入页是否广播 READY**：打开嵌入页（8081）devtools Console 应看到 `[Embed] 广播 READY → parent`。没有 → 嵌入页自身没加载完/报错，先解决页面加载。
2. **宿主 SDK 是否收到 READY 并发 AUTH_REQUEST**：打开宿主页（5108）devtools Console，应看到 `收到嵌入页 READY` → `sendAuth →`。**若根本没收到 READY** → 宿主 `origin` 配错（填成了后端 API 域名而非嵌入页地址，旧版本会因此丢弃 READY）。v2 SDK 已解耦可自愈；旧版本需把 `origin` 改成嵌入页真实地址（如 `http://localhost:8081`）。
3. **嵌入页是否接收 AUTH_REQUEST**：嵌入页 Console 应看到 `[Embed] 收到 AUTH_REQUEST`。若显示 `[Embed] 拒绝来自非白名单来源的鉴权消息: <origin>` → 宿主页 origin 未被 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS` 放行（开发期 localhost 任意端口默认放行；生产需显式加白名单并重启前端）。
4. **是否回执 AUTH_OK**：嵌入页应打印 `[Embed] 应用凭证通道（仅 app_id）握手完成` + `广播 AUTH_OK → parent`，宿主侧收到后触发 `onReady`。

> 最常见两类坑：① 宿主 `origin` 填成后端 API 域名（旧版本致命，v2 已修）；② 生产环境未把宿主域名加入 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`。

## 业务事件（事件桥）

嵌入页在关键业务节点会向宿主回传事件，SDK 同时提供**通用透传** `onEvent(event)` 与**类型化回调**：

| 回调 | 触发时机 | `data` 字段 |
|------|----------|-------------|
| `onPointsChanged` | 积分余额变动（任务完成奖励、兑换扣减） | `currentBalance?` / `rewardPoints?` / `spentPoints?` / `reason?` / `taskId?` |
| `onPurchaseSuccess` | 积分商城兑换下单成功 | `orderId` / `productId?` / `productName?` / `points?` / `order?` |
| `onClose` | 用户离开/完成（返回按钮、支付完成） | `redirect?`（deep link 回跳） + 额外字段 |
| `onForbidden` | 权限不足（管理类模块被非管理员访问 / token 失效） | `reason: 'no_permission' \| 'auth_expired'` + `page?`（嵌入页标识） |

事件名常量 `EMBED_EVENT_NAME`（`points_changed` / `purchase_success` / `close` / `forbidden`）与 `client/src/embed/eventBridge.ts` 保持一致。Web Component 额外派发 `points-changed` / `purchase-success` / `close` / `forbidden` / `auth-expired` 五个 `CustomEvent`。

`onClose` 的 `redirect` 来自嵌入 URL 的 `redirect` 参数或显式传入，宿主可据此关闭嵌入层并 **deep link 回跳**自有 App（如 `myapp://home`）。

### 支付闭环示例（以 `payment-create` 为例）

`payment-create` 是嵌入层里**闭环最完整**的一条链路，流程如下：

```
1. 目标APP 挂载 <idstack-embed module="payment-create" externalOrderId="cmrm6zup..." redirect="myapp://pay-result">
      │  externalOrderId / redirect 随 iframe URL 透传：/embed/payment/create?externalOrderId=cmrm6zup...&redirect=myapp://pay-result
2. 用户在嵌入页填金额/渠道 → 点"创建订单"（externalOrderId 落库为订单 external_order_id）
      │ POST /api/v1/payment/orders（同源 IDStack 后端，CORS 见上）
3. 订单创建成功 → 嵌入页跳转 PaymentVoucher（凭证页）
      │ 展示 voucher_code + 可分享的 shareUrl（如 http://localhost:8081/pay?token=...）
      │ 点"分享"把 shareUrl 发给付款人；点"完成" → emitClose()
4. emitClose 读取嵌入 URL 的 redirect → postMessage { type:EVENT, name:'close', data:{ redirect:'myapp://pay-result' } }
5. 宿主 SDK onClose(data) 收到 → embed.destroy() 关闭 iframe
      │ 若 data.redirect 存在 → window.location.href = data.redirect 深链回跳目标 APP
```

**凭证页（PaymentVoucher）用户操作说明**：该页是给**发起方（orderer）**看的，只展示凭证/口令。
- 点 **"分享"**：把 `shareUrl`（如 `http://localhost:8081/pay?token=...`）复制或发给付款人；
- 付款人在自己手机打开 `shareUrl` → 进入匿名支付页（`PaymentShare`）→ 完成实际转账 → 点 **"已完成付款"** → 触发 `emitClose` 关闭嵌入层；
- 发起方回到自己这侧的凭证页点 **"完成"** → 同样触发 `emitClose` 回跳目标 APP。

> 关键点：`redirect` 必须**在挂载时由宿主传入 SDK**（编程式 `new IdStackEmbed({ redirect })` 或声明式 `<idstack-embed redirect="...">`）。若宿主不传，嵌入页 `emitClose` 回落到无 `redirect`，`onClose` 仅关闭嵌入层、不做深链回跳。直接浏览器打开 `/embed/payment/create`（非 iframe、无宿主）时 `emitClose` 为 no-op，这是预期行为——只有真正走 SDK 嵌入才会闭环回跳。

## 支付结果 Webhook 通知（服务端 → 服务端）

> 与上面「支付闭环示例」的前端 `onClose` 回跳不同，Webhook 是 **IDStack 后端直接打到目标 APP 后端**的服务器间回调，用于让目标 APP **实时同步支付状态、无需轮询**。SDK 嵌入流程里用户完成付款、运营在后台核销凭证后，目标 APP 服务端即可收到通知。

### 前置配置（IDStack 管理后台）

在对应应用（APP）记录上配置：

| 字段 | 说明 |
|------|------|
| `webhook_url` | 目标 APP 接收端点的 HTTPS 地址，如 `https://app.example.com/api/idstack/webhook` |
| 租户 `idstack_webhook_enabled = true` | 租户级总开关，关闭后该租户下**全部** webhook（含支付事件）都会被抑制 |

> 出站鉴权用 **RS256 签名**（复用 IDStack 私钥），消费方用 JWKS 公钥验签，**无需配置任何 webhook secret**。

### 事件：`payment.verified`

**所有业务类型的订单**在凭证核销成功后都会推送（会员订单额外再推 `user.subscription_changed`）。

> **关联本地订单（必传）**：
> - **直连后端 API** `POST /payment/orders` 时，请求体字段名为 `external_order_id`（snake_case），缺失将返回 `400 MISSING_EXTERNAL_ORDER_ID`。
> - **用 SDK 托管下单页**（`module: 'payment-create'`）时，通过 SDK 的 `externalOrderId` 选项传入（见配置项表）；不传则托管页会生成 `hosted-*` 占位值，导致无法关联本地订单、订单停在 PENDING。
> - **核销回调（webhook）中的字段名是 `externalOrderId`（camelCase，不是 `external_order_id`）**，值为你创建订单时传入的本地订单号，原样回推。请用它而非 `orderId`（IDStack 内部 UUID）来关联本地订单。同一租户内需唯一。

```
POST {app.webhook_url}
Headers:
  Content-Type: application/json
  X-IDStack-Signature: keyId=<kid>,algorithm=rs256,signature=<base64url>
  X-IDStack-Timestamp: <unix 秒>
  X-IDStack-Event-Id: <uuid>
```

请求体示例：

```json
{
  "event": "payment.verified",
  "userId": "uuid-of-payer",        // IDStack 用户主键，即目标 APP 的 idstackUserId
  "tenantId": "uuid",
  "appId": "uuid",
  "orderId": "uuid",                // IDStack 内部订单 UUID（不要用它关联本地订单）
  "orderNo": "ORDER20260715XXXX",   // IDStack 订单号
  "externalOrderId": "your-app-order-id", // 创建订单时由目标 APP 透传的自身订单号，关联回本地订单请用它
  "businessType": "order",          // 业务类型；会员订单为 "membership"
  "businessId": "external-biz-id",  // 创建订单时由目标 APP 透传的外部业务 ID（会员订单为套餐ID）
  "amount": "99.00",
  "currency": "CNY",
  "voucherCode": "ABCD2346789EFGHJ",
  "verificationCode": "VF123456",
  // 会员订单（businessType=membership）额外携带套餐/等级映射字段，单事件即可完成会员等级同步：
  "tierCode": "gold",               // 等级码（如 normal/silver/gold/diamond）
  "planCode": "year_vip",           // 套餐码
  "externalCode": "app_gold_annual",// 映射回目标 APP 的等级码
  "tierId": "uuid",
  "membershipLevel": "gold",
  "billingCycle": "year",
  "periodStart": "2026-07-15T10:00:00.000Z",
  "periodEnd": "2027-07-15T10:00:00.000Z",
  "status": "verified",             // 支付核销状态（会员状态 'active' 见 user.subscription_changed）
  "verifiedAt": "2026-07-15T10:00:00.000Z",
  "timestamp": "2026-07-15T10:00:00.000Z"
}
```

## 采集（sdk-web-analytics）与展示（sdk-web-features）分工

本项目把**数据上报**与**数据展现**拆成两个独立 SDK，职责清晰：

| SDK | 职责 | 目标 APP 用法 |
|-----|------|--------------|
| `@raodaor/web-analytics` | 仅**采集**：把用户行为事件 POST 到 IDStack 的 `/api/v1/analytics/events` | 在目标 APP 内初始化，自动上报浏览/点击等事件 |
| `@raodaor/web-features`（本 SDK） | 仅**展现**：以 `/embed/dashboard` 嵌入 IDStack 现成的分析看板 | 用 `<idstack-embed module="analytics-dashboard">` 嵌入报表页 |

**为什么这样分工更好**：

- `sdk-web-analytics` 是「纯收集器」，不含任何图表 / 报表组件，目标 APP 无需自行实现可视化；
- 报表页（`DashboardScreen`）是 IDStack 平台已有的能力，按 `app_id` 三级隔离（`tenantIsolation` 中间件 + JWT），复用即可，随平台升级自动演进；
- 嵌入态下看板自动隐藏导航栏与「可视范围横幅（ScopeBanner）」，目标 APP 只能看到**本应用（app_id）维度**的数据，不会泄露平台 / 租户级视野；
- 目标 APP 前后端都无需重复建设聚合、趋势、维度分布、实时面板逻辑。

**接入示例**：

```html
<!-- 1) 采集：目标 APP 内注入 analytics SDK，自动上报事件 -->
<script src="https://cdn.your-idstack.com/raodaor-analytics-sdk.umd.js"></script>
<script>
  RaodaorAnalyticsSDK.analytics.init({
    endpoint: 'https://idstack.your-domain.com',
    appId: 'APP_UUID',
  });
</script>

<!-- 2) 展示：在「数据中心」页面嵌入 IDStack 看板（务必传 app_id） -->
<idstack-embed
  origin="https://idstack.your-domain.com"
  module="analytics-dashboard"
  app_id="YOUR_IDSTACK_APP_ID">
</idstack-embed>
```

> 看板走应用凭证通道，**只需 `app_id` 即可，无需 `token`**。
> 若使用 JS SDK 初始化：`new IdStackEmbed({ container, origin, module: 'analytics-dashboard', app_id: import.meta.env.VITE_IDSTACK_APP_ID })`。

> 说明：`analytics-dashboard` 模块复用的就是 IDStack 客户端 `client/src/screens/DashboardScreen.tsx`，后端数据来自 `daily_analytics_aggregate` 聚合表（由 analytics SDK 上报事件经 `AnalyticsDashboardService.incrementDailyAggregate` 落库）。嵌入态下 `ScopeBanner` 自动隐藏。

### 看板默认时间范围（嵌入参数）

目标 APP 可通过嵌入时透传的 query 参数控制看板默认展示的时间范围，无需在目标 APP 内做二次选择。参数优先级：**`start` + `end` 显式日期 > `range` 预设 > 默认 30 天**。

| 参数 | 取值 | 说明 |
|------|------|------|
| `range` | `today` / `7d` / `30d` / `90d` | 预设范围；`today`=当天，`7d/30d/90d`=最近 N 天 |
| `start` | `YYYY-MM-DD` | 自定义起始日期，优先级高于 `range` |
| `end` | `YYYY-MM-DD` | 自定义结束日期，默认当天 |
| `granularity` | `day` / `week` / `month` | 趋势图聚合粒度，默认按范围自动（`≤30d`→day，`>30d`→week） |

**编程式（JS）示例**：

```ts
new IdStackEmbed({
  origin: 'https://idstack.your-domain.com',
  module: 'analytics-dashboard',
  token: 'USER_TOKEN',
  // 透传时间范围：最近 7 天
  params: { range: '7d' },
}).mount(document.getElementById('dashboard'));
```

**声明式（自定义元素）示例**：

```html
<idstack-embed
  origin="https://idstack.your-domain.com"
  module="analytics-dashboard"
  token="USER_TOKEN"
  params='{"range":"7d"}'>
</idstack-embed>
```

> 注意：`params` 中的 `range/start/end/granularity` 会被 SDK 自动拼接到 `/embed/dashboard?range=7d` 这类 URL 上，由 IDStack 嵌入页解析并注入看板。独立运行 IDStack（非嵌入态）时这些参数不生效，看板使用自身默认 30 天范围。

### 接收端实现要点（最佳实践）

1. **校验签名**：用 JWKS 公钥验签（RS256），校验 `X-IDStack-Signature` + 时间窗（±5min）+ eventId，不匹配直接返回 `401` 拒绝。
2. **按 `event` 分发**：对 `payment.verified`，用 `orderNo`（或 `voucherCode`）把本端订单状态推进为「已支付/已核销」。
3. **幂等**：事件可能重复/乱序到达，必须基于 `orderNo` 做幂等处理（已处理则直接返回成功）。
4. **响应码**：成功返回 `2xx`（推荐 `200`）；非 2xx 时 IDStack 会**最多重试 3 次**（指数退避），因此务必尽快返回。

```ts
// 目标 APP 服务端（Express 示例）
import express from 'express';
const app = express();
app.use(express.json());

app.post('/api/idstack/webhook', async (req, res) => {
  // 1) 校验签名（JWKS 公钥 RS256 + 时间窗，见上文「③ 用什么鉴权」）
  try {
    await verifyIdStackWebhook(req.rawBody, req.headers); // 参考实现见 IDStack `idstack-verify.ts`
  } catch {
    return res.status(401).json({ success: false, error: 'invalid signature' });
  }

  const { event, orderNo, voucherCode, status, userId } = req.body;

  // 2) 按事件分发
  if (event === 'payment.verified') {
    // 3) 幂等更新本端订单状态（基于 orderNo）
    myOrderService.markPaid(orderNo, {
      voucherCode,
      status,
      idstackUserId: userId,
    });
  }

  // 4) 成功响应（非 2xx 会触发 IDStack 重试）
  res.status(200).json({ success: true });
});
```

## 安全说明

- SDK 发送鉴权时 `targetOrigin` 始终为传入的 `origin`，**绝不使用 `'*'`**。
- SDK 只接受来自本 iframe（`e.source === iframe.contentWindow`）且消息来源 `e.origin` 等于 iframe 实际加载的 origin（由 `origin` 推导，二者已解耦）的消息。
- IDStack 嵌入页侧还会对 `event.origin` 做**白名单**二次校验（见 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`）。

> ⚠️ **`origin` 必须填「嵌入页实际加载地址」，不是 IDStack 后端 API 域名。**
> 例：若嵌入页通过 `http://localhost:8081/embed/dashboard?...` 加载，则 `origin: 'http://localhost:8081'`。
> 旧版本要求 `origin` 与嵌入页回执 `event.origin` 字符串相等，若把它填成后端 API 域名（如 `https://api.idstack.com`）会导致握手消息被 SDK 直接丢弃 → 嵌入页报「等待宿主页面鉴权超时」。v2 已解耦：SDK 自动按 `origin` 推导出 iframe 真实 origin 做消息校验，填对 `origin`（嵌入页地址）即可。
- 令牌全程不出现在 URL，避免进入浏览器历史与 referer 日志。

详见项目文档 `./idstack-embed-integration.md`。

## Token 生命周期与登录态同步（iframe 嵌入必读）

### 问题背景

iframe 是独立浏览器上下文，与宿主不是同一份 localStorage / cookie jar。以下场景会导致「宿主已登录、iframe 要重新连接」：

1. **token 生命周期不同步**：宿主 refresh 后，iframe 持有的旧 token 过期 → 401
2. **第三方 cookie 屏蔽**：Chrome/Safari 逐步禁用第三方 cookie，iframe 无法依赖 cookie 保活
3. **refresh_token 两端竞争续签**：宿主和 iframe 都用同一 refresh_token 调 refresh API，导致互踢

### 最佳实践：宿主是登录态唯一权威，iframe 当无状态视图

**职责分工：**

| 端 | 职责 |
|----|------|
| **宿主（目标 APP）** | 持有 refresh_token，独自负责 token 续签；续签后主动调 `embed.updateToken(newToken)` 推送新 token |
| **iframe（IDStack Embed）** | 每次 mount 重新握手；token 失效时上报 `AUTH_EXPIRED`；**绝不调 refresh API**，不持有 refresh_token |

### 协议：两个新消息

| 消息 | 方向 | 触发时机 | 处理 |
|------|------|----------|------|
| `AUTH_EXPIRED` | iframe → 宿主 | iframe 检测到 401 | 宿主续签 → `updateToken` 或销毁重建 |
| `AUTH_UPDATE` | 宿主 → iframe | 宿主续签后 | iframe 覆盖 localStorage 中的 token，回执 `AUTH_OK` |

### 宿主侧完整实现示例

以下是宿主（目标 APP）侧配合 IDStack Embed Token 同步协议的完整实现。可直接参考抄写，按你的实际框架调整 `HostAuthService` 的 refresh 逻辑即可。

```typescript
import { IdStackEmbed } from '@isudaji/raodaor-sdk-web-features';

// ==================== 宿主侧 session 管理（按你的实际框架实现） ====================

interface SessionInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;  // ms 时间戳
}

class HostAuthService {
  private session: SessionInfo | null = null;
  private expiryListeners: Array<() => void> = [];

  setSession(s: SessionInfo) {
    this.session = s;
    // token 临近过期前 60s 触发续签
    const ttl = s.expiresAt - Date.now() - 60_000;
    if (ttl > 0) setTimeout(() => this.notifyExpiry(), ttl);
  }

  /** 续签：调宿主后端用 refresh_token 换新 access_token */
  async refresh(): Promise<string | null> {
    if (!this.session) return null;
    try {
      const res = await fetch('/api/host/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.session.refreshToken }),
      });
      if (!res.ok) {
        this.session = null;  // refresh_token 也过期，清空
        return null;
      }
      const data = await res.json();
      this.setSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.session.refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      });
      return data.access_token;
    } catch {
      return null;
    }
  }

  onTokenExpiring(cb: () => void) {
    this.expiryListeners.push(cb);
  }

  private notifyExpiry() {
    this.expiryListeners.forEach((cb) => cb());
  }

  isLoggedIn(): boolean {
    return !!this.session;
  }
}

const authService = new HostAuthService();

// ==================== IDStack Embed 集成 ====================

let embed: IdStackEmbed | null = null;

function mountEmbed() {
  if (embed) return;

  embed = new IdStackEmbed({
    container: '#idstack-box',
    origin: 'https://idstack.raodaor.com',
    module: 'points-mall',
    token: authService.session?.accessToken,
    onReady: () => console.log('[Host] 嵌入页握手成功'),
    onError: (msg) => console.error('[Host] 嵌入页握手失败:', msg),

    onAuthExpired: async () => {
      // 1. iframe 报 401 → 尝试用本地 refresh_token 续签
      console.warn('[Host] 收到 AUTH_EXPIRED：iframe token 失效，尝试续签');
      const newToken = await authService.refresh();
      if (newToken && embed) {
        embed.updateToken(newToken);  // 推送新 token 给 iframe
        console.log('[Host] 已推送新 token 给 iframe');
      } else {
        // 2. refresh_token 也过期 → 销毁 iframe 跳登录
        console.warn('[Host] refresh_token 也过期，销毁 iframe 跳登录');
        embed?.destroy();
        embed = null;
        window.location.href = '/login';
      }
    },
  });

  // 3. 主动续签：token 临近过期前调 refresh，避免 iframe 报 401（更平滑）
  authService.onTokenExpiring(async () => {
    console.log('[Host] token 即将过期，主动续签');
    const newToken = await authService.refresh();
    if (newToken && embed) {
      embed.updateToken(newToken);
    }
  });

  embed.mount();
}

// ==================== 生命周期管理 ====================

// 宿主登录成功后挂载 iframe
window.addEventListener('host:login-success', () => {
  mountEmbed();
});

// 宿主登出时销毁 iframe，避免 iframe 持旧 token 继续请求
window.addEventListener('host:logout', () => {
  embed?.destroy();
  embed = null;
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  embed?.destroy();
});
```

**关键点说明：**

| 关注点 | 说明 |
|--------|------|
| `onAuthExpired` 回调 | iframe 检测到 401 时触发，宿主在此续签或销毁重建 |
| `authService.onTokenExpiring` | 主动续签，比等 iframe 报 401 更平滑（用户无感知） |
| `embed.updateToken(newToken)` | 推送新 token 给 iframe，走 `AUTH_UPDATE` 通道 |
| `embed.destroy()` | 宿主登出时销毁 iframe，避免持旧 token 继续请求 |
| **refresh_token 不下发** | `refreshToken` 只在 `HostAuthService` 内部使用，不传给 `IdStackEmbed` 构造参数 |

### 安全规则

- **refresh_token 只在宿主后端持有**，不下发给 iframe
- iframe 收到 401 后不自行调 refresh API，只上报 `AUTH_EXPIRED` 通知宿主
- `AUTH_UPDATE` 的 targetOrigin 由 SDK 限定为 `options.origin`，杜绝 `'*'` 广播
- iframe 首次握手仍走 `AUTH_REQUEST`（带白名单校验），`AUTH_UPDATE` 仅用于已握手的 iframe 运行时更新

### 验证清单

- [ ] 宿主续签后 5 秒内 iframe 不再出现 401
- [ ] iframe 不持有 refresh_token（localStorage 中无 `refresh_token` key）
- [ ] 第三方 cookie 禁用后嵌入页仍能正常加载（token 走 postMessage 不依赖 cookie）
- [ ] 宿主登出后 iframe 被销毁重建，不会持有旧 token 继续请求
