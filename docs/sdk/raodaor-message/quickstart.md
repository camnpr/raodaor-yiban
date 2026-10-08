<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-message/quickstart.md；修改请提交至 hub 仓库，勿直接编辑 -->

# RaoDaor Message 接入清单（Quickstart）

> 按场景勾选。前置项（§0）为所有场景共用；凭证签发详情见同目录 `developer-platform.md`，详细协议见 `overview.md`。

## 0. 前置约定（所有场景必做）

- [ ] 开放平台入驻：`POST /admin/apps`（带 scopes）→ 平台审批 `approved` 后才可签发凭证（详见 `developer-platform.md`）
- [ ] 签发**入站通知密钥**（`X-Raodaor-Message-Inbound-Key: rdae_`，开放平台为对接方签发，每对接方独立）；凭证仅服务端持有
- [ ] 接入方前端源加入 message 后端 `CORS_ALLOW_ORIGINS` 白名单
- [ ] 确认 IDStack SSO 已接入（换 message token 依赖 IDStack access_token；message 侧验签用 `IDSTACK_JWKS_URI` / `IDSTACK_ISSUER`）
- [ ] 若消息带 http(s) 外链，登记域名白名单（`App.redirectDomains`）；deep link 用 `rdm://{scheme}/{businessId}`

## 1. 站内消息中心（最常用）

**数据进（服务端投递事件）**：

- [ ] 收益/订单/系统等业务事件调用 `POST /internal/notifications`（携带 `X-Raodaor-Message-Inbound-Key` 入站密钥）
- [ ] `category` 按语义映射：`benefit`（权益）/ `order`（交易）/ `system`（公告）/ `interaction`（互动）/ `app`（应用）
- [ ] `level` 判级：A 服务 / B 营销（须订阅）/ C 会话
- [ ] 目标用户传 `idstackUserId`（或 message 域 `userId`）

**展示出（前端展示）**：

- [ ] 前端用 IDStack access_token 调 `POST /auth/idstack/exchange` 换 message token
- [ ] 嵌入 `<rdm-notification-center app-id="..." >` 并注入 `token`（**message accessToken，非 IDStack token**）；或自渲染（`GET /notifications`、`GET /notifications/unread`、`POST /notifications/:id/read`）

## 2. 服务号消息（Open API）

- [ ] 应用入驻：`POST /admin/apps`（带 `scopes`）→ 等待审批 `approved`（未通过签发凭证会失败）
- [ ] 签发 API Key：`POST /open/api-keys`（`rdmapp_` 开头，明文仅展示一次，仅服务端持有）
- [ ] 用户订阅（`AppSubscription`）——B 级营销未订阅会被 `6001` 拒绝
- [ ] 下发：`POST /open/messages/send`（`X-API-Key`），`level: "B"`，`link` 走 deep link 或白名单域名

## 3. 网页客服悬浮窗

- [ ] 页面引入 `<script src="https://message.raodaor.com/embed/widget.js" data-app-id="YOUR_APP_ID" async></script>`（一行接入）
- [ ] 访客匿名会话自动签发 visitorToken；登录后调 `POST /widget/claim` 合并身份
- [ ] 坐席在 message 工作台接待；进线/分配/关闭可订阅 Webhook 事件（`cs.session.*`）

## 4. App 推送

- [ ] 客户端注册设备：`POST /push/devices`（`Authorization: Bearer <message token>`，`platform: web|ios|android|h5`，token 为 Expo/FCM/APNs 设备令牌）
- [ ] 推送由 message 在通知/消息投递时自动触发，无需自行调用推送网关

## 5. Webhook 订阅（事件出站，同步业务系统）

- [ ] 登记：`POST /open/webhooks`（`appId` + `url` + `events`），保存返回的 `secret`（明文仅一次）
- [ ] 回调端点实现**验签**：`X-RDM-Signature: sha256=<HMAC-SHA256(rawBody, secret)>`，不匹配返回 401
- [ ] 用 `X-RDM-EventId` 去重幂等（至少一次投递，非 2xx 按 1m/5m/30m/2h/6h 重试 5 次）
- [ ] 仅订阅必要事件（如 `user.unsubscribed` → 取消营销；`message.created` → 机器人接力）；事件目录见 `developer-platform.md` §6

## 6. 发送前合规钩子（可选，IM 合规插桩）

- [ ] 业务方实现回调端点：接收 `{ conversationId, senderId, idstackUserId, type, content, organizationId }`，返回 `{ allow, reason? }`
- [ ] message 侧配置（组织级）：`PUT /cs/pre-send-hook?organizationId=...`（`url` / `timeoutMs` / `failClosed`）
- [ ] 合规场景（未成年人等）设 `failClosed: true`；回调 2s 内返回、幂等、用 `idstackUserId` 识别用户
- [ ] 完整示例见同目录 `pre-send-hook-example.md`
