import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A filter whose selection lives in the URL query string, so navigating away
 * and back (e.g. to a detail page) restores the exact filtered view — and with
 * it the saved scroll position.
 *
 * The selection is stored as a comma-separated list under `key`
 * (e.g. `?status=registered,pledged`). An empty selection removes the param,
 * which represents "all". Old single-value URLs parse as a one-element array,
 * so existing links keep working.
 *
 * Changing a filter also clears the `page` param and uses `replace` navigation,
 * matching the existing single-select behavior: filtering doesn't flood history,
 * and a single Back press returns to the filtered list.
 */
export function useUrlMultiFilter(key: string): [string[], (values: string[]) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);

  const values = useMemo(
    () => (raw ? raw.split(',').filter(Boolean) : []),
    [raw]
  );

  const setValues = useCallback(
    (next: string[]) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next.length === 0) params.delete(key);
          else params.set(key, next.join(','));
          params.delete('page');
          return params;
        },
        { replace: true }
      );
    },
    [key, setSearchParams]
  );

  return [values, setValues];
}
