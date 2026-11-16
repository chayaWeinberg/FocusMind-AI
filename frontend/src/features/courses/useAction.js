import { useCallback, useRef, useState } from 'react';

/**
 * Runs one server action at a time with busy/error/message state.
 * The in-flight guard is a ref, so a double click cannot send two requests
 * even before React re-renders the disabled button.
 * Resolves to the action's result, or `undefined` when it failed or was
 * ignored as a duplicate.
 */
export default function useAction() {
  const [state, setState] = useState({ busy: false, error: '', message: '' });
  const inFlight = useRef(false);

  const run = useCallback(async (action, success = '') => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setState({ busy: true, error: '', message: '' });
    try {
      const result = await action();
      setState({ busy: false, error: '', message: success });
      return result;
    } catch (error) {
      setState({ busy: false, error: error.message || 'משהו השתבש.', message: '' });
      return undefined;
    } finally {
      inFlight.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ busy: false, error: '', message: '' }), []);
  return [state, run, reset];
}
