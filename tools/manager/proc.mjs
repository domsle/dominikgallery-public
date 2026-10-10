// Runs `npm run dev` (Astro) and `npm run deploy` (git push) in the project root.
import { spawn } from 'node:child_process';
import { ROOT } from './store.mjs';

let devProc = null;
const devLog = [];
const pushLine = (s) => {
  devLog.push(...String(s).split('\n').filter(Boolean));
  while (devLog.length > 200) devLog.shift();
};

export function startDev() {
  if (devProc) return;
  devLog.length = 0;
  devProc = spawn('npm', ['run', 'dev'], { cwd: ROOT, shell: true });
  devProc.stdout.on('data', pushLine);
  devProc.stderr.on('data', pushLine);
  devProc.on('exit', () => {
    devProc = null;
  });
}

export function stopDev() {
  if (!devProc) return;
  devProc.kill();
  devProc = null;
}

export function devStatus() {
  return { running: Boolean(devProc), url: 'http://localhost:4321', log: devLog.slice(-40) };
}

/** Runs a one-shot command in ROOT and resolves with its combined output. Never rejects on
 * a non-zero exit — callers check `code`, since a failed git push still has output worth showing. */
function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, shell: true });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('exit', (code) => resolve({ code, output: out.trim() }));
  });
}

/** Parses `git status --porcelain` lines into {x: index-status, y: worktree-status, path}. */
function parsePorcelain(output) {
  return output
    ? output.split('\n').map((line) => ({ x: line[0], y: line[1], path: line.slice(3) }))
    : [];
}

export async function gitStatus() {
  const [branch, porcelain, log] = await Promise.all([
    run('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    run('git', ['status', '--porcelain']),
    run('git', ['log', '--oneline', '-20', '@{u}..']),
  ]);
  const entries = parsePorcelain(porcelain.output);
  const staged = entries.filter((e) => e.x !== ' ' && e.x !== '?');
  const unstaged = entries.filter((e) => e.y !== ' ');
  return {
    branch: branch.output,
    staged,
    unstaged,
    ahead: log.code === 0 ? (log.output ? log.output.split('\n') : []) : null, // null: no upstream tracking
  };
}

/** Unstaged changes (tracked edits + untracked files), for the "stage changes" review step. */
export async function gitDiffPreview() {
  const status = await gitStatus();
  const trackedPaths = status.unstaged.filter((e) => e.y !== '?').map((e) => e.path);
  const diff = trackedPaths.length ? await run('git', ['diff', '--', ...trackedPaths]) : { output: '' };
  return { ...status, diffText: diff.output };
}

export async function gitAdd() {
  return run('git', ['add', '-A']);
}

export async function deploy() {
  return run('npm', ['run', 'deploy']);
}
