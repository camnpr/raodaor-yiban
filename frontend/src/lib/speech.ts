import * as Speech from 'expo-speech';

/**
 * 语音播报封装（FR-V1）：跟随用户语言，语速略缓适配长辈。
 * expo-speech 为 M2 新增依赖（`npx expo install expo-speech`）。
 */

export function speakText(text: string, language = 'zh-CN'): void {
  Speech.stop();
  Speech.speak(text, { language, rate: 0.9 });
}

export function stopSpeaking(): void {
  Speech.stop();
}
