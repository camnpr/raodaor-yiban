import { create } from 'zustand';
import { platformStorage } from './storage';

interface ConsentState {
  /** 是否已同意隐私政策（同意后方可绑定家人 / 会员） */
  agreed: boolean;
  /** 是否曾「暂不同意」：不再弹窗，但 agreed 仍为 false 以限制绑定/会员 */
  dismissed: boolean;
  setAgreed: (value: boolean) => void;
  setDismissed: (value: boolean) => void;
}

/** 隐私政策首启同意状态（PRD FR-G6） */
export const useConsentStore = create<ConsentState>((set) => ({
  agreed: false,
  dismissed: false,
  setAgreed: (agreed) => set({ agreed }),
  setDismissed: (dismissed) => set({ dismissed }),
}));

const STORAGE_KEY = 'raodaor-yiban-consent';
let hydrated = false;

platformStorage
  .getItem(STORAGE_KEY)
  .then((raw) => {
    hydrated = true;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<ConsentState>;
      if (typeof parsed.agreed === 'boolean') useConsentStore.setState({ agreed: parsed.agreed });
      if (typeof parsed.dismissed === 'boolean') {
        useConsentStore.setState({ dismissed: parsed.dismissed });
      }
    } catch {
      /* 忽略损坏的本地数据 */
    }
  })
  .catch(() => {
    hydrated = true;
  });

useConsentStore.subscribe((state) => {
  if (!hydrated) return;
  void platformStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ agreed: state.agreed, dismissed: state.dismissed }),
  );
});
