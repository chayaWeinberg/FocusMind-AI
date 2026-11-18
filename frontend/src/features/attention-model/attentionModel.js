// The course attention model (v4_2: GRU with attention, trained on EngageNet
// and DAiSEE), run in the browser with ONNX Runtime Web (WebAssembly).
// Input: [1, 100, 478, 3] raw MediaPipe landmarks. Outputs: a regression score
// 0..1 (higher = more attentive), 5-level logits and per-frame attention
// weights. The model, the landmarks and the score stay on the device; only the
// score is sent to the server.

import { LANDMARK_COUNT, WINDOW_FRAMES } from './landmarkWindow.js';

export const ATTENTION_MODEL_VERSION = 'v4_2';
export const ATTENTION_MODEL_URL = `/models/attention/${ATTENTION_MODEL_VERSION}.onnx`;
export const ORT_WASM_PATH = '/ort/';

// The training targets were 0.05 (not in camera), 0.30 (not attentive),
// 0.50 (weak attention), 0.70 (attentive) and 0.95 (very attentive).
// A score is placed at the nearest target (boundaries are the midpoints).
export const ATTENTION_LEVELS = Object.freeze([
  { key: 'absent', label: 'לא נמצא במצלמה', below: 0.175 },
  { key: 'not-attentive', label: 'לא קשוב', below: 0.4 },
  { key: 'weak', label: 'קשב חלש', below: 0.6 },
  { key: 'attentive', label: 'קשוב', below: 0.825 },
  { key: 'very-attentive', label: 'קשוב מאוד', below: Number.POSITIVE_INFINITY },
]);

export function attentionLevelOf(score) {
  return ATTENTION_LEVELS.find((level) => score < level.below);
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * Loads the model once. onnxruntime-web is imported lazily, so it is only
 * downloaded when the camera is turned on.
 * @returns {Promise<{ score(data: Float32Array): Promise<number>, release(): void }>}
 */
export async function loadAttentionModel({ url = ATTENTION_MODEL_URL } = {}) {
  // The WASM-only build (no eval, no WebGL/WebGPU); its loader and .wasm are
  // served from /ort (copied by scripts/copy-mediapipe-assets.mjs).
  const ort = await import('onnxruntime-web/wasm');
  ort.env.wasm.wasmPaths = ORT_WASM_PATH;
  // Single thread: multithreading needs cross-origin isolation headers.
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(url, { executionProviders: ['wasm'] });
  const inputName = session.inputNames[0]; // differs between model versions
  const scoreName = session.outputNames[0]; // the first output is always the score

  return {
    async score(data) {
      const input = new ort.Tensor('float32', data, [1, WINDOW_FRAMES, LANDMARK_COUNT, 3]);
      const outputs = await session.run({ [inputName]: input });
      const value = Number(outputs[scoreName].data[0]);
      return Number.isFinite(value) ? clamp01(value) : null;
    },
    release() {
      void session.release?.();
    },
  };
}
