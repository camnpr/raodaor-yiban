<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-message/errors.md；修改请提交至 hub 仓库，勿直接编辑 -->

# RaoDaor Message 错误码字典与排查路径

> 响应统一为 `{ code, data, message }`。错误码按段划分，具体码以 message 后端为准；下表为段语义与**已确认的具体码**。

## 错误码段总表

| 段 | 语义 | 典型原因 |
|---|---|---|
| 1000–1999 | 鉴权 / 凭证 | token 缺失/过期、通道用错、密钥不一致 |
| 2000–2999 | 会话 / 消息 | 消息校验失败、会话不存在、钩子拒绝（2008） |
| 3000–3999 | 配额 | 3001 超额拒绝 |
| 4000–4999 | 客服 | 会话状态、坐席分配 |
| 5000–5999 | 推送 | 设备未注册、通道失败 |
| 6000–6999 | 开放平台 / Webhook | 6001 营销未订阅拒绝 |
| 7000–7999 | 内容安全 / 发送限流 | 敏感词命中、禁言、30 条/分钟限流（7001） |

## 已确认的具体码

| 码 | 含义 | 处置 |
|---|---|---|
| `2001` | 会话不存在或非成员（404） | 核对 conversationId 与当前用户是否为成员 |
| `2002` | 消息不存在 / 只能撤回自己的（404） | 撤回只能撤自己发的消息 |
| `2003` | 超过 2 分钟撤回时限 | 撤回窗口已过，不可补救 |
| `2004` | 消息体不合法 | 校验 `type` 与 `content` 结构（text/image/card） |
| `2005` / `2006` | 不能与自己建会话 / 目标用户不存在 | 目标 `targetUserId` 须为已登录过本平台的 `User.id` |
| `2007` | 引用消息无效 | `refMessageId` 须属同一会话 |
| `2008` | 发送被 pre-send 钩子拒绝 | `message` 即业务方回调返回的 `reason`（如「禁聊时段」「未通过家长审核」），直接透传展示；排查业务方回调逻辑 |
| `2107` / `2108` | 黑名单拦截 / 私信门槛不满足 | 查 `/relations/blocks` 与 `/relations/message-gate`（none｜verified｜mutual） |
| `7001` | 发送限流 30 条/分钟（429） | 客户端限流并重试；避免重连补发打满 |
| `7002` / `7004` / `7005` | 敏感词 / 禁言 / 封禁 | 按 message 返回提示处理，勿重试绕过 |
| `1010` / `1011` | 未登录 / 令牌无效（401） | message token 15m 过期，用 `POST /auth/refresh` 旋转刷新 |
| `1001` | 参数校验失败（含多余字段） | 请求体禁止多余字段，逐字段比对 DTO |
| `3001` | 配额超额拒绝 | 计量用量达上限；关注 `quota.warning` webhook（≥90% 预警），联系平台调额 |
| `6001` | 营销消息未订阅拒绝 | B 级消息的接收用户无 `AppSubscription`；引导用户订阅后再发，或改用 A 级服务消息 |

## 排查路径（按现象）

### 401 / 鉴权失败（1000 段）

1. **确认用对通道**：用户态读写用 `Bearer <message token>`（不是 IDStack token）；服务号下发用 `X-API-Key: rdmapp_...`；服务端事件投递用 `X-Raodaor-Message-Inbound-Key: rdae_...`（每对接方独立入站密钥）
2. **token 拿错是最常见坑**：`POST /auth/idstack/exchange` 的返回 `accessToken` 才是 message token；IDStack access_token 只用于 exchange
3. API Key 是否已签发且未吊销；应用是否已 `approved`（pending/rejected 状态无法签发与使用凭证）
4. **入站密钥轮换即失效**：刚在控制台轮换过 `rdae_` 密钥后，旧值立即 401——确认环境变量已更新
5. 入站密钥是否为开放平台为**当前对接方**签发的最新值（每对接方独立，不与其他对接方共用）

### 跨源请求失败（前端控制台 CORS 报错）

- 接入方前端源未加入 message 后端 `CORS_ALLOW_ORIGINS` 白名单 → 联系平台加入

### 消息没到 / 没推送

1. 投递请求返回是否成功（先查 1000 段鉴权）
2. `level: "B"` 时用户是否订阅（未订阅 `6001` 拒绝）
3. 推送未到：设备是否已 `POST /push/devices` 注册；用户勿扰/免打扰/静默设置会按规则跳过
4. `interaction` 事件 24h 同源聚合，多条可能合并展示，非丢失

### IM 消息发不出 / 收不到（会话与消息域）

1. **身份取错**：会话/消息/关系接口用内部 `User.id`（cuid），不是 `idstackUserId`；只有 IDStack 主键时 `POST /users/resolve` 批量解析（未登录过本平台的用户不返回）
2. **重复消息**：发送未带 `clientMsgId`，弱网重试/重连补发落库多次——保持同值即可幂等
3. **消息拉不全**：用 **seq 游标**（`beforeSeq` 翻页 / `afterSeq` 断线补齐），不是 page/offset；重连后以本地最大 `seq` 补齐
4. **撤回失败 `2003`**：超过 2 分钟窗口
5. **发送被限流 `7001`**：30 条/分钟；客户端做节流与退避
6. **被关系链拦截**：`2107`（黑名单）/ `2108`（私信门槛），先查 `/relations/*`
7. **WS 收不到新消息**：事件名是 `message.created`（**不存在 `chat:message`**）；WS 仅服务端→客户端推送，发消息/已读/撤回必须走 REST；握手 token 无效会直接断开，需 `POST /auth/refresh` 后续期重连

### pre-send 钩子行为异常

1. **该拦截的没拦截**：检查回调超时（默认 2s）是否触发降级——fail-open 会放行；合规场景必须配置 `failClosed: true`
2. **回调收不到**：`PUT /cs/pre-send-hook?organizationId=...` 的 URL 是否可达（公网）、组织 ID 是否正确
3. **用户识别失败**：回调 payload 里用 `idstackUserId` 反查本地用户，`senderId` 是 message 内部 cuid 不可用
4. **误拒**：检查回调内慢查询/异常；回调须幂等且快速，慢规则做缓存

### Webhook 事件收不到 / 回调 401

1. 确认订阅端点（`POST /open/webhooks` 登记）状态为 `active`（`paused` 不投递；`PATCH /open/webhooks/:id` 可恢复）
2. **验签失败（本地返回 401）**：用 `secret`（登记/轮换时返回的 48hex）对**原始 body 字节**算 `HMAC-SHA256`，与 `X-RDM-Signature: sha256=...` 比对；刚轮换过密钥的旧值立即失效
3. **重复收到事件是正常行为**：至少一次投递，非 2xx 按 `1m / 5m / 30m / 2h / 6h` 重试 5 次；用 `X-RDM-EventId` 去重幂等
4. 审计类事件（`message.recalled`/`friend.request`/`user.muted` 等）按用户**主组织**分发（登录时取首个 `roles[].tenant_id` 映射组织）——多组织用户可能分发到非预期组织
5. 事件名以 `WebhookEvents` 事件集为准（`quota.warning` / `cs.session.*` / `message.created` / `push.delivered` 等），完整目录见 `developer-platform.md` §6

### deep link / 外链打不开

- http(s) 外链域名未在 `App.redirectDomains` 白名单；deep link 须为 `rdm://{scheme}/{businessId}` 格式
