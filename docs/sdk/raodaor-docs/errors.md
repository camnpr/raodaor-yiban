<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-docs/errors.md；修改请提交至 hub 仓库，勿直接编辑 -->

# RaoDaor Docs 错误码字典与排查路径

> 统一响应为 `{ code, data, message }`；HTTP 非 2xx 或 `code !== 0` 表示失败。排查顺序：来源白名单 → token → HTTP/code → 请求参数 → 文档权限/配额。

## 错误码

| code / HTTP | 常量或现象 | 含义 | 处理 |
|---|---|---|---|
| `401` | JWT invalid/expired | 未登录、token 过期，或误用了 IDStack token | 先 refresh；失败后重新 SSO，确认 Bearer 是 Docs JWT |
| `3001` / 404 | `WORKBOOK_NOT_FOUND` | 文档不存在、已删除或 ID 错 | 检查 `documentId`，确认未提前清理 |
| `3002` / 404 | `SHEET_NOT_FOUND` | `sheet` 或 sheetId 不存在 | 使用 import 返回的 sheet id，或省略 `sheet` 导出全部 |
| `3003` / 403 | `WORKBOOK_ACCESS_DENIED` | 当前用户不是 owner/协作者 | 换正确账号或加为协作者；组织身份**共享的是配额**，文档可见性仍按 owner + 协作者 |
| `3005` / 400 | `SHEET_LIMIT_EXCEEDED` | Sheet 数超过 100 | 拆分文件后重试 |
| `3006` / 400 | `WORKBOOK_LIMIT_EXCEEDED` | 当前身份（组织/个人）套餐文档数达上限；**回收站文档仍占额** | 彻底清理文档（含回收站）或升级套餐；`GET /api/v1/billing/quota` 可预检 |
| `5001` / 413 | `FILE_TOO_LARGE` | 超过当前套餐的文件大小/行数上限（free 5 MB / 2 万行） | 拆分文件或升级套餐；不要重试同一文件 |
| `5002` / 400 | `FILE_TYPE_NOT_SUPPORTED` | 非 xlsx/xls/csv 或未上传文件 | 检查扩展名、`file` multipart 字段 |
| `5003` / 400 | `FILE_PARSE_ERROR` | 文件损坏、加密或没有可解析 Sheet | 重新导出未加密文件 |
| `5004` / 400 | `FILE_EXPORT_ERROR` | format 不支持或文档类型不适合导出 | 使用 `format=json`，确认文档 ID |
| `5005` / 429 | `IMPORT_QUOTA_EXCEEDED` | 本月导入次数达套餐上限（自然月重置） | 等待下月或升级套餐；仅**成功**导入计费，失败不消耗 |
| CORS/无响应 | 预检失败 | `CORS_ALLOW_ORIGINS` 未精确包含宿主域名 | 加白名单并重启后端 |
| 登录不回传 | popup 不关闭/无消息 | `VITE_AUTH_ALLOWED_ORIGINS` 未包含 opener，或来源校验失败 | 精确配置来源并重建前端；检查 `event.origin` |
| 标红后数据消失 | 使用了 `clear:true` | 服务端删除了整格数据 | 用 `v: { bg: null }` 只清除背景 |
| Open API `401` | `8001/8002/8003` | 密钥无效 / 已吊销 / 已过期 | 检查 `X-API-Key`（仅存服务端），必要时轮换密钥 |
| Open API `403` | `8004/8005` | scope 不足 / IP 不在白名单 | 到平台改密钥 scope（`docs:read` / `docs:import` / `docs:write`）或 IP 白名单 |
| Open API `429` | `6003` | per-key 限流（60 次/分钟） | 指数退避 + 抖动重试，最多 3 次 |

## 标准排查路径

1. **登录失败**：检查 popup 是否由 `window.open` 打开；确认 Docs origin、消息类型和 opener origin 白名单。
2. **API 401**：确认 token 来源是 RaoDaor Docs；检查 JWT 是否过期、refresh 是否覆盖新 refreshToken。
3. **API 403/3003**：确认文档 owner 或协作者身份；组织身份共享的是配额而非文档可见性。
4. **导入失败**：检查 multipart 字段名 `file`、文件类型、5 MB/20,000 行/100 Sheet 限制；不要手设 `Content-Type`。
5. **导出异常**：确认 `format=json`、documentId、sheetId；用 `data.sheets[].rows`，不要依赖稀疏矩阵。
6. **校验回写异常**：确认 `r/c` 为 0-based 和当前用户有 edit 权限；清除旧错误必须先发送 `bg:null`。
7. **配额异常**：遇到 `3006` 清理文档；成功入库后用 `permanent=true` 删除暂存文档。
