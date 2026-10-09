<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-message/im-integration.md；修改请提交至 hub 仓库，勿直接编辑 -->

# IM 双聊接入（会话 / 消息 / 关系链）

> 面向**接入方**：把自研私信 / 好友体系迁移到 message，或新增 IM 能力。
> 后端根地址：`https://message.raodaor.com/api/v1`（dev：`http://localhost:9012/api/v1`）
> 配套：[overview.md](./overview.md)（消息中心 / 服务号 / 客服 / 推送能力总览）

---

## 0. 前置

- [ ] 完成 [quickstart.md](./quickstart.md) §0（开放平台入驻审批 → 凭证签发 → 前端源加入 CORS 白名单）
- [ ] 用户已通过 **IDStack SSO** 登录，接入方持有其 IDStack access_token

## 1. 换 token

```http
POST /api/v1/auth/idstack/exchange
{ "idstackAccessToken": "<IDStack access_token>" }
# → data.accessToken（15m）/ data.refreshToken / data.user.id
```

续期：`POST /api/v1/auth/refresh` `{ refreshToken }`（旋转刷新，旧 refresh 作废）。

## 2. 会话（conversation）

| 操作 | 端点 | 参数 |
|---|---|---|
| 创建单聊（幂等） | `POST /conversations` | `{ "type":"single","targetUserId":"<User.id>" }` |
| 会话列表 | `GET /conversations` | `page`（≥1）、`limit`（1..50，默认 20） |
| 详情 | `GET /conversations/:id` | — |
| 置顶 / 免打扰 | `PATCH /conversations/:id/settings` | `{ pinned?, muted?, mutedUntil? }` |
| 已读上报 | `POST /conversations/:id/read` | `{ "lastReadSeq": <number> }` |

- **未读 = `lastSeq − lastReadSeq`**（物化，无独立未读表）
- **已读 = 会话级游标**，只增不减、幂等；对端收 WS `read.receipt`
- 自己对自己 → `2005`；目标不存在 → `2006`
- 排序：置顶 → `lastMessageAt` 倒序

## 3. 消息

### 拉取（**seq 游标分页**，非 page/offset）
```http
GET /conversations/:cid/messages?limit=30                 # 首屏历史
GET /conversations/:cid/messages?beforeSeq=123&limit=30    # 向前翻页
GET /conversations/:cid/messages?afterSeq=456             # 断线补齐（上限 100）
```
→ `{ items: MessageVo[], hasMore, lastSeq, myLastReadSeq }`

`MessageVo`：`{ id, conversationId, seq, clientMsgId, senderType, senderId, type, content, refMessageId, refMessage, proxyAgentId, status, createdAt }`
- `status`：`normal | recalled | rejected`；已撤回/下线时 `content` 为 `null`
- **没有单条 `readAt`**——已读一律看会话游标

### 发送
```http
POST /conversations/:cid/messages
# text
{ "type":"text",  "content":{ "text":"你好" } }
# image（fileId 由上传链路获得）
{ "type":"image", "content":{ "fileId":"...","name":"a.png","size":123,"mimeType":"image/png" } }
# card（product|match|order|link）
{ "type":"card", "content":{ "card":{ "kind":"match","title":"...","payload":{} } } }
```

可选：`refMessageId`（引用回复）、**`clientMsgId`**。

**幂等（FR-IM-16）**：带 `clientMsgId` 后，同一会话内同值**只落库一次**；
弱网重试 / 重连补发保持同值即可消除重复消息。重复提交返回首次落库的消息（含原 `seq`）。

限制：文本 ≤4000 字；附件 ≤100MB 且 `mimeType` 需与类型匹配；**30 条/分钟**（超限 `7001`）；
敏感词 `7002`；禁言 `7004`；封禁 `7005`。

### 其他

| 操作 | 端点 |
|---|---|
| 撤回（**2 分钟内**，超时 `2003`） | `POST /messages/:id/recall` |
| 本地删除（仅自己不可见） | `DELETE /messages/:id` |
| 批量本地删除（≤100） | `POST /messages/local-delete` `{ messageIds }` |
| 转发（≤10 条 → ≤5 会话） | `POST /messages/forward` `{ messageIds, targetConversationIds }` |
| 会话内搜索（text，≤50） | `GET /conversations/:id/messages/search?q=` |
| typing（3s 防抖，不落库） | `POST /conversations/:cid/messages/typing` |

---

## 4. 实时通道（Socket.IO）

```js
io('https://message.raodaor.com', {
  path: '/ws', transports: ['websocket'],
  auth: { token: accessToken },   // 本服务 access JWT
  reconnection: true,
});
```

- 握手：`auth.token` 或 `query.token`；无效即断开，客户端负责续期重连
- **写操作一律走 REST**，WS 仅服务端→客户端推送；可 `ping` 做心跳
- **断线补齐**：重连后 `GET /conversations/:cid/messages?afterSeq=<本地最大 seq>`

服务端事件：`connected` / `message.created`（= `MessageVo`）/ `message.recalled` / `message.updated` / `read.receipt` / `chat:typing` / `conversation.created` / `conversation.deleted` / `friend.request` / `friend.changed` / `relation.blocked` / `relation.unblocked` / `presence.changed` / `notification.created` / `notification.read` / `cs.*`

> ⚠️ 新消息事件是 **`message.created`**，不存在 `chat:message`。

## 5. 好友关系（relation）

| 能力 | 端点 |
|---|---|
| 发起申请 | `POST /relations/requests` `{ targetUserId, verifyMessage? }`（≤50 字） |
| 收到的申请 | `GET /relations/requests` |
| 接受 / 拒绝 | `POST /relations/requests/:id/accept` / `/reject` |
| 好友列表 | `GET /relations/friends` |
| 删除好友 | `DELETE /relations/friends/:userId` |
| 备注 | `PUT /relations/friends/:userId/remark` `{ remark? }` |
| 黑名单列表 | `GET /relations/blocks` |
| 拉黑（`deleteBoth:true` = **断联**，双向删会话与历史，不可恢复） | `POST /relations/blocks` `{ blockedUserId, deleteBoth? }` |
| 加好友验证开关 | `GET/PUT /relations/policy`（`everyone｜verify｜none`） |
| 私信门槛 | `GET/PUT /relations/message-gate`（`none｜verified｜mutual`） |

申请有效期 7 天；发消息前校验黑名单（`2107`）与私信门槛（`2108`）。

## 6. 附件 fileId 来源

```
POST /uploads → POST /uploads/:uploadId/chunks/:index → POST /uploads/:uploadId/complete
GET  /uploads/files/:fileId            （审核态 REVIEWING → ACTIVE/BLOCKED）
GET  /uploads/files/:fileId/sign-url   （签名短链）
```
下发时 `content` 注入 `mediaUrl`（签名短链，不落库）。

## 7. 身份映射（关键）

**所有关系 / 会话 / 消息接口一律使用内部 `User.id`（cuid），不是 `idstackUserId`。**

接入方通常只持有 IDStack 主键，解决办法（二选一）：

- **推荐**：接入方在自己的库里缓存 `idstackUserId → message User.id` 映射（登录/首次建会话时写入）
- 或调 `POST /api/v1/users/resolve` `{ idstackUserIds: [...] }`（1..200）批量解析，返回 `{ users: [{ idstackUserId, userId, nickname, avatarFileId }] }`；
  仅命中「已登录过本平台」的用户，未命中的主键不返回

## 8. 错误码

| 码 | 含义 |
|---|---|
| `2001` | 会话不存在或非成员（404） |
| `2002` | 消息不存在 / 只能撤回自己的（404） |
| `2003` | 超过 2 分钟撤回时限 |
| `2004` | 消息体不合法 |
| `2005` / `2006` | 不能与自己建会话 / 目标用户不存在 |
| `2007` | 引用消息无效 |
| `2008` | 发送前钩子拒绝（合规拦截） |
| `2101`~`2108` | 关系链：自己操作 / 已好友 / 重复申请 / 申请不存在 / 禁止加好友 / 好友不存在 / 黑名单 / 私信门槛 |
| `7001` | 发送限流 30 条/分钟（429） |
| `7002` / `7004` / `7005` | 敏感词 / 禁言 / 封禁 |
| `1010` / `1011` | 未登录 / 令牌无效（401） |
| `1001` | 参数校验失败（含多余字段） |

## 9. 推荐调用序列

```
1) POST /auth/idstack/exchange → accessToken + user.id（缓存映射）
2) io(host, { path:'/ws', auth:{ token } }) 并订阅 §4 事件
3) POST /users/resolve { idstackUserIds }     → 好友的 User.id
4) POST /conversations { type:'single', targetUserId } → conversationId
5) GET  /conversations/:cid/messages?limit=30          → 首屏历史
6) POST /conversations/:cid/messages { type:'text', content:{text}, clientMsgId } → seq
7) POST /conversations/:cid/read { lastReadSeq }
```

## 10. 合规（校园 / 未成年人场景必读）

钩子说明见 [pre-send-hook-example.md](./pre-send-hook-example.md) 与 [platform-architecture.md](./platform-architecture.md) §5.2；拒绝返回 `2008`。
钩子超时默认 fail-open，合规场景须设 `failClosed: true`。
