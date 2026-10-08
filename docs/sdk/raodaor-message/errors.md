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
| 7000–7999 | 内容安全 | 敏感词命中、禁言 |

## 已确认的具体码

| 码 | 含义 | 处置 |
|---|---|---|
| `2008` | 发送被 pre-send 钩子拒绝 | `message` 即业务方回调返回的 `reason`（如「禁聊时段」「未通过家长审核」），直接透传展示；排查业务方回调逻辑 |
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
