// Creates the test video once per run: a real MP4 recorded by the browser
// itself (MediaRecorder on a canvas), so no media file is downloaded or
// committed. Edge produces a seekable MP4 with a known duration.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
export const TEST_VIDEO = path.join(here, '.generated', 'lesson.mp4');
export const TEST_VIDEO_SECONDS = 12;

export default async function globalSetup(config) {
  const channel = config.projects[0]?.use?.channel || 'msedge';
  const browser = await chromium.launch({ channel });
  try {
    const page = await browser.newPage();
    await page.setContent('<html><body></body></html>');
    const base64 = await page.evaluate(async (seconds) => {
      const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      const started = performance.now();
      const timer = setInterval(() => {
        const elapsed = (performance.now() - started) / 1000;
        context.fillStyle = `hsl(${Math.round(elapsed * 30) % 360}, 60%, 45%)`;
        context.fillRect(0, 0, 320, 180);
        context.fillStyle = '#fff';
        context.font = '28px sans-serif';
        context.fillText(`FocusMind e2e ${elapsed.toFixed(1)}s`, 20, 100);
      }, 33);
      const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: type });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      recorder.stop();
      await stopped;
      clearInterval(timer);
      const bytes = new Uint8Array(await new Blob(chunks, { type }).arrayBuffer());
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return btoa(binary);
    }, TEST_VIDEO_SECONDS);
    await mkdir(path.dirname(TEST_VIDEO), { recursive: true });
    await writeFile(TEST_VIDEO, Buffer.from(base64, 'base64'));
  } finally {
    await browser.close();
  }
}
