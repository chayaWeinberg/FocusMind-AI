import { useCallback, useEffect, useRef, useState } from 'react';
import { addBookmark, deleteBookmark, getLessonReplay, setReplayStatus } from '../learning/learningApi.js';

/** ReplayAI data of one lesson plus the learner's actions on it. */
export default function useLessonReplay(lessonId, enabled) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: null, error: '' });
  const [actionError, setActionError] = useState('');
  const version = useRef(0);

  const reload = useCallback(async ({ quiet = false } = {}) => {
    if (!enabled) return;
    const current = ++version.current;
    if (!quiet) setState((previous) => ({ ...previous, status: 'loading', error: '' }));
    try {
      const data = await getLessonReplay(lessonId);
      if (current === version.current) setState({ status: 'ready', data, error: '' });
    } catch (error) {
      if (current === version.current && !quiet) setState({ status: 'error', data: null, error: error.message });
    }
  }, [enabled, lessonId]);

  useEffect(() => {
    void reload();
    return () => {
      version.current += 1;
    };
  }, [reload]);

  const replaceItem = (item) => setState((previous) => (previous.data ? {
    ...previous,
    data: { ...previous.data, items: previous.data.items.map((entry) => (entry.id === item.id ? item : entry)) },
  } : previous));

  async function act(action) {
    setActionError('');
    try {
      return await action();
    } catch (error) {
      setActionError(error.message);
      return null;
    }
  }

  return {
    ...state,
    items: state.data?.items ?? [],
    actionError,
    reload,
    async setStatus(item, status) {
      const updated = await act(() => setReplayStatus(item.id, status));
      if (updated) replaceItem(updated);
      return updated;
    },
    async addBookmark(bookmark) {
      const created = await act(() => addBookmark(lessonId, bookmark));
      if (created) {
        setState((previous) => (previous.data ? {
          ...previous,
          data: {
            ...previous.data,
            items: [...previous.data.items, created].sort((a, b) => a.startSeconds - b.startSeconds),
          },
        } : previous));
      }
      return created;
    },
    async removeBookmark(item) {
      const removed = await act(async () => {
        await deleteBookmark(item.id);
        return true;
      });
      if (removed) {
        setState((previous) => (previous.data ? {
          ...previous,
          data: { ...previous.data, items: previous.data.items.filter((entry) => entry.id !== item.id) },
        } : previous));
      }
    },
  };
}
