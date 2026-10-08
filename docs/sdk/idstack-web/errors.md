<!-- 由 ai-docs 同步自 canonical/sdk/idstack-web/errors.md；修改请提交至 hub 仓库，勿直接编辑 -->

# IDStack 接入排错手册

> 所有错误响应为统一信封 `{ success:false, error, code }`。排查顺序：先看 HTTP 状态与 `code` 定位大组，再按「排查方向」逐条核对。

## 1. SSO 授权跳转错误

| `code` | HTTP | 含义 / 排查方向 |
|--------|------|-----------------|
| `INVALID_STATE` | 401 | state 非法/过期/不匹配。细分：`State payload is malformed`（签名非法或不存在，多为自实现内存 state 方案）→ 改用 IDStack 签名 state；`State expired`（超 10 分钟 TTL）→ 提示用户重新登录；`State does not match...` → 用错账号或 app 登录，非 TTL 问题 |

## 2. 换 token 错误（`/oauth/token`）

| `code` | HTTP | 含义 / 排查方向 |
|--------|------|-----------------|
| `INVALID_PARAMS` | 400 | 缺 `grant_type`/`code`/`redirect_uri`/`client_id`/`client_secret` 之一 |
| `UNSUPPORTED_GRANT_TYPE` | 400 | 平台**不支持 `client_credentials`** 换用户 token |
| `INVALID_CLIENT` | 401 | `client_id`/`client_secret` 不匹配（须为该 app 的 `api_key`/`secret_key`） |
| `INVALID_CODE` | 400 | 授权码不存在（取错字段或已被消费） |
| `CODE_ALREADY_USED` | 400 | 授权码一次性，勿重复换取 |
| `CODE_EXPIRED` | 400 | 授权码超 10 分钟，重新发起登录 |
| `REDIRECT_URI_MISMATCH` | 400 | `redirect_uri` 与授权时不**字节级一致**（大小写/尾斜杠/端口） |
| `APP_MISMATCH` | 400 | `client_id` 对应的 app 与发码 app 不同 |

## 3. 看板错误（`/analytics/dashboard/*`）

| `code` | HTTP | 含义 / 排查方向 |
|--------|------|-----------------|
| `MFA_REQUIRED` | 401/403 | 走了用户 JWT 通道。**根因：嵌入未传 `app_id`** → 组件显式传 `appId` 或 URL 带 `?app_id=`，走 `x-app-id` 应用通道（豁免 MFA） |
| `MISSING_TENANT` | 401 | JWT 缺 `tenant_id`（非 IDStack 合法用户令牌） |
| `INVALID_APP` | 401 | `x-app-id` 的 app 不存在或非 `active`，后台确认已激活 |

## 4. 埋点上报错误（`POST /api/v1/analytics/events`）

| 现象 | 含义 / 排查方向 |
|------|-----------------|
| 401 无 `x-app-id` / `INVALID_APP` | 请求头缺 `x-app-id`，或 appId 与后台 app 不匹配/未激活 |
| 403 密钥不符 | 仅当携带 `x-app-secret` 时校验（上报可不带 secret）；检查代理是否改写了上报体 |
| 403 `ORIGIN_NOT_ALLOWED` | 来源不在 `analytics_allowed_origins` 白名单，后台「编辑应用」加入即可 |
| CORS 预检失败 | 前端来源不在后端 `CORS_ALLOW_ORIGINS`（开发期 localhost 默认放行） |
| 事件落入错误租户 | `appId` 传错（如误传租户 ID）。`app_id` 是应用 UUID |

## 5. 「等待宿主页面鉴权超时」排查路径

握手链路：`嵌入页 READY → 宿主 AUTH_REQUEST → 嵌入页 applyIdentity → AUTH_OK → onReady`，任一步断掉 15s 超时。按序检查 Console：

1. **嵌入页广播 READY**：`[Embed] 广播 READY → parent`？没有 → 嵌入页自身加载失败
2. **宿主收到 READY 并发 AUTH_REQUEST**：没有 → 宿主 `origin` 配错（填成了 API 域名，应为嵌入页前端地址）
3. **嵌入页接收 AUTH_REQUEST**：若打印 `拒绝来自非白名单来源` → 宿主 origin 未加入 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`（生产必须显式配置，改完**重启 IDStack 前端**）
4. **回执 AUTH_OK**：`应用凭证通道握手完成` + `广播 AUTH_OK`，宿主触发 `onReady`

## 6. 常见误用速查（违反即翻车）

| 误用 | 后果 | 正确做法 |
|------|------|----------|
| 授权 URL 写成静态配置（`ssoUrl: "..."`） | state 失去防 CSRF 作用；参数错位（真实踩坑：授权码发到错误应用） | 运行时动态拼接，每次生成新 `state` |
| 授权端点用 `/sso/authorize` | 路径不存在（`/sso/*` 是出站 SSO），登录回退错误应用 | 用 `/oauth/authorize` |
| 授权端点传 `client_id` 而非 `app_id` | 参数被忽略，拿不到授权码 | 授权用 `app_id`；`client_id` 仅换 token 时用 |
| `redirect_uri` 未登记 | `INVALID_REDIRECT_URI` | 后台预先登记，字节级一致 |
| 浏览器端拿 `client_secret` 换 token | 密钥暴露 | 换 token 必须后端→后端 |
| 从顶层读 `resp.access_token` | 「未返回 access_token」 | 读 `resp.data.access_token` |
| 以 `data.user.roles` 为角色唯一来源 | 该字段可能缺失 → 误判为最小权限（「IDStack 没同步角色」的根因） | 解码 `access_token` 读 JWT `roles` claim |
| 读 `payload.sub` 当用户主键（OIDC 惯例） | JWT 无 `sub` claim（主键叫 `id`，`sub` 仅在 userinfo 响应体），读到 `undefined` → 「用户主键为空」登录失败（如报 `9004 缺少 sub`，SSO 100% 失败）；展示名读 `name`/`nickname` 会永远走兜底昵称 | 读 **`payload.id`**（与 webhook 载荷 `userId` 同源）；展示名读 `user_name` |
| 用终端用户 token 调 `GET /api/v1/roles` / `GET /api/v1/permissions` 拉「角色 → 权限」 | 403 `no_permission` | 让租户管理员在 IDStack 后台为该业务角色绑定 `role:read` / `permission:read` 权限点（租户/系统管理员默认放行） |
| 前端做验签 / 持有验签材料 | JWT 可伪造 | 验签仅在目标 APP 后端：拉 JWKS 公钥（RS256，钉死算法 + 校验 `iss`）；纯前端 SPA 由自己的后端/BFF 验签后下发结论 |

## 7. 埋点 SDK 自查工具

```js
analytics.getStatus();    // SDK 状态与队列大小
analytics.flushQueue();   // 手动上报测试
analytics.initialize({ ...config, debug: true });  // 调试模式
```

离线缓存：断网时事件存 localStorage，恢复后自动上报；页面卸载走 sendBeacon。
