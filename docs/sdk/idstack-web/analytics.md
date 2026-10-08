<!-- 由 ai-docs 同步自 canonical/sdk/idstack-web/analytics.md；修改请提交至 hub 仓库，勿直接编辑 -->

# Web Analytics SDK 使用文档

## 简介

Web Analytics SDK 是一个用于 Web 应用的数据采集 SDK，提供完整的事件上报、批量处理、断网缓存、自动页面追踪等功能。

> ### ❓ endpoint 到底填什么？（接入口最易困惑的点）
>
> **填 IDStack 主服务地址**，不是某个「独立分析后端」。本项目**不存在独立的分析服务**——分析数据接口（`POST /api/v1/analytics/events` 等）由 IDStack 主服务（即 `server` / `apps/api`，NestJS）**同源直接提供**。
>
> - 本地联调：`endpoint: 'http://localhost:9005'`（IDStack 本地主服务默认跑在 9005，即 `server/.env.development` 中的 `PORT=9005`；**不要填 8081、9010、5110**，那分别是 Expo dev server / 目标APP 后端 / 目标APP 前端，都不是 IDStack 主服务地址）。
> - 生产：`endpoint: 'https://idstack.raodaor.com'`（或指向同一后端的子域名）。
>
> SDK 会在 `endpoint` 后自动拼 `/api/v1/analytics/events`。文档早期示例里出现的 `https://analytics.yourdomain.com` / `https://analytics.example.com` / `http://localhost:3000` / `http://localhost:8081` 等地址仅是**示意占位或旧端口**，请勿当真——那不是独立分析服务，就是 IDStack 主服务本身。**本地真实地址是 `http://localhost:9005`**。
>
> **鉴权差异**（易混）：事件**上报**与**看板嵌入**都**只需公开的 `x-app-id`** 即可（免 MFA、无需用户 token），两者都是同一主服务的接口。其中上报接口**不强制** `app_secret`——`app_secret` 只是可选的「服务端凭证」，仅当你用后端代理转发上报、或调用 dashboard 配置类接口（设置看板可见性）时才需要。**前端 SDK 绝不能传入 `appSecret`**（会被浏览器暴露），SDK 检测到传入会告警并忽略。

> ### 🛡️ 上报来源域名白名单（防灌水）
>
> 因为上报接口**不强制 `app_secret`**，理论上知道你 `app_id` 的人可从任意域名伪造事件。为此后端提供 **`app` 表的 `analytics_allowed_origins` 字段**（逗号分隔的 host 白名单）：
> - 配置后，`POST /events` 会校验请求来源（`Origin` 或 sendBeacon 场景的 `Referer` 的 host）是否命中白名单，**未命中返回 `403 ORIGIN_NOT_ALLOWED`**（见文末错误码表）。
> - 支持子域通配：规则写成 `.raodaor.com` 即匹配 `a.raodaor.com`、`b.raodaor.com` 及其本身。
> - **该字段为空 = 不校验来源**（向后兼容老数据）；**无来源（服务端调用/curl 联调）也放行**，避免误杀合法后端代理。
> - 配合 IP 限流（默认 120 次/分钟/IP）形成「白名单 + 限流 + 租户隔离」三层防护。
>
> #### 📍 在哪里配置白名单？
>
> **推荐在 IDStack 应用管理后台配置（无需改数据库）**：
> 1. 进入「应用管理」，新建或编辑你的目标应用；
> 2. 找到 **「分析上报来源白名单」**（`analyticsAllowedOrigins`）输入框；
> 3. 填入允许上报的域名，逗号分隔，例如：`example.com, .raodaor.com`；
>    - 只填域名即可（也支持带 `https://`，后端自动提取 host）；
>    - 支持 `.raodaor.com` 子域通配；
>    - **留空 = 不校验来源**（向后兼容，旧应用在字段为空时等同放行）。
> 4. 保存后即时生效，后端 `appController` 会归一化落库（去引号/空白 → 提取 host → 小写 → 去重排序）。
>
> 若需直接操作数据库（如批量初始化老数据），等价 SQL 为：
> ```sql
> UPDATE app SET analytics_allowed_origins='.raodaor.com,client.example.com' WHERE id='<你的 app_id>';
> ```

> ### 📊 入站来源统计（referer）
>
> 每个上报事件都会记录 **`referer` 字段**（入站来源域名），用于后续统计流量来源：
> - **服务端优先**从请求头 `Referer` / `Origin` 提取（更可信、无法被事件属性伪造）；
> - **SDK 同时**自动注入 `referer`（取站外 `document.referrer` 或同源时取 `location.origin`），作为来源统计参考；
> - 目标 APP 可通过查询 `analytics_events.referer` 维度做「入站来源分析」，无需前端额外传参。
> - 后端已提供聚合接口：**`GET /api/v1/analytics/statistics/referer?startDate=&endDate=`**（携带 `x-app-id`），按来源 host 聚合返回 PV/UV/占比，空来源归一化为 `Direct`（直达访问）。也可复用通用维度接口 `GET /api/v1/analytics/statistics/dimensions/referer`。

## 特性

- ✅ **批量上报**：支持批量事件上报，减少网络请求次数
- ✅ **断网缓存**：网络断开时自动缓存事件，网络恢复后自动补报
- ✅ **持久化存储**：使用 localStorage 持久化队列，防止数据丢失
- ✅ **自动采集**：自动页面浏览追踪（支持 history 和 hash 模式）
- ✅ **会话管理**：自动管理会话 ID，支持会话重置
- ✅ **网络监听**：实时监听网络状态，智能上报
- ✅ **TypeScript**：完整的 TypeScript 类型定义
- ✅ **单例模式**：全局唯一实例，方便使用
- ✅ **sendBeacon**：页面卸载时使用 sendBeacon 上报，确保数据不丢失
- ✅ **UMD 打包**：支持多种引入方式（CDN、npm、本地）

## 安装

### 方式一：npm 安装

```bash
npm install @isudaji/raodaor-sdk-web-analytics
```

### 方式二：CDN 引入

```html
<!-- 开发版 -->
<script src="https://cdn.raodaor.com/js/sdk-web-analytics/dist/analytics.umd.js"></script>

<!-- 生产版（压缩） -->
<script src="https://cdn.raodaor.com/js/sdk-web-analytics/dist/analytics.umd.min.js"></script>
```

### 方式三：本地文件

下载 `dist/analytics.umd.js` 文件，在 HTML 中引入：

```html
<script src="./analytics.umd.js"></script>
```

## 快速开始

### 1. 基础使用（UMD）

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
  <script src="https://cdn.raodaor.com/js/sdk-web-analytics/dist/analytics.umd.min.js"></script>
</head>
<body>
  <script>
    // 初始化 SDK
    RaodaorAnalyticsSDK.analytics.initialize({
      tenantId: 'your-tenant-id',
      appId: 'your-app-id',
      // endpoint 即 IDStack 主服务地址（分析接口与主服务同源同址，无需独立分析服务）
      endpoint: 'https://idstack.raodaor.com',
      enableAutoPageView: true,
      debug: true,
    });

    // 追踪页面浏览（自动）
    // 追踪自定义事件
    RaodaorAnalyticsSDK.analytics.trackEvent({
      eventType: 'button_click',
      properties: {
        buttonId: 'submit_btn',
      },
    });
  </script>
</body>
</html>
```

### 2. npm 使用（ES Module）

```javascript
import { analytics } from '@isudaji/raodaor-sdk-web-analytics';

// 初始化
analytics.initialize({
  tenantId: 'your-tenant-id',
  appId: 'your-app-id',
  // endpoint 即 IDStack 主服务地址（分析接口与主服务同源同址，无需独立分析服务）
  endpoint: 'https://idstack.raodaor.com',
  maxBatchSize: 50,
  flushInterval: 5000,
  enableAutoPageView: true,
  useHash: false,
  debug: true,
});

// 追踪事件
analytics.trackEvent({
  eventType: 'button_click',
  properties: {
    buttonId: 'submit_btn',
  },
});
```

## 本地开发与联调

> ### 🔌 端口对照（接入口最容易配错的点，先读）
>
> | 角色 | 地址 | 说明 |
> |------|------|------|
> | 目标 APP 前端页面 | `http://localhost:5110` | 浏览器 origin（仅用于 CORS 校验） |
> | 目标 APP 自有后端 | `http://localhost:9010` | 你的后端，走授权码换 token |
> | **IDStack 主服务（上报打这里）** | **`http://localhost:9005`** | `server/.env.development` 的 `PORT`，所有 analytics 接口真实所在地 |
>
> ⚠️ **`endpoint` 必须填 `http://localhost:9005`（Web SDK 不带 `/api/v1`，由 SDK 自动拼）**。不要填 5110（前端）、9010（你的后端）、或 8081（Expo dev server）——这些都不是 IDStack 主服务，填错会出现 `CORS: No 'Access-Control-Allow-Origin'` 或请求落空。

对外发布的 UMD 全局变量已命名为 **`RaodaorAnalyticsSDK`**（带品牌前缀，避免与目标 APP 自身变量同名冲突）。开发阶段与目标 APP 联调时，推荐以下流程：

### 1. 构建本地 SDK（watch 模式）

```bash
cd sdk-web-analytics
npm install
npm run build          # 产出 dist/analytics.umd.js（含 sourcemap，便于断点调试）
npm run build:watch    # 改源码自动重新打包，联调首选
```

构建完成后，`dist/analytics.umd.js` 在浏览器中以全局 `window.RaodaorAnalyticsSDK` 暴露。

### 2. 目标 APP 引入本地 SDK

**方式 A：本地 `<script>`（最快，适合纯前端/静态页联调）**

把构建产物拷到目标 APP 可访问路径，或直接用绝对路径：

```html
<!-- 指向你本地构建出的文件，而非 CDN -->
<script src="http://localhost:5173/sdk/analytics.umd.js"></script>
<script>
  RaodaorAnalyticsSDK.analytics.initialize({
    tenantId: 'dev-tenant-id',
    appId: 'dev-app-id',
    // endpoint 即 IDStack 本地主服务地址（分析接口同源同址）。
    // 本地 IDStack 主服务默认跑在 9005（server/.env.development 的 PORT），与你的前端页面（如 localhost:5110）不同源，但 CORS 已对 localhost:* 放行。
    endpoint: 'http://localhost:9005',
    enableAutoPageView: true,
    debug: true,                          // 开启后控制台打印 [RaodaorAnalyticsSDK] 日志
  });
</script>
```

**方式 B：npm link（适合目标 APP 用 npm import 联调）**

```bash
# 在 SDK 目录
cd sdk-web-analytics && npm link

# 在目标 APP 目录
npm link @isudaji/raodaor-sdk-web-analytics
# 然后正常 import { analytics } from '@isudaji/raodaor-sdk-web-analytics';
```

> 注意：`npm link` 后若目标 APP 用了打包器（Vite/Webpack），需将其加入 `optimizeDeps` 排除或重启 dev server，否则可能解析到缓存版本。

### 3. 联调检查清单

- [ ] 浏览器控制台能看到 `[RaodaorAnalyticsSDK]` 调试日志（`debug: true`）。
- [ ] Network 面板中事件上报请求命中本地后端 `endpoint`（如 `http://localhost:9005/api/v1/analytics/events`），状态码 2xx。
- [ ] 后端 `app` 表中该 `appId` 的 `status` 为 `active`，否则上报会被 401 拒绝（见「公开看板」段鉴权说明）。
- [ ] 跨域（CORS）：本地前端与后端不同源时，后端需对 `http://localhost:*` 来源放行 `Access-Control-Allow-Origin` 及 `x-app-id` 请求头。
- [ ] 用项目自带 `demo/index.html` 可独立验证 SDK 行为，再嵌入目标 APP。

### 4. 切换到生产

联调通过后，把 `endpoint` 改为** IDStack 主服务生产域名**（如 `https://idstack.raodaor.com`，与分析接口同源同址；若你用独立子域名反代到同一后端也可）、移除 `debug: true`，并将 `<script>` 改为 CDN 地址即可：

```html
<script src="https://cdn.raodaor.com/js/sdk-web-analytics/dist/analytics.umd.min.js"></script>
```

> ⚠️ 生产环境**绝不**传入 `appSecret`（详见上文配置项安全说明）。

## 使用方法

### 1. 页面浏览追踪

#### 自动追踪（推荐）

SDK 会自动追踪页面浏览，支持 history 和 hash 模式：

```javascript
// history 模式（默认）
analytics.initialize({
  enableAutoPageView: true,
  useHash: false,
});

// hash 模式
analytics.initialize({
  enableAutoPageView: true,
  useHash: true,
});
```

#### 手动追踪

```javascript
// 基础用法
analytics.trackPageView();

// 指定 URL 和标题
analytics.trackPageView({
  url: 'https://example.com/custom-page',
  title: 'Custom Page',
  referrer: 'https://example.com/previous',
});

// 添加自定义属性
analytics.trackPageView({
  properties: {
    pageId: 'home_001',
    category: 'main',
  },
});
```

### 2. 自定义事件追踪

```javascript
// 基础用法
analytics.trackEvent({
  eventType: 'button_click',
});

// 带属性
analytics.trackEvent({
  eventType: 'purchase',
  properties: {
    productId: 'prod_123',
    productName: 'Premium Plan',
    amount: 99.99,
    currency: 'CNY',
  },
});

// 覆盖用户 ID
analytics.trackEvent({
  eventType: 'user_action',
  userId: 'user_456',
  properties: {
    action: 'share',
  },
});

// 指定页面信息
analytics.trackEvent({
  eventType: 'form_submit',
  pageUrl: 'https://example.com/form',
  pageTitle: 'Contact Form',
  properties: {
    formId: 'contact_form',
  },
});
```

### 3. 用户管理

```javascript
// 设置用户 ID
analytics.setUserId('user_123');

// 清除用户 ID
analytics.clearUserId();

// 获取状态
const status = analytics.getStatus();
console.log('Current user:', status);
```

### 4. 全局属性

设置全局属性，会自动添加到所有事件中：

```javascript
// 设置全局属性
analytics.setGlobalProperties({
  environment: 'production',
  siteVersion: '1.0.0',
  channelId: 'google',
});

// 更新全局属性
analytics.setGlobalProperties({
  userLevel: 'vip',
});
```

### 5. 会话管理

```javascript
// 重置会话 ID
analytics.resetSessionId();

// 获取当前会话 ID
const status = analytics.getStatus();
console.log('Session ID:', status.sessionId);
```

### 6. 手动上报

```javascript
// 立即上报队列中的所有事件
const result = await analytics.flushQueue();

console.log('Report result:', result);
// {
//   success: true,
//   reportedCount: 10,
//   failedCount: 0
// }
```

### 7. 清空队列

```javascript
// 清空事件队列（谨慎使用）
analytics.clearQueue();
```

### 8. 查看 SDK 状态

```javascript
const status = analytics.getStatus();

console.log(status);
// {
//   isInitialized: true,
//   queueSize: 5,
//   isFlushing: false,
//   isOnline: true,
//   sessionId: 'xxx-xxx-xxx',
//   pageUrl: 'https://example.com'
// }
```

### 9. 销毁 SDK

```javascript
// 销毁 SDK 实例（清理定时器和监听器）
analytics.destroy();
```

### 10. 公开看板展示（公开展示 / 访问密码 / 拒绝公开）

采集的数据可在目标 APP 内以**只读方式公开展示**（如「今日访问量」组件），无需暴露 `app_secret`。后端提供三态可见性模型，由持有者（即你，通过 `app_secret` 配置）控制：

| 可见性 | 含义 | 展示端访问方式 |
|--------|------|----------------|
| `private` | 拒绝公开 | 公开链接返回 404，外部无法读取 |
| `public` | 完全公开 | 仅需 `public_token` 即可读取 |
| `unlisted` | 需密码 | 需 `public_token` + 访问密码 |

#### 持有者配置看板（服务端 API）

```bash
# 读取当前看板配置
GET /api/v1/analytics/dashboards/{app_id}/config
  -H "x-app-id: {app_id}" -H "x-app-secret: {app_secret}"

# 更新可见性 / 密码（例如设置为需密码公开）
PUT /api/v1/analytics/dashboards/{app_id}/config
  -H "x-app-id: {app_id}" -H "x-app-secret: {app_secret}"
  -d '{
    "title": "我的数据看板",
    "visibility": "unlisted",
    "access_password": "your-display-password",
    "metrics": "pv,uv,eventCount,deviceCount"
  }'
```

#### 展示端读取公开指标（无需 app_secret）

```javascript
import { analytics } from 'web-analytics-sdk';

// 初始化 SDK（仅需 endpoint；无需 app_secret 也可调用 getPublicStats）
// endpoint 填 IDStack 主服务地址（分析接口同源同址，非独立分析服务）
await analytics.initialize({ endpoint: 'https://idstack.raodaor.com', appId: 'xxx' });

// public_token 由持有者从配置接口获取后，配置到展示端
const stats = await analytics.getPublicStats(
  '看板_public_token',
  '若看板为 unlisted 则传访问密码'
);

console.log('今日访问量(PV):', stats.metrics.pv);
console.log('今日独立访客(UV):', stats.metrics.uv);
```

> 说明：公开接口已做限流防刷（默认 120 次/分钟/ IP+看板），今日指标采用「聚合表 + 1 分钟缓存」分钟级更新。

## 完整示例

### 示例 1：单页应用（SPA）

```javascript
import { analytics } from '@isudaji/raodaor-sdk-web-analytics';

// 在应用入口初始化
analytics.initialize({
  tenantId: 'tenant_123',
  appId: 'app_456',
  endpoint: 'https://idstack.raodaor.com',
  enableAutoPageView: true,
  useHash: false, // history 模式
  debug: process.env.NODE_ENV === 'development',
});

// 用户登录时
const handleLogin = (user) => {
  analytics.setUserId(user.id);
  
  analytics.trackEvent({
    eventType: 'user_login',
    properties: {
      userId: user.id,
      loginMethod: 'email',
    },
  });
};

// 用户退出时
const handleLogout = () => {
  analytics.clearUserId();
  analytics.resetSessionId();
  
  analytics.trackEvent({
    eventType: 'user_logout',
  });
};

// 购买事件
const handlePurchase = (order) => {
  analytics.trackEvent({
    eventType: 'purchase',
    properties: {
      orderId: order.id,
      amount: order.amount,
      items: order.items.length,
    },
  });
};
```

### 示例 2：Vue 应用

```javascript
// main.js
import { createApp } from 'vue';
import { analytics } from '@isudaji/raodaor-sdk-web-analytics';
import App from './App.vue';
import router from './router';

// 初始化 SDK
analytics.initialize({
  tenantId: 'tenant_123',
  appId: 'app_456',
  endpoint: 'https://idstack.raodaor.com',
  enableAutoPageView: false, // 手动追踪
  debug: true,
});

const app = createApp(App);

// 路由守卫中追踪页面
router.afterEach((to, from) => {
  analytics.trackPageView({
    url: window.location.href,
    title: document.title,
    properties: {
      path: to.path,
      name: to.name,
      params: to.params,
    },
  });
});

app.use(router);
app.mount('#app');
```

### 示例 3：React 应用

```jsx
// App.jsx
import { useEffect } from 'react';
import { analytics } from '@isudaji/raodaor-sdk-web-analytics';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();

  useEffect(() => {
    // 初始化 SDK
    analytics.initialize({
      tenantId: 'tenant_123',
      appId: 'app_456',
      endpoint: 'https://idstack.raodaor.com',
      enableAutoPageView: false,
      debug: true,
    });
  }, []);

  useEffect(() => {
    // 追踪页面浏览
    analytics.trackPageView({
      url: window.location.href,
      title: document.title,
      properties: {
        pathname: location.pathname,
        search: location.search,
      },
    });
  }, [location]);

  return (
    {/* ... */}
  );
}

export default App;
```

### 示例 4：传统多页应用

```html
<!-- 每个页面都引入 SDK -->
<script src="https://cdn.raodaor.com/js/sdk-web-analytics/dist/analytics.umd.min.js"></script>
<script>
  // 初始化
  RaodaorAnalyticsSDK.analytics.initialize({
    tenantId: 'tenant_123',
    appId: 'app_456',
    endpoint: 'https://idstack.raodaor.com',
    enableAutoPageView: true,
  });

  // 按钮点击追踪
  document.getElementById('submitBtn').addEventListener('click', function() {
    RaodaorAnalyticsSDK.analytics.trackEvent({
      eventType: 'button_click',
      properties: {
        buttonId: 'submit_btn',
        page: 'contact',
      },
    });
  });
</script>
```

## 配置说明

### SDKConfig 配置项

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| tenantId | string | 是 | - | 租户 ID |
| appId | string | 是 | - | 应用 ID（采集上报认证，**可公开**） |
| appSecret | string | **否** | - | 应用密钥。**前端不应传入**（传入会被 SDK 告警并忽略，见下方安全说明）。上报事件只需 `appId`，`appSecret` 仅用于「服务端」调用 dashboard 配置类接口 |
| endpoint | string | 是 | - | **IDStack 主服务地址**（服务端点基址，不含 `/api/vX` 版本前缀）。⚠️ 分析数据接口由 IDStack 主服务直接提供（如 `POST /api/v1/analytics/events`），**不存在独立的「分析后端」**；`endpoint` 填 IDStack 主服务地址即可（**本地即 `http://localhost:9005`**，即 `server/.env.development` 的 `PORT`；生产即 `https://idstack.raodaor.com`）。SDK 自动拼接 `/api/{apiVersion}` 后拼接口路径；若你已在 endpoint 中自带 `/api/vX`，则以其为准不再重复拼接 |
| apiVersion | string | 否 | `'v1'` | API 版本前缀。接口升级时目标 APP 传 `apiVersion: 'v2'` 即可切换到新版本，无需等待 SDK 发版 |

> ⚠️ **安全说明（重要）**：`appSecret` 是敏感凭证，**只能在你的后端服务中持有**。事件**上报（写数据）只需公开的 `appId` 即可**，后端不再强制要求 `appSecret`；`appSecret` 仅用于「服务端」调用 dashboard 配置类接口（见「公开看板」段）。**前端 SDK 初始化时切勿传入 `appSecret`**——若误传，SDK 会在控制台告警并直接忽略该值，不会随事件上报发出，以免任何用户通过开发者工具提取后伪造配置请求。
| maxBatchSize | number | 否 | 50 | 批量上报最大数量 |
| flushInterval | number | 否 | 5000 | 批量上报间隔（毫秒） |
| enableAutoPageView | boolean | 否 | true | 是否启用自动页面追踪 |
| useHash | boolean | 否 | false | 是否使用 hash 路由 |
| defaultUserId | string | 否 | - | 默认用户 ID |
| globalProperties | Record<string, any> | 否 | - | 全局自定义属性 |
| debug | boolean | 否 | false | 是否启用调试模式 |

### AnalyticsEvent 事件字段

| 字段 | 类型 | 说明 |
|------|------|------|
| event_type | string | 事件类型 |
| timestamp | string | 事件时间（ISO 8601） |
| session_id | string | 会话 ID |
| user_id | string? | 用户 ID |
| device_id | string | 设备 ID |
| device_type | string | 设备类型（phone/tablet/desktop） |
| os | string | 操作系统 |
| os_version | string | 操作系统版本 |
| browser | string | 浏览器 |
| browser_version | string | 浏览器版本 |
| screen_resolution | string | 屏幕分辨率 |
| viewport_size | string | 视口大小 |
| language | string | 语言 |
| page_url | string | 页面 URL |
| page_title | string | 页面标题 |
| referrer_url | string | 上一页 URL |
| properties | Record? | 事件属性 |
| sdk_version | string | SDK 版本 |
| sdk_type | string | SDK 类型（web） |

## 最佳实践

### 1. 初始化时机

在应用启动时尽早初始化 SDK：

```javascript
// 推荐：在 HTML 头部或应用入口处
<script>
  RaodaorAnalyticsSDK.analytics.initialize(config);
</script>
```

### 2. 用户 ID 管理

在用户登录/退出时及时更新用户 ID：

```javascript
// 登录成功
const onLoginSuccess = (user) => {
  analytics.setUserId(user.id);
  analytics.trackEvent({
    eventType: 'user_login',
    properties: { userId: user.id },
  });
};

// 退出登录
const onLogout = () => {
  analytics.clearUserId();
  analytics.resetSessionId();
};
```

### 3. 事件命名规范

使用清晰、一致的事件命名：

```javascript
// 推荐
analytics.trackEvent({ eventType: 'button_click', ... });
analytics.trackEvent({ eventType: 'page_view', ... });
analytics.trackEvent({ eventType: 'purchase_completed', ... });

// 不推荐
analytics.trackEvent({ eventType: 'click', ... });
analytics.trackEvent({ eventType: 'test', ... });
```

### 4. 属性命名规范

使用 snake_case 命名属性：

```javascript
// 推荐
properties: {
  button_id: 'submit_btn',
  product_name: 'Premium Plan',
  user_level: 'vip',
}

// 不推荐
properties: {
  buttonId: 'submit_btn',
  productName: 'Premium Plan',
}
```

### 5. 错误处理

添加适当的错误处理：

```javascript
try {
  await analytics.initialize(config);
} catch (error) {
  console.error('Analytics init failed:', error);
  // 降级处理或上报错误
}
```

## 性能优化

### 1. 批量上报配置

根据应用特点调整批量上报参数：

```javascript
analytics.initialize({
  maxBatchSize: 100,      // 增加批量大小
  flushInterval: 10000,   // 延长上报间隔
});
```

### 2. 减少不必要的事件

避免过于频繁的事件上报：

```javascript
// 不推荐：每次渲染都上报
componentDidUpdate() {
  analytics.trackEvent({ eventType: 'render', ... });
}

// 推荐：只在必要时上报
handleImportantAction = () => {
  analytics.trackEvent({ eventType: 'important_action', ... });
};
```

### 3. 调试模式

生产环境关闭调试模式：

```javascript
analytics.initialize({
  debug: process.env.NODE_ENV === 'development',
});
```

## 故障排查

### 1. 检查 SDK 状态

```javascript
const status = analytics.getStatus();
console.log('SDK status:', status);
```

### 2. 检查网络连接

```javascript
console.log('Online:', navigator.onLine);
```

### 3. 检查队列状态

```javascript
const status = analytics.getStatus();
console.log('Queue size:', status.queueSize);
```

### 4. 手动上报测试

```javascript
const result = await analytics.flushQueue();
console.log('Flush result:', result);
```

### 5. 启用调试模式

```javascript
analytics.initialize({
  ...config,
  debug: true,
});
```

### 6. 事件上报错误码速查

事件上报（`POST /api/v1/analytics/events`）被拒时，响应为统一信封 `{ success:false, code, error }`，常见 `code` 与排查方向：

| `code` / 现象 | 含义 / 排查方向 |
|---------------|-----------------|
| `401` 无 `x-app-id` / `INVALID_APP` | 请求头缺 `x-app-id`，或 `appId` 与后端 `app` 表不匹配、该 app `status` 非 `active`。核对 `appId` 是否为你登记的 `IDSTACK_APP_ID`，且在后台已激活 |
| `403` 密钥不符 | 仅当请求**携带**了 `x-app-secret` 时才会校验：其与 `app` 表 `secret_key` 不一致，或请求体被篡改。注意：**上报可不带 `app_secret`**，不带则跳过此项校验（仅靠 `x-app-id` 归属）。若你用后端代理转发且带了 secret，请检查 `secretKey` 配置、确认上报体未被代理改写 |
| `403` `ORIGIN_NOT_ALLOWED` | 来源域名不在该应用的 `analytics_allowed_origins` 白名单中。浏览器/Beacon 上报时，后端比对请求 `Origin`/`Referer` 的 host 与白名单（支持 `.raodaor.com` 子域通配）；不匹配即拒绝写入。在「应用管理 → 编辑应用 → 分析上报来源白名单」中把你的域名加入白名单即可（留空=不校验来源，向后兼容）。**无来源头**（后端代理/curl 联调）会放行 |
| `CORS` 预检失败（Network 无响应） | 前端来源不在后端 CORS 白名单。**开发期 `localhost:*` 默认放行**；生产环境把你的来源加入 `CORS_ALLOW_ORIGINS`（服务端）并把域名加入 IDStack 客户端的 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS`（前端，重启生效） |
| 事件落入错误租户/看板无数据 | `appId` 传错（如误传租户 ID `tenant_id`）。`app_id` 是应用 UUID，不是租户 UUID，也不是 `client_id` |

> 事件上报与看板读取共用 `x-app-id` 应用凭证通道：上报**仅需 `x-app-id`**（可选携带 `x-app-secret` 用于后端代理/旧版兼容），看板嵌入走 `x-app-id` 头（由 `app_id` 触发），二者都**免 MFA、无需用户 token**。

## 常见问题

### Q: SDK 是否支持离线使用？

A: 是的，SDK 支持离线使用。网络断开时事件会缓存到 localStorage，网络恢复后自动上报。

### Q: 如何确保数据不丢失？

A: SDK 使用 localStorage 持久化队列，页面卸载时使用 sendBeacon 上报，确保数据不丢失。

### Q: 如何追踪 SPA 页面？

A: 设置 `enableAutoPageView: true`，SDK 会自动监听 history 或 hash 变化。

### Q: 如何更换用户 ID？

A: 使用 `analytics.setUserId(userId)` 设置新的用户 ID。

### Q: 如何清空缓存队列？

A: 使用 `analytics.clearQueue()` 清空队列（谨慎使用）。

### Q: sendBeacon 兼容性如何？

A: 现代浏览器都支持 sendBeacon，不支持的浏览器会降级使用同步 XHR。

## 浏览器兼容性

- Chrome 39+
- Firefox 31+
- Safari 11+
- Edge 14+
- IE 11（使用 polyfill）

## 更新日志

### v1.0.0 (2024-01-01)

- 初始版本发布
- 支持批量上报
- 支持断网缓存
- 支持自动页面追踪（history 和 hash 模式）
- 支持网络状态监听
- 支持 sendBeacon 卸载上报
- 完整的 TypeScript 类型
- UMD 和 ESM 打包

## 许可证

Private License

## 联系方式

- GitHub: https://github.com/raodaor/analytics-web-sdk
- Email: support@raodaor.com
