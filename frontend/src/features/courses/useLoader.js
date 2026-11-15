import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads data with loading/error states; `reload()` fetches again. */
export default function useLoader(load, dependencies) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const version = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, dependencies);

  const reload = useCallback(async ({ quiet = false } = {}) => {
    const current = ++version.current;
    if (!quiet) setState((previous) => ({ ...previous, status: 'loading', error: '' }));
    try {
      const data = await run();
      if (version.current === current) setState({ status: 'ready', data, error: '' });
      return data;
    } catch (error) {
      if (version.current === current) {
        setState((previous) => ({ ...previous, status: 'error', error: error.message || 'משהו השתבש.' }));
      }
      return null;
    }
  }, [run]);

  useEffect(() => {
    void reload();
    return () => {
      version.current += 1;
    };
  }, [reload]);

  return { ...state, reload, setData: (data) => setState({ status: 'ready', data, error: '' }) };
}
