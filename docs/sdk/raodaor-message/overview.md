<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-message/overview.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 绕道儿消息（RaodaorMessage）接入指南

> 本 APP 侧 SDK 源文档，供生态内应用（raodaor-ad / docs / mall 等）接入。
> 后端根地址：`https://message.raodaor.com/api/v1`（dev：`http://localhost:9012/api/v1`）

---

## 目录导航（本 SDK 文档）

| 文档 | 说明 |
|---|---|
| [overview.md](./overview.md) | 接入指南（本页）：身份模型、鉴权通道、四类接入场景与完整示例 |
| [im-integration.md](./im-integration.md) | **IM 双聊接入**：会话 / 消息（seq 游标 + 幂等键）/ 关系链 / WebSocket 事件 / 身份映射 |
| [developer-platform.md](./developer-platform.md) | **开放平台（开发者平台）接入**：入驻审批 + 三类凭证（API Key / 入站通知密钥 / Webhook）获取与对接示例 |
| [platform-architecture.md](./platform-architecture.md) | 平台化架构：通用核心 + 4 扩展点、角色模型、分阶段落地路线 |
| [pre-send-hook-example.md](./pre-send-hook-example.md) | 发送前拦截钩子接入示例：CampusHeroSaga 家长审核 / 时段限制等合规回调 |

---

## 1. 定位与能力

RaodaorMessage 是绕道儿生态的**统一「消息触达与实时交互」底座**，为各业务提供：

| 能力 | 说明 |
|---|---|
| 消息中心 | 全品类通知聚合（收益/订单/互动/系统/权益/服务号），统一存储、展示、未读角标、已读 |
| IM 实时 | 单聊 / 群聊 / 卡片消息 / 多端同步 |
| 网页客服 | 悬浮窗一行接入（访客匿名会话 → 坐席工作台） |
| 推送 | 全端推送（Expo/FCM/APNs），设备注册 + 触发 |
| 服务号 | 应用入驻后以「服务号」身份向订阅用户触达 |

---

## 2. 身份模型（关键）

**本平台不自建用户体系**，用户统一走 **IDStack 全局账号**。`User` 表是 IDStack 账号的映射（`idstackUserId @unique`）。

- **用户账号资产属生态全局（IDStack）**；接入方的「获客」沉淀于本应用的订阅者（`AppSubscription`）与客户档案（`CustomerProfile`）。
- 本服务签发的 access_token（下文「message token」）身份即 IDStack 账号，不是独立用户。

---

## 3. 鉴权通道（四类）

| 通道 | 凭证 | 用途 | 典型场景 |
|---|---|---|---|
| 用户 JWT | `Authorization: Bearer <message token>` | 用户态读写 | 消息中心拉取、已读、发消息 |
| API Key | `X-API-Key: <key>` | 应用服务端调用 | 服务号消息下发 |
| 访客 token | `Authorization: Bearer <visitorToken>` | 未登录访客 | 客服悬浮窗 |
| 生态入站 | `X-Raodaor-Message-Inbound-Key: <rdae_xxx>` | 服务端→服务端事件（每对接方独立密钥） | 通知落消息中心、支付核销 |

---

## 4. 接入场景

### 4.1 站内消息中心（最常用）

接入方要把自己的业务事件（收益到账、举报结果、评论回复、系统公告）投递到用户消息中心，分「数据进」与「展示出」两条通道。

#### ① 数据进：服务端投递事件

```http
POST /api/v1/internal/notifications
X-Raodaor-Message-Inbound-Key: <RAODAOR_MESSAGE_INBOUND_KEY>   # 开放平台为对接方签发的独立入站密钥
Content-Type: application/json

{
  "event": "notification.create",
  "data": {
    "idstackUserId": "<IDStack 用户主键>",   # 或 userId（message 域 User.id）
    "category": "benefit",                   # interaction|order|system|benefit|app
    "title": "收益到账",
    "summary": "您有一笔 12.50 元收益已到账",
    "level": "A",                            # A服务(退订不影响) | B营销(须显式订阅) | C会话
    "link": "rdm://earn/history"             # deep link（rdm://{scheme}/{businessId}）或 http(s)
  }
}
```

**category 语义对照**（接入方按业务映射）：

| category | 语义 | 接入方典型事件 |
|---|---|---|
| `benefit` | 权益 | 收益到账、会员权益、余额变动 |
| `order` | 订单交易 | 订单状态、物流、交易 |
| `system` | 系统公告 | 系统公告、举报结果、安全通知 |
| `interaction` | 互动 | 评论回复、赞、关注（也可用 `interaction` 事件，24h 同源聚合） |
| `app` | 应用/服务号 | 应用自己的通知 |

**互动事件**（评论回复等，带 24h 聚合）：

```json
{
  "event": "interaction",
  "data": {
    "idstackUserId": "<接收方用户>",
    "actorId": "<评论者 ID>",
    "actorName": "张三",
    "action": "comment",                     # like|comment|follow|mention
    "targetId": "<被评论的内容 ID>",
    "targetTitle": "你的广告收到了新评论",
    "sourceAppId": "<你的 appId>"
  }
}
```

#### ② 展示出：换取 message token 后嵌入组件

接入方前端已持 IDStack token（SSO 登录后拿到），先换成 message token：

```http
POST /api/v1/auth/idstack/exchange
Content-Type: application/json

{ "idstackAccessToken": "<IDStack access_token>" }
# 返回 { accessToken, refreshToken, user, capabilities }，其中 accessToken 即 message token
```

再嵌入消息中心组件（Web，只读：展示 + 已读 + 跳转）：

```html
<script src="https://message.raodaor.com/embed/notification-center.js" async></script>
<rdm-notification-center app-id="YOUR_APP_ID" style="width:360px;height:560px"></rdm-notification-center>
<script>
  document.querySelector('rdm-notification-center').token = '<message accessToken>';
</script>
```

> 或在自有 APP/Web 里直接调用户接口自渲染：`GET /notifications`（列表）、`GET /notifications/unread`（未读角标）、`POST /notifications/:id/read`（已读）。

### 4.2 IM 双聊（会话 / 消息 / 好友）

把自研私信或好友体系迁到 message 时的完整协议，见 **[im-integration.md](./im-integration.md)**。

要点速览：

- **会话**：`POST /conversations { type:'single', targetUserId }`（幂等）、`GET /conversations?page&limit`
- **消息**：`GET/POST /conversations/:cid/messages`；**seq 游标分页**（`beforeSeq` 翻页 / `afterSeq` 断线补齐）
- **发送幂等**：**必带 `clientMsgId`**（≤64 字符）——同一会话内同值只落库一次，消除弱网重试 / 重连补发的重复消息
- **已读**：会话级游标 `POST /conversations/:cid/read { lastReadSeq }`（**无单条 readAt**）
- **撤回**：`POST /messages/:id/recall`（**2 分钟内**，超时 `2003`）；**typing**：`POST /conversations/:cid/messages/typing`（无 body，客户端 3s 防抖）
- **实时**：Socket.IO `path:'/ws'` + `auth.token`，服务端事件 `message.created` / `read.receipt` / `chat:typing` / `friend.request` 等（**无 `chat:message`**）
- **好友**：`/relations/*`（申请/接受/拒绝/好友/黑名单/私信门槛）
- **身份**：接口用内部 `User.id`；只有 IDStack 主键时用 `POST /users/resolve` 批量解析

### 4.3 服务号消息（Open API）

应用入驻审批通过后，以「服务号」身份向已订阅用户下发消息（B 端营销须显式订阅）：

```http
POST /api/v1/open/messages/send
X-API-Key: <rdmapp_ 开头的应用 Key>

{
  "userId": "<接收方 message 域 User.id 或 idstackUserId>",
  "title": "会员日专享",
  "summary": "全场 8 折",
  "level": "B",
  "link": "rdm://mall/campaign/123"
}
```

前置：应用入驻（`POST /admin/apps` → 审批）→ 签发 API Key（`POST /open/api-keys`）→ 用户订阅（`AppSubscription`）。

### 4.4 网页客服悬浮窗

第三方站点一行接入：

```html
<script src="https://message.raodaor.com/embed/widget.js" data-app-id="YOUR_APP_ID" async></script>
```

访客匿名会话（自动签发 visitorToken），登录后 `POST /widget/claim` 合并身份；坐席在工作台接待。

### 4.5 App 推送

```http
POST /api/v1/push/devices          # 注册设备 token（platform: web|ios|android|h5）
Authorization: Bearer <message token>
{ "platform": "android", "token": "<Expo/FCM token>" }
```

消息触发推送由 message 在通知/消息投递时自动完成（未订阅/勿扰/静默按规则跳过）。

---

## 5. 完整示例：raodaor-ad 接入「收益到账通知」

```js
// ① 后端：收益结算时投递通知（Node 伪码）
await fetch('https://message.raodaor.com/api/v1/internal/notifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Raodaor-Message-Inbound-Key': process.env.RAODAOR_MESSAGE_INBOUND_KEY,   // 开放平台为对接方签发的独立入站密钥
  },
  body: JSON.stringify({
    event: 'notification.create',
    data: {
      idstackUserId: user.idstackUserId,
      category: 'benefit',
      title: '收益到账',
      summary: `您有一笔 ${amount} 元收益已到账`,
      level: 'A',
      link: 'rdm://earn/history',
    },
  }),
});

// ② 前端：免二次登录换 message token，再注入组件
const ex = await fetch('https://message.raodaor.com/api/v1/auth/idstack/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idstackAccessToken: idstackToken }),  // 已登录的 IDStack token
});
const { accessToken } = (await ex.json()).data;
document.querySelector('rdm-notification-center').token = accessToken;
```

---

## 6. 错误码段（对齐生态 `{ code, data, message }`）

| 段 | 语义 |
|---|---|
| 1000–1999 | 鉴权 / 凭证 |
| 2000–2999 | 会话 / 消息 |
| 3000–3999 | 配额（3001 超额拒绝） |
| 4000–4999 | 客服 |
| 5000–5999 | 推送 |
| 6000–6999 | 开放平台 / Webhook（6001 营销未订阅拒绝） |
| 7000–7999 | 内容安全 |

---

## 7. 配置项（接入方需与 message 侧约定）

| 项 | 说明 |
|---|---|
| `RAODAOR_MESSAGE_API_KEY` | 应用 API Key（`rdmapp_` 开头；`X-API-Key`，服务号消息下发） |
| `RAODAOR_MESSAGE_INBOUND_KEY` | 对接方入站密钥（开放平台签发，每对接方独立；`X-Raodaor-Message-Inbound-Key`） |
| `RAODAOR_MESSAGE_WEBHOOK_SECRET` | Webhook 订阅签名密钥（验 message 回调 `X-RDM-Signature`） |
| `IDSTACK_JWKS_URI` / `IDSTACK_ISSUER` | message 验签 IDStack token 用（`/auth/idstack/exchange` 依赖） |
| `CORS_ALLOW_ORIGINS` | 接入方源需加入 message 后端白名单（跨源请求） |
| 域名白名单 | 卡片/服务号 deep link 的 http(s) 外链域名（`App.redirectDomains`） |
