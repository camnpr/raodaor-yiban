/** 天气展示辅助：QWeather 图标码 → emoji、日期/时间格式化（无第三方依赖） */

const ICON_EMOJI: Record<string, string> = {
  '100': '☀️',
  '101': '🌤️',
  '102': '⛅',
  '103': '🌥️',
  '104': '☁️',
  '150': '🌙',
  '151': '🌙',
  '152': '🌙',
  '153': '🌙',
  '300': '🌦️',
  '301': '🌦️',
  '302': '⛈️',
  '303': '⛈️',
  '304': '🌨️',
  '305': '🌧️',
  '306': '🌧️',
  '307': '🌧️',
  '308': '🌧️',
  '309': '🌧️',
  '310': '🌧️',
  '311': '🌧️',
  '312': '🌧️',
  '313': '🌧️',
  '314': '🌧️',
  '315': '🌧️',
  '316': '🌧️',
  '317': '🌧️',
  '318': '🌧️',
  '350': '🌧️',
  '351': '🌧️',
  '400': '🌨️',
  '401': '🌨️',
  '402': '🌨️',
  '403': '🌨️',
  '404': '🌨️',
  '405': '🌨️',
  '406': '🌨️',
  '407': '🌨️',
  '408': '🌨️',
  '409': '🌨️',
  '410': '🌨️',
  '456': '🌨️',
  '457': '🌨️',
  '500': '🌫️',
  '501': '🌫️',
  '502': '🌫️',
  '503': '🌫️',
  '504': '🌫️',
  '507': '🌫️',
  '508': '🌫️',
  '509': '🌫️',
  '510': '🌫️',
  '511': '🌫️',
  '512': '🌫️',
  '513': '🌫️',
  '514': '🌫️',
  '515': '🌫️',
};

export function weatherEmoji(icon: string): string {
  return ICON_EMOJI[icon] ?? '🌡️';
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** fxDate（YYYY-MM-DD）→ 星期（今天显示「今天」） */
export function weekday(fxDate: string): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  if (fxDate === `${y}-${m}-${d}`) return '今天';
  const date = new Date(`${fxDate}T00:00:00`);
  return WEEKDAYS[date.getDay()] ?? '';
}

/** fxTime（ISO）→ 小时（如「10时」） */
export function hourOf(fxTime: string): string {
  const m = /T(\d{2}):/.exec(fxTime);
  return m ? `${Number(m[1])}时` : '';
}
