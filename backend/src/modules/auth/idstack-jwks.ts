import { createPublicKey } from 'node:crypto';

/**
 * IDStack JWKS 公钥选择（源自 IDStack 参考实现 `idstack-verify.ts` 的 JWKS 段）。
 * 零第三方依赖：仅 `node:crypto` + Node 18 全局 `fetch`。
 * 按 token header 的 `kid` 从 JWKS 选公钥，`kid` 未命中强制刷新一次（配合 IDStack 密钥轮换）。
 */

interface JwkEntry {
  kid?: string;
  alg?: string;
  kty?: string;
  n?: string;
  e?: string;
}

interface JwksCacheEntry {
  body: { keys?: JwkEntry[] };
  fetchedAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h

async function fetchJwks(jwksUri: string, force = false): Promise<{ keys?: JwkEntry[] }> {
  const now = Date.now();
  const cached = jwksCache.get(jwksUri);
  if (!force && cached && now - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.body;
  }
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`IDStack JWKS 拉取失败: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: JwkEntry[] };
  jwksCache.set(jwksUri, { body, fetchedAt: now });
  return body;
}

function jwkToPem(jwk: JwkEntry): string {
  const key = createPublicKey({
    key: { kty: 'RSA', n: jwk.n as string, e: jwk.e as string },
    format: 'jwk',
  });
  return key.export({ type: 'spki', format: 'pem' }) as string;
}

/** 归一化 JWKS 端点：显式配置优先，缺省由 apiBaseUrl（去掉 /api/v1）推导。 */
export function resolveJwksUri(jwksUri: string, apiBaseUrl: string): string {
  return (
    jwksUri ||
    `${apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '')}/.well-known/jwks.json`
  );
}

export interface TokenHeader {
  alg?: string;
  kid?: string;
}

/** 仅解码 token header（不验签），用于按 `alg` 显式分派验签路径。 */
export function decodeTokenHeader(token: string): TokenHeader | null {
  const seg = token.split('.')[0];
  if (!seg) return null;
  try {
    return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8')) as TokenHeader;
  } catch {
    return null;
  }
}

/** 按 kid 从 JWKS 选择 RS256 公钥（PEM）。kid 未命中会强制刷新一次再选。 */
export async function selectPublicKey(jwksUri: string, kid?: string): Promise<string> {
  const pick = (keys: JwkEntry[]) =>
    keys.find((k) => k.kty === 'RSA' && !!k.n && !!k.e && (!kid || k.kid === kid));

  const jwks = await fetchJwks(jwksUri);
  let key = pick(jwks.keys ?? []);
  if (!key && kid) {
    const refreshed = await fetchJwks(jwksUri, true);
    key = pick(refreshed.keys ?? []);
  }
  if (!key) throw new Error(`IDStack JWK 未找到${kid ? `（kid=${kid}）` : ''}`);
  return jwkToPem(key);
}
