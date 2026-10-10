/** 字典结构（双语 key 必须一致，编译期由 Dict 类型约束） */
export interface Dict {
  common: {
    appName: string;
    confirm: string;
    cancel: string;
    loading: string;
    retry: string;
    back: string;
    copy: string;
  };
  tabs: {
    home: string;
    care: string;
    me: string;
  };
  home: {
    title: string;
    subtitle: string;
    loginPrompt: string;
    loginButton: string;
    weatherComingSoon: string;
    loadFailed: string;
  };
  care: {
    title: string;
    /** 已登录但尚无守护家人时的空态文案 */
    empty: string;
    /** 未登录时的引导文案（提示先登录） */
    emptyUnauth: string;
    guardianSection: string;
    elderSection: string;
    addElder: string;
    bindGuardian: string;
    invite: string;
    generateCode: string;
    enterCode: string;
    codePlaceholder: string;
    accept: string;
    inviteHintGuardian: string;
    inviteHintElder: string;
    codeCopied: string;
    codeExpired: string;
    bindingSuccess: string;
    invalidCode: string;
    alreadyBound: string;
    noElders: string;
    noGuardians: string;
    unbind: string;
    unbindConfirm: string;
    noCity: string;
    alertBadge: string;
    qrTitle: string;
    qrHint: string;
  };
  guard: {
    title: string;
    noCity: string;
    loading: string;
    unbindConfirm: string;
    unbindDone: string;
  };
  me: {
    title: string;
    membership: string;
    settings: string;
    language: string;
    fontSize: string;
    logout: string;
    login: string;
    guest: string;
  };
  settings: {
    title: string;
    appearance: string;
    fontSize: string;
    fontSizeNormal: string;
    fontSizeLarge: string;
    fontSizeXLarge: string;
    eyeCare: string;
    eyeCareHint: string;
    language: string;
    privacy: string;
    deactivate: string;
    deactivateConfirmTitle: string;
    deactivateConfirmText: string;
    deactivating: string;
    saved: string;
  };
  privacy: {
    title: string;
    consentTitle: string;
    consentText: string;
    agree: string;
    disagree: string;
    disagreeHint: string;
    gateHint: string;
    body: string;
  };
  login: {
    title: string;
    subtitle: string;
    button: string;
    notConfigured: string;
    cancelled: string;
  };
  weather: {
    obtainingLocation: string;
    noCity: string;
    selectCity: string;
    changeCity: string;
    voice: string;
    feelsLike: string;
    humidity: string;
    wind: string;
    precip: string;
    pressure: string;
    visibility: string;
    hourly: string;
    daily: string;
    aqi: string;
    alert: string;
    uv: string;
    sunrise: string;
    sunset: string;
    today: string;
    lifeIndex: string;
  };
  cities: {
    title: string;
    searchPlaceholder: string;
    add: string;
    default: string;
    setDefault: string;
    remove: string;
    empty: string;
    current: string;
    searching: string;
    noResult: string;
  };
  membership: {
    title: string;
    statusFree: string;
    statusActive: string;
    statusExpired: string;
    current: string;
    plans: string;
    perks: string;
    cityLimit: string;
    careLimit: string;
    timedBroadcast: string;
    advancedWidget: string;
    dailyBrief: string;
    healthReport: string;
    emergencyContact: string;
    aiCompanion: string;
    unlimited: string;
    upgrade: string;
    upgrading: string;
    upgradeHint: string;
    openPayment: string;
    refreshHint: string;
    upgradeSuccess: string;
  };
  admin: {
    sectionTitle: string;
    sectionHint: string;
    userIdLabel: string;
    userIdPlaceholder: string;
    tierLabel: string;
    standard: string;
    premium: string;
    monthsLabel: string;
    monthsPlaceholder: string;
    codeLabel: string;
    codePlaceholder: string;
    noteLabel: string;
    notePlaceholder: string;
    submit: string;
    submitting: string;
    confirmTitle: string;
    confirmText: string;
    success: string;
    failed: string;
    checkButton: string;
    checking: string;
    notFound: string;
    statusPending: string;
    statusVerified: string;
    statusFailed: string;
    alreadyGranted: string;
    notVerified: string;
    eligible: string;
    ownerLabel: string;
    planLabel: string;
    entry: string;
    centerTitle: string;
    grantItem: string;
  };
  portal: {
    /** 产品名（按 locale 区分简繁） */
    productName: string;
    heroTagline: string;
    heroDesc: string;
    enterApp: string;
    downloadApp: string;
    featuresTitle: string;
    fWeatherTitle: string;
    fWeatherDesc: string;
    fGuardTitle: string;
    fGuardDesc: string;
    fIndexTitle: string;
    fIndexDesc: string;
    fMemberTitle: string;
    fMemberDesc: string;
    agingTitle: string;
    agingLarge: string;
    agingContrast: string;
    agingVoice: string;
    agingSimple: string;
    downloadTitle: string;
    downloadDesc: string;
    footerPrivacy: string;
    footerMember: string;
    footerCopy: string;
  };
}

const zhCN: Dict = {
  common: {
    appName: '绕道儿颐伴',
    confirm: '确定',
    cancel: '取消',
    loading: '加载中…',
    retry: '重试',
    back: '返回',
    copy: '复制',
  },
  tabs: {
    home: '天气',
    care: '守护',
    me: '我的',
  },
  home: {
    title: '绕道儿颐伴',
    subtitle: '大字纯净好帮手，温暖守护长辈日常',
    loginPrompt: '登录后可收藏城市、与家人互相守护',
    loginButton: '登录 / 注册',
    weatherComingSoon: '天气功能即将上线，敬请期待',
    loadFailed: '天气加载失败，请稍后重试',
  },
  care: {
    title: '亲情守护',
    empty: '还没有绑定家人，点击下方「亲情绑定」添加你的第一位家人',
    emptyUnauth: '还没有绑定家人，登录后可添加守护',
    guardianSection: '我守护的长辈',
    elderSection: '守护我的家人',
    addElder: '添加长辈',
    bindGuardian: '绑定守护人',
    invite: '亲情绑定',
    generateCode: '生成邀请码',
    enterCode: '输入邀请码',
    codePlaceholder: '请输入 8 位邀请码',
    accept: '确认绑定',
    inviteHintGuardian: '把邀请码发给父母，父母输入后即可互相守护',
    inviteHintElder: '输入子女分享给你的邀请码，完成亲情绑定',
    codeCopied: '邀请码已复制',
    codeExpired: '邀请码已过期，请重新生成',
    bindingSuccess: '绑定成功',
    invalidCode: '邀请码无效或已失效',
    alreadyBound: '已与该家人建立守护关系',
    noElders: '还没有守护的长辈',
    noGuardians: '还没有守护你的家人',
    unbind: '解除守护',
    unbindConfirm: '确定解除这段守护关系吗？',
    noCity: '长辈尚未设置城市',
    alertBadge: '预警',
    qrTitle: '扫码绑定',
    qrHint: '让家人用手机扫描二维码，自动进入绑定页并完成亲情守护',
  },
  guard: {
    title: '长辈天气守护',
    noCity: '长辈尚未设置守护城市',
    loading: '加载中…',
    unbindConfirm: '确定解除守护关系吗？',
    unbindDone: '已解除守护',
  },
  me: {
    title: '我的',
    membership: '会员中心',
    settings: '设置',
    language: '语言',
    fontSize: '字体大小',
    logout: '退出登录',
    login: '登录 / 注册',
    guest: '未登录',
  },
  settings: {
    title: '设置',
    appearance: '显示与适老',
    fontSize: '字体大小',
    fontSizeNormal: '标准',
    fontSizeLarge: '大',
    fontSizeXLarge: '超大',
    eyeCare: '护眼模式',
    eyeCareHint: '暖色护眼底色，降低蓝光与眩光，减轻视觉疲劳',
    language: '语言',
    privacy: '隐私政策',
    deactivate: '注销账号',
    deactivateConfirmTitle: '确认注销账号？',
    deactivateConfirmText: '注销后您的个人数据将被匿名化处理，亲情关系将解除，城市与预警订阅将被清除，此操作不可恢复。',
    deactivating: '注销中…',
    saved: '已保存',
  },
  privacy: {
    title: '隐私政策',
    consentTitle: '隐私政策与用户协议',
    consentText:
      '我们非常重视您的隐私。绕道儿颐伴仅收集为您提供天气守护与亲情绑定所必需的最小信息：您授权的定位（用于默认城市，可拒绝并手动选择）、设备标识（用于消息推送）。我们不会向第三方出售您的个人信息，所有传输均经加密保护。您可以随时在设置中查看隐私政策或注销账号。',
    agree: '同意并继续',
    disagree: '暂不同意',
    disagreeHint: '您仍可浏览天气，但绑定家人与会员需同意后使用',
    gateHint: '绑定家人与会员功能需先阅读并同意隐私政策',
    body:
      '一、我们收集的信息\n我们仅收集为您提供核心功能所必需的最小信息：您授权的定位信息（用于推荐默认城市，您可拒绝并手动选择）、设备标识（用于消息推送与风控）。我们不会收集与核心功能无关的敏感信息。\n\n二、信息的使用\n您的天气浏览无需登录即可使用；绑定家人、会员等需登录的功能将在您同意本政策后开放。您的健康与定位数据仅在您已建立的亲情关系范围内共享。\n\n三、信息的保护\n全站采用 HTTPS 加密传输，移动端令牌存储于系统安全区，日志经脱敏处理。我们不会向任何第三方出售您的个人信息。\n\n四、您的权利\n您可以随时在「设置」中查看本政策、修改语言与适老偏好，或注销账号。注销后我们将对您的个人数据进行匿名化处理。',
  },
  login: {
    title: '登录绕道儿颐伴',
    subtitle: '使用绕道儿统一账号登录',
    button: '使用 IDStack 登录',
    notConfigured: 'IDStack 未配置，请联系管理员',
    cancelled: '已取消登录',
  },
  weather: {
    obtainingLocation: '正在获取定位…',
    noCity: '未选择城市',
    selectCity: '选择城市',
    changeCity: '切换城市',
    voice: '🔊 语音播报',
    feelsLike: '体感',
    humidity: '湿度',
    wind: '风力',
    precip: '降水',
    pressure: '气压',
    visibility: '能见度',
    hourly: '逐小时预报',
    daily: '15 天预报',
    aqi: '空气质量',
    alert: '天气预警',
    uv: '紫外线',
    sunrise: '日出',
    sunset: '日落',
    today: '今天',
    lifeIndex: '生活指数',
  },
  cities: {
    title: '城市管理',
    searchPlaceholder: '搜索城市名',
    add: '添加',
    default: '默认',
    setDefault: '设为默认',
    remove: '删除',
    empty: '还没有收藏城市',
    current: '当前',
    searching: '搜索中…',
    noResult: '未找到相关城市',
  },
  membership: {
    title: '会员中心',
    statusFree: '免费用户',
    statusActive: '会员生效中',
    statusExpired: '会员已过期',
    current: '当前等级',
    plans: '选择会员套餐',
    perks: '尊享权益',
    cityLimit: '城市收藏上限',
    careLimit: '亲情守护上限',
    timedBroadcast: '每日定时播报',
    advancedWidget: '高级适老小组件',
    dailyBrief: '子女每日简报',
    healthReport: '完整健康报告',
    emergencyContact: '紧急联系人上限',
    aiCompanion: 'AI 暖心陪伴次数',
    unlimited: '不限',
    upgrade: '立即开通',
    upgrading: '正在跳转支付…',
    upgradeHint: '开通后将跳转绕道儿支付完成付款，核销后权益自动生效',
    openPayment: '打开支付页',
    refreshHint: '付款核销后在此刷新查看权益',
    upgradeSuccess: '会员已开通，感谢支持！',
  },
  admin: {
    sectionTitle: '运营补单',
    sectionHint: '为已核销但未自动同步会员的用户补发会员。核销码必须已核销、且不可重复补单。',
    userIdLabel: '用户 ID',
    userIdPlaceholder: '请输入本平台用户 ID',
    tierLabel: '会员等级',
    standard: '标准会员',
    premium: '尊享会员',
    monthsLabel: '时长（月）',
    monthsPlaceholder: '1 ~ 36，如 12',
    codeLabel: '核销码',
    codePlaceholder: '请输入已核销的核销码',
    noteLabel: '备注（选填）',
    notePlaceholder: '补单原因，将记入审计日志',
    submit: '确认补单',
    submitting: '补单中…',
    confirmTitle: '确认补单',
    confirmText: '补单后核销码不可重复使用，且会记入审计日志。确定继续？',
    success: '补单成功',
    failed: '补单失败',
    checkButton: '查询核销码状态',
    checking: '查询中…',
    notFound: '核销码不存在',
    statusPending: '未核销',
    statusVerified: '已核销',
    statusFailed: '已失败',
    alreadyGranted: '该核销码已补单，不可重复',
    notVerified: '核销码尚未核销，不可补单',
    eligible: '可补单',
    ownerLabel: '所属用户',
    planLabel: '套餐',
    entry: '平台运营中心',
    centerTitle: '平台运营中心',
    grantItem: '运营补单',
  },
  portal: {
    productName: '绕道儿·颐伴',
    heroTagline: '适老陪伴，贴心守护每一程',
    heroDesc: '为父母打造的适老陪伴应用：天气预警、亲情守护、生活指数，重要信息一目了然。',
    enterApp: '进入应用',
    downloadApp: '下载 App',
    featuresTitle: '核心功能',
    fWeatherTitle: '天气与预警',
    fWeatherDesc: '实时天气、逐小时与多日预报，极端天气主动预警，守护出行安全。',
    fGuardTitle: '亲情守护',
    fGuardDesc: '绑定家人，远程关注父母所在城市的天气与健康状况，关爱不掉线。',
    fIndexTitle: '生活指数',
    fIndexDesc: '穿衣、洗车、运动、紫外线、感冒等适老文案化建议，日常安排更安心。',
    fMemberTitle: '会员权益',
    fMemberDesc: '解锁不限城市、定时播报、健康周报与 AI 陪伴等贴心增值服务。',
    agingTitle: '适老化设计',
    agingLarge: '大字号，三档可调',
    agingContrast: '高对比配色，护眼舒适',
    agingVoice: '语音播报，解放双眼',
    agingSimple: '简洁操作，少即是多',
    downloadTitle: '下载应用',
    downloadDesc: '支持 iOS 与 Android，前往应用商店搜索「绕道儿·颐伴」即可免费下载。',
    footerPrivacy: '隐私政策',
    footerMember: '会员权益',
    footerCopy: '© 2026 绕道儿·颐伴 保留所有权利',
  },
};

export default zhCN;
