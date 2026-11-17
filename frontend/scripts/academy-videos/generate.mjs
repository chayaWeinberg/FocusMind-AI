// Records the FocusMind Academy lessons (original content, lessons.mjs) as
// H.264 MP4 videos, fully offline: Microsoft Edge draws each scene on a canvas
// with explanation captions, and MediaRecorder records it in real time.
//
//   node scripts/academy-videos/generate.mjs                 # missing/outdated only
//   node scripts/academy-videos/generate.mjs --force
//   node scripts/academy-videos/generate.mjs --only sql-academy/joins   (or a whole course: --only sql-academy)
//
// Output: backend/demo_assets/<course>--<key>.mp4, merged into its
// manifest.json (entries with "kind": "academy"). The backend installs them
// on startup (SEED_CATALOG=true + DEMO_VIDEOS_DIR) or with
// python -m app.demo_videos install <dir>.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ACADEMY_LESSONS, ACADEMY_VERSION, captionSeconds } from './lessons.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(here, '..', '..', '..', 'backend', 'demo_assets');
const WIDTH = 960;
const HEIGHT = 540;
const FPS = 15;
const BITRATE = 400_000;

const fileNameOf = (lesson) => `${lesson.course}--${lesson.key}.mp4`;

/** Runs inside the page: draws the lesson and records it. Self-contained. */
async function recordInPage({ lesson, timeline, width, height, fps, bitrate }) {
  const total = timeline.total;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const C = {
    bg: '#faf8f4', card: '#ffffff', primary: '#167d83', dark: '#123f42', ink: '#25383b', muted: '#6b7c7a',
    peach: '#f3b58d', soft: '#ddf1ef', line: '#d9dedb', code: '#1f2b2a', codeText: '#e9f2ef', comment: '#8fb3ad',
    ok: '#2e7d4f', okSoft: '#dcefe3', faded: '#eef0ee',
  };
  const HE = '"Segoe UI", Arial, sans-serif';
  const MONO = 'Consolas, "Courier New", monospace';
  const AREA = { x: 40, y: 122, w: width - 80, h: 268 };
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function text(value, x, y, font, color, align, dir) {
    ctx.direction = dir;
    ctx.textAlign = align;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }
  const rtl = (value, x, y, font, color, align = 'right') => text(value, x, y, font, color, align, 'rtl');
  const ltr = (value, x, y, font, color, align = 'left') => text(value, x, y, font, color, align, 'ltr');
  function box(x, y, w, h, fill, stroke, r = 10, lineWidth = 2) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function wrap(value, maxWidth, font) {
    ctx.font = font;
    const words = value.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) { lines.push(current); current = word; } else current = candidate;
    }
    if (current) lines.push(current);
    return lines;
  }
  const isLatin = (value) => !/[֐-׿]/.test(value);
  const reveal = (progress, count, until = 0.6) => Math.min(count, Math.floor((progress / until) * count) + 1);

  function drawList(lines, progress, numbered, check) {
    const shown = reveal(progress, lines.length, 0.7);
    const gap = Math.min(54, AREA.h / lines.length);
    lines.slice(0, shown).forEach((line, index) => {
      const y = AREA.y + 34 + index * gap;
      if (check) rtl('✓', width - 60, y, `700 24px ${HE}`, C.ok);
      else if (numbered) {
        box(width - 86, y - 24, 32, 32, C.soft, null, 16);
        ltr(String(index + 1), width - 70, y - 1, `700 18px ${HE}`, C.primary, 'center');
      } else {
        ctx.beginPath();
        ctx.arc(width - 66, y - 8, 6, 0, Math.PI * 2);
        ctx.fillStyle = C.primary;
        ctx.fill();
      }
      rtl(line, width - 100, y, `400 24px ${HE}`, C.ink);
    });
  }

  function drawCode(visual, progress) {
    const code = visual.code;
    const output = visual.output || [];
    const rows = code.length + (output.length ? output.length + 1.4 : 0);
    const lh = Math.min(30, (AREA.h - 26) / rows);
    const size = Math.max(15, Math.min(21, Math.floor(lh * 0.74)));
    box(AREA.x + 20, AREA.y, AREA.w - 40, AREA.h, C.code);
    const shown = reveal(progress, code.length, 0.45);
    code.slice(0, shown).forEach((line, index) => {
      const trimmed = line.trim();
      const comment = trimmed.startsWith('#') || trimmed.startsWith('--') || trimmed.startsWith('//') || trimmed.startsWith('/*');
      ltr(line, AREA.x + 46, AREA.y + 14 + lh * (index + 0.8), `400 ${size}px ${MONO}`, comment ? C.comment : C.codeText);
    });
    if (output.length && progress > 0.5) {
      const top = AREA.y + 14 + lh * (code.length + 0.35);
      ctx.fillStyle = '#3b4b49';
      ctx.fillRect(AREA.x + 40, top, AREA.w - 80, 1);
      rtl('פלט', AREA.x + AREA.w - 46, top + lh * 0.95, `600 ${size - 2}px ${HE}`, C.peach);
      output.forEach((line, index) => ltr(line, AREA.x + 46, top + lh * (index + 1.85), `400 ${size}px ${MONO}`, '#bfe7c9'));
    }
  }

  function drawTable(table, progress, x0, maxWidth, rowReveal = true) {
    const cols = table.columns.length;
    const colW = Math.min(230, maxWidth / cols);
    const tableW = colW * cols;
    const left = x0 ?? (width - tableW) / 2;
    const rowH = Math.min(46, (AREA.h - 40) / (table.rows.length + 1));
    const top = AREA.y + (table.name ? 30 : 6);
    if (table.name) ltr(table.name, left + tableW / 2, AREA.y + 18, `700 19px ${MONO}`, C.primary, 'center');
    box(left, top, tableW, rowH, C.primary, null, 6);
    table.columns.forEach((name, index) => ltr(name, left + colW * index + colW / 2, top + rowH * 0.66, `600 18px ${MONO}`, '#fff', 'center'));
    const shown = rowReveal ? reveal(progress, table.rows.length, 0.6) : table.rows.length;
    table.rows.slice(0, shown).forEach((row, r) => {
      const y = top + rowH * (r + 1);
      box(left, y, tableW, rowH, r % 2 ? '#f1f6f4' : C.card, C.line, 0, 1);
      row.forEach((cell, index) => ltr(cell, left + colW * index + colW / 2, y + rowH * 0.66, `400 18px ${MONO}`, C.ink, 'center'));
    });
  }

  function drawFlow(boxes, progress) {
    const n = boxes.length;
    const gap = 34;
    const bw = (AREA.w - gap * (n - 1)) / n;
    const shown = reveal(progress, n, 0.7);
    boxes.forEach((label, index) => {
      if (index >= shown) return;
      const x = width - AREA.x - (index + 1) * bw - index * gap; // right to left
      const y = AREA.y + 80;
      box(x, y, bw, 110, index === shown - 1 ? C.soft : C.card, C.primary);
      const lines = wrap(label, bw - 16, `600 18px ${HE}`);
      lines.slice(0, 3).forEach((line, i) => text(line, x + bw / 2, y + 58 - (lines.length - 1) * 12 + i * 24, `600 18px ${HE}`, C.ink, 'center', isLatin(line) ? 'ltr' : 'rtl'));
      if (index > 0) {
        const ax1 = x + bw + gap - 4;
        const ax2 = x + bw + 6;
        ctx.strokeStyle = C.primary;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ax1, y + 55); ctx.lineTo(ax2, y + 55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax2, y + 55); ctx.lineTo(ax2 + 10, y + 48); ctx.lineTo(ax2 + 10, y + 62); ctx.closePath();
        ctx.fillStyle = C.primary; ctx.fill();
      }
    });
  }

  function drawArray(steps, progress) {
    const index = Math.min(steps.length - 1, Math.floor(progress * steps.length));
    const step = steps[index];
    const n = step.values.length;
    const size = Math.min(70, (AREA.w - 40) / n - 10);
    const gap = 10;
    const extra = step.split ? 30 : 0;
    const rowW = n * size + (n - 1) * gap + extra;
    const left = (width - rowW) / 2; // arrays read left to right, like code
    const y = AREA.y + 70;
    step.values.forEach((value, i) => {
      const x = left + i * (size + gap) + (step.split && i >= step.split ? extra : 0);
      const inRange = step.low === undefined || (i >= step.low && i <= step.high);
      let fill = inRange ? C.card : C.faded;
      let stroke = C.line;
      if (step.compare?.includes(i)) { fill = '#fde6d6'; stroke = C.peach; }
      if (step.mid === i) { fill = C.soft; stroke = C.primary; }
      if (step.found === i || step.sorted?.includes(i)) { fill = C.okSoft; stroke = C.ok; }
      box(x, y, size, size, fill, stroke, 8, 3);
      ltr(String(value), x + size / 2, y + size / 2 + 8, `700 ${Math.round(size * 0.36)}px ${MONO}`, inRange ? C.ink : '#a9b3b1', 'center');
      ltr(String(i), x + size / 2, y - 10, `400 14px ${MONO}`, C.muted, 'center');
      const tags = [];
      if (step.low === i) tags.push('low');
      if (step.mid === i) tags.push('mid');
      if (step.high === i) tags.push('high');
      tags.forEach((tag, t) => ltr(tag, x + size / 2, y + size + 24 + t * 20, `600 16px ${MONO}`, tag === 'mid' ? C.primary : C.muted, 'center'));
    });
    rtl(step.note, width / 2, AREA.y + AREA.h - 26, `600 22px ${HE}`, C.dark, 'center');
    if (steps.length > 1) rtl(`שלב ${index + 1} מתוך ${steps.length}`, width - AREA.x, AREA.y + 20, `500 16px ${HE}`, C.muted);
  }

  function drawTerminal(lines, progress) {
    box(AREA.x + 20, AREA.y, AREA.w - 40, AREA.h, '#111816');
    ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => { ctx.beginPath(); ctx.arc(AREA.x + 44 + i * 20, AREA.y + 18, 6, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
    const lh = Math.min(30, (AREA.h - 50) / lines.length);
    const shown = reveal(progress, lines.length, 0.6);
    lines.slice(0, shown).forEach((line, index) => {
      const command = line.startsWith('$ ');
      ltr(line, AREA.x + 46, AREA.y + 50 + index * lh, `400 18px ${MONO}`, command ? '#7ee2a8' : (line.trim().startsWith('#') ? '#8fa6a2' : '#dfe8e5'));
    });
  }

  function drawQuiz(visual, progress) {
    box(AREA.x + 20, AREA.y, AREA.w - 40, 64, C.card, C.primary);
    const question = visual.question;
    text(question, width / 2, AREA.y + 40, `600 20px ${isLatin(question) ? MONO : HE}`, C.ink, 'center', isLatin(question) ? 'ltr' : 'rtl');
    const answered = progress > 0.55;
    const n = visual.options.length;
    const bw = 286;
    const gap = 18;
    const left = (width - (n * bw + (n - 1) * gap)) / 2;
    visual.options.forEach((option, i) => {
      const x = width - left - (i + 1) * bw - i * gap; // first option on the right
      const correct = answered && i === visual.answer;
      box(x, AREA.y + 100, bw, 70, correct ? C.okSoft : C.card, correct ? C.ok : C.line, 10, correct ? 3 : 2);
      rtl(['א', 'ב', 'ג', 'ד'][i], x + bw - 16, AREA.y + 142, `700 18px ${HE}`, C.primary);
      text(option, x + bw / 2 - 8, AREA.y + 142, `600 ${isLatin(option) ? 17 : 19}px ${isLatin(option) ? MONO : HE}`, C.ink, 'center', isLatin(option) ? 'ltr' : 'rtl');
    });
    rtl(answered ? '✓ התשובה הנכונה מסומנת' : 'עצרו וחשבו לפני שממשיכים…', width / 2, AREA.y + 228, `600 22px ${HE}`, answered ? C.ok : C.muted, 'center');
  }

  function drawVisual(visual, progress) {
    switch (visual.type) {
      case 'intro':
        rtl('בסוף השיעור תדעו:', width - 60, AREA.y + 4, `600 20px ${HE}`, C.muted);
        ctx.save(); ctx.translate(0, 26); drawList(visual.goals, progress, true, false); ctx.restore();
        break;
      case 'bullets': drawList(visual.lines, progress, false, false); break;
      case 'summary': drawList(visual.lines, progress, false, true); break;
      case 'code': drawCode(visual, progress); break;
      case 'table': drawTable(visual, progress); break;
      case 'tables': {
        const half = (AREA.w - 40) / 2;
        visual.tables.forEach((table, i) => drawTable(table, 1, i === 0 ? width - AREA.x - half : AREA.x, half - 10, false));
        break;
      }
      case 'flow': drawFlow(visual.boxes, progress); break;
      case 'array': drawArray(visual.steps, progress); break;
      case 'terminal': drawTerminal(visual.lines, progress); break;
      case 'quiz': drawQuiz(visual, progress); break;
      default: break;
    }
  }

  function draw(t) {
    const sceneIndex = Math.max(0, timeline.scenes.findLastIndex((scene) => t >= scene.start));
    const scene = lesson.scenes[sceneIndex];
    const timing = timeline.scenes[sceneIndex];
    const local = t - timing.start;
    const progress = Math.min(1, local / timing.duration);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = C.card;
    ctx.fillRect(0, 0, width, 62);
    ctx.fillStyle = C.line;
    ctx.fillRect(0, 62, width, 1);
    box(width - 214, 14, 190, 34, C.primary, null, 9);
    ltr('FocusMind Academy', width - 119, 37, `700 17px ${HE}`, '#fff', 'center');
    rtl(`${lesson.courseTitle} · ${lesson.title}`, width - 230, 38, `500 18px ${HE}`, C.ink);
    rtl(scene.title, width - 40, 104, `700 28px ${HE}`, C.dark);
    drawVisual(scene.visual, progress);
    // Caption ("narration") of the current moment.
    const captionIndex = Math.max(0, timing.captions.findLastIndex((start) => local >= start));
    const caption = scene.captions[captionIndex];
    box(30, 400, width - 60, 82, C.dark, null, 12);
    const captionLines = wrap(caption, width - 110, `500 21px ${HE}`).slice(0, 3);
    const lineHeight = captionLines.length > 2 ? 24 : 28;
    captionLines.forEach((line, i) => rtl(line, width - 52, 446 - ((captionLines.length - 1) * lineHeight) / 2 + i * lineHeight, `500 21px ${HE}`, '#ffffff'));
    // Footer: progress, clock, scene number.
    const done = Math.min(1, t / total);
    ctx.fillStyle = C.line;
    ctx.fillRect(40, 497, width - 80, 6);
    ctx.fillStyle = C.primary;
    ctx.fillRect(width - 40 - (width - 80) * done, 497, (width - 80) * done, 6);
    ltr(`${clock(t)} / ${clock(total)}`, 40, 528, `600 18px ${MONO}`, C.muted);
    rtl(`חלק ${sceneIndex + 1} מתוך ${lesson.scenes.length}`, width - 40, 528, `500 17px ${HE}`, C.muted);
    rtl('שיעור מקורי של FocusMind', width / 2, 528, `400 15px ${HE}`, C.muted, 'center');
  }

  const type = ['video/mp4;codecs=avc1', 'video/mp4'].find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!type) throw new Error('MP4 recording is not supported in this browser.');
  const recorder = new MediaRecorder(canvas.captureStream(fps), { mimeType: type, videoBitsPerSecond: bitrate });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  draw(0);
  const started = performance.now();
  const timer = setInterval(() => draw(Math.min(total, (performance.now() - started) / 1000)), Math.round(1000 / fps));
  recorder.start(1000);
  await new Promise((resolve) => setTimeout(resolve, total * 1000 + 400));
  recorder.stop();
  await stopped;
  clearInterval(timer);
  const blob = new Blob(chunks, { type: 'video/mp4' });
  const duration = await new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => resolve(NaN);
    video.src = URL.createObjectURL(blob);
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return { base64: btoa(binary), duration };
}

function timelineOf(lesson) {
  let start = 0;
  const scenes = lesson.scenes.map((scene) => {
    let offset = 0;
    const captions = scene.captions.map((caption) => { const at = offset; offset += captionSeconds(caption); return at; });
    const entry = { start, duration: offset, captions };
    start += offset;
    return entry;
  });
  return { total: start, scenes };
}

export async function generateAcademyVideos({ force = false, only = null, concurrency = 3, log = console.log } = {}) {
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf-8')) : { videos: [] };
  const byFile = new Map(manifest.videos.map((entry) => [entry.file, entry]));
  const wanted = ACADEMY_LESSONS.filter((lesson) => !only || `${lesson.course}/${lesson.key}` === only || lesson.course === only);
  const todo = wanted.filter((lesson) => {
    const entry = byFile.get(fileNameOf(lesson));
    return force || !entry || entry.version !== ACADEMY_VERSION || !existsSync(path.join(OUT_DIR, entry.file));
  });
  log(`Academy videos: ${wanted.length - todo.length} up to date, ${todo.length} to record.`);
  const writeManifest = async () => {
    manifest.videos = [
      ...manifest.videos.filter((entry) => entry.kind !== 'academy'),
      ...ACADEMY_LESSONS.map((lesson) => byFile.get(fileNameOf(lesson))).filter(Boolean),
    ];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  };
  const queue = [...todo];
  const worker = async () => {
    const browser = await chromium.launch({
      channel: 'msedge',
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent('<html><body style="margin:0"></body></html>');
      while (queue.length) {
        const lesson = queue.shift();
        const timeline = timelineOf(lesson);
        let result = null;
        for (let attempt = 1; attempt <= 3 && !result; attempt += 1) {
          const recorded = await page.evaluate(recordInPage, { lesson, timeline, width: WIDTH, height: HEIGHT, fps: FPS, bitrate: BITRATE });
          if (Number.isFinite(recorded.duration) && recorded.duration >= timeline.total - 2) result = recorded;
          else log(`  ${fileNameOf(lesson)}: recording too short (${recorded.duration} s), retrying (${attempt}/3)`);
        }
        if (!result) throw new Error(`${fileNameOf(lesson)}: could not record a full-length video.`);
        const data = Buffer.from(result.base64, 'base64');
        await writeFile(path.join(OUT_DIR, fileNameOf(lesson)), data);
        byFile.set(fileNameOf(lesson), {
          kind: 'academy',
          course: lesson.course,
          key: lesson.key,
          title: lesson.title,
          file: fileNameOf(lesson),
          durationSeconds: Math.round(result.duration * 100) / 100,
          sizeBytes: data.length,
          sha256: createHash('sha256').update(data).digest('hex'),
          version: ACADEMY_VERSION,
        });
        await writeManifest();
        log(`  recorded ${fileNameOf(lesson)} (${Math.round(result.duration)} s, ${(data.length / 1048576).toFixed(1)} MB)`);
      }
    } finally {
      await browser.close();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  await writeManifest();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const pick = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
  await generateAcademyVideos({ force: args.includes('--force'), only: pick('--only') });
}
