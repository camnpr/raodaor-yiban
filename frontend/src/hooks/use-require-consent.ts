import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useT } from '../i18n';
import { useConsentStore } from '../stores/consent-store';

/**
 * 绑定 / 会员等需同意隐私政策的功能闸门（FR-G6）：
 * 未同意时弹窗提示并给出查看隐私政策的入口，返回 false 由调用方中止操作。
 */
export function useRequireConsent() {
  const t = useT();
  const router = useRouter();
  return useCallback(() => {
    const { agreed } = useConsentStore.getState();
    if (agreed) return true;
    Alert.alert(t.privacy.consentTitle, t.privacy.gateHint, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.privacy.title, onPress: () => router.push('/privacy') },
    ]);
    return false;
  }, [t, router]);
}
