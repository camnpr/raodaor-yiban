import { create } from 'zustand';
import { platformStorage } from './storage';

/**
 * 与后端 /auth/* 返回结构对齐（capabilities 入口可见性驱动前端入口，禁止硬编码角色名）。
 * - `consoleAdmin`：平台运营后台（IDStack `system_admin` / `owner` 角色驱动）。
 * - `owner`：平台拥有者（仅 IDStack `owner` 角色），运营补单等高危操作专属入口。
 * 长辈 / 守护人不依赖 IDStack 业务角色区分，视图由亲情关系数据（CareRelationship）驱动。
 */
export interface Capabilities {
  consoleAdmin: boolean;
  owner: boolean;
}

export interface AuthUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthMembership {
  tier: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  capabilities: Capabilities;
  /**
   * 会员状态摘要（后端 /auth/me 下发）：免费用户 tier=null / isActive=false。
   */
  membership?: AuthMembership | null;
  /**
   * IDStack access_token 透传：凭它调 message `POST /auth/idstack/exchange`
   * 免二次登录换消息域凭证。仅 SSO 登录时下发（refresh 不重建）。
   */
  idstackAccessToken?: string | null;
}

interface AuthState {
  session: AuthSession | null;
  /** 本地存储水合是否完成 */
  hydrated: boolean;
  setSession: (session: AuthSession) => void;
  /** 局部更新会话（如启动后用 /auth/me 刷新 capabilities / user，令牌保持不变） */
  patchSession: (patch: Partial<AuthSession>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  setSession: (session) => set({ session }),
  patchSession: (patch) =>
    set((state) => (state.session ? { session: { ...state.session, ...patch } } : state)),
  logout: () => set({ session: null }),
}));

/**
 * 轻量持久化（Native → SecureStore / Web → localStorage）。
 * 不使用 zustand persist：其 devtools 实现含 import.meta，Metro 非 module 脚本无法解析。
 */
const STORAGE_KEY = 'raodaor-yiban-auth';
let storageReady = false;

platformStorage
  .getItem(STORAGE_KEY)
  .then((raw) => {
    storageReady = true;
    if (!raw) {
      useAuthStore.setState({ hydrated: true });
      return;
    }
    const parsed = JSON.parse(raw) as { session: AuthSession | null };
    useAuthStore.setState({ session: parsed.session ?? null, hydrated: true });
  })
  .catch(() => {
    storageReady = true;
    useAuthStore.setState({ hydrated: true });
  });

useAuthStore.subscribe((state) => {
  if (!storageReady) return;
  void platformStorage.setItem(STORAGE_KEY, JSON.stringify({ session: state.session }));
});
