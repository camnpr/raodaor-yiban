<!-- 由 ai-docs 同步自 canonical/sdk/idstack-web/embed-integration.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 功能模块嵌入式（Embed）对接指南

> 目标：让接入 IDStack 的**目标 APP** 以极低成本、插拔式地展示 IDStack 已有功能（积分商城、任务中心、收藏与喜欢、调查问卷、支付流程等），无需重复开发。

## 1. 整体方案（业界最佳实践）

采用 **"一次构建、双端嵌入"（Hybrid Embed）**：

- IDStack 客户端复用现有功能屏，提供一组 **无壳（chromeless）嵌入路由** `/embed/*`。
- **Web 端**：目标 APP 用 `<iframe>` 指向对应 `/embed/*` 页面。
- **RN 端**：目标 APP 用 `WebView` 指向**同一个** `/embed/*` URL。
- 功能数据天然按 JWT 中的 `app_id` 做三级隔离，嵌入层无需额外改造。

优势：零重复开发（直接复用 `PointsMallScreen` 等）、真·插拔式（删掉标签即卸载）、统一升级（IDStack 改 UI，所有接入方自动生效）。

```
目标APP (Web)                    IDStack 嵌入服务
┌──────────────────┐           ┌──────────────────────┐
│ <iframe src=     │           │ /embed/points-mall   │
│  /embed/...>     │──────────>│ (复用现有功能屏)      │
└──────────────────┘           └──────────────────────┘
        │  postMessage 安全握手（token 不进 URL）  ▲
        └────── AUTH_REQUEST / READY / AUTH_OK ───┘
```

## 2. 已实现的嵌入层

在 `client` 中新增嵌入层，复用全部已有功能屏：

| 文件 | 职责 |
|------|------|
| `src/embed/EmbedNavigator.tsx` | 栈导航器，注册 `/embed/*` 深层链接与功能屏及其依赖详情页 |
| `src/embed/EmbedApp.tsx` | 嵌入外壳：发起 postMessage 握手、校验来源白名单、注入令牌、设置语言/主题 |
| `src/embed/messaging.ts` | 嵌入页 ↔ 宿主页的 postMessage 协议常量与载荷类型 |
| `src/embed/embedConfig.ts` | 来源白名单校验、查询参数解析 |
| `src/embed/theme.tsx` | 轻量主题上下文（Phase 0 仅控制容器背景，深度换肤为后续工作） |
| `App.tsx` | 当访问路径以 `/embed` 开头时，自动切换为 `EmbedApp` |

### 2.1 支持的嵌入入口

| 功能 | 嵌入 URL |
|------|----------|
| 积分商城 | `/embed/points-mall` |
| 任务中心 | `/embed/task` |
| 我的收藏 | `/embed/collection` |
| 我的喜欢 | `/embed/like` |
| 填写问卷 | `/embed/survey/:surveyId` |
| 创建支付 | `/embed/payment/create` |
| 支付订单管理（管理员） | `/embed/payment/orders` |
| 核销管理（管理员） | `/embed/payment/verify` |
| 管理员订单（管理员） | `/embed/admin-orders` |

> **管理类入口（`payment-orders` / `payment-verify` / `admin-orders`）默认要求 `system_admin` 或 `tenant_admin` 角色**，可通过 SDK `allowedRoles` / 嵌入 URL `roles` 参数放行目标 APP 自定义角色（见 3.7）。若嵌入 token 用户未命中角色白名单或已失效，页面会**自动展示"无权限/登录失效"占位页**（`/embed/forbidden`），并通过事件桥通知宿主（见 3.7 节），**不会**静默跳转到其他页面。

### 2.2 部署注意（SPA 回退）

`/embed/*` 为前端深层链接，静态托管需配置 **SPA 回退**（任意未知路径返回 `index.html`），否则刷新会 404。示例（Nginx）：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## 3. 安全握手（postMessage，推荐生产方案）

令牌**不再经 URL 明文传递**，改为宿主页与嵌入页之间的 postMessage 握手，并对来源 `event.origin` 做白名单校验。

### 3.1 握手时序

```
1. 嵌入页挂载 → 向父页面派发 { type: '__IDSTACK_EMBED_READY__' }
2. 父页面监听 READY（校验 event.origin 为可信 IDStack 源）
3. 父页面向 iframe.contentWindow.postMessage(
     { type: '__IDSTACK_EMBED_AUTH__', payload: { token, locale, theme } },
     '<IDStack 源>'            // 必须明确指定 targetOrigin，禁止 '*'
   )
4. 嵌入页收到 AUTH_REQUEST → 校验 event.origin 在白名单内
   → 写入 token / locale / theme → 派发 { type: '__IDSTACK_EMBED_AUTH_OK__' }
5.（可选）握手超时（15s）未收到合法鉴权 → 嵌入页显示错误态
```

### 3.2 消息协议（`src/embed/messaging.ts`）

| 类型 | 方向 | 说明 |
|------|------|------|
| `__IDSTACK_EMBED_READY__` | iframe → 宿主 | 嵌入页就绪，可发起鉴权 |
| `__IDSTACK_EMBED_AUTH__` | 宿主 → iframe | 鉴权请求，载荷含 `token`/`locale`/`theme`/`app_id` |
| `__IDSTACK_EMBED_AUTH_OK__` | iframe → 宿主 | 鉴权已生效回执 |
| `__IDSTACK_EMBED_AUTH_ERROR__` | iframe → 宿主 | 鉴权失败（如来源不在白名单） |
| `__IDSTACK_EMBED_NAVIGATE__` | 宿主 → iframe | 触发内部路由跳转（预留） |
| `__IDSTACK_EMBED_EVENT__` | iframe → 宿主 | 业务事件上报（预留，供埋点透传） |

### 3.3 来源白名单（`src/embed/embedConfig.ts`）

嵌入页只接受白名单来源发来的 `AUTH_REQUEST`，防止任意第三方站点嵌入 iframe 后注入伪造令牌。

- 开发期默认允许 `localhost:3000` / `localhost:8080` / `127.0.0.1:3000`。
- 生产期默认仅信任 `ENVIRONMENT.WEBSITE_URL`。
- 可通过构建环境变量追加可信来源：

```bash
# .env / 构建环境
EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS=https://partner-a.com,https://partner-b.com
```

### 3.4 宿主页面接入示例（Web / iframe）

```html
<iframe
  id="idstack-embed"
  src="https://idstack.raodaor.com/embed/points-mall?locale=zh-CN"
  style="width:100%; height:600px; border:0;"
  title="积分商城"
></iframe>

<script>
  const IFRAME_SRC = 'https://idstack.raodaor.com';
  const iframe = document.getElementById('idstack-embed');

  // 1. 等待嵌入页就绪
  window.addEventListener('message', (event) => {
    // 校验来源为可信的 IDStack 源
    if (event.origin !== IFRAME_SRC) return;
    if (event.data?.type !== '__IDSTACK_EMBED_READY__') return;

    // 2. 回传令牌（targetOrigin 必须明确，禁止 '*'）
    iframe.contentWindow.postMessage(
      {
        type: '__IDSTACK_EMBED_AUTH__',
        payload: {
          token: window.__USER_TOKEN__,      // 用户在目标 APP 登录后由 IDStack 签发
          locale: 'zh-CN',
          theme: 'light',
        },
      },
      IFRAME_SRC,
    );
  });
</script>
```

> 安全要点：
> - 宿主**回复鉴权时 `targetOrigin` 必须写死为 IDStack 源**，绝不能用 `'*'`，否则令牌可能被中间任意窗口截获。
> - 嵌入页**只接受白名单来源**的 `AUTH_REQUEST`。
> - 若目标 APP 与 IDStack **同域**（如都挂在 `idstack.raodaor.com` 下），可直接复用登录会话，无需传 token。
> - 开发自测仍可用 URL 明文 `?token=`（仅 `__DEV__` 生效，且会打印安全告警），便于本地快速验证。

### 3.5 跨域请求 CORS 配置（服务端侧，易踩坑）

嵌入页内的功能接口调用（如支付下单 `POST /api/v1/payment/orders`、积分商城兑换等）最终打到 **IDStack 后端**。当嵌入页运行在**宿主页的源**（本地联调多为 `http://localhost:8081` 的 client、或宿主自测域名）而 IDStack 后端在另一源（如 `http://localhost:9005`）时，浏览器会先发 `OPTIONS` 预检，IDStack 后端必须放行该来源，否则预检失败、真实请求被拦截，表现为**接口"无响应"**（Console 报 `blocked by CORS policy`，请求状态 `(failed) net::ERR_FAILED`）。

后端 CORS 白名单（`server/src/index.ts`）规则，满足任一即放行：

| 条件 | 变量 / 规则 |
|------|------------|
| 无 `origin`（同源/服务端互调） | 始终放行 |
| 精确匹配主源 | `CORS_ORIGIN`（开发期 `http://localhost:8081`，生产 `https://idstack.raodaor.com`） |
| 追加可信来源 | `CORS_ALLOW_ORIGINS`（逗号分隔，如 `https://app.example.com,http://localhost:3000`） |
| 子域通配 | `*.raodaor.com`（含任意端口） |
| 本地联调 | `localhost` / `127.0.0.1`（任意端口，开发期默认放行） |

```bash
# server/.env.development / .env.production
CORS_ORIGIN=http://localhost:8081
# 接入方联调/生产追加域名：
# CORS_ALLOW_ORIGINS=https://app.example.com
```

> 排查要点：后端采用 `localhost` 默认放行，**本地联调基本不会再因 CORS 卡住**。若宿主页用的是非 localhost 的自测域名，务必用 `CORS_ALLOW_ORIGINS` 显式追加并**重启后端**。改完 CORS 若仍报错，再按 `401`（token 过期，用 `embed.updateToken` 刷新）/ `400 MISSING_TENANT`（JWT 缺 `tenant_id`，token 非 IDStack 合法用户令牌）进一步定位。

### 3.6 支付闭环与回跳（以 `payment-create` 为例）

`payment-create` 是嵌入链路里**闭环最完整**的一条，需要宿主、SDK、嵌入页三方配合才能跳回目标 APP。完整时序：

```
目标APP (宿主)                    嵌入页 (iframe)                    IDStack 后端
     │ 挂载 module=payment-create         │
     │ redirect=myapp://pay-result ──────>│ /embed/payment/create?redirect=myapp://pay-result
     │                                    │
     │                         填金额/渠道 → 创建订单 ──POST /api/v1/payment/orders──> 落库生成 order+voucher
     │                                    │<── voucher_code + share_token ────────────│
     │                                    │ 跳转 PaymentVoucher（凭证页）
     │                                    │ 点"分享" → 复制 shareUrl（http://localhost:8081/pay?token=...）
     │                                    │
     │                   点"完成" → emitClose() ──postMessage(EVENT:close,{redirect:'myapp://pay-result'})──>│
     │ onClose(data) 收到 ────────────────│
     │ embed.destroy() 关闭 iframe
     │ window.location.href = data.redirect  ──> 深链回跳目标 APP（myapp://pay-result）
```

**三方职责**：
- **宿主（目标 APP）**：挂载 SDK 时**必须传 `redirect`**（编程式 `new IdStackEmbed({ redirect: 'myapp://pay-result' })`，或声明式 `<idstack-embed redirect="myapp://pay-result">`）；在 `onClose(data)` 里 `embed.destroy()` 关闭 iframe，若 `data.redirect` 存在则 `window.location.href = data.redirect` 深链回跳。
- **SDK（`sdk-web-features`）**：把 `redirect` 透传到 iframe URL 的 `redirect` 查询参数；收到 `close` 事件时调用 `onClose`，并把 `redirect` 原样放入 `data.redirect`。
- **嵌入页**：`EmbedApp` 挂载时登记 `redirect`（`setEmbedRedirect`）；`PaymentVoucher` / `PaymentShare` 点"完成/已完成付款"时 `emitClose()`，自动带上该 `redirect` 回传。

**凭证页（PaymentVoucher）用户操作**：
1. 点 **"分享"**：把 `shareUrl` 复制或发给付款人（付款人在自己手机打开 `shareUrl` → 匿名支付页 `PaymentShare` → 完成实际转账 → 点"已完成付款"→ 触发 `emitClose` 关闭嵌入层）。
2. 发起方回到凭证页点 **"完成"** → 触发 `emitClose` 回跳目标 APP。

> 注意：直接浏览器打开 `/embed/payment/create`（无宿主 iframe）时 `emitClose` 为 no-op，这是预期行为——**只有真正走 SDK 嵌入才会闭环回跳**。若宿主漏传 `redirect`，`emitClose` 回落到无 `redirect`，`onClose` 仅关闭嵌入层、不做深链回跳。

### 3.7 管理类嵌入页的权限说明（对接必读）

`payment-orders` / `payment-verify` / `admin-orders` 三个嵌入入口为**管理员功能**。嵌入页挂载时会用 JWT token 调 `getUserInfo()` 做角色校验（**角色白名单判定**），并区分嵌入 / 非嵌入环境处理。

**角色白名单（`allowedRoles` / URL `roles` 参数）**：

| 角色来源 | 判定逻辑 |
|----------|----------|
| 默认白名单 | `['system_admin', 'tenant_admin']` —— **IDStack 租户管理员即"目标 APP 拥有者"的标准映射**。目标 APP 无需做任何配置，只要把拥有者账号在 IDStack 侧授予 `tenant_admin` 即可 |
| 目标 APP 自定义角色 | 通过 SDK 的 `allowedRoles: ['owner']` 选项（Web / RN 均支持，透传为嵌入 URL 的 `roles=owner` 参数）放行目标 APP 自身的角色体系。例如目标 APP 的 OWNER 用户，若 IDStack 已为其签发自定义角色 `owner`，传入 `allowedRoles: ['owner']` 后即可访问核销/订单页 |
| 安全边界 | `roles` 参数只决定"判定标准"，角色本身由 IDStack 签发的 JWT 保证可信，宿主无法借此提权；未命中白名单时仍走下方 forbidden 流程 |

> 场景示例：目标 APP 有租户功能、租户管理员是**目标 APP 的客户**（不应放行核销）时，只传 OWNER 角色白名单：`allowedRoles: ['owner']`（**不要**包含 `tenant_admin`，否则客户的租户管理员也能核销）。目标 APP 无租户功能时，默认白名单即可——此时 IDStack 的 `tenant_admin` 就是目标 APP 拥有者。

**权限不足 / 失效时的表现**：

| 场景 | 非嵌入（直接打开 URL） | 嵌入（iframe / WebView） |
|------|------------------------|--------------------------|
| token 用户未命中角色白名单 | `Toast` 提示"权限不足"后回退首页 | 跳转 `/embed/forbidden?reason=no_permission` 占位页，并上报 `forbidden` 事件 |
| token 失效 / 接口 401 | 跳转登录页 | 跳转 `/embed/forbidden?reason=auth_expired` 占位页，并上报 `AUTH_EXPIRED` 消息 |

**宿主侧消费**：

- **Web SDK**：注册 `onForbidden(data)` 收到 `{ reason: 'no_permission' | 'auth_expired', page?: string }`；注册 `onAuthExpired()` 后调用 `embed.updateToken(新token)` 续签，或 `embed.destroy()` 后重建嵌入层。两回调同时作用于 `embed.onAuthExpired`（AUTH_EXPIRED 消息）。
- **RN SDK**：`<IdStackEmbedView onForbidden={...} onAuthExpired={...} />` 用法与 Web 一致。
- **裸 iframe（不走 SDK）**：监听 `message`，当 `event.data.type === '__IDSTACK_EMBED_AUTH_EXPIRED__'` 时刷新 token 并重发鉴权；`forbidden` 事件格式为 `{ type: '__IDSTACK_EMBED_EVENT__', payload: { name: 'forbidden', data: { reason, page } } }`。

> 设计意图：早期版本在权限不足时会 `navigation.replace('Home')`，嵌入导航器中 `Home` 恰好是"我的收藏"回退页，导致 iframe 地址是 `/embed/payment/verify` 却显示"我的收藏"，让对接方误以为 iframe URL 配错。现改为**明确的占位页 + 事件通知**，对接方可据此精准提示"需要管理员账号"或"登录已失效"。

## 4. 路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| **Phase 0** | `/embed/*` 无壳路由，复用功能屏，支持 `locale`/`theme` | ✅ 已完成 |
| **Phase 1** | `postMessage` 令牌握手 + `event.origin` 白名单校验，token 不进 URL | ✅ 已完成 |
| **Phase 2** | `sdk-web-features`：iframe + Web Component 封装，托管 token/主题/事件握手 | ✅ 已完成 |
| **Phase 3** | `sdk-rn-features`：WebView 封装同一 URL（RN 端即贴即用） | ✅ 已完成 |
| **Phase 4** | 事件桥（`onPointsChanged` / `onPurchaseSuccess` / `onClose`）+ 深度链接回跳 | ✅ 已完成 |

### Phase 2 交付物

`sdk-web-features/` 独立 npm 包，两种用法：

- **声明式**：`<idstack-embed origin="..." module="points-mall" token="..." />`（UMD 引入自动注册）
- **编程式**：`new IdStackEmbed({ container, origin, module, token, onReady, onEvent }).mount()`

SDK 自动完成 `READY → AUTH_REQUEST → AUTH_OK` 握手，`targetOrigin` 始终为传入 `origin`（禁止 `'*'`），并预留 `navigate()` 与 `feature-event` 事件桥（供 Phase 4）。详见 `sdk-web-features/README.md`。

### Phase 3 交付物

`sdk-rn-features/` 独立 npm 包，让目标 RN App 用 `<IdStackEmbedView>` 即贴即用，底层复用 Phase 1 握手协议，承载层换成 `react-native-webview`：

- `src/types.ts`：与 Web SDK、嵌入页 `messaging.ts` 完全对齐的协议常量、模块映射、Props 类型
- `src/buildUrl.ts`：`buildEmbedUrl()` 仅拼接 `locale`/`theme`，**绝不包含 token**
- `src/IdStackEmbedView.tsx`：`WebView` 组件，收到 `READY` 后通过 `injectJavaScript` 派发 `AUTH_REQUEST`，监听 `AUTH_OK`/`AUTH_ERROR`/`EVENT` 并回调 `onReady`/`onError`/`onEvent`
- `src/index.ts`：统一导出
- `package.json`/`tsconfig.json`/`README.md`：与 `sdk-rn-analytics` 一致的工程规范

**双通道兼容（关键）**：嵌入页 `client/src/embed/EmbedApp.tsx` 同时支持 iframe 与 RN WebView 两种回传通道——检测 `window.ReactNativeWebView` 存在时走 RN 桥（`postMessage` 序列化字符串），否则走 `window.parent`。WebView 通道下跳过 `origin` 白名单（页面仅由可信源加载且只有 RN 原生侧可注入消息），iframe 通道仍强制白名单，确保两端安全模型一致。

详见 `sdk-rn-features/README.md`。

### Phase 4 交付物

**事件桥**：嵌入页在业务关键节点通过 `client/src/embed/eventBridge.ts` 向宿主回传业务事件；该桥在非嵌入环境（主 App 直接运行）下为 **no-op**，因此可安全地在复用型功能屏中埋点，不影响主 App 行为。

- `src/embed/eventBridge.ts`：通道探测（`iframe` / `webview` / `null`）、宿主来源与 deep link 记录、`emitEmbedEvent` / `emitClose` / `emitPointsChanged` / `emitPurchaseSuccess` / `emitForbidden` / `emitAuthExpired` 便捷方法
- 标准化事件名 `EMBED_EVENT_NAME`：`points_changed`、`purchase_success`、`close`、`forbidden`（与两个 SDK 常量保持一致）；`AUTH_EXPIRED` 为独立消息类型（不经 EVENT 信封）
- 埋点位置（均经 `embedConfig.ts` 的 `redirect` 参数支持深链回跳）：
  - `ProductDetailScreen` 兑换下单成功 → `purchase_success` + 刷新余额后 `points_changed`
  - `TaskScreen` 任务完成校验通过 → `points_changed`（含 `rewardPoints` / `taskId`）
  - `PaymentShareScreen` 用户点击"已完成付款" → `close`（携带 `redirect` 深链）
  - `PointsMallScreen` / `TaskScreen` 返回按钮 → `close`（请求宿主关闭嵌入层）
  - `SurveyFillScreen` 返回按钮 / 提交成功回跳 → `close`（携带 `surveyId` / `submitted`）
  - `CollectionScreen` 顶部返回 → `close`（根级返回经 `Home` 回退页刷新列表）
  - `LikeScreen` 顶部返回 → `close`
  - `ItemDetailScreen` 顶部返回 / 详情缺失回退 → `close`（携带 `itemType`）
- 通道安全：iframe 事件定向到握手时记录的宿主来源，未知时回退 `'*'`；WebView 经 `ReactNativeWebView` 桥回传字符串载荷

**宿主 SDK 消费层**（Web + RN 同步升级）：
- 通用透传回调 `onEvent(event)` 继续保留
- 新增类型化回调 `onPointsChanged(data)` / `onPurchaseSuccess(data)` / `onClose(data)`，SDK 内部按 `event.name` 自动分发
- Web Component 额外派发 `points-changed` / `purchase-success` / `close` 三个 `CustomEvent`
- `close` 事件携带 `redirect`（来自嵌入 URL 的 `redirect` 参数或显式传入），宿主据此关闭嵌入层并 deep link 回跳自有 App

详见 `sdk-web-features/README.md` 与 `sdk-rn-features/README.md`。
