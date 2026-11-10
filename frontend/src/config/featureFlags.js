// Development feature flags. Every flag is OFF in production builds.

const ATTENTION_ENGINE_STORAGE_KEY = 'focusmind:attention-engine';

/**
 * The new attention engine replaces the legacy gaze experiment on the Smart
 * Learning page when enabled, in development only, by either:
 *   - VITE_FEATURE_ATTENTION_ENGINE=true in frontend/.env.local, or
 *   - opening /learning?engine=new (remembered in this browser;
 *     /learning?engine=legacy switches back).
 */
export function isAttentionEngineEnabled() {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_FEATURE_ATTENTION_ENGINE === 'true') return true;
  try {
    const choice = new URLSearchParams(window.location.search).get('engine');
    if (choice === 'new') window.localStorage.setItem(ATTENTION_ENGINE_STORAGE_KEY, 'on');
    if (choice === 'legacy') window.localStorage.removeItem(ATTENTION_ENGINE_STORAGE_KEY);
    return window.localStorage.getItem(ATTENTION_ENGINE_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export { ATTENTION_ENGINE_STORAGE_KEY };
