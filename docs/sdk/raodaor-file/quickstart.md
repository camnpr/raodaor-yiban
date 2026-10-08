<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-file/quickstart.md；修改请提交至 hub 仓库，勿直接编辑 -->

# RaoDaor File Web 接入清单

> 先阅读 [overview.md](./overview.md) 选择个人网盘模式或应用租户模式；文件 API、SDK、picker 的完整说明见 [sdk-integration.md](./sdk-integration.md)。

## 1. 选择文件归属

- 头像或用户个人资源：使用个人租户模式，用户通过 IDStack SSO 登录。
- 网站自己的附件、头像库或 UGC 资产：使用应用租户模式，由平台管理员创建 `APPLICATION` 租户并下发 ApiKey；由目标 APP 后端代理上传。
- 在目标 APP 数据库保存 `business_user_id ↔ fileId`，不要假设 RaoDaor File 会识别业务对象。

## 2. 配置平台与密钥

平台部署方配置：

```dotenv
IDSTACK_BASE_URL=https://idstack.raodaor.com
IDSTACK_API_BASE_URL=https://idstack.raodaor.com
IDSTACK_APP_ID=<IDStack 应用 UUID>
IDSTACK_APP_SECRET=<仅服务端使用>
JWT_ACCESS_SECRET=<RaoDaor File JWT 密钥>
FILE_SIGN_SECRET=<签名短链密钥>
CORS_ALLOW_ORIGINS=https://your-app.example
```

应用租户模式还需要从平台管理员取得 ApiKey。所有 secret、ApiKey 和 JWT 签名密钥仅存服务端密钥管理系统。

## 3. 完成 IDStack SSO（个人模式）

1. 前端运行时生成随机 `state`，跳转 `GET /oauth/authorize`。
2. 授权参数使用 `app_id`、与后台字节级一致的 `redirect_uri`、`response_type=code` 和所需 scope。
3. 后端用授权码调用 `/api/v1/oauth/token`；使用 `client_id=api_key` 与 `client_secret`，不得在浏览器换 token。
4. 读取 `response.data.access_token`，再调用 RaoDaor File SSO 回调换取本库 token。
5. 将本库 token 安全交给前端 SDK（短期存储，避免日志和 URL）。

## 4. 安装并初始化 SDK

```bash
npm install @isudaji/raodaor-file-sdk
```

```ts
import { RaoDaorFile } from '@isudaji/raodaor-file-sdk';

const file = new RaoDaorFile({
  origin: 'https://file.raodaor.com',
  accessToken: raodaorFileAccessToken,
});
```

实际构造参数和方法以已安装 SDK 的类型声明为准；典型流程是 `uploadFile`/`uploadAvatar` → 保存返回的 `fileId` → 需要展示时请求签名短链。

## 5. 上传、选择与展示

- 普通文件/头像：优先使用 SDK；大文件让 SDK 管理分片、重试、秒传和完成确认。
- 官方文件选择器：使用 `openPicker()` 或 iframe，固定 `origin`，校验 `event.origin` 和消息类型；token 只走 postMessage 握手。
- 下载/管理：使用本库 Bearer token 调租户隔离 API。
- 对外公开展示：使用短期签名 URL；不要把管理 token 变成公开 URL。裸 `/blobs/*` 地址公开可读、无鉴权、无过期，对外统一用 `signUrl` 签名短链，敏感内容绝不裸发。
- 新文件默认 `REVIEWING`，对外签名短链只放行 `ACTIVE`（否则裂图）：上传后轮询 `getFile` 或订阅 `file.reviewed`，确认 `ACTIVE` 再展示；无需二次审核可让平台管理员关闭该租户 `autoReview` 开关。
- 应用租户模式：浏览器只调用目标 APP 后端，后端用 ApiKey/服务端凭据上传并把业务关联写入自己的数据库。

## 6. 接入 Webhook 与上线检查

1. 为审核、上传完成等事件建立服务端 Webhook endpoint。
2. 验签、按事件 ID 幂等，失败重试可安全执行；记录原始事件和处理结果。
3. 配置生产 CORS 白名单、签名密钥和 picker/embed origin 白名单。
4. 验证个人租户/应用租户的读写隔离、删除权限、过期签名链接和大文件失败重试。
5. 逐项对照 [errors.md](./errors.md) 做联调；不要把密钥提交到仓库。
