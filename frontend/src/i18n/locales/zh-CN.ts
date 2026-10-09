/** 字典结构（双语 key 必须一致，编译期由 Dict 类型约束） */
export interface Dict {
  common: {
    appName: string;
    confirm: string;
    cancel: string;
    loading: string;
    retry: string;
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
}

const zhCN: Dict = {
  common: {
    appName: '绕道儿颐伴',
    confirm: '确定',
    cancel: '取消',
    loading: '加载中…',
    retry: '重试',
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
};

export default zhCN;
