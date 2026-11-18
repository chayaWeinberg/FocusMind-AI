// Test stand-in for onnxruntime-web/wasm (aliased in vite.config.js for
// Vitest only). jsdom cannot run WebAssembly models from /ort, so loading the
// course attention model fails politely, as it would without the model files:
// the monitor shows "לא זמין" and the concentration estimate keeps working.
// Model behaviour itself is tested with a fake loader (attentionModel.test.js).

export const env = { wasm: {} };

export class Tensor {
  constructor(type, data, dims) {
    Object.assign(this, { type, data, dims });
  }
}

export const InferenceSession = {
  async create() {
    throw new Error('ONNX Runtime is not available in tests.');
  },
};
