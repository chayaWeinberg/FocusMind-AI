// Generates the original "סרטון הדגמה" (demonstration) videos for the catalog
// lessons, fully offline: Microsoft Edge (installed locally) draws the slides
// on a canvas and records them with MediaRecorder as H.264 MP4.
//
//   node scripts/demo-videos/generate.mjs            # all lessons, skips up-to-date files
//   node scripts/demo-videos/generate.mjs --force    # regenerate everything
//   node scripts/demo-videos/generate.mjs --only sql-fundamentals/select
//
// Output: <repo>/demo-videos/*.mp4 and manifest.json (ignored by Git).
// Then install them:  backend: python -m app.demo_videos install <dir>

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { DEMO_VERSION, LESSONS, SLIDE_SECONDS } from './lessons.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT_DIR = path.resolve(here, '..', '..', '..', 'demo-videos');
const WIDTH = 960;
const HEIGHT = 540;
const BITRATE = 650_000;

export const fileNameOf = (lesson) => `${lesson.course}--${lesson.key}.mp4`;

/** Runs inside the page: draws the lesson's slides and records them. */
async function recordInPage({ lesson, slideSeconds, width, height, bitrate }) {
  const total = lesson.slides.length * slideSeconds;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const C = { bg: '#faf8f4', card: '#ffffff', primary: '#167d83', ink: '#25383b', muted: '#6b7c7a', peach: '#f3b58d', soft: '#ddf1ef', line: '#d9dedb' };
  const HE = '"Segoe UI", Arial, sans-serif';
  const MONO = 'Consolas, "Courier New", monospace';
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function rtl(text, x, y, font, color, align = 'right') {
    ctx.direction = 'rtl';
    ctx.textAlign = align;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function ltr(text, x, y, font, color, align = 'left') {
    ctx.direction = 'ltr';
    ctx.textAlign = align;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function box(x, y, w, h, fill, stroke, r = 12) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  function arrowLeft(x1, x2, y) {
    ctx.strokeStyle = C.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 + 12, y - 8);
    ctx.lineTo(x2 + 12, y + 8);
    ctx.closePath();
    ctx.fillStyle = C.primary;
    ctx.fill();
  }
  const revealed = (local, count, step) => Math.min(count, Math.floor(local / step) + 1);

  function drawSlide(slide, local) {
    const top = 130;
    rtl(slide.title, width - 60, top, `600 34px ${HE}`, C.ink);
    const area = { x: 60, y: top + 30, w: width - 120, h: height - top - 110 };
    if (slide.type === 'bullets' || slide.type === 'summary') {
      const shown = revealed(local, slide.lines.length, 2.5);
      slide.lines.slice(0, shown).forEach((line, index) => {
        const y = area.y + 55 + index * 62;
        if (slide.type === 'summary') rtl('✓', width - 70, y, `700 26px ${HE}`, C.primary);
        else {
          ctx.beginPath();
          ctx.arc(width - 76, y - 9, 7, 0, Math.PI * 2);
          ctx.fillStyle = C.primary;
          ctx.fill();
        }
        rtl(line, width - 100, y, `400 28px ${HE}`, C.ink);
      });
    } else if (slide.type === 'code') {
      box(area.x + 40, area.y + 10, area.w - 80, area.h - 10, '#1f2b2a');
      const shown = revealed(local, slide.code.length, 1.2);
      slide.code.slice(0, shown).forEach((line, index) => {
        const color = line.trim().startsWith('#') || line.trim().startsWith('--') ? '#8fb3ad' : '#e9f2ef';
        ltr(line, area.x + 70, area.y + 55 + index * 38, `400 25px ${MONO}`, color);
      });
      if (shown < slide.code.length || Math.floor(local * 2) % 2 === 0) {
        const last = slide.code[shown - 1] || '';
        ctx.font = `400 25px ${MONO}`;
        const cursorX = area.x + 70 + ctx.measureText(last).width + 4;
        ctx.fillStyle = C.peach;
        ctx.fillRect(cursorX, area.y + 55 + (shown - 1) * 38 - 22, 12, 26);
      }
    } else if (slide.type === 'table') {
      const cols = slide.columns.length;
      const colW = Math.min(240, (area.w - 80) / cols);
      const tableW = colW * cols;
      const x0 = (width - tableW) / 2;
      const rowH = 52;
      const shown = revealed(local, slide.rows.length, 2);
      box(x0, area.y + 10, tableW, rowH, C.primary, null, 8);
      slide.columns.forEach((name, index) => ltr(name, x0 + colW * index + colW / 2, area.y + 45, `600 24px ${MONO}`, '#fff', 'center'));
      slide.rows.slice(0, shown).forEach((row, r) => {
        const y = area.y + 10 + rowH * (r + 1);
        box(x0, y, tableW, rowH, r % 2 ? '#f1f6f4' : C.card, C.line, 0);
        row.forEach((cell, index) => ltr(cell, x0 + colW * index + colW / 2, y + 35, `400 23px ${MONO}`, C.ink, 'center'));
      });
    } else if (slide.type === 'flow') {
      const n = slide.boxes.length;
      const gap = 70;
      const bw = (area.w - gap * (n - 1)) / n;
      const shown = revealed(local, n, 3);
      slide.boxes.forEach((label, index) => {
        if (index >= shown) return;
        const x = width - 60 - (index + 1) * bw - index * gap; // right to left
        const y = area.y + 90;
        box(x, y, bw, 110, index === shown - 1 ? C.soft : C.card, C.primary);
        rtl(label, x + bw / 2, y + 65, `600 23px ${HE}`, C.ink, 'center');
        if (index > 0) arrowLeft(x + bw + gap - 8, x + bw + 8, y + 55);
      });
    } else if (slide.type === 'neuron') {
      const cx = width / 2 + 40;
      const cy = area.y + 150;
      const inputs = ['x1', 'x2', 'x3'];
      const shown = revealed(local, 4, 3);
      inputs.forEach((name, index) => {
        if (index >= shown) return;
        const y = cy - 110 + index * 110;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(240, y);
        ctx.lineTo(cx - 60, cy);
        ctx.stroke();
        box(170, y - 30, 70, 60, C.card, C.primary, 30);
        ltr(name, 205, y + 9, `600 24px ${MONO}`, C.ink, 'center');
        ltr(`w${index + 1}`, (240 + cx - 60) / 2 - 20, (y + cy) / 2 - 10, `400 20px ${MONO}`, C.muted);
      });
      if (shown >= 4) {
        ctx.beginPath();
        ctx.arc(cx, cy, 62, 0, Math.PI * 2);
        ctx.fillStyle = C.soft;
        ctx.fill();
        ctx.strokeStyle = C.primary;
        ctx.stroke();
        ltr('Σ + b', cx, cy + 10, `600 26px ${MONO}`, C.ink, 'center');
        arrowLeft(cx + 200, cx + 70, cy);
        ltr('f(·) → y', cx + 210, cy + 8, `600 24px ${MONO}`, C.primary);
      }
    } else if (slide.type === 'layers') {
      const layers = [3, 4, 4, 2];
      const shown = revealed(local, layers.length, 3);
      const xs = layers.map((_, index) => 220 + index * 170);
      const ys = (count) => Array.from({ length: count }, (_, i) => area.y + 70 + i * 70 + (4 - count) * 35);
      for (let l = 1; l < shown; l += 1) {
        ys(layers[l - 1]).forEach((y1) => ys(layers[l]).forEach((y2) => {
          ctx.strokeStyle = 'rgba(22,125,131,0.25)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(xs[l - 1], y1);
          ctx.lineTo(xs[l], y2);
          ctx.stroke();
        }));
      }
      ['קלט', 'שכבה נסתרת', 'שכבה נסתרת', 'פלט'].forEach((label, l) => {
        if (l >= shown) return;
        ys(layers[l]).forEach((y) => {
          ctx.beginPath();
          ctx.arc(xs[l], y, 20, 0, Math.PI * 2);
          ctx.fillStyle = l === 0 || l === layers.length - 1 ? C.soft : C.card;
          ctx.fill();
          ctx.strokeStyle = C.primary;
          ctx.stroke();
        });
        rtl(label, xs[l], area.y + 40, `600 20px ${HE}`, C.muted, 'center');
      });
    }
  }

  function draw(t) {
    const index = Math.min(lesson.slides.length - 1, Math.floor(t / slideSeconds));
    const local = t - index * slideSeconds;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width, height);
    // header
    ctx.fillStyle = C.card;
    ctx.fillRect(0, 0, width, 74);
    ctx.fillStyle = C.line;
    ctx.fillRect(0, 74, width, 1);
    box(width - 190, 18, 160, 38, C.peach, null, 10);
    rtl('סרטון הדגמה', width - 110, 45, `700 21px ${HE}`, C.ink, 'center');
    rtl(`${lesson.courseTitle} · ${lesson.title}`, width - 210, 45, `500 20px ${HE}`, C.ink);
    ltr('FocusMind AI', 30, 45, `700 20px ${HE}`, C.primary);
    drawSlide(lesson.slides[index], local);
    // footer: progress, clock and slide number (useful to verify seeking and replay)
    const progress = Math.min(1, t / total);
    ctx.fillStyle = C.line;
    ctx.fillRect(60, height - 46, width - 120, 6);
    ctx.fillStyle = C.primary;
    ctx.fillRect(width - 60 - (width - 120) * progress, height - 46, (width - 120) * progress, 6);
    ltr(`${clock(t)} / ${clock(total)}`, 60, height - 16, `600 20px ${MONO}`, C.muted);
    rtl(`שקופית ${index + 1} מתוך ${lesson.slides.length}`, width - 60, height - 16, `500 19px ${HE}`, C.muted);
    rtl('תוכן הדגמה מקורי של FocusMind, לא הרצאה מלאה', width / 2, height - 16, `400 16px ${HE}`, C.muted, 'center');
  }

  const type = ['video/mp4;codecs=avc1', 'video/mp4'].find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!type) throw new Error('MP4 recording is not supported in this browser.');
  const recorder = new MediaRecorder(canvas.captureStream(25), { mimeType: type, videoBitsPerSecond: bitrate });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  draw(0);
  const started = performance.now();
  const timer = setInterval(() => draw((performance.now() - started) / 1000), 40);
  recorder.start(1000);
  await new Promise((resolve) => setTimeout(resolve, total * 1000 + 300));
  recorder.stop();
  await stopped;
  clearInterval(timer);
  const blob = new Blob(chunks, { type: 'video/mp4' });

  // Validate: a real, finite, seekable duration.
  const duration = await new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => resolve(NaN);
    video.src = URL.createObjectURL(blob);
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return { base64: btoa(binary), duration, type };
}

export async function generateDemoVideos({ outDir = DEFAULT_OUT_DIR, force = false, only = null, concurrency = 4, channel = 'msedge', log = console.log } = {}) {
  await mkdir(outDir, { recursive: true });
  const manifestPath = path.join(outDir, 'manifest.json');
  const previous = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf-8')) : { videos: [] };
  const byFile = new Map(previous.videos.map((entry) => [entry.file, entry]));
  const wanted = LESSONS.filter((lesson) => !only || `${lesson.course}/${lesson.key}` === only);
  const todo = wanted.filter((lesson) => {
    const entry = byFile.get(fileNameOf(lesson));
    return force || !entry || entry.version !== DEMO_VERSION || !existsSync(path.join(outDir, entry.file));
  });
  log(`Demo videos: ${wanted.length - todo.length} up to date, ${todo.length} to record (~${todo.length ? Math.ceil(todo.length / concurrency) * 1.6 : 0} min).`);

  const writeManifest = async () => {
    const videos = LESSONS.map((lesson) => byFile.get(fileNameOf(lesson))).filter(Boolean);
    await writeFile(manifestPath, `${JSON.stringify({ generator: 'FocusMind demo videos', version: DEMO_VERSION, videos }, null, 2)}\n`);
    return videos;
  };

  // One browser process per worker: pages sharing a browser can lose frames
  // while they are not in focus, which shortens the recording.
  const queue = [...todo];
  const worker = async () => {
    const browser = await chromium.launch({
      channel,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent('<html><body style="margin:0"></body></html>');
      while (queue.length) {
        const lesson = queue.shift();
        const expected = lesson.slides.length * SLIDE_SECONDS;
        let result = null;
        for (let attempt = 1; attempt <= 3 && !result; attempt += 1) {
          const recorded = await page.evaluate(recordInPage, { lesson, slideSeconds: SLIDE_SECONDS, width: WIDTH, height: HEIGHT, bitrate: BITRATE });
          if (Number.isFinite(recorded.duration) && recorded.duration >= expected - 2) result = recorded;
          else log(`  ${fileNameOf(lesson)}: recording too short (${recorded.duration} s), retrying (${attempt}/3)`);
        }
        if (!result) throw new Error(`${fileNameOf(lesson)}: could not record a full-length video.`);
        const data = Buffer.from(result.base64, 'base64');
        await writeFile(path.join(outDir, fileNameOf(lesson)), data);
        byFile.set(fileNameOf(lesson), {
          course: lesson.course,
          key: lesson.key,
          title: lesson.title,
          file: fileNameOf(lesson),
          durationSeconds: Math.round(result.duration * 100) / 100,
          sizeBytes: data.length,
          sha256: createHash('sha256').update(data).digest('hex'),
          version: DEMO_VERSION,
        });
        await writeManifest();
        log(`  recorded ${fileNameOf(lesson)} (${Math.round(result.duration)} s, ${(data.length / 1048576).toFixed(1)} MB)`);
      }
    } finally {
      await browser.close();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  const videos = await writeManifest();
  return { outDir, manifestPath, videos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf('--only');
  const outIndex = args.indexOf('--out');
  await generateDemoVideos({
    force: args.includes('--force'),
    only: onlyIndex >= 0 ? args[onlyIndex + 1] : null,
    outDir: outIndex >= 0 ? path.resolve(args[outIndex + 1]) : DEFAULT_OUT_DIR,
  });
}
