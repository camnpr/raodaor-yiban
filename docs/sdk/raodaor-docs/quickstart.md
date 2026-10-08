<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-docs/quickstart.md；修改请提交至 hub 仓库，勿直接编辑 -->

# RaoDaor Docs 接入清单

> 目标：完成“登录 → 导入 → 在线清洗 → 结构化读回 → 校验 → 标红/入库 → 清理”的闭环。详细契约见 [import-api.md](./import-api.md)。

## 1. 平台配置

1. 在后端精确配置 `CORS_ALLOW_ORIGINS=https://your-app.com`。
2. 在前端构建环境精确配置 `VITE_AUTH_ALLOWED_ORIGINS=https://your-app.com`。
3. 配置 `IDSTACK_BASE_URL` 和 `IDSTACK_APP_ID`。
4. 修改后重启后端并重新构建前端；确认启动日志列出来源。

## 2. 登录取 token

1. 用 `window.open(`${DOCS_ORIGIN}/api/v1/auth/login`)` 打开登录窗口。
2. 监听 `message`，只接受 `event.origin === DOCS_ORIGIN` 且 `event.data.type === 'RAODAOR_DOCS_AUTH'`。
3. 保存 `accessToken` 与 `refreshToken`；所有 Docs API 使用 `Authorization: Bearer <accessToken>`。
4. 401 时调用 `POST /api/v1/auth/refresh`，并同时替换两个新 token。

## 3. 导入文件

```ts
const form = new FormData();
form.append('file', file);
const response = await fetch(`${DOCS_ORIGIN}/api/v1/documents/import`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: form,
});
const { documentId, sheets } = (await response.json()).data;
```

只接受 xlsx/xls/csv，规模按**当前身份（组织/个人）套餐**校验（free 5 MB / 2 万行 / 100 Sheet）；**> 8 MB 自动转异步**：响应 `{ async: true, taskId }`，轮询 `GET /api/v1/documents/import/:taskId` 至 `completed` 取 `documentId`；不要手动设置 multipart `Content-Type`。

## 4. 在线加工与读回

1. Phase 1 打开 `https://docs.raodaor.com/doc/sheet/${documentId}` 新窗口。
2. 用户完成清洗后调用 `GET /api/v1/documents/${documentId}/export?format=json&value=formatted`。
3. 使用 `data.sheets[].rows` 的二维数组；坐标和数组下标均为 0-based。
4. 在目标 APP 后端做字段映射、业务校验，业务库保持唯一权威。

## 5. 标红、入库、清理

- 错误单元格调用 `PATCH /api/v1/workbooks/{id}/sheets/{sheetId}/cells`，发送 `{ r, c, v: { bg: '#ffe6e6' } }`。
- 清除旧标记发送 `{ bg: null }`，绝不使用 `clear: true`。
- 全部校验通过后写入目标 APP 业务库，并调用 `DELETE /api/v1/workbooks/{id}?permanent=true` 释放配额（回收站中的文档仍占额）。
- 服务端批量 / 无人值守场景改走 Open API（`X-API-Key` + `/api/v1/open/*`），见 [open-api-guide.md](./open-api-guide.md)；套餐计费与支付见 [billing.md](./billing.md)。
- 对照 [errors.md](./errors.md) 完成联调验收。
