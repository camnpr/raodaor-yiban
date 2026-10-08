<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-file/errors.md；修改请提交至 hub 仓库，勿直接编辑 -->

# RaoDaor File 接入排错手册

> 排查顺序：先看 HTTP 状态、响应 `code`/`message`，再确认 token 类型、租户、origin 和请求体。错误响应以服务端实际统一信封为准，本文按常见现象归类。

## 1. 认证与租户

| 现象 / code | 常见原因 | 排查与修复 |
|---|---|---|
| `401 Unauthorized` / JWT invalid | 把 IDStack token 当成 RaoDaor File token，token 过期，或 `JWT_ACCESS_SECRET` 不一致 | 先走 SSO 换取本库 token；确认 `Authorization: Bearer`、服务端时间和密钥配置 |
| `401` / missing `userId` 或 `tenantId` | JWT payload 不完整或使用了错误环境的 token | 解码仅用于排查，服务端验签并确认 `{ userId, tenantId }` 来自当前会话 |
| `403 Forbidden` / tenant denied | 请求资源属于另一个租户，或成员角色不足 | 检查文件的 `tenantId`、当前用户 Membership/OWNER/ADMIN 权限；不要用前端参数绕过隔离 |
| 应用租户上传后用户看不到文件 | 误用用户 token 直传，文件落到了个人租户 | 模式 B 必须由目标 APP 后端用应用租户 ApiKey 代理上传，并保存 `fileId` 映射 |
| ApiKey invalid / application not found | ApiKey 被撤销、环境错误或应用租户未由平台开通 | 联系平台管理员确认 `APPLICATION` 租户、`appId` 绑定和 ApiKey 状态；密钥只在服务端使用 |

## 2. SSO 与换票

| 现象 / code | 常见原因 | 排查与修复 |
|---|---|---|
| 授权页参数错误 / `INVALID_PARAMS` | 漏传 `app_id`、`redirect_uri`、`response_type` 或 scope | 使用 `/oauth/authorize`，运行时拼接参数并生成随机 `state` |
| `INVALID_CLIENT` | `client_id`/secret 不匹配 | 授权跳转用 `app_id`；换 token 时 `client_id` 必须是该应用的 `api_key`，secret 仅后端 |
| `REDIRECT_URI_MISMATCH` / `INVALID_REDIRECT_URI` | 回调地址与后台登记值不完全一致 | 比对大小写、协议、端口、路径和尾斜杠，做到字节级一致 |
| `INVALID_CODE` / `CODE_ALREADY_USED` | code 取错字段、重复消费或跨环境使用 | 从 `response.data` 取值；授权码一次性，重新发起登录 |
| `CODE_EXPIRED` | 授权码超过有效期 | 重新授权，不要缓存 code |
| SSO 回调成功但拿不到 token | 错读顶层字段 | 检查 `response.data.access_token`，不要读取 `response.access_token` |

## 3. 上传、签名与文件访问

| 现象 | 常见原因 | 排查与修复 |
|---|---|---|
| 分片上传卡在 uploading | 未按服务端返回的 session/chunk 状态继续，或中途刷新丢失会话 | 让 SDK 管理分片、重试和完成确认；记录 upload/session ID，避免并发覆盖 |
| 上传完成但列表没有文件 | 完成确认未成功，或列表查询使用了不同 tenant token | 检查最终 complete 请求响应与 `tenantId`，再重新查询 |
| 签名链接 `403` / expired | URL 已过期、签名密钥/实例配置不一致或 URL 被改写 | 重新签发短链，所有实例使用同一 `FILE_SIGN_SECRET`，完整保留签名参数 |
| 公开 URL 可访问但 Bearer 下载失败 | 两条访问通道语义不同 | 公开展示使用签名 URL；管理/私有下载使用本库 Bearer 且在正确租户内 |
| 删除/下载其他用户文件成功 | 严重越权缺陷或错误的服务端代理 | 立即停止发布，检查后端按 `tenantId` 的授权条件和应用租户边界；不要仅依赖前端隐藏按钮 |
| 刚上传的图对外展示裂图 | 文件默认 `REVIEWING`，对外签名短链 `serveSigned` 只放行 `ACTIVE` | 轮询 `getFile` 状态或订阅 `file.reviewed`，变 `ACTIVE` 再展示；UI 先放占位图；或让平台管理员关闭该租户 `autoReview` 开关 |
| `signUrl` 报「文件状态不可生成公开链接」 | 文件仍在 `REVIEWING`，下载型签名（`inline=false`）只接受 `ACTIVE` | 等审核通过再签；或先签 `inline=true` 预览型 |
| 裸 `/blobs/<hash>` 地址被外部刷/泄露 | 该路由公开可读、无鉴权、无过期、无法撤销 | 对外改用 `signUrl` 短期签名链接，敏感内容绝不裸发 |

## 4. Picker、Embed、CORS 与 Webhook

| 现象 | 常见原因 | 排查与修复 |
|---|---|---|
| picker/embed 鉴权超时 | origin 填成 API 域名、宿主未在白名单、握手消息被过滤 | 使用嵌入页前端 origin；双向校验 `event.origin`；生产修改白名单后重启前端 |
| `postMessage` 消息被拒绝 | 未严格匹配允许 origin，或 origin 含尾斜杠/协议不一致 | 统一规范 origin，检查 READY/AUTH_REQUEST/AUTH_OK 消息顺序，token 不进 URL |
| CORS 预检失败 | 宿主域名未加入 `CORS_ALLOW_ORIGINS` | 在服务端加入精确生产 origin，避免用 `*` 配合凭证；确认部署已加载新环境变量 |
| Webhook 重复处理 | 未按事件 ID 幂等 | 建立事件 ID 唯一约束/去重表；重复投递直接返回成功，不重复执行业务操作 |
| Webhook 验签失败 | secret 错误、原始 body 被 JSON 重序列化或时间戳过期 | 使用原始请求体验签，确认环境 secret、签名头和时钟；不要先改写 body |

## 5. 快速安全检查

- 浏览器 bundle、日志、URL、错误上报中不得出现 ApiKey、client secret、JWT signing secret。
- 所有文件读写接口都在服务端验证租户和角色；业务 `user_id` 与 RaoDaor File `fileId` 的关联保存在目标 APP。
- 生产仅允许明确的 CORS、picker 和 Embed origins；签名链接设置最小有效期。
- 对外访问统一走 `signUrl` 短期签名短链，不把裸 `/blobs/*` 地址或管理 token 直接下发；敏感内容绝不生成公开链接。
- 上传后处理 `REVIEWING` 审核态：轮询 `getFile` 或订阅 `file.reviewed`，确认 `ACTIVE` 再对外展示，避免"上传即裂图"。
