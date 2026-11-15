// Removes everything the run created: the dedicated e2e database and the
// temporary video folder. Refuses to drop any other database.

import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_DATABASE, E2E_VIDEO_DIR } from '../playwright.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..', 'backend');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

const DROP_SCRIPT = `
import os
from pymongo import MongoClient
from app.core.config import settings
name = os.environ["MONGO_DB_NAME"]
assert name == "${E2E_DATABASE}", name
client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
client.drop_database(name)
client.close()
`;

export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DATA === '1') return;
  execFileSync(python, ['-c', DROP_SCRIPT], {
    cwd: backendDir,
    env: { ...process.env, MONGO_DB_NAME: E2E_DATABASE },
    stdio: 'inherit',
  });
  await rm(E2E_VIDEO_DIR, { recursive: true, force: true });
}
