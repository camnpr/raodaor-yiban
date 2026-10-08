<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-docs/open-api-guide.md；修改请提交至 hub 仓库，勿直接编辑 -->

# Open API 对接流程说明（组织级 API Key）

> **适用对象**：要把业务数据导入绕道儿文档的第三方系统（目标 APP）的**服务端**，以及负责开通与排障的实施/运维人员。
> **前置阅读**：[organization-api-keys.md](./organization-api-keys.md)（设计与密钥规范）、[import-api.md](./import-api.md)（用户级导入契约）、[billing.md](./billing.md)（套餐与支付）。
>
> 一句话：**组织是计费主体，API Key 是组织凭证，Open API 是服务端通道。**
> 每次调用都校验「密钥有效性 + scope + 组织配额」，并把用量计入该组织的套餐额度。

---

## 1. 两条通道，先选对

| 通道 | 凭证 | 前缀 | 调用方 | 计费主体 |
|---|---|---|---|---|
| 用户级通道 | `Authorization: Bearer <本 APP JWT>` | `/api/v1/documents/*` | 目标 APP **前端**（SSO 登录用户） | 当前身份（组织 / 个人） |
| **Open API（本文）** | `X-API-Key: rdorg_xxx` | `/api/v1/open/*` | 目标 APP **后端** | 密钥绑定的**组织** |

两条通道**互不认账**：Open API 不接受 Bearer，用户通道不接受 X-API-Key。
需要「无人值守、定时同步、批量导入」的场景，一律走 Open API。

---

## 2. 对接流程（端到端七步）

```
① 申请/加入组织  →  ② 组织升级套餐  →  ③ 签发 API Key  →  ④ 服务端联调自检
                                                              ↓
⑦ 上线后运维（轮换 / 吊销 / 查日志）  ←  ⑥ 配额与错误兜底  ←  ⑤ 正式调用
```

### ① 获得组织身份

- 组织 = IDStack 租户，创建需平台侧权限，故为**申请制**：用户在 `/org-request` 提交申请 → 运营方在 IDStack 建租户并签发 `organization` 角色 → 申请人重新 SSO 登录即可切换组织身份。
- 已有组织：让组织管理员把你加为成员（`/admin/members`）。只有**组织管理员**（组织身份档 `organization` 角色）能签发密钥，普通成员 `org_member` 无此权限。

### ② 组织升级套餐（配额的来源）

- 新组织默认 `free`（10 文档 / 月 50 次导入 / 单文件 5MB / 20,000 行）。
- 组织管理员在 `/billing` 升级，款项由 **IDStack 托管收款**（线上支付 / 分享支付链接 / 线下对公凭证核销），**核销成功后** `payment.verified` 才抬档生效。
- 企业版无标价，走商务洽谈。
- 关键认知：**配额是组织级、成员共享的**。Open API 的调用与成员在界面上的操作累加到同一份额度，不会「另给一份」。
- **文档数按「创建时的归属快照」计量**：本通道导入的文档归属本组织（`Workbook.organizationId`），与成员在界面上创建的文档一起占用组织额度；个人身份创建的文档不会因成员切到组织而占用组织额度。
- **软删除（回收站）仍占额**，只有彻底删除才释放；平台**不会自动清理**回收站。用量接近上限（≥90%）时组织管理员会收到清理提示，可在导入前用 `GET /api/v1/open/usage` 预检，额度不足则先清理或升级。

### ③ 签发 API Key

管理端点（需组织管理员的本 APP JWT，即浏览器登录态）：

```
POST   /api/v1/organization-keys              签发（明文仅返回一次）
GET    /api/v1/organization-keys              列表（只回前缀，不回摘要）
PATCH  /api/v1/organization-keys/:id          改名 / 换 scope / 设到期 / 设 IP 白名单
POST   /api/v1/organization-keys/:id/rotate   轮换（旧 key 立即失效，返回新明文）
POST   /api/v1/organization-keys/:id/revoke   吊销（幂等、即时生效）
```

- 界面入口：侧栏 **API 密钥**（`/admin/organization-keys`）。
- 每组织上限 **5 枚**活跃密钥；scope 默认只给 `docs:read`，需要导入请勾 `docs:import`，需要标红/清理请勾 `docs:write`。
- **明文只在签发/轮换弹窗出现一次**，请立即保存到服务端的密钥管理（环境变量 / Vault）；丢失只能轮换。

### ④ 服务端联调自检

```bash
# 1) 确认密钥有效、归属正确、套餐与用量
curl -s https://<host>/api/v1/open/organizations/me -H "X-API-Key: rdorg_xxx" | jq

# 2) 轻量配额预检（调用方据此降级提示）
curl -s https://<host>/api/v1/open/usage -H "X-API-Key: rdorg_xxx" | jq
```

返回示例（`organizations/me`）：

```json
{
  "organization": { "id": "...", "name": "示例科技", "plan": "pro", "planExpiresAt": null },
  "key": { "prefix": "rdorg_1a2b3c4d", "scopes": ["docs:read", "docs:import"] },
  "usage": {
    "documents": { "used": 12, "limit": 1000 },
    "importsThisMonth": { "used": 3, "limit": 10000 }
  }
}
```

### ⑤ 正式调用

| 方法 | 路径 | scope | 说明 |
|---|---|---|---|
| GET | `/api/v1/open/organizations/me` | 任意 | 组织与用量概览 |
| GET | `/api/v1/open/usage` | 任意 | 套餐配额与已用量 |
| GET | `/api/v1/open/workbooks` | `docs:read` | 组织下文档列表（分页，`page` / `pageSize`） |
| GET | `/api/v1/open/workbooks/:id` | `docs:read` | 读取结构化数据（`value=raw\|formatted`、`sheet`、`skipEmptyRows`） |
| POST | `/api/v1/open/workbooks/import` | `docs:import` | 上传导入建文档（**配额主消费动作**） |
| GET | `/api/v1/open/import/:taskId` | `docs:import` | 查询异步导入任务（>8MB 文件走异步） |
| PATCH | `/api/v1/open/workbooks/:id/sheets/:sheetId/cells` | `docs:write` | 批量更新单元格（校验标红 / 清除标红） |
| DELETE | `/api/v1/open/workbooks/:id` | `docs:write` | 删除文档（暂存清理，`?permanent=true` 彻底删除并释放配额） |

导入示例：

```bash
curl -s -X POST https://<host>/api/v1/open/workbooks/import \
  -H "X-API-Key: rdorg_xxx" \
  -H "Idempotency-Key: 7f3c9e10-...（UUID，重试时保持不变）" \
  -F "file=@./customers.xlsx" \
  -F "ownerEmail=ops@client.com" \
  -F "docName=客户主数据导入" | jq
```

响应：

- 小文件（≤8MB）同步：`{ "documentId": "...", "name": "...", "sheets": [...], "rowCount": 120, "totalRows": 120, "async": false }`
- 大文件（>8MB）异步：`{ "taskId": "...", "async": true }` → 轮询 `/api/v1/open/import/:taskId`，状态 `pending → processing → completed | failed`

**文档归属人**：`ownerEmail` 必须是本组织成员；不传则归属**密钥签发人**（并要求其仍在组织内）。配额按组织计，文档落在指定成员名下，权限与成员在界面上的文档一致。

**标红 / 清理示例**（「读回 → 校验 → 标红 → 修正 → 清理」闭环）：

```bash
# 校验出错误后标红问题单元格（坐标 0-based，与读回的 rows 下标一一对应）
curl -s -X PATCH "https://<host>/api/v1/open/workbooks/$DOC_ID/sheets/$SHEET_ID/cells" \
  -H "X-API-Key: rdorg_xxx" -H "Content-Type: application/json" \
  -d '{"operations":[{"r":3,"c":2,"v":{"bg":"#ffe6e6"}}]}' | jq

# 清除上一轮标记：务必用 bg:null（单元格原值原样保留）
curl -s -X PATCH "https://<host>/api/v1/open/workbooks/$DOC_ID/sheets/$SHEET_ID/cells" \
  -H "X-API-Key: rdorg_xxx" -H "Content-Type: application/json" \
  -d '{"operations":[{"r":3,"c":2,"v":{"bg":null}}]}' | jq

# 导入成功后清理暂存文档，释放组织文档配额（不可恢复）
curl -s -X DELETE "https://<host>/api/v1/open/workbooks/$DOC_ID?permanent=true" \
  -H "X-API-Key: rdorg_xxx" | jq
```

> 🔴 `clear: true` 在 Open API 通道被**直接拒绝（400）**：该分支删除的是整个单元格（含原值与公式），
> 对第三方是数据丢失脚枪。清除标红一律用 `v: { bg: null }`。

### ⑥ 配额与错误兜底

| HTTP | 业务码 | 场景 | 处理建议 |
|---|---|---|---|
| 400 | `3006` | 文档数达组织套餐上限 | 清理文档或升级套餐 |
| 429 | `5005` | 本月导入次数用尽 | 次月再试或升级 |
| 413 | — | 单文件超套餐大小上限 | 压缩 / 拆分文件 |
| 401 | `8001` `8002` `8003` | 密钥无效 / 已吊销 / 已过期 | 检查环境变量，必要时轮换 |
| 403 | `8004` `8005` | scope 不足 / IP 不在白名单 | 到平台改密钥配置 |
| 429 | `6003` | per-key 限流（60 次/分钟） | 指数退避重试 |
| 400 | `8007` | `ownerEmail` 不属于本组织 | 改用组织内成员邮箱 |
| 400 | — | 单元格操作含 `clear: true`（Open API 已禁用） | 改用 `v: { bg: null }` 清除标红 |

导入次数**只在导入成功后记账**，解析失败不消耗额度。

### ⑦ 上线后运维

- **轮换**：疑似泄露时立即 `rotate`，旧 key 即时失效、新 key 同配置签发；建议配合短期 `expiresAt` 做定期轮换。
- **吊销**：下线对接方时 `revoke`（幂等），并填 `reason` 便于审计。
- **审计**：每次调用落 `OpenApiAccessLog`（组织、密钥前缀、方法、路径、状态码、错误码、IP、时间），可在服务端排查「谁在何时调了什么」。
- **限流**：每枚密钥 60 次/分钟（进程内固定窗口）；多实例部署时各实例独立计数，超大规模调用请提前沟通。

---

## 3. 客户端工程规范（写进你的服务端代码）

1. 只走 **HTTPS（TLS ≥ 1.2）**；密钥存服务端密钥管理，绝不进前端代码、日志、异常消息与 URL 查询串。
2. **幂等键**：所有写操作（导入）带 `Idempotency-Key`（UUID）。重试时复用同一键值，服务端返回首次结果，不会重复建文档、不会重复消耗导入次数。
3. **重试策略**：`429` / 网络错误按 `2^n` 指数退避 + 抖动，最多 3 次；`4xx` 业务错误（配额、scope、参数）**不重试**。
4. **超时**：连接 10s、读 60s；大文件走异步任务轮询，不要用超长同步等待。
5. **降级**：拿到配额类错误时向你的用户提示，不要静默吞掉。

---

## 4. 上线自检清单

- [ ] 已切换/加入目标组织，且当前身份为**组织管理员**
- [ ] 组织套餐已升级并**核销成功**（`/billing` 或 `/open/usage` 能看到新额度）
- [ ] 密钥 scope 覆盖所需操作（导入必须含 `docs:import`；标红/清理需 `docs:write`）
- [ ] 明文已保存至服务端密钥管理，未提交进代码仓库
- [ ] `organizations/me` 返回的 `organization.name` 是**预期的组织**
- [ ] `usage` 显示额度充足（文档数、本月导入次数）
- [ ] 导入请求带 `Idempotency-Key`，重复提交返回同一 `documentId`
- [ ] 标红用 `v: { bg: "#ffe6e6" }`、清红用 `v: { bg: null }`（未使用 `clear: true`）
- [ ] 导入成功后调用 `DELETE ...?permanent=true` 清理暂存文档，配额已释放
- [ ] `ownerEmail` 为本组织成员（或已确认回退到签发人符合预期）
- [ ] 已按「IP 白名单 + 到期时间」做最小授权
- [ ] 错误处理覆盖了 `3006 / 5005 / 8001-8007 / 429`
- [ ] 有密钥轮换与吊销的运维预案（含联系人）

---

## 5. 常见问题

**Q：组织管理员在侧栏看不到「API 密钥」入口？**
A：入口由服务端下发的 `capabilities.manageMembers` 控制。需同时满足：当前身份挂在组织上、且在该组织持 `organization` / 管理员角色（或为平台运营者）。切换身份后请刷新页面重新拉取。

**Q：导入返回 429 `5005`，但本月没导几次？**
A：月导入次数是**组织共享**的，同组织其他成员与历史 Open API 调用都计入同一计数。用 `/open/usage` 看 `imports.used`。

**Q：文档建出来了，但组织成员在界面看不到？**
A：文档归属 `ownerEmail` 指定成员（或密钥签发人）。其他成员需通过协作成员/分享链接获得访问权；Open API 的读取按「owner 属于本组织」判定。

**Q：可以用用户级 JWT 调 `/open` 吗？**
A：不可以，也不应该。`/open` 只认 `X-API-Key`；用户级需求请走 `/api/v1/documents/*`。

**Q：密钥泄露了怎么办？**
A：立即 `rotate`（优先）或 `revoke`。吊销/轮换**即时生效**（鉴权每次读库判状态，无长 TTL 缓存）。随后在 `OpenApiAccessLog` 里按 `keyPrefix` 排查异常调用。

**Q：为什么 PATCH 单元格不允许 `clear: true`，也不建议直接改业务值？**
A：Open API 的写入定位是**交互层标注**（标红引导修正）与**暂存文档清理**，不是把表格当权威源做业务写入——那会让「目标 APP 业务库 = System of Record」的架构原则失效。`clear: true` 在服务端会删除整个单元格（含原值与公式），已直接 400 拒绝。
