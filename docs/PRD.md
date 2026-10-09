# 绕道儿颐伴（Raodaor Yiban）产品需求文档（PRD）

| 项目 | 内容 |
|------|------|
| 产品名称 | 绕道儿颐伴（Raodaor Yiban，长辈生活助手 APP） |
| 产品形态 | 独立 APP（iOS / Android）+ Web 门户与运营后台 |
| 前端域名 | https://yiban.raodaor.com |
| 后端服务 | NestJS，端口 9015 |
| 前端开发端口 | Expo Dev Server，端口 5115（`expo start --port 5115`） |
| 数据库 | PostgreSQL 14（Prisma） |
| 文档版本 | v1.0 |
| 编写日期 | 2026-10-09 |
| 文档状态 | 待评审 |

**更新记录**

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-10-09 | 首版最终落地：以「首期天气守护版本」为核心，对齐绕道儿广告（raodaor-ad）技术栈（Expo 57 + NestJS 11 + Prisma + PostgreSQL 14 + Windows Server 2012 R2 部署）；明确 V1.0 / V1.1 / V1.2 三阶段范围；补齐生态 SDK 对接契约、数据模型、安全合规与里程碑 |

---

## 1. 项目概述

### 1.1 背景与定位

绕道儿颐伴是绕道儿（Raodaor）生态中面向**中老年群体**的**「AI 暖心陪伴 + 健康安全守护」综合生活助手**，以**一套代码、三个端**（iOS APP / Android APP / Web）交付。

产品遵循**「国内单点验证 → 长期全球化出海」**战略：

```
国内单点验证（天气刚需冷启动）
  → 完善 AI 陪伴 / 健康监护 / 紧急急救核心能力
  → 多语言国际化适配
  → 深耕东南亚华人市场
  → 全面海外出海
```

**首期（V1.0）以「纯净零广告适老天气工具」作为业务敲门砖**，核心差异化是**「亲情气象守护」**：子女绑定父母后，可远程掌握父母所在城市的实时天气与极端天气预警，父母无需任何操作即可获得守护。长期深耕老年情感陪伴、健康监测、跌倒急救、用药关怀、子女远程安心守护。

核心痛点定位：

| 痛点 | 现状 | 本产品解法 |
|------|------|-----------|
| 中老年手机广告误触 | 主流工具类 APP 广告弹窗密集，误触率高 | 全应用零广告、零弹窗、零诱导（对齐工信部适老化规范） |
| 孤独无人陪伴 | 独居长辈深夜失眠无倾诉渠道 | AI 暖光情感陪伴（长期记忆、人格统一，V1.1） |
| 健康异常无人察觉 | 慢病突发无预警，子女异地不知情 | 智能手环健康监护 + 分级预警推送（V1.1） |
| 突发意外无法自救 | 跌倒后无法手动呼救 | 无人干预跌倒自动联络（V1.1） |
| 子女远程不知情 | 异地牵挂无低成本尽孝渠道 | 每日子女安心简报（V1.2） |

**核心架构准则**：生态能力 100% 复用（身份、会员、支付、消息、文件、埋点、大屏、AI 全部对接绕道儿生态 SDK/OpenAPI），垂直业务自研（天气查询、亲情守护、AI 陪伴、健康监护、跌倒急救、用药关怀）；严格遵循生态官方规范，不臆造接口、不重复造轮子；**全站原生 i18n 架构，不后期补丁兼容**。

### 1.2 商业版图（收入模型）

```
会员订阅收入（IDStack 托管收款，国内外统一商业化体系）
        │
   基础功能永久免费（天气、预警、语音播报、基础亲情守护）
        │
   增值会员订阅（无广告、无诱导下载、无流量变现）
   ├── 高级适老组件（小组件多样式、定时播报）
   ├── 守护类权益（多城市、多亲情绑定、每日子女简报）
   ├── 健康类权益（完整健康报告、多紧急联系人、漏服药物多级提醒）
   └── AI 类权益（无限次深夜陪伴、个性化情绪安抚）
        +
   （P2 评估）绕道儿生态应用市场订阅分发、海外会员体系
```

> 商业化铁律：**不靠广告变现**——这是与市面老年工具类 APP 的根本区别，也是「绝对纯净」定位的底线。所有收入来自会员订阅与生态能力复用的增值服务。

### 1.3 核心价值

| 对象 | 价值 |
|------|------|
| 长辈（直接使用者） | 零广告纯净体验、大字适老、一键语音播报、极端天气强预警、AI 有温度陪伴、健康被守护 |
| 子女（决策 / 付费 / 守护者） | 远程掌握父母城市天气与预警、每日安心简报、突发异常第一时间接收、低成本远程尽孝 |
| 平台（运营方） | 复用生态统一底座、数据大屏、合规会员订阅、可出海复制的银发市场标杆 |
| 生态 | 复用 IDStack 身份/支付/会员/埋点；RaoDaor Message 消息推送；RaoDaor File 存储；RaoDaor Docs 导入导出；DataCanvas 数据大屏；CodeRouter AI |

### 1.4 术语表

| 术语 | 说明 |
|------|------|
| 长辈 Elder | 产品直接使用者（50 岁以上中老年），核心使用天气与守护功能 |
| 子女 / 守护人 Guardian | 绑定并守护长辈的中青年用户，接收长辈城市天气、预警与简报 |
| 亲情守护 Care | 长辈与守护人之间的绑定关系及其衍生能力（天气守护、预警推送、简报） |
| 天气守护 Weather Guardian | V1.0 核心：守护人关注长辈城市天气，极端天气预警自动触达双方 |
| 极端天气预警 Alert | 气象灾害预警（暴雨/台风/寒潮/高温/暴雪等），按红/橙/黄/蓝四级 |
| 实时天气 / 逐小时 / 逐天 | 当前天气 / 24 小时逐时预报 / 15 天逐日预报 |
| 语音播报 TTS | 跟随系统语言的大字天气语音朗读（expo-speech） |
| 适老小组件 Widget | 桌面小组件（Android AppWidget / iOS WidgetKit），大字展示天气与预警 |
| 暖光 AI Companion | V1.1 AI 情感陪伴（CodeRouter），长期记忆、人格统一、温和舒缓 |
| 健康监护 Health Monitor | V1.1 智能手环健康数据联动，异常分级预警 |
| 跌倒急救 Fall Rescue | V1.1 无人干预跌倒自动联络紧急联系人 |
| 安心简报 Daily Brief | V1.2 每日子女端长辈状态汇总 |
| 会员限免 Membership | 复用 IDStack 会员体系，本地维护权益映射 |

---

## 2. 用户与角色

### 2.1 角色体系（复用 IDStack SSO + JWT roles）

本产品**不自建用户体系**，用户统一经 **IDStack SSO** 登录（APP 内嵌 SSO WebView / Web 端 OAuth 跳转）；角色经 IDStack JWT `roles` claim 下发，前端用 SDK 的 `parseRoles()` / `hasRole()` 判定，后端用 **JWKS 公钥（RS256）** 验签。

| 角色 | 判定 | 权限概要 |
|------|------|---------|
| 长辈（普通用户） | 普通登录用户（默认角色） | 天气首页、语音播报、城市管理、预警订阅、被守护 |
| 守护人（普通用户） | 普通登录用户，经亲情绑定后获得守护视图 | 守护中心（绑定长辈城市天气 + 预警）、发起/接受绑定、接收简报 |
| 平台运营者 | `system_admin` / `owner`（IDStack 角色） | 运营后台：用户/亲情关系/会员/预警事件看板、全局配置 |

> 长辈与守护人**不依赖 IDStack 业务角色区分**（二者可互为、可并存），准入与视图由**亲情关系数据（`CareRelationship`）**驱动；只有平台运营后台由 IDStack 角色驱动（`AdminGuard` 强校验）。

> **能力布尔（capabilities）契约**（与生态一致）：capabilities 只由服务端计算（`/auth/idstack/login`、`/auth/refresh`、`/auth/me`），前端仅消费、禁止自行推断角色。页面加载时 `auth-store` 从本地恢复会话快照，再由根布局调 `GET /auth/me` 对齐一次；对齐失败保留本地会话、不做登出。

### 2.2 目标用户分层

**核心用户（直接使用者：中老年长辈）**
50 岁以上国内居家长辈、东南亚海外华人长辈、海外定居银发群体；特征：视力操作弱化、独居孤独感强、慢病需日常监护、突发意外自救能力弱、依赖温和语音交互、厌恶复杂操作与广告。

**次要用户（决策 / 付费 / 守护用户：中青年子女）**
25–45 岁国内外中青年子女；核心诉求：远程掌握父母状态、第一时间接收异常预警、低成本远程尽孝，愿为亲情守护增值服务付费。

---

## 3. 总体产品架构

### 3.1 信息架构（一套 Expo 代码，三端输出）

**APP 端（iOS / Android，Tab 导航）**

```
(tabs)/home        天气首页（默认首屏）：大字实时天气、逐小时/15 天、预警横幅、一键语音播报 ★核心
(tabs)/care        亲情守护：长辈端「我的家人」；子女端「守护中心」（绑定长辈城市天气摘要 + 预警入口）
(tabs)/me          我的：会员、设置（字体大小/护眼/语言切换）、隐私政策、账号注销
  ├─ /membership   会员中心（权益说明 + 套餐购买）
  ├─ /settings     语言、字体、护眼、注销
  └─ /cities       城市管理（收藏、搜索添加、设为默认）
/care/invite       亲情绑定（二维码 / 邀请码确认）
/guard/[elderId]   子女端：某位长辈详情（城市天气 + 预警 + 每日简报入口）
/share/[elderId]   （P2）长辈天气卡片分享落地页（公开）
```

**Web 端（https://yiban.raodaor.com，同一 Expo Router 路由树的 Web 分支）**

```
/                      门户首页（产品介绍、下载引导、适老说明、双语）
/membership            会员中心（与 APP 同源页面）
/login                 IDStack SSO 登录
/console/admin/*       平台运营后台（仅平台运营者）
  ├─ overview          概览：用户数、绑定关系数、会员收入、预警事件量
  ├─ users             用户与长辈档案
  ├─ care              亲情关系与守护视图
  ├─ membership        会员套餐映射、订阅订单
  └─ alerts            极端天气预警事件看板（DataCanvas 只读嵌入）
```

> 一次编写、三端运行（`expo start --ios / --android / --web`）：APP 与 Web 共用同一份代码与 expo-router 路由树。「运营后台仅面向 Web」是**产品决策**而非技术拆分——通过 `Platform` 守卫与导航条件渲染控制入口暴露；天气首页与守护中心双端复用。

### 3.2 核心用户旅程

**长辈旅程（APP）**：安装 APP → IDStack SSO 登录（隐私政策同意）→ 授权定位/手动选城市 → 大字天气首页 → 一键语音播报 → 极端天气预警强提醒 → 添加多个城市 → （子女绑定后）无需操作即被守护。

**守护人旅程（APP）**：SSO 登录 → 进入守护中心 → 生成邀请二维码 / 邀请码 → 长辈扫码确认绑定 → 守护中心展示长辈城市天气 → 极端天气预警自动推送 → （V1.2）每晚接收安心简报。

**平台运营旅程（Web）**：SSO 登录（运营角色）→ 运营后台查看用户/亲情/会员/预警数据 → 配置会员权益映射 → 大屏查看全局指标。

---

## 4. 功能需求

> 优先级：P0 = V1.0 必须；P1 = 重要；P2 = 增强。标注「V1.1」「V1.2」为对应版本落地，其实现细节在其启动前经独立设计评审确认，本 PRD 给出需求边界与架构约束（不臆造接口）。

### 4.1 天气服务（V1.0 核心，P0）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-W1 | 实时天气 | 大字展示当前温度、体感温度、天气现象、湿度、风力风向、气压、空气质量（AQI）、日出日落；口语化生活文案（如「今天暖和，适合出门遛弯」） |
| FR-W2 | 逐小时预报 | 24 小时逐时温度/降水概率曲线，上下滑动查看 |
| FR-W3 | 逐天预报 | 15 天逐日高低温、天气现象、降水概率、风力 |
| FR-W4 | 空气质量 | AQI 指数、等级、首要污染物、健康建议（对老年群体给出「建议减少外出」等提示） |
| FR-W5 | 生活指数 | 穿衣、洗车、运动、紫外线、感冒等指数（适老文案化） |
| FR-W6 | 数据源路由 | 国内走和风天气（QWeather），海外走 OpenWeatherMap（V1.2）；经 `WeatherProvider` 抽象层归一化，见 §6.4 |

### 4.2 极端天气预警（V1.0 核心，P0）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-A1 | 预警拉取与展示 | 拉取气象灾害预警（暴雨/台风/寒潮/高温/暴雪/大雾等），按红/橙/黄/蓝四级显著展示；首页顶部横幅 + 详情页 |
| FR-A2 | 强提醒 | 高级别预警（红/橙）触发强提醒（视觉强调 + 语音播报 + 推送） |
| FR-A3 | 预警订阅 | 用户可配置订阅城市与预警级别阈值（默认订阅所在城市全部级别） |
| FR-A4 | 预警去重与追踪 | 服务端按 `alertId + cityId` 去重推送，`WeatherAlertRecord` 记录已推送事件，避免重复打扰 |
| FR-A5 | 预警推送（亲情） | 长辈城市触发预警 → 经 raodaor-message 推送给长辈与全部绑定守护人（见 §5.2） |

### 4.3 亲情气象守护（V1.0 核心差异化，P0）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-C1 | 亲情绑定 | 守护人生成邀请二维码/邀请码 → 长辈扫码确认 → 建立双向关系；支持解绑（双方均可发起，需确认） |
| FR-C2 | 守护中心（子女端） | 列表展示所有绑定长辈：昵称、所在城市、当前温度/天气、预警状态；点击进入长辈详情 |
| FR-C3 | 长辈详情（子女端） | 长辈城市实时天气、逐小时/逐天、预警、每日简报入口（V1.2） |
| FR-C4 | 长辈端家人视图 | 长辈查看已绑定的守护人列表 |
| FR-C5 | 亲情绑定数量上限 | 免费 1 位长辈（1 对 1 基础）；会员提升上限（可配） |

### 4.4 语音播报与适老交互（V1.0，P0）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-V1 | 一键语音播报 | 首页醒目语音按钮，点击朗读当前天气与预警（expo-speech，跟随系统语言：简中/繁中/海外语种） |
| FR-V2 | 定时播报 | 会员可自定义时段（如每天早 8 点）自动播报天气 |
| FR-V3 | 大字模式 | 全局字号可调（至少三档，默认大字）；所有文案口语化、弱化专业术语 |
| FR-V4 | 护眼模式 | 高对比度/护眼配色开关 |

### 4.5 城市管理与小组件（V1.0，P0/P1）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-L1 | 城市搜索与添加 | 城市/区县搜索（定位优先），添加收藏 |
| FR-L2 | 多城市收藏 | 收藏列表、设为默认、排序、删除；免费 3 个收藏 + 1 默认，会员不限 |
| FR-L3 | 适老桌面小组件 | 桌面大字天气与预警小组件（Android AppWidget / iOS WidgetKit 原生扩展，经 Expo config plugin 接入）；高级样式为会员权益 |

### 4.6 会员体系（V1.0，P0 底座）

复用 **IDStack 会员体系**（等级 / 套餐目录与收款托管）：

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-M1 | 会员购买 | 会员页嵌入 `payment-create`（`businessType=membership` + `businessId` + `amount` + `locked:true` 预填锁定） |
| FR-M2 | 会员状态同步 | 消费 IDStack webhook（`payment.verified`）落地会员等级；`/auth/me` 下发会员标识 |
| FR-M3 | 权益映射配置 | 运营维护 `tierCode → 权益`（城市上限、亲情绑定上限、定时播报、高级小组件、简报、健康报告、多紧急联系人、AI 陪伴次数等） |
| FR-M4 | 限免与加成 | 会员「每日定时播报」「不限城市/绑定」等权益即时生效 |

> ⚠️ 支付闭环铁律（沿用生态契约）：**核销后才生效**——会员权益只能以 `payment.verified` webhook 为准落地（`externalOrderId` 反查、幂等、RS256 验签）；前端 `onPurchaseSuccess` 仅做 UX 提示。

### 4.7 AI 暖光情感陪伴（V1.1，P0 保命/暖心）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-AI1 | 有记忆对话 | 对接 CodeRouter（OpenAI 兼容 API）；基于长期对话记忆、个人生活轨迹生成专属回应（老伴姓氏、纪念日、生活琐事），非机械问答 |
| FR-AI2 | 情绪安抚 | 深夜失眠陪伴、孤独倾诉疏导；语气温和舒缓、贴合老人沟通习惯 |
| FR-AI3 | 个性化文娱推荐 | 依用户喜好推荐戏曲/评书/音乐等安神内容 |
| FR-AI4 | 主动关怀 | 结合当日天气与过往记忆主动发起暖心对话 |
| FR-AI5 | 内容安全 | 心理健康类高危内容（自伤/自杀）触发危机干预引导话术；对话内容脱敏留存 |

> 依赖外部设施：CodeRouter 密钥 + TTS 播报。实现前经独立设计评审确定记忆存储模型与人格一致性方案。

### 4.8 健康监护（V1.1，P0 安全刚需）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-H1 | 设备数据接入 | 经设备抽象层接入智能手环/手表健康数据（心率/血压/步数/睡眠）；主流通用 BLE + 系统健康平台（Apple HealthKit / Google Health Connect / 华为 HMS Health Kit）被动读取 |
| FR-H2 | 异常监测 | 静息心率/血压异常阈值判定（如静息心率突升持续 N 分钟） |
| FR-H3 | 分级预警 | 三级：① 语音温和问询（无不适记录日志）② 确认不适 → 一级预警推送子女 ③ 30 秒无响应 → 高危推送 |
| FR-H4 | 健康档案 | 长辈健康数据台账，会员可查看完整报告 |

> ⚠️ 定位边界：本产品为**健康数据展示与提醒**（wellness），**不做医疗诊断**；血压/心率数值仅供参考，不构成医疗建议（见 §7.3）。

### 4.9 跌倒急救（V1.1，P0 保命刚需）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-E1 | 跌倒检测 | 依赖设备内置跌倒检测（手环/手表硬件检测 + 上报）；APP 侧语音二次确认 |
| FR-E2 | 极速响应 | 触发后立即大音量语音呼叫确认；30 秒无人应答判定失能 |
| FR-E3 | 自动联络 | 自动拨打预设紧急联系人电话（经系统电话深链，需用户确认平台能力边界）、推送定位/时间/状态至所有紧急联系人 |
| FR-E4 | 紧急联系人管理 | 长辈配置多位紧急联系人（会员可配置多组） |

> ⚠️ 技术约束：iOS 无法静默自动拨号，拨打经 `tel://` 深链跳系统拨号页；「定位」依赖用户授权（expo-location），急救推送定位仅发送至已绑定紧急联系人，遵循最小必要原则。

### 4.10 用药提醒（V1.1，P1）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-D1 | 定时用药提醒 | 长辈配置用药计划（药名/剂量/时间），定时语音播报提醒 |
| FR-D2 | 服药确认 | 长辈点击确认服药，数据同步健康档案与守护人 |
| FR-D3 | 漏服预警 | 连续未确认 → 推送守护人；会员享多级提醒 |

### 4.11 子女安心简报（V1.2，P1）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-B1 | 每日简报 | 每晚固定时段向守护人推送长辈当日状态汇总（天气、情绪、步数、健康体征、用药、生活碎碎念） |
| FR-B2 | 简报生成 | 整合 AI 对话情绪、运动、健康、用药数据生成暖心简报 |
| FR-B3 | 简报查看 | 守护人端简报列表与历史 |

### 4.12 国际化与出海（V1.2，P1）

| 编号 | 功能 | 说明 |
|------|------|------|
| FR-I1 | 多语言 | V1.0 简中 + 繁中；V1.2 新增 English / 泰语 / 越南语 / 马来语（全站、后台、推送、协议、AI 文案全量多语言） |
| FR-I2 | 海外数据源 | 温度单位/日期格式/城市库/预警/健康文案切换海外数据源（OpenWeatherMap） |
| FR-I3 | 出海合规 | GDPR、东南亚隐私法规适配，多语言隐私/用户协议独立配置 |

---

## 5. 生态 SDK 集成方案（复用，避免重复造轮子）

### 5.1 IDStack（身份 / 支付 / 会员 / 埋点）

| 能力 | 复用方式 | 关键契约 |
|------|---------|---------|
| SSO 登录 | Web 端 OAuth code 流程（`app_id` ≠ `client_id`，换 token 用 `client_id=api_key`，响应字段取 `data` 下）；APP 端 WebView 承载同一 SSO 页，postMessage/深链回传 token | P0 |
| 角色判定 | `parseRoles()` / `hasRole()`；后端 JWKS 公钥（RS256）验签；**JWT 用户主键读 `payload.id`（无 `sub`），展示名读 `user_name`** | P0 |
| 支付 | 嵌入 `payment-create`（**必传 externalOrderId**；金额服务端下发、`locked:true`）；消费 `payment.verified` webhook（**RS256 签名 + 时间窗 + `eventId` 去重**；`externalOrderId` 反查意图表；幂等、快速 2xx） | P0 |
| 会员 | 套餐/等级目录托管 IDStack；权益映射本地维护（FR-M3） | P1 |
| 埋点 | `@isudaji/raodaor-sdk-web-analytics`（Web）+ APP 端按平台规范采集；上报来源加 `analytics_allowed_origins` 白名单 | P1 |

**支付充值时序（会员购买共用）**：

```
用户点开通会员 → 本平台 POST /api/v1/billing/checkout
  → 生成 externalOrderId（mem_ 前缀）落意图表（subjectType=user）
  → 前端嵌入 IDStack payment-create（externalOrderId + 金额锁定）
  → 用户付款 → 运营者核销 → IDStack POST /api/v1/auth/idstack-webhook（payment.verified）
  → 校验 RS256 签名 → externalOrderId 反查 → 幂等 → 落地会员权益
  → 用户刷新看到新权益
```

### 5.2 RaoDaor Message（天气预警 / 简报 / 系统通知推送）

| 能力 | 复用方式 | 关键契约 |
|------|---------|---------|
| 通知投递 | 后端调 `POST /api/v1/internal/notifications`，携带 `X-Raodaor-Message-Inbound-Key`（`rdae_` 前缀入站密钥） | P0 |
| 分类与级别 | `category=system`（预警/系统）或 `benefit`（权益）；`level=A`（服务，退订不影响） | P0 |
| 推送 | 客户端注册设备 `POST /api/v1/push/devices`（`platform: web\|ios\|android`，Expo/FCM/APNs token）；推送由 message 在通知投递时自动触发 | P0 |
| 深链 | `link: "rdm://yiban/guard/xxx"` 或 http(s) 落地页 | P1 |
| 多语言 | 推送文案随用户设备语言（`locale`）匹配语种，由 message 按用户语言适配 | P1 |

**极端天气预警推送链路**：

```
后端天气巡检（定时任务）发现长辈城市命中预警
  → 判级（红/橙强提醒，黄/蓝静默）
  → 查 CareRelationship 得到长辈 + 全部守护人 idstackUserId
  → 逐人 POST /internal/notifications（category=system, level=A, link=rdm://yiban/guard/{elderId}）
  → message 落消息中心 + 触发 APP 推送（按用户语言）
  → 前端收到消息中心未读角标 + 系统推送
```

### 5.3 RaoDaor File（用户头像 / 健康记录截图 / 反馈图片）

采用**模式 B（应用租户 / OSS 式）**：文件归本产品所有，由后端代理上传。

| 环节 | 方案 |
|------|------|
| 开通 | 平台管理员在 RaoDaor File 后台创建 **APPLICATION 应用租户**（绑定本产品 IDStack app_id）并签发 ApiKey（`rdfl_` 前缀），仅存本平台后端 |
| 上传 | 头像、健康记录截图、反馈图片由**后端代理三步分片上传**：`POST /uploads`（uploadKey/hash SHA-256/size/name/mimeType）→ `POST /uploads/:id/chunks/:index`（字段名 `chunk`）→ `POST /uploads/:id/complete`；鉴权 `X-API-Key` |
| 入库 | 保存 `fileId + blobPath`（相对路径）；运行时以 `RAODAOR_FILE_BASE_URL + blobPath` 拼绝对地址 |
| 下发 | 对外一律 `signUrl` 签名短链（过期 + 签名）；不裸发 `/blobs/*` |
| 审核 | 新文件默认 `REVIEWING` → `ACTIVE` 后可访问；订阅 `file.reviewed` Webhook；UI 渲染「审核中」占位 |

### 5.4 RaoDaor Docs（健康数据 / 会员 / 预警记录导入导出）

| 场景 | 方案 |
|------|------|
| 数据导出 | 运营后台报表「导出到在线表格」：服务端经 Open API（`X-API-Key: rdorg_xxx` + `Idempotency-Key` 幂等）把数据推成在线文档，生成分享链接；也可直接下载 CSV/Excel |
| 批量导入 | 城市库/配置批量导入：上传 Excel → 在线表格清洗 → 读回校验 → 入库 → 清理暂存 |

> 架构原则（沿用生态）：本平台业务库 = System of Record；在线表格 = Interaction Layer，不持有权威数据。

### 5.5 DataCanvas（数据大屏）

运营后台「预警事件 / 用户增长 / 会员营收」大屏**由 raodaor-DataCanvas 只读嵌入承载**（不自建大屏）。推荐 PostgreSQL 只读账号直连聚合表（或 API 数据源 + `X-API-Key`）；嵌入令牌按 DataCanvas `embed-isolation-design.md` 契约签发（RS256 短时令牌，时长 ≤600s）。

### 5.6 CodeRouter（AI）

AI 暖光陪伴（V1.1）对接 CodeRouter（OpenAI 兼容 API）：情感对话、情绪安抚、生活建议、健康解读、戏曲文娱推荐；支持多语言文案生成。密钥仅存后端；V1.1 启动前确认 CodeRouter 端点与降级策略。

### 5.7 生态对接配置清单（上线前必配）

| 配置项 | 位置 | 值 |
|--------|------|-----|
| IDStack 应用登记 | IDStack 后台 | `redirect_uris = https://yiban.raodaor.com/auth/callback`（字节级一致） |
| IDStack CORS | IDStack 后端 `CORS_ALLOW_ORIGINS` | `https://yiban.raodaor.com` |
| IDStack 嵌入白名单 | IDStack 前端 `EXPO_PUBLIC_EMBED_ALLOWED_ORIGINS` | `https://yiban.raodaor.com` |
| IDStack webhook | IDStack 后台 | `POST https://yiban.raodaor.com/api/v1/auth/idstack-webhook` |
| 埋点来源白名单 | IDStack 应用管理 `analytics_allowed_origins` | `yiban.raodaor.com` |
| RaoDaor Message | 开放平台 | 入驻审批 → 签发入站通知密钥（`rdae_`）；`CORS_ALLOW_ORIGINS` 加 `https://yiban.raodaor.com` |
| RaoDaor File | 后台 | 开通应用租户 + ApiKey；`CORS_ALLOW_ORIGINS` 加 `https://yiban.raodaor.com` |
| RaoDaor Docs | 后端/前端 | `CORS_ALLOW_ORIGINS` 与 `VITE_AUTH_ALLOWED_ORIGINS` 加 `https://yiban.raodaor.com` |
| 天气数据源 | QWeather | 注册开发者账号，获取 API Host / API Key（仅存后端） |
| CodeRouter | CodeRouter 后台 | 获取 API 密钥（仅存后端，V1.1 启用） |

> 密钥类（`*_SECRET_KEY` / `*_API_KEY` / `*_INBOUND_KEY` / `*_ORG_KEY` / QWeather Key）仅存后端与密钥管理，绝不进前端代码与构建产物。

---

## 6. 技术架构

### 6.1 Monorepo 结构（Turbo + pnpm）

```
raodaor-yiban/
├── frontend/                      # 前端：Expo 57 跨平台（iOS / Android / Web）
│   ├── app/                       # Expo Router 文件路由
│   │   ├── (tabs)/                # APP Tab：home（天气）/ care（守护）/ me（我的）
│   │   ├── (portal)/              # Web 门户、/membership、/login
│   │   ├── console/               # 运营后台（仅 Web：admin）
│   │   ├── guard/[elderId].tsx    # 长辈详情（子女端）
│   │   ├── care/invite.tsx        # 亲情绑定
│   │   └── _layout.tsx
│   ├── src/
│   │   ├── components/            # 业务与品牌基础组件（优先复用 RN/Expo 官方组件）
│   │   ├── components/weather/    # 天气组件：大字天气卡 / 逐小时曲线 / 预警横幅
│   │   ├── components/care/       # 守护组件：绑定卡 / 长辈卡 / 简报卡
│   │   ├── design/tokens.ts       # 设计令牌（大字体系/色板/间距/护眼与暗色模式）
│   │   ├── stores/                # Zustand：authStore / weatherStore / careStore ...
│   │   ├── api/                   # 请求层（平台适配：APP SecureStore / Web 存储）
│   │   ├── i18n/                  # zh-CN / zh-TW（V1.2 增 en/th/vi/ms），按模块拆分
│   │   ├── speech/                # expo-speech 语音播报封装
│   │   └── utils/
│   ├── public/                    # Web 静态资源
│   ├── .env.development
│   ├── .env.production
│   ├── app.json / app.config.ts   # Expo 配置（bundle id、权限、深链 scheme、小组件插件）
│   └── package.json
├── backend/                       # 后端（NestJS，端口 9015）
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/              # IDStack SSO 对接、/auth/me、webhook 入口
│   │   │   ├── weather/           # 天气服务（WeatherProvider 抽象 + 缓存 + 归一化）
│   │   │   ├── alerts/            # 极端天气预警（订阅、巡检、去重推送）
│   │   │   ├── cities/            # 城市收藏与管理
│   │   │   ├── care/              # 亲情守护（绑定关系、守护视图）
│   │   │   ├── membership/        # 会员权益映射
│   │   │   ├── billing/           # 会员购买意图表 + webhook
│   │   │   ├── account/           # 账号（locale/注销/隐私政策）
│   │   │   └── (V1.1) companion/  # AI 陪伴（CodeRouter）
│   │   │   └── (V1.1) health/     # 健康监护 / 跌倒急救 / 用药提醒
│   │   ├── common/                # guards / filters / interceptors / config
│   │   └── prisma/                # schema.prisma + migrations
│   ├── .env.development
│   ├── .env.production
│   └── package.json
├── docs/                          # 文档（SDK 文档、PRD）
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 6.2 前端技术方案（Expo 57 跨平台，优先复用官方组件）

| 项 | 方案 |
|----|------|
| 框架与版本 | `expo ~57.0.23` · `react 19.2.3` · `react-dom 19.2.3` · `react-native 0.86.3` · `react-native-web ^0.21.0`；iOS / Android / Web 三端（`expo-*` 各包版本与 SDK 57 对齐，用 `npx expo install --fix` 校验） |
| 路由 | Expo Router（文件路由、typed routes）；单一共享代码三端运行；「运营后台仅 Web」经 `Platform` 守卫 + 导航条件渲染 |
| 构建产物 | Web：`npx expo export --platform web` → 静态 `dist/`（Metro）；APP：EAS Build 出 IPA / AAB |
| UI 方案 | 优先复用 RN 核心组件与 Expo 官方模块（View/Text/Pressable/FlatList/Modal + expo-image/expo-location/expo-secure-store 等），不引入重型第三方 UI 库；自建范围仅限设计令牌（大字体系/色板/间距/护眼暗色）+ 少量品牌基础组件 |
| 状态管理 | Zustand（authStore 持久化经平台适配层） |
| 凭证存储 | APP：`expo-secure-store`；Web：内存 + httpOnly 优先、localStorage 兜底；token 绝不进 URL |
| 语音 | `expo-speech`（跟随系统语言 TTS；简中/繁中/海外语种由系统 TTS 引擎支持） |
| 定位 | `expo-location`（最小必要，仅用于默认城市定位，可拒绝后手动选城市） |
| 桌面小组件 | Android AppWidget / iOS WidgetKit 原生扩展，经 Expo config plugin 接入 |
| 国际化 | 双语 zh-CN / zh-TW（V1.2 增 en/th/vi/ms）；`expo-localization` 检测系统语言 + 手动切换（设置页持久化）；日期/温度单位本地化；**全站无硬编码文字** |
| 深链与分享 | `expo-linking`（scheme `raodaoryiban://` + Universal Links / App Links 对齐 `https://yiban.raodaor.com`） |
| 推送 | 设备注册到 raodaor-message（`POST /push/devices`）；站内消息中心嵌入 `<rdm-notification-center>` 或自渲染 |
| OTA | `expo-updates` 仅紧急缺陷修复（遵守商店政策与备案要求） |
| 环境文件 | `.env.development` / `.env.production`（`EXPO_PUBLIC_` 前缀，构建期注入） |

> ⚠️ **静态导出 ≠ 浏览器环境**：`web.output = "static"` 下 `expo export` 在 Node.js 预渲染，`Platform.OS === 'web'` 为 true 但 `window`/`localStorage` 不存在。任何模块顶层不得访问浏览器全局；持久化读取放 `useEffect` 内或做 `typeof window === 'undefined'` 守卫。

### 6.3 后端技术方案

| 项 | 方案 |
|----|------|
| 框架 | NestJS 11（模块化，统一前缀 `/api/v1`） |
| ORM | Prisma ^6.19.3 + PostgreSQL 14（**不用 SQLite**，对齐生态标准，规避生产级并发/事务/迁移短板） |
| 端口 | 9015（与生态不冲突：IDStack 9005、File 9001、Docs 9010、ad 9011、message 9012、POS 9013、QA 9014） |
| 天气巡检 | 进程内定时任务（`@nestjs/schedule`）+ 数据库乐观锁（沿用生态无 Redis 方案，兼容目标部署环境）；预警命中触发推送 |
| 天气缓存 | 服务端内存/短期 TTL 缓存（实时 10min、逐小时 30min、逐天 2h、预警 5min），应对 provider 限流与降级 |
| 鉴权 | ① 用户态：本平台 JWT（SSO 换发，15 分钟 + refresh）② 公开态：天气读取免登录（`@Public` + 全局限流）③ Webhook：IDStack RS256 验签 ④ 服务端：message 入站密钥 / file·docs X-API-Key |
| 错误码 | 沿用生态 `{ code, data, message }` 结构与分段错误码（附录 B） |

### 6.4 天气数据源与 Provider 抽象（生产方案，非临时）

| 项 | 方案 |
|----|------|
| 国内主数据源 | **和风天气（QWeather）**：实时天气、逐小时预报（24h）、逐天预报（15 天）、气象灾害预警、空气质量、生活指数；注册开发者账号获取 API Host / API Key（仅存后端） |
| 出海数据源（V1.2） | **OpenWeatherMap**：One Call API、Geocoding API、National Weather Alerts |
| 抽象层 | `WeatherProvider` 接口（`getNow` / `getHourly` / `getDaily` / `getAlerts` / `getAirQuality` / `searchCity`），按 `region`/`locale` 路由到具体 provider；响应统一归一化为内部 `WeatherModel`（统一温度单位、预警级别、时间格式、i18n 文案键） |
| 降级 | 主 provider 失败降级备用 provider；缓存兜底返回最近可用数据；不因数据源故障阻塞核心链路 |

> 具体端点、字段、签名以 QWeather / OpenWeatherMap **官方文档为准**，本 PRD 不臆造接口；接入时以「适配器 + 归一化模型」隔离供应商差异。

### 6.5 数据模型（核心表，Prisma 命名 camelCase）

| 表 | 关键字段 |
|----|---------|
| User | id, idstackUserId(unique), displayName, avatarFileId?, locale, status, deletedAt（注销软删） |
| Device | id, deviceId(unique), platform(ios/android/web), userId?（推送令牌由 raodaor-message 承接，不入本库） |
| CareRelationship | id, elderUserId, guardianUserId, status(pending/active/rejected), invitedAt, acceptedAt（双向绑定，含唯一约束防重复） |
| ElderProfile | id, userId(unique), birthYear?, cityId?, cityName?, note?（长辈轻量档案） |
| FavoriteCity | id, userId, cityId, name, adminDiv, lat, lng, isDefault, sortOrder |
| AlertSubscription | id, userId, cityId?, minLevel?, quietStart?, quietEnd?, enabled |
| WeatherAlertRecord | id, alertId, cityId, type, level, title, content, source, startedAt, endedAt, pushedAt?（去重与推送追踪） |
| CheckoutSession（意图表） | externalOrderId(unique), subjectType, subjectId, targetPlan?, amount, currency, status(pending/verified/failed) |
| MembershipBenefit | tierCode, cityLimit, careLimit, timedBroadcast, advancedWidget, dailyBrief, healthReport, emergencyContactLimit, aiCompanionQuota |
| AuditLog | 操作审计（亲情绑定/解绑、会员变更、预警推送） |

> 金额一律字符串存储；token/secret 一律不入库明文；亲情关系与预警推送按合规要求留存日志。天气数据本身**不落业务库**（实时从 provider 拉取 + TTL 缓存），业务库仅存用户偏好、亲情关系与预警追踪记录。

### 6.6 核心链路：极端天气预警时序

```
长辈城市命中气象预警
  │ 后端定时巡检（QWeather 预警接口，TTL 5min）
  ▼
判级 + 去重（WeatherAlertRecord 按 alertId+cityId）
  │
  ├─ 长辈端：首页预警横幅 + 语音播报（红/橙强提醒）
  ├─ 站内消息：POST message /internal/notifications（长辈 + 全部守护人）
  └─ APP 推送：message 自动触发（按用户语言）
```

### 6.7 API 规范（摘要）

| 分组 | 端点 | 鉴权 |
|------|------|------|
| 天气 | `GET /api/v1/weather/now` · `/weather/hourly` · `/weather/daily` · `/weather/alerts` · `/weather/air-quality` · `/weather/search-city` | 公开（游客可浏览 + 全局限流） |
| 城市 | `GET/POST/DELETE /api/v1/cities` · `PATCH /api/v1/cities/:id/default` | JWT |
| 预警订阅 | `GET/PUT /api/v1/alerts/subscription` | JWT |
| 亲情守护 | `GET /api/v1/care/relationships` · `POST /api/v1/care/invite` · `POST /api/v1/care/accept` · `DELETE /api/v1/care/:id` · `GET /api/v1/care/elders` · `GET /api/v1/care/elders/:id/weather` | JWT |
| 会员 | `GET /api/v1/membership/plans` · `GET /api/v1/membership/me` · `POST /api/v1/membership/purchase` | JWT |
| 财务 | `POST /api/v1/billing/checkout` · `GET /api/v1/billing/orders` · `POST /api/v1/auth/idstack-webhook` | JWT / RS256 |
| 账号合规 | `GET /api/v1/privacy/policy` · `PUT /api/v1/account/locale` · `DELETE /api/v1/account/deactivate` | JWT |
| 运营后台 | `/api/v1/admin/*`（用户/亲情/会员/预警看板） | JWT + AdminGuard |
| 健康体检 | `GET /api/v1/health` | Public |

### 6.8 环境配置（前后端均分开发/生产）

**frontend/.env.development**

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:9015
EXPO_PUBLIC_IDSTACK_BASE_URL=https://idstack.raodaor.com
EXPO_PUBLIC_IDSTACK_APP_ID=<应用 UUID>
EXPO_PUBLIC_MESSAGE_BASE_URL=https://message.raodaor.com
EXPO_PUBLIC_DEFAULT_LOCALE=zh-CN
```

**frontend/.env.production**

```bash
EXPO_PUBLIC_API_BASE_URL=https://yiban.raodaor.com/api
EXPO_PUBLIC_IDSTACK_BASE_URL=https://idstack.raodaor.com
EXPO_PUBLIC_IDSTACK_APP_ID=<应用 UUID>
EXPO_PUBLIC_MESSAGE_BASE_URL=https://message.raodaor.com
EXPO_PUBLIC_DEFAULT_LOCALE=zh-CN
```

**backend/.env.development**

```bash
PORT=9015
DATABASE_URL=postgresql://user:pass@localhost:5432/raodaor_yiban?schema=public
JWT_ACCESS_SECRET=<本平台 JWT 密钥>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ALLOW_ORIGINS=http://localhost:5115

# IDStack（仅服务端）
IDSTACK_BASE_URL=https://idstack.raodaor.com
IDSTACK_APP_ID=<UUID>
IDSTACK_APP_API_KEY=<client_id>
IDSTACK_APP_SECRET_KEY=<client_secret>
# JWT 验签（RS256）：后端拉 JWKS 公钥，无需共享密钥；可选 IDSTACK_JWKS_URI / IDSTACK_ISSUER

# RaoDaor Message（预警/简报推送）
RAODAOR_MESSAGE_BASE_URL=http://localhost:9012
RAODAOR_MESSAGE_INBOUND_KEY=rdae_xxx

# RaoDaor File（模式 B 应用租户）
RAODAOR_FILE_BASE_URL=http://localhost:9001
RAODAOR_FILE_API_KEY=rdfl_xxx

# RaoDaor Docs（导入导出 Open API）
RAODAOR_DOCS_BASE_URL=http://localhost:9010
RAODAOR_DOCS_ORG_KEY=rdorg_xxx

# 天气数据源（QWeather）
QWEATHER_API_HOST=https://api.qweather.com
QWEATHER_API_KEY=<开发 key>
WEATHER_CACHE_TTL_NOW=600
WEATHER_CACHE_TTL_HOURLY=1800
WEATHER_CACHE_TTL_DAILY=7200
WEATHER_CACHE_TTL_ALERTS=300
```

**backend/.env.production**

```bash
PORT=9015
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/raodaor_yiban?schema=public
JWT_ACCESS_SECRET=<生产强密钥>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ALLOW_ORIGINS=https://yiban.raodaor.com

IDSTACK_BASE_URL=https://idstack.raodaor.com
IDSTACK_APP_ID=<UUID>
IDSTACK_APP_API_KEY=<生产值>
IDSTACK_APP_SECRET_KEY=<生产值>

RAODAOR_MESSAGE_BASE_URL=https://message.raodaor.com
RAODAOR_MESSAGE_INBOUND_KEY=rdae_<生产值>

RAODAOR_FILE_BASE_URL=https://file.raodaor.com
RAODAOR_FILE_API_KEY=rdfl_<生产值>

RAODAOR_DOCS_BASE_URL=https://docs.raodaor.com
RAODAOR_DOCS_ORG_KEY=rdorg_<生产值>

QWEATHER_API_HOST=https://api.qweather.com
QWEATHER_API_KEY=<生产值>
```

> 令牌时效与前端续期契约与 raodaor-ad 一致：`JWT_ACCESS_TTL=15m`、`JWT_REFRESH_TTL=7d`（旋转签发）；`lib/api.ts` 的 `authedRequest` 统一承担 2001/2002 与 401 的静默续期重放，业务代码不自行跳登录。

---

## 7. 安全与合规（P0 除非注明）

### 7.1 适老化（工信部《互联网应用适老化及无障碍改造专项行动》）

| 编号 | 要求 | 落地 |
|------|------|------|
| FR-G1 | 零广告零弹窗 | 全应用无广告、无营销弹窗、无诱导点击、无强制分享 |
| FR-G2 | 大字与高对比 | 全局字号可调（≥三档）、高对比/护眼配色、图标与触控目标足够大（按钮 ≥ 48×48dp） |
| FR-G3 | 操作最简 | 关键功能 ≤ 3 步到达；首屏一键语音播报；语音交互优先 |
| FR-G4 | 无诱导下载/分享 | 不强制分享、不诱导下载第三方应用 |
| FR-G5 | 长辈模式默认 | 新用户默认大字模式、口语化文案、免登录核心功能可用（天气可游客浏览，绑定/会员需登录） |

### 7.2 隐私与数据合规（PIPL / 工信部规定，出海对接 GDPR）

| 编号 | 要求 | 落地 |
|------|------|------|
| FR-G6 | 隐私政策 | 首启弹窗：隐私政策 + 用户协议（双语）；不同意仅可浏览门户，不可使用绑定/会员；政策版本化与再同意 |
| FR-G7 | 最小必要 | 仅采集定位（可选，可拒绝后手动选城市）、设备标识（推送/风控）；采集项在政策中枚举 |
| FR-G8 | SDK 披露 | 第三方 SDK 清单（IDStack / RaoDaor Message / File / Docs / QWeather / CodeRouter）及用途在政策中披露 |
| FR-G9 | 账号注销 | 设置页注销入口：清理个人数据（匿名化亲情关系、档案）、流程 ≤15 个工作日 |
| FR-G10 | 数据安全 | 全链路 HTTPS（TLS ≥1.2）；APP 端 token 存 SecureStore；日志脱敏；健康/定位数据仅在绑定关系内共享 |
| FR-G11 | 出海合规 | V1.2 海外数据源切换、GDPR/东南亚法规适配、多语言协议独立配置 |

### 7.3 健康数据与医疗器械边界（重要）

| 编号 | 要求 | 落地 |
|------|------|------|
| FR-G12 | 非医疗定位 | 本产品为「健康数据展示与提醒」，**不做医疗诊断、不提供医疗建议**；界面显著声明「仅供参考」 |
| FR-G13 | 数据授权 | 健康数据接入（V1.1）需长辈明确授权；数据仅在绑定守护人范围内共享 |
| FR-G14 | 医疗设备合规评估 | 若未来涉及「诊断/治疗建议」类功能，须评估《医疗器械监督管理条例》备案/注册义务；当前定位规避 |

### 7.4 AI 陪伴内容安全（V1.1）

| 编号 | 要求 | 落地 |
|------|------|------|
| FR-G15 | 危机干预 | 自伤/自杀等高风险内容触发危机干预引导话术（提供求助热线/紧急联系人引导） |
| FR-G16 | 对话留存 | 对话内容脱敏留存、可删除；不用于训练 |

### 7.5 APP 上架与运营合规

| 编号 | 要求 | 落地 |
|------|------|------|
| FR-G17 | 备案 | 网站 ICP 备案 + APP 备案（工信部）；应用商店上架材料（软著、隐私政策链接、权限用途说明） |
| FR-G18 | 权限声明 | app.json 权限最小化（网络/定位/推送；不用相机/通讯录/麦克风除非 AI 语音输入）；用途在商店与政策中说明 |
| FR-G19 | 支付合规 | 收款经 IDStack 托管（见 §5.1），本平台不接触资金通道 |
| FR-G20 | 紧急呼叫边界 | 自动拨号受系统限制（iOS 无法静默拨号），经 `tel://` 深链跳系统拨号页；定位推送仅至已授权紧急联系人 |

### 7.6 应用安全

| 项 | 方案 |
|----|------|
| 传输 | 全站 HTTPS；APP 启用 ATS / 网络安全配置；禁止明文日志输出 token |
| API 防护 | 全局限流（IP/用户）；关键写操作幂等键；参数校验（class-validator）；SQL 注入防护（Prisma 参数化） |
| 越权防护 | 资源级权限校验（亲情关系/城市/订阅仅本人可操作；守护视图仅绑定关系内可见）；管理端能力布尔驱动 |
| 防重放 | 支付事件 eventId 去重；webhook 幂等 |
| 依赖安全 | 锁定依赖版本（pnpm-lock）；上线前漏洞扫描 |

---

## 8. 部署方案（IIS8 + PM2 + Windows Server 2012 R2 + EAS）

### 8.1 拓扑

```
用户浏览器 / 长辈与子女 APP
        │ https://yiban.raodaor.com
        ▼
IIS 8（Windows Server 2012 R2，绑定 SSL 证书）
  ├─ 站点：frontend Web 导出产物（expo export --platform web → dist/）
  │    └─ URL Rewrite：SPA 回退（未知路径 → /index.html）
  └─ ARR 反向代理：/api/* → http://127.0.0.1:9015
PM2（以 Windows 服务运行，开机自启）
  └─ backend（NestJS，监听 127.0.0.1:9015）
PostgreSQL 14（本机实例，仅监听 127.0.0.1）

iOS / Android APP
  └─ EAS Build（云端构建 IPA/AAB）→ App Store / 主流安卓商店
      APP 直连 https://yiban.raodaor.com/api（同域 ARR → 9015）
```

### 8.2 部署要点

| 项 | 说明 |
|----|------|
| Web 端发布 | 构建在开发机/CI 完成（`npx expo export --platform web`），上传 `dist` 到 IIS；URL Rewrite 配 SPA 回退 |
| APP 构建 | EAS Build 云构建（规避 Windows 无法本地构建 iOS）；Android 出 AAB、iOS 出 IPA |
| 后端运行 | PM2 守护：`pm2 start dist/main.js --name raodaor-yiban-backend`；`pm2 save` + `pm2-startup` 注册服务 |
| 反向代理 | IIS 安装 ARR，规则 `/api/*` → `127.0.0.1:9015`，保留 Host 与 `X-Forwarded-For` |
| HTTPS | IIS 绑定 `yiban.raodaor.com` 证书（TLS ≥1.2）；HTTP 301 跳 HTTPS |
| 数据库 | PostgreSQL 14 单实例；Prisma 迁移**手动执行**（`npx prisma migrate deploy`），drift/reset 提示立即停止确认；每日全量备份 + WAL 归档（保留 ≥7 天） |
| NPM 安装 | 依赖包**手动安装**（开发机 `pnpm install`）；服务器只部署构建产物与生产依赖 |
| 防火墙 | 仅开放 80/443；9015 与 5432 仅本机访问 |
| Webhook 公网 | `payment.verified` 等回调地址必须是 IDStack 可访问的公网 HTTPS 地址（经 IIS ARR 反代） |

### 8.3 环境差异

| 项 | 开发 | 生产 |
|----|------|------|
| 配置 | `.env.development`（前后端各自） | `.env.production`（前后端各自） |
| Web/APP API | `http://192.168.x.x:9015`（局域网真机调试） | `https://yiban.raodaor.com/api`（ARR 反代） |
| 数据库 | 本地 PG，可 reset | 生产 PG，迁移前必须备份 |

---

## 9. 里程碑规划

> 按依赖排序，每阶段完成后确认再进入下一阶段。不含时间估计。

| 阶段 | 范围 | 交付物 |
|------|------|--------|
| M1 基础框架 | Expo 57 monorepo（三端跑通）、Expo Router 骨架、设计令牌（大字体系）、IDStack SSO + 角色、i18n 双语、`.env.*`、Web IIS 部署流水 + EAS 构建链路 | 可登录的三端空壳 + 部署手册 |
| M2 天气核心 | WeatherProvider 抽象 + QWeather 接入；大字天气首页（实时/逐小时/15 天/AQI）；多城市收藏；语音播报；极端天气预警展示与订阅；适老小组件 | 可用的纯净适老天气 APP |
| M3 亲情气象守护 | 亲情绑定（邀请码/二维码）；守护中心；长辈详情；极端天气预警经 raodaor-message 推送给长辈 + 守护人 | 「天气守护」核心差异化闭环 |
| M4 会员与商业化 | IDStack payment-create + webhook；会员权益映射；定时播报/不限城市/高级小组件 | 会员订阅可运转 |
| M5 合规与上架 | 适老化合规、隐私政策/注销、备案材料、商店提审 | 可上架运营 |
| M6（V1.1）AI 暖光陪伴 | CodeRouter 接入、长期记忆对话、情绪安抚、内容安全 | 有温度的 AI 陪伴 |
| M7（V1.1）健康守护 | 手环健康监护 + 分级预警；跌倒急救 + 自动联络；用药提醒 | 保命级守护能力 |
| M8（V1.2）暖心与出海 | 每日子女安心简报；AI 主动关怀；多语言（en/th/vi/ms）；海外数据源 + GDPR | 暖心提质 + 出海就绪 |

---

## 10. 验收标准（核心场景）

| # | 场景 | 通过标准 |
|---|------|--------|
| 1 | 三端运行 | 同一 Expo 代码在 iOS/Android/Web 跑通天气首页与守护中心 |
| 2 | SSO 登录 | IDStack 登录后正常使用；游客可浏览天气、绑定/会员需登录 |
| 3 | 天气体验 | 实时/逐小时/15 天/AQI 数据真实（QWeather 数据源），大字清晰、口语化文案；缓存与降级生效 |
| 4 | 语音播报 | 一键播报当前天气与预警，跟随系统语言（简中/繁中） |
| 5 | 极端天气预警 | 命中预警后首页横幅 + 语音 + 推送；同预警不重复推送；长辈与守护人均触达 |
| 6 | 亲情守护 | 绑定流程可走通；守护中心正确展示长辈城市天气与预警；解绑后视图收回 |
| 7 | 会员 | 核销后权益生效；未核销权益**不变**；重复 webhook 不重复入账 |
| 8 | 国际化 | 双语切换全站无遗漏；日期/温度本地化正确 |
| 9 | 合规 | 隐私弹窗/注销可用；无广告无弹窗；适老大字与高对比生效 |
| 10 | 部署 | Web 按 §8 手册部署到 Windows Server 2012 R2 + IIS8 + PM2（SPA 刷新不 404，`/api` 反代可用）；APP 经 EAS 构建出包 |

---

## 11. 风险与依赖

| # | 风险 / 依赖 | 影响 | 缓解 |
|---|------------|------|------|
| 1 | Windows Server 2012 R2 最高 LTS Node 为 16.x，Expo/React 19 构建需高版本 Node | 服务器无法构建前端 | 构建全部在开发机/CI + EAS 云端完成，服务器只部署静态产物与后端 |
| 2 | APP 上架审核（适老/健康/急救类审查） | 拒审/下架风险 | 提前准备备案/软著/资质；健康功能明确「非医疗」边界；紧急呼叫走系统深链 |
| 3 | 天气数据源成本与限流 | QWeather 免费额度有限，流量大成本上升 | 服务端 TTL 缓存降低调用频率；按套餐/分级配额；数据源可切换 |
| 4 | 极端天气预警时效 | 推送延迟影响守护价值 | 预警巡检短周期（5min）；高级别预警优先；message 推送多级重试 |
| 5 | 健康/急救硬件依赖（V1.1） | 手环/手表型号碎片化、跌倒检测精度 | 设备抽象层 + 系统健康平台（HealthKit/Health Connect/HMS）兜底；明确非医疗定位 |
| 6 | AI 陪伴内容安全（V1.1） | 心理健康高危内容风险 | 危机干预话术 + 内容审核 + 脱敏留存 |
| 7 | 生态白名单漏配（IDStack/Message/File/Docs） | 登录回跳失败、推送不达、支付停 PENDING | 上线前按 §5.7 清单逐项自检 |
| 8 | 支付核销时效 | 付款后需运营核销才生效 | 前端明确「等待核销」状态；管理端手动核销补单（幂等） |
| 9 | 出海合规差异 | 多国隐私法规差异 | V1.2 分地区合规适配、多语言协议独立配置 |

---

## 附录 A：页面 × 权限矩阵

| 页面/区域 | 游客 | 长辈 | 守护人 | 平台运营 |
|------|:--:|:--:|:--:|:--:|
| 天气首页（游客可浏览） | ✓ | ✓ | ✓ | ✓ |
| /care 守护中心 | 引导登录 | ✓（家人视图） | ✓（守护视图） | ✓ |
| /membership | 引导登录 | ✓ | ✓ | ✓ |
| /cities 城市管理 | — | ✓ | ✓ | ✓ |
| /guard/[elderId] 长辈详情 | — | — | ✓（绑定关系内） | ✓ |
| /settings | — | ✓ | ✓ | ✓ |
| /console/admin | — | — | — | ✓ |

## 附录 B：错误码分段（沿用生态结构 `{ code, data, message }`）

| 分段 | 域 |
|------|-----|
| 1xxx | 通用参数/校验 |
| 2xxx | 认证与权限 |
| 3xxx | 天气/城市/数据源（3001 数据源不可用等） |
| 4xxx | 亲情守护（绑定关系/权限） |
| 5xxx | 会员/计费/订阅（5005 沿用生态「额度用尽」） |
| 6xxx | 限流（6003 沿用生态 per-key 限流） |
| 7xxx | 风控与安全 |
| 8xxx | 内容审核/AI 内容安全 |
| 9xxx | 生态依赖（IDStack/Message/File/Docs/CodeRouter 调用失败透传） |

## 附录 C：参考文档

| 文档 | 位置 |
|------|------|
| IDStack Web SDK（SSO/嵌入/支付/角色） | docs/sdk/idstack-web/（quickstart / features / embed-integration） |
| IDStack Analytics SDK（埋点/白名单） | docs/sdk/idstack-web/analytics.md |
| RaoDaor Message（消息中心/推送/服务号） | docs/sdk/raodaor-message/（overview / quickstart / developer-platform / platform-architecture） |
| RaoDaor File（文件存储/签名短链/Webhook） | docs/sdk/raodaor-file/（overview / sdk-integration / quickstart） |
| RaoDaor Docs（导入导出/Open API/计费） | docs/sdk/raodaor-docs/（overview / open-api-guide / organization-api-keys / billing） |
| 绕道儿广告（raodaor-ad）技术栈参考 | raodaor-ad/docs/PRD.md |
