import { useCallback, useEffect, useState } from 'react'

export interface AsyncData<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

interface Result<T> {
  key: string
  data: T | null
  error: string | null
}

/**
 * Minimal data-loading hook: runs `load` when `deps` change or on reload().
 * `loading` is derived (the latest result belongs to an older request), so
 * the effect only sets state when the request settles.
 */
export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[]): AsyncData<T> {
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState<Result<T>>({ key: '', data: null, error: null })
  const key = JSON.stringify([...deps, reloadCount])

  useEffect(() => {
    let active = true
    load()
      .then((data) => active && setResult({ key, data, error: null }))
      .catch(
        (err: unknown) =>
          active &&
          setResult((r) => ({ key, data: r.data, error: err instanceof Error ? err.message : 'Something went wrong.' })),
      )
    return () => {
      active = false
    }
    // `key` captures deps and reloads; `load` is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])
  const loading = result.key !== key
  return { data: result.data, error: loading ? null : result.error, loading, reload }
}
