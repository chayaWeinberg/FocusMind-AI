// Copies the MediaPipe Tasks Vision WASM runtime from node_modules into
// public/mediapipe/wasm so the face landmarker runs fully locally (no CDN).
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(frontendDirectory, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destinationDirectory = path.join(frontendDirectory, 'public', 'mediapipe', 'wasm');

const runtimeFiles = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && ['.js', '.wasm'].includes(path.extname(entry.name)))
  .map((entry) => entry.name);

if (runtimeFiles.length === 0) {
  throw new Error(`No MediaPipe JS/WASM runtime assets found in ${sourceDirectory}`);
}

await mkdir(destinationDirectory, { recursive: true });
await Promise.all(runtimeFiles.map((fileName) => (
  copyFile(path.join(sourceDirectory, fileName), path.join(destinationDirectory, fileName))
)));
console.log(`Copied ${runtimeFiles.length} MediaPipe runtime assets to ${destinationDirectory}`);

// ONNX Runtime Web (the course attention model): the single-threaded-capable
// WASM build and its loader, served from /ort. Generated, ignored by Git.
const ortSource = path.join(frontendDirectory, 'node_modules', 'onnxruntime-web', 'dist');
const ortDestination = path.join(frontendDirectory, 'public', 'ort');
const ortFiles = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
await mkdir(ortDestination, { recursive: true });
await Promise.all(ortFiles.map((fileName) => (
  copyFile(path.join(ortSource, fileName), path.join(ortDestination, fileName))
)));
console.log(`Copied ${ortFiles.length} ONNX Runtime Web assets to ${ortDestination}`);
