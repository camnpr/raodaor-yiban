<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-message/developer-platform.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 绕道儿消息 · 开放平台（开发者平台）接入文档

> 面向**接入方（目标 APP）的开发者**：本文说明如何在「开放平台控制台」申请入驻、获取三类凭证，
> 并把消息能力对接进自己的业务系统。
> 后端根地址：`https://message.raodaor.com/api/v1`（dev：`http://localhost:9012/api/v1`）

---

## 目录

1. [总体流程](#1-总体流程)
2. [三类凭证速览](#2-三类凭证速览)
3. [① 入驻申请与审批](#3-①-入驻申请与审批)
4. [② API Key（服务号下发）](#4-②-api-key服务号下发)
5. [③ 入站通知密钥（投递到消息中心）](#5-③-入站通知密钥投递到消息中心)
6. [④ Webhook 订阅（事件出站）](#6-④-webhook-订阅事件出站)
7. [完整示例：raodaor-ad 接入](#7-完整示例raodaor-ad-接入)
8. [安全与合规](#8-安全与合规)

---

## 1. 总体流程

```
申请入驻（POST /admin/apps）
      │
      ▼
平台审批（pending → approved）        ← 仅 approved 后才会下发凭证
      │
      ├─ 签发 API Key         → 服务号消息下发（X-API-Key）
      ├─ 轮换入站通知密钥      → 业务事件投递到消息中心（X-Raodaor-Message-Inbound-Key）
      └─ 登记 Webhook 订阅     → 接收 message 侧事件（X-RDM-Signature）
```

> 控制台入口：消息 APP 内「开放平台」页（`/dev-console`）。审批与密钥签发需要**平台运营者**
> 权限（`consoleAccess` 能力，对应 `system_admin` / `owner`）。

---

## 2. 三类凭证速览

| 凭证 | 形态 | 通道头 | 用途 | 谁持有 | 明文可见性 |
|---|---|---|---|---|---|
| **API Key** | `rdmapp_<64hex>` / `rdmorg_<64hex>` | `X-API-Key` | 以「服务号」身份向已订阅用户下发消息 | 接入方服务端 | 仅签发时展示一次 |
| **入站通知密钥** | `rdae_<48hex>` | `X-Raodaor-Message-Inbound-Key` | 把业务事件投递进用户消息中心（服务端→服务端） | 接入方服务端 | 仅签发/轮换时展示一次 |
| **Webhook 签名密钥** | `<48hex>` | `X-RDM-Signature` | 校验 message 推送给你的回调请求 | message 侧持有，你本地比对 | 仅登记/轮换时展示一次 |

**关键原则**：三类密钥均为「明文仅展示一次」，库内只存哈希（API Key / 入站密钥）或密文（Webhook）。
一旦离开签发响应就无法再读取——请在控制台**立即复制保存**到服务端环境变量/密钥管理，切勿进前端代码或仓库。

---

## 3. ① 入驻申请与审批

```http
POST /api/v1/admin/apps
Authorization: Bearer <message token>
Content-Type: application/json

{ "name": "绕道儿广告", "scopes": ["im:read","im:send","webhook:manage"] }
# 返回 { appId, status: "pending" }
```

- `appId` 是应用的公开标识，后续所有凭证与接口都以此为 `subject` / `appId` 维度。
- 状态：`pending`（待审批）→ `approved`（通过，可签发凭证）/ `rejected`（驳回，附 `adminNote`）。
- 平台运营者在控制台「待审批」队列点「通过」；`approved` 后才能签发 API Key / 入站密钥。

---

## 4. ② API Key（服务号下发）

**用途**：应用以「服务号」身份，向**已关注/订阅**本应用的用户下发消息（`category=app`）。
B 端营销消息（`level: "B"`）需用户显式订阅，否则被拒（错误码 `6001`）。

**获取**（控制台 → 应用详情 → API Key → 「签发 Key」）：

```http
POST /api/v1/open/api-keys
Authorization: Bearer <message token>
Content-Type: application/json

{ "prefix": "rdmapp", "subject": "<你的 appId>", "scopes": ["im:send","webhook:manage"] }
# 返回 { apiKey: "rdmapp_xxx", id, status: "active" }   ← apiKey 仅此一次
```

- 列表/吊销：`GET /open/api-keys`、`DELETE /open/api-keys/:id`（吊销即时失效，不可恢复）。
- **使用**（服务端调用）：

```http
POST /api/v1/open/messages/send
X-API-Key: <rdmapp_xxx>

{ "userId": "<接收方 message User.id 或 idstackUserId>", "title": "会员日专享", "summary": "全场 8 折", "level": "B", "link": "rdm://mall/campaign/123" }
```

---

## 5. ③ 入站通知密钥（投递到消息中心）

**用途**：把你的业务事件（收益到账、举报结果、评论回复、系统公告）**投递进用户消息中心**。
这是最常用通道；`sourceAppId` 由 message 服务端据密钥反查核验，防冒充。

**获取**（控制台 → 应用详情 → 入站通知密钥 → 「签发/轮换」，仅 `approved` 应用）：

```http
POST /api/v1/admin/apps/<appId>/inbound-secret/rotate
Authorization: Bearer <message token>
# 返回 { appId, inboundSecret: "rdae_xxx" }   ← 明文仅此一次
```

- 轮换：旧密钥立即失效；`hasInboundSecret` 标记可在应用列表查看是否已签发。
- 接入方把密钥写入**服务端环境变量**（如 raodaor-ad 的 `RAODAOR_MESSAGE_INBOUND_KEY`），严禁进前端。

**使用**（服务端→服务端投递）：

```http
POST /api/v1/internal/notifications
X-Raodaor-Message-Inbound-Key: <rdae_xxx>
Content-Type: application/json

{
  "event": "notification.create",
  "data": {
    "idstackUserId": "<IDStack 用户主键>",
    "category": "benefit",
    "title": "收益到账",
    "summary": "您有一笔 12.50 元收益已到账",
    "level": "A",
    "link": "rdm://earn/history"
  }
}
```

> 每个对接方（含 QA / POS / File / Docs / IDStack）均在开放平台申请独立入站密钥，以 `X-Raodaor-Message-Inbound-Key` 携带；可按应用隔离 `sourceAppId`、可轮换。category 语义见 [overview.md](./overview.md) §4.1。

---

## 6. ④ Webhook 订阅（事件出站）

**用途**：接收 message 侧发生的事件（用户关注/退订、服务号消息、客服生命周期、审计留痕、推送回执等），
用于同步你的业务系统（如退订后取消营销、消息撤回后审计）。

**获取**（控制台 → 应用详情 → Webhook 订阅 → 「登记」）：

```http
POST /api/v1/open/webhooks
Authorization: Bearer <message token>
Content-Type: application/json

{ "appId": "<你的 appId>", "url": "https://ad.raodaor.com/api/message/webhook", "events": ["user.subscribed","user.unsubscribed","message.created"] }
# 返回 { id, url, events, status: "active", secret: "<48hex>" }   ← secret 仅此一次
```

**管理（产品级控制台能力）**：

| 操作 | 接口 | 说明 |
|---|---|---|
| 列表 | `GET /open/webhooks?appId=` | 含 `url` / `events` / `status`（active\|paused） |
| 编辑 | `PATCH /open/webhooks/:id?appId=` | 改 `url` / `events` / `status`（暂停投递） |
| 轮换密钥 | `PATCH /open/webhooks/:id?appId=` + `{ "rotateSecret": true }` | 返回新 `secret`，旧密钥立即失效 |
| 删除 | `DELETE /open/webhooks/:id?appId=` | 不再接收事件 |

**事件目录**（订阅维度：应用级 `appId` + 组织级 `organizationId` 审计类事件）：

| 事件 | 触发点 | 维度 |
|---|---|---|
| `user.subscribed` / `user.unsubscribed` | 用户关注/退订应用 | 应用级 |
| `message.created` | 用户回复服务号（type=app 会话） | 应用级 |
| `cs.session.started` / `cs.session.assigned` / `cs.session.closed` | 客服会话生命周期 | 应用级 |
| `cs.message.created` | 客服/访客消息 | 应用级 |
| `message.recalled` / `user.muted` / `friend.request` | 审计留痕 | 组织级 |
| `push.delivered` | 推送任务聚合回执 | 应用级 |
| `quota.warning` | 任一计量维度 ≥ 90% | 应用级 |

**签名校验**（你的服务端必须校验，否则任何人可伪造事件）：

```http
X-RDM-Event: user.unsubscribed
X-RDM-EventId: <uuid，幂等键>
X-RDM-Signature: sha256=<HMAC-SHA256(body, secret)>
```

```js
// 你的回调校验伪码
const sig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
if (sig !== req.headers['x-rdm-signature']) return res.status(401).end();
// 用 X-RDM-EventId 去重（至少一次投递，可能重试）
```

**投递保障**：非 2xx 按 `1m / 5m / 30m / 2h / 6h` 重试 5 次；暂停（`paused`）状态不投递。

---

## 7. 完整示例：raodaor-ad 接入

```js
// 后端 .env（密钥仅服务端）
RAODAOR_MESSAGE_BASE_URL=https://message.raodaor.com
RAODAOR_MESSAGE_INBOUND_KEY=rdae_xxx          # 控制台「入站通知密钥」签发
RAODAOR_MESSAGE_API_KEY=rdmapp_xxx            # 控制台「API Key」签发（X-API-Key，服务号下发）
RAODAOR_MESSAGE_WEBHOOK_SECRET=xxx            # 控制台「Webhook 订阅」登记后获得（验 X-RDM-Signature）

// ① 收益结算 → 投递消息中心
await fetch(`${BASE}/internal/notifications`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Raodaor-Message-Inbound-Key': process.env.RAODAOR_MESSAGE_INBOUND_KEY },
  body: JSON.stringify({ event: 'notification.create', data: { idstackUserId: user.idstackUserId, category: 'benefit', title: '收益到账', summary: `到账 ${amount} 元`, level: 'A', link: 'rdm://earn/history' } }),
});

// ② 用户退订 → 你的 Webhook 回调取消营销
app.post('/api/message/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const sig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.body).digest('hex');
  if (sig !== req.headers['x-rdm-signature']) return res.status(401).end();
  const { event, eventId } = req.headers;
  if (seen(eventId)) return res.status(200).end();        // 幂等
  if (event === 'user.unsubscribed') cancelMarketing(req.body.userId);
  res.status(200).end();
});
```

前端换取 message token 后嵌入消息中心组件，见 [overview.md](./overview.md) §4.1。

---

## 8. 安全与合规

- **密钥一律服务端持有**：API Key / 入站密钥 / Webhook 密钥均明文仅展示一次，离开签发响应即不可读；
  写入环境变量或密钥管理，**严禁**打包进前端、提交仓库、记日志。
- **轮换即失效**：三类密钥均支持轮换，旧值立即作废；泄露时第一时间在控制台轮换。
- **Webhook 必须验签**：用 `X-RDM-Signature` 校验请求来源，并用 `X-RDM-EventId` 做幂等（至少一次投递）。
- **最小权限**：API Key `scopes` 按实际需求申请；Webhook 仅订阅必要事件。
- **凭证与成员隔离**：入站密钥按应用隔离（`sourceAppId` 服务端核验），每对接方独立、可轮换、可吊销。
