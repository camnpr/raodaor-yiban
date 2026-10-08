<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-message/platform-architecture.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 绕道儿消息（RaodaorMessage）平台化架构设计

> 本 APP 侧架构源文档。定位 message 为生态的 **IM + 消息触达 PaaS**，明确「通用核心 + 扩展点」边界。
> 配套：[overview.md](./overview.md)（接入指南）、[pre-send-hook-example.md](./pre-send-hook-example.md)（发送前拦截钩子接入示例）、message 后端仓库 `docs/PRD.md` §13.2 Q8（平台化决策，未随 hub 收录）。

---

## 1. 定位与目标

message 不是「某几个业务的消息模块」，而是生态**统一的消息底座**，目标：

| 目标 | 含义 |
|---|---|
| 一套核心 | 消息 schema、IM 能力、消息中心、推送、接入协议，**全生态只有一套** |
| 到处复用 | 所有生态应用（ad / docs / mall / 游戏 / 教育…）共用，不各自造轮子 |
| 业务可插拔 | 各业务的**特有规则**（合规、角色、维度、样式）通过扩展点注入，不侵入核心 |

---

## 2. 核心设计原则（业界 IM PaaS 对齐）

对标腾讯云 IM / 融云 / Sendbird / Twilio 的成熟范式：

1. **通用的事 message 做**：消息怎么发、怎么存、怎么搜、怎么推。
2. **业务的事业务做**：谁能发、给谁发、什么时段发、什么内容合规——通过扩展点桥接。
3. **PaaS 不做业务角色鉴权**：只认「合法用户」，业务角色由业务方判断。
4. **YAGNI（别提前抽象）**：扩展点按「有真实接入方验证」的节奏落地，不为单个产品提前抽象。
5. **schema 与 theme 分离**：数据契约一套硬约束，视觉主题多套可换。

---

## 3. 架构总览：通用核心 + 4 扩展点

```
┌─────────────────────────────────────────────────────────────┐
│                      通用核心（一套，标准化）                    │
│  消息 schema │ IM 能力 │ 消息中心 │ 推送 │ 接入协议             │
└─────────────────────────────────────────────────────────────┘
                              ▲
        ┌──────────┬──────────┼──────────┬──────────────┐
        │          │          │          │              │
   ┌────┴───┐ ┌────┴────┐ ┌───┴────┐ ┌───┴─────┐ ┌──────┴─────┐
   │metadata│ │发送前钩子│ │Webhook │ │ theme   │ │ (未来扩展)   │
   │ 自定义  │ │ 合规拦截 │ │ 事件流出│ │ 视觉主题 │ │            │
   │ 维度    │ │         │ │        │ │         │ │            │
   └────────┘ └─────────┘ └────────┘ └─────────┘ └────────────┘
```

---

## 4. 通用核心（必须一套，不允许各业务自建）

| 能力 | 现状 | 说明 |
|---|---|---|
| 消息 schema | ✅ | text/image/file/audio/video/card/system；card 四类（product/match/order/link） |
| IM 能力 | ✅ | 收发、seq、撤回 2 分钟、已读游标、本地删除、转发、引用、搜索 |
| 消息中心 | ✅ | 5 分类、订阅、免打扰、未读角标、聚合 |
| 推送 | ✅ | 全端设备注册 + 触发 |
| 接入协议 | ✅ | 鉴权通道（JWT/APIKey/visitor/入站）、入站事件、嵌入组件 |
| 好友/关系 | ✅ | 好友生命周期、拉黑断联、私信门槛 |
| 内容安全 | ✅ | 敏感词、举报、禁言、隐私打码 |
| **typing（正在输入）** | ✅ | `chat:typing` WS 事件 + `POST /conversations/:id/messages/typing`（3 秒防抖在客户端做） |

---

## 5. 扩展点（业务注入规则，message 不硬编码）

### 5.1 metadata —— 自定义维度（问题：学校/班级/年龄）

**问题**：CampusHeroSaga 要「学校/班级/年龄」，电商要「会员等级」，社交要「性别/地区」。message 不能为每个维度加字段。

**方案**：`User` 加通用 metadata，维度由业务方自定义写入，message 提供「按 metadata 检索」的通用能力。

```prisma
model User {
  // ...现有字段...
  metadata Json @default("{}")   // 业务自定义维度：{ school, className, age, vipLevel, ... }
}
```

**已实现（P0）**：`User.metadata` 字段 + `GET/PATCH /users/me/metadata`（浅合并，删除用显式 null）；`CsVisitor.attrs`、`CustomerProfile.attrs` 为同源 Json 雏形。业务方批量写入走 Open API（P1 补）。

### 5.2 发送前拦截钩子 —— 合规插桩（问题：家长审核/同校/时段）

**问题**：CampusHeroSaga 的未成年人合规（家长审核、同校同龄限制、22:00–8:00 禁聊）是**业务特有**，message 通用 IM 不该内置。

**方案**（P1）：message 提供「发送前同步回调」，业务方注入合规判定。

```
发送消息 → message 检查本地规则（敏感词/禁言/黑名单）
        → 若配置了 pre-send 回调 URL，同步调用业务方 → { allow: true/false, reason }
        → allow 才落库 + 扇出
```

- 这是腾讯云 IM「发消息前回调」的等价物，**通用**（不只服务合规，还可做风控、限流、审计）；
- message 只提供钩子机制 + 超时降级（回调不可用默认放行并告警），**不理解**"家长审核"是什么。

**已实现（P1）**：`OrganizationSettings.preSendHook`（`{url, secret, timeoutMs, failClosed}`）+ `PreSendHookService`（同步回调 + 超时降级：默认 fail-open、可配 fail-closed）；`MessageService.send/proxySend` 在本地规则后、落库前调用；配置端点 `GET/PUT /cs/pre-send-hook`；拒绝错误码 `2008`。

### 5.3 Webhook 事件流出 —— 审计/留痕/联动

已有 `WebhookEndpoint` + `WebhookDelivery`（HMAC 签名 + 指数退避重试）。事件集统一定义于
`backend/src/modules/webhook/events.ts`（事件名常量 `WebhookEvents` + 事件目录）。

**已实现（P1 后半）**：

| 事件 | 触发点 | 用途 |
|---|---|---|
| `quota.warning` | `billing.recordUsage` ≥90% | 计量预警（FR-BILL-02） |
| `cs.session.started` | `widget.getOrCreateSession` | 访客进线 |
| `cs.session.assigned` | `cs.acceptSession` / `cs.autoAssign` | 会话分配 |
| `cs.session.closed` | `cs.closeSession` | 会话关闭 |
| `cs.message.created` | `widget.sendMessage`（访客/用户消息） | 机器人接管入口（FR-OPEN-07 / FR-CS-11） |
| `message.recalled` | `message.recall` | 审计留痕（按撤回者主组织） |
| `friend.request` | `relation.sendRequest` | 审计留痕（按申请者主组织） |
| `user.muted` | `report.dispose`（mute 处置） | 审计留痕（按被禁言者主组织） |
| `user.subscribed` / `user.unsubscribed` | `open.subscribe` / `open.unsubscribe` | 用户关注/退订应用（FR-MC-05 / FR-PUSH-10） |
| `message.created` | `message.send`（type=app 会话） | 用户回复服务号（FR-OPEN-07 机器人接力） |
| `push.delivered` | `push.executeTask`（任务完成） | 推送任务聚合回执（FR-PUSH-09） |

**组织级订阅模型**：`WebhookEndpoint.organizationId`（可选）+ `User.organizationId`（登录时取首个
`roles[].tenant_id` 映射的「主组织」，多租户多对多留待 P2）；`WebhookService.dispatchForUser`
按用户主组织分发审计类事件。

> PRD §9.4 出站 Webhook 事件清单（9 类）已**全部实现**。

### 5.4 theme —— 视觉主题（问题：消息样式多套）

**schema 与 theme 分离**：

| 层 | 约束 | 说明 |
|---|---|---|
| 消息 schema | 一套硬约束 | 数据契约，所有接入方一致 |
| 视觉主题 | 多套，应用创建时选 | 存 `App.theme`，仅影响前端渲染 |

预留主题：`default`（默认）/ `education`（柔和卡通）/ `enterprise`（正式）/ `game`（活泼）。主题**不改变**后端数据契约。

**已实现（P0）**：`App.theme` 字段 + `CreateAppDto.theme`（应用创建时四选一）；前端按主题渲染的样式库留待接入方联调时落地。

---

## 6. 角色模型：平台角色 ≠ 业务角色

**铁律：message 只认「生态平台角色」做平台权限，业务角色（PLAYER/TEACHER/PARENT）由业务方自己判断。**

| 角色类型 | 例子 | message 态度 |
|---|---|---|
| 生态平台角色 | system_admin / owner / tenant_admin / organization | ✅ 认，做 message 自己的鉴权（AdminGuard） |
| 业务应用角色 | PLAYER / TEACHER / PARENT | ❌ 不认、不判，可由 metadata 透传存储 |

技术现状（已实现）：`extractIdstackRoleNames` 提取 IDStack roles 时**主动过滤** `app_id` 非本应用的角色，故业务角色天然进不了 message 的鉴权，这是正确行为。

---

## 7. 分阶段落地路线

| 阶段 | 内容 | 触发条件 |
|---|---|---|
| **P0（通用零耦合）** | ✅ 已落地：`chat:typing` 事件、`User.metadata`、`App.theme` + 4 套主题、消息 schema audio/video | 任何接入方都用得上，无业务耦合 |
| **P1（首个真实接入方验证后）** | ✅ 已落地：发送前拦截钩子（`preSendHook` + `PreSendHookService` + `GET/PUT /cs/pre-send-hook`）；✅ 已落地：Webhook 事件集（客服域 4 事件 + `quota.warning`，见 §5.3） | 有业务方需要插桩合规/风控 |
| **P2（3+ 产品验证后）** | 再抽「合规 IM」专门模块（监护审计/三方审批/时段限制） | 模式被多个产品验证，避免提前抽象 |

---

## 8. 边界：什么不该做（防过度设计）

- ❌ 不在 `User` 硬编码 `school`/`className`/`age`/`vipLevel` —— 用 metadata
- ❌ 不内置「家长审核」「同校同龄」「未成年人时段」—— 用发送前钩子让业务方注入
- ❌ 不做业务角色鉴权（PLAYER/PARENT 等）—— 业务方自己判
- ❌ 不管客户端音效/动画 —— 纯 UI 层
- ❌ 不因单个业务改通用 schema —— schema 变更走评审，保证全生态一致

---

## 9. 与现有实现的映射

| 本文概念 | 现有代码落点 |
|---|---|
| 通用核心 | `backend/src/modules/{message,conversation,group,relation,notification,push,moderation}` |
| 接入协议 | `internal`（入站事件）、`open`（Open API）、`widget`（客服）、`billing` |
| metadata | `User.metadata` + `GET/PATCH /users/me/metadata`；`CsVisitor.attrs`/`CustomerProfile.attrs` 同源 Json |
| Webhook 流出 | `webhook` 模块（HMAC + 重试） |
| 平台角色鉴权 | `AdminGuard`（system_admin/owner） |
| 业务角色过滤 | `auth.service#extractIdstackRoleNames` |
| 主题 | `App.theme` 字段 + `CreateAppDto.theme`（创建时四选一） |
