import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(
  frontendDirectory,
  'node_modules',
  '@mediapipe',
  'tasks-vision',
  'wasm',
);
const destinationDirectory = path.join(frontendDirectory, 'public', 'mediapipe', 'wasm');
const runtimeFiles = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && ['.js', '.wasm'].includes(path.extname(entry.name)))
  .map((entry) => entry.name);
const webGazerSourceDirectory = path.join(
  frontendDirectory,
  'node_modules',
  'webgazer',
  'dist',
  'mediapipe',
  'face_mesh',
);
const webGazerDestinationDirectory = path.join(
  frontendDirectory,
  'public',
  'mediapipe',
  'webgazer-face-mesh',
);
const webGazerRuntimeFiles = await readdir(webGazerSourceDirectory, { withFileTypes: true });
const webGazerAssetFiles = webGazerRuntimeFiles
  .filter((entry) => (
    entry.isFile() && ['.binarypb', '.data', '.js', '.wasm'].includes(path.extname(entry.name))
  ))
  .map((entry) => entry.name);

if (runtimeFiles.length === 0) {
  throw new Error(`No MediaPipe JS/WASM runtime assets found in ${sourceDirectory}`);
}
if (webGazerAssetFiles.length === 0) {
  throw new Error(`No WebGazer Face Mesh assets found in ${webGazerSourceDirectory}`);
}

await mkdir(destinationDirectory, { recursive: true });
await Promise.all(runtimeFiles.map((fileName) => (
  copyFile(path.join(sourceDirectory, fileName), path.join(destinationDirectory, fileName))
)));
console.log(`Copied ${runtimeFiles.length} MediaPipe runtime assets to ${destinationDirectory}`);
if (process.env.npm_lifecycle_event === 'prebuild') {
  await rm(webGazerDestinationDirectory, { recursive: true, force: true });
  console.log('Removed WebGazer-only assets from the production build input.');
} else {
  await rm(webGazerDestinationDirectory, { recursive: true, force: true });
  await mkdir(webGazerDestinationDirectory, { recursive: true });
  await Promise.all(webGazerAssetFiles
    .map((name) => (
      copyFile(
        path.join(webGazerSourceDirectory, name),
        path.join(webGazerDestinationDirectory, name),
      )
    )));
  console.log(`Copied ${webGazerAssetFiles.length} WebGazer Face Mesh assets to ${webGazerDestinationDirectory}`);
}
