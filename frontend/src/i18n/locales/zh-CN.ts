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
    empty: string;
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
    empty: '还没有绑定家人，登录后可添加守护',
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
  },
};

export default zhCN;
