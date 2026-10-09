import { useCallback, useEffect, useRef, useState } from 'react';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 手动刷新（单模块重试 / 下拉刷新都会调用它） */
  reload: () => void;
}

/**
 * 独立数据区块：每个模块各自管理 loading / error / data，互不阻塞。
 * - deps 变化时自动重新拉取；
 * - enabled=false 时不发起请求（如城市尚未选定）；
 * - reload() 用于手动刷新。
 * 失败时只影响本模块（由 AsyncSection 渲染内联错误 + 重试），不会冒泡导致整页白屏。
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  enabled = true,
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // fetcher 通过 ref 读取最新闭包，不放入依赖，避免每次渲染重复请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return { data, loading, error, reload };
}
