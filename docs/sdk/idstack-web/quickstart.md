<!-- 由 ai-docs 同步自 canonical/sdk/idstack-web/quickstart.md；修改请提交至 hub 仓库，勿直接编辑 -->

# IDStack Web 接入清单（5 分钟跑通）

> 新接入方按顺序照做即可。逐步详解见 [features.md](./features.md)，嵌入协议见 [embed-integration.md](./embed-integration.md)。

## 第 1 步：平台侧登记（IDStack 后台）

1. **登记回调白名单**：为你的 app 登记 `redirect_uris`（SSO 回调地址，须与代码中**字节级一致**——大小写/尾斜杠/端口都不能差）
2. **领取凭证**：

| 凭证 | 环境变量 | 用途 |
|------|----------|------|
| `app_id`（应用 UUID） | `IDSTACK_APP_ID` | 授权跳转、看板嵌入、埋点上报 |
| `api_key` | `IDSTACK_APP_API_KEY` | 换 token 时的 `client_id` |
| `secret_key` | `IDSTACK_APP_SECRET_KEY` | 换 token 时的 `client_secret`（仅后端） |
| JWKS 公钥 | `IDSTACK_JWKS_URI`（可选，缺省由 API 域名推导）/ `IDSTACK_ISSUER`（可选） | 后端拉 `/.well-known/jwks.json` 公钥（RS256）验签读角色，**无需任何共享密钥** |

> ⚠️ `app_id` ≠ `client_id`：授权用 `app_id`，换 token 用 `client_id=api_key`。

## 第 2 步：安装 SDK

```bash
npm install @isudaji/raodaor-sdk-web-features @isudaji/raodaor-sdk-web-analytics
# 或 CDN：<script src="https://cdn.raodaor.com/js/sdk-web-features/dist/features.umd.min.js"></script>
```

## 第 3 步：SSO 登录（动态拼接授权 URL）

```ts
// 前端：每次登录动态生成（state 随机防 CSRF，禁止整条 URL 写成静态配置）
const url = new URL(`${base}/oauth/authorize`);          // 端点固定，不是 /sso/authorize
url.searchParams.set('app_id', appId);                    // 授权用 app_id
url.searchParams.set('redirect_uri', redirectUri);
url.searchParams.set('response_type', 'code');
url.searchParams.set('scope', 'openid profile offline_access');
url.searchParams.set('state', randomState);
window.location.href = url.toString();
```

```ts
// 后端：回调用 code 换 token（必须后端→后端调用，密钥不进浏览器）
const tokenRes = await fetch(`${apiBase}/api/v1/oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,          // 与授权时字节级一致
    client_id: apiKey,                  // 换 token 用 client_id=api_key
    client_secret: secretKey,
  }),
}).then(r => r.json());

const accessToken = tokenRes.data.access_token;  // ⚠️ 在 data 下，非顶层
```

续签：`grant_type=refresh_token`（refresh_token 会旋转，覆盖本地旧值）。

## 第 4 步：读取角色（JWT 是唯一权威）

```ts
import { parseRoles, hasRole, isTenantAdmin } from '@isudaji/raodaor-sdk-web-features';

const roles = parseRoles(accessToken);                  // 解码 JWT roles claim
if (isTenantAdmin(accessToken, MY_TENANT_ID)) {         // 必须带 tenant_id 比对
  enableAdminConsole();
}
```

> 不要依赖 `data.user.roles`（可能缺失）；后端敏感鉴权先拉 JWKS 公钥验签（RS256，钉死算法 + 校验 `iss`）。

## 第 5 步：嵌入功能模块

```tsx
import { IdStackEmbedReact as IdStackEmbed } from '@isudaji/raodaor-sdk-web-features';

<IdStackEmbed
  origin="https://idstack.raodaor.com"   // 嵌入页前端地址（不是 API 域名）
  token={accessToken}                    // SSO 换得的 access_token
  module="points-mall"                   // 合法模块名，非法立即抛错
/>
```

常用 module：`points-mall` / `task` / `collection` / `like` / `survey/:surveyId` / `payment-create` / `analytics-dashboard`（看板需传 `appId`，走 `x-app-id` 通道免 MFA）。

## 第 6 步：联调跨域（双白名单缺一不可）

- **服务端** `CORS_ALLOW_ORIGINS`：放行宿主的后端 API 跨域（开发期 localhost 默认放行）
- **前端** `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`（IDStack 客户端）：放行宿主页与嵌入页的鉴权握手；生产必须显式配置，**改完重启前端生效**

## 第 7 步：接入埋点（可选）

```ts
import { analytics } from '@isudaji/raodaor-sdk-web-analytics';

analytics.initialize({ appId, serverUrl });  // appId = 应用 UUID（非租户 ID）
analytics.track('button_click', { page: 'home' });
```

来源需加入后台 `analytics_allowed_origins` 白名单。详见 [analytics.md](./analytics.md)。

---

**防坑速记**：`app_id`≠`client_id` · 所有响应字段在 `data` 下 · 授权码一次性 10 分钟 · 角色只信 JWT roles claim · 看板必须传 `app_id` 否则 403 `MFA_REQUIRED` · JWT 用户主键读 `payload.id`（没有 `sub`），展示名读 `user_name`。
