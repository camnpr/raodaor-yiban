<!-- 由 ai-docs 同步自 canonical/sdk/raodaor-message/pre-send-hook-example.md；修改请提交至 hub 仓库，勿直接编辑 -->

# 发送前拦截钩子（preSendHook）接入示例

> 平台化 Q8 P1。供**接入方（如 CampusHeroSaga）**在 message 的「发送前拦截钩子」注入自己的合规规则
> （家长审核 / 同校同龄 / 时段限制等）。message 只提供机制，**不理解业务语义**——规则完全由接入方自己写。

---

## 1. 钩子协议

### 请求（message → 接入方）

```
POST <你配置的 hook.url>
Content-Type: application/json

{
  "conversationId": "cmxxxx",          // message 会话 ID
  "senderId": "cmxxxx",                // message 域 User.id
  "idstackUserId": "IDStack 用户主键",  // ★ 用这个识别你的用户/角色
  "type": "text",                      // text | image | file | audio | video | card
  "content": { "text": "你好" },        // 已规范化的消息体
  "organizationId": "组织 ID"           // 会话所属组织
}
```

### 响应（接入方 → message）

```json
{ "allow": true }
// 或
{ "allow": false, "reason": "22:00–8:00 为未成年人禁聊时段" }
```

- `allow:false` → message 拒绝发送，错误码 `2008`，`reason` 透传给用户
- 回调超时（默认 2s）或不可用 → 默认**放行**（fail-open）；配置 `failClosed:true` 则**拒绝**（合规场景建议）

---

## 2. 配置（在 message 侧，组织级）

```http
PUT /api/v1/cs/pre-send-hook?organizationId=<你的组织ID>
Content-Type: application/json

{
  "url": "https://game-campus-hero-saga.raodaor.com/api/v1/message-hook/pre-send",
  "timeoutMs": 2000,
  "failClosed": true
}
```

> `failClosed:true`：回调故障时拒绝发送（未成年人合规宁可误拒不可漏放）。

---

## 3. CampusHeroSaga 侧回调示例（NestJS）

```typescript
// CampusHeroSaga 后端：message-hook.controller.ts
import { Body, Controller, Post } from '@nestjs/common';

interface PreSendHookPayload {
  conversationId: string;
  senderId: string;
  idstackUserId: string | null; // ★ 识别用户用（IDStack 全局账号）
  type: string;
  content: unknown;
  organizationId: string;
}

@Controller('message-hook')
export class MessageHookController {
  constructor(
    private readonly users: UserService,     // 你自己的用户服务（IDStack 映射）
    private readonly parents: ParentService, // 家长审核服务
    private readonly schools: SchoolService, // 学校/同龄维度
  ) {}

  @Post('pre-send')
  async preSend(@Body() payload: PreSendHookPayload) {
    // ① 时段限制：22:00–8:00 未成年人禁聊
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 8) {
      return { allow: false, reason: '22:00–8:00 为未成年人禁聊时段' };
    }

    // ② 按 idstackUserId 反查本地用户（PLAYER / TEACHER / PARENT）
    const user = payload.idstackUserId
      ? await this.users.findByIdstackUserId(payload.idstackUserId)
      : null;
    if (!user) {
      return { allow: false, reason: '用户不存在' };
    }

    // ③ 家长审核：PLAYER 须经家长批准
    if (user.role === 'PLAYER' && !(await this.parents.isApproved(user.id))) {
      return { allow: false, reason: '该账号未通过家长审核，禁止私聊' };
    }

    // ④ 同校/同龄限制（示例：仅同龄可私聊）
    const peer = await this.resolvePeer(payload.conversationId);
    if (peer && !this.sameAgeBand(user, peer)) {
      return { allow: false, reason: '仅限同龄用户私聊' };
    }

    // 全部通过 → 放行
    return { allow: true };
  }

  private async resolvePeer(conversationId: string) {
    // 单聊会话的另一方。可调用 message 的 Open API，或自己维护 conversationId → 对端 映射。
    return null;
  }

  private sameAgeBand(a: User, b: User): boolean {
    return Math.abs(a.age - b.age) <= 3;
  }
}
```

---

## 4. 完整链路（CampusHeroSaga 场景）

```
CampusHeroSaga 玩家 A 发私信
  → message 本地规则（敏感词/禁言/黑名单/私信门槛）
  → POST 你的 pre-send 回调
      ├─ 22:00–8:00 → { allow:false } → message 返回 2008「禁聊时段」
      ├─ 未过家长审核 → { allow:false } → 2008「未通过家长审核」
      └─ 通过 → { allow:true } → 落库 + 扇出
```

**message 核心零侵入**：所有未成年人合规规则都在 CampusHeroSaga 自己的 `message-hook` 端点里，message 只负责「回调 → 按 allow 放行/拒绝」。

---

## 5. 注意事项

1. **failClosed 取舍**：合规场景设 `true`（故障即拒）；普通风控场景设 `false`（故障放行不误伤）。
2. **回调要快**：默认 2s 超时，不要做慢查询/同步调第三方；慢规则应缓存（如家长审核结果）。
3. **幂等**：message 可能重试，回调须幂等（只读判定天然幂等）。
4. **验签预留**：`secret` 字段已预留，若需验响应签名可后续补 HMAC（当前 message 不验响应签名）。
5. **用户识别**：用 `idstackUserId` 反查本地用户，不要用 `senderId`（那是 message 内部 cuid）。
