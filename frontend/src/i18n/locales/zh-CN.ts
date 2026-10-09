/** 字典结构（双语 key 必须一致，编译期由 Dict 类型约束） */
export interface Dict {
  common: {
    appName: string;
    confirm: string;
    cancel: string;
    loading: string;
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
}

const zhCN: Dict = {
  common: {
    appName: '绕道儿颐伴',
    confirm: '确定',
    cancel: '取消',
    loading: '加载中…',
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
};

export default zhCN;
