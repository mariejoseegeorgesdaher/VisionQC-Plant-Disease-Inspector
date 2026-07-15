#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const net = require('net');
const path = require('path');

const IS_WINDOWS = process.platform === 'win32';
const DOTNET_CMD = IS_WINDOWS ? 'dotnet.exe' : 'dotnet';
const NPX_CMD = IS_WINDOWS ? 'npx.cmd' : 'npx';
const BACKEND_HTTPS_PORT = 7125;
const WEB_RESET_PORT = 3000;
const useExpoGo = (process.env.EXPO_USE_GO || 'true').toLowerCase() !== 'false';
const ADB_PATH = IS_WINDOWS
  ? 'C:\\Users\\Marie Josee\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe'
  : 'adb';

const backendPath =
  process.env.VISIONQC_BACKEND_PATH ||
  'C:\\Users\\Marie Josee\\Documents\\GitHub\\VisionQC-Backend';
const backendCwd = path.resolve(backendPath);

let isShuttingDown = false;
let backendProcess;
let expoProcess;
let webResetProcess;

function runAdb(args) {
  return spawnSync(ADB_PATH, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

function setupUsbReverse() {
  const start = runAdb(['start-server']);
  if (start.error) {
    console.log('[adb] not available, skipping USB reverse');
    return;
  }

  const devices = runAdb(['devices']);
  if (devices.error) return;
  const hasAuthorizedDevice = (devices.stdout || '')
    .split(/\r?\n/)
    .some((line) => /\sdevice$/.test(line.trim()) && !line.startsWith('List of devices'));

  if (!hasAuthorizedDevice) {
    console.log('[adb] no authorized device, skipping USB reverse');
    return;
  }

  const reverse = runAdb(['reverse', `tcp:${BACKEND_HTTPS_PORT}`, `tcp:${BACKEND_HTTPS_PORT}`]);
  if (reverse.status === 0) {
    console.log(`[adb] reverse enabled: tcp:${BACKEND_HTTPS_PORT} -> tcp:${BACKEND_HTTPS_PORT}`);
  } else {
    console.log('[adb] reverse failed, continuing without it');
  }
}

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(600);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, host);
  });
}

async function findFreePort(start, end) {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const inUse = await isPortInUse(port);
    if (!inUse) return port;
  }
  return start;
}

function startProcess(name, command, args, cwd, extraEnv = {}) {
  const child = IS_WINDOWS
    ? spawn('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], {
        cwd,
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, ...extraEnv },
      })
    : spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, ...extraEnv },
      });

  child.on('exit', (code) => {
    if (isShuttingDown) return;
    console.error(`[${name}] exited with code ${code ?? 'null'}`);
    shutdown(code || 1);
  });

  child.on('error', (error) => {
    if (isShuttingDown) return;
    console.error(`[${name}] failed to start:`, error.message);
    shutdown(1);
  });

  return child;
}

function shutdown(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  if (expoProcess && !expoProcess.killed) expoProcess.kill();
  if (webResetProcess && !webResetProcess.killed) webResetProcess.kill();

  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  setupUsbReverse();

  const backendAlreadyRunning = await isPortInUse(BACKEND_HTTPS_PORT);
  if (backendAlreadyRunning) {
    console.log(`[backend] already running on https://localhost:${BACKEND_HTTPS_PORT}, skipping start`);
  } else {
    console.log(`[backend] starting in ${backendCwd}`);
    backendProcess = startProcess(
      'backend',
      DOTNET_CMD,
      [
        'run',
        '--launch-profile',
        'https',
        '--urls',
        'https://0.0.0.0:7125;https://localhost:7125;http://0.0.0.0:7126;http://localhost:7126',
      ],
      backendCwd,
      {
        ASPNETCORE_URLS:
          'https://0.0.0.0:7125;https://localhost:7125;http://0.0.0.0:7126;http://localhost:7126',
      }
    );
  }

  const webResetAlreadyRunning = await isPortInUse(WEB_RESET_PORT);
  if (webResetAlreadyRunning) {
    console.log(`[reset-web] already running on http://localhost:${WEB_RESET_PORT}, skipping start`);
  } else {
    console.log(`[reset-web] starting on port ${WEB_RESET_PORT}`);
    webResetProcess = startProcess(
      'reset-web',
      NPX_CMD,
      ['expo', 'start', '--web', '--port', String(WEB_RESET_PORT)],
      process.cwd()
    );
  }

  const expoPort = await findFreePort(8081, 8090);
  console.log(`[mobile] starting expo on port ${expoPort}${useExpoGo ? ' (Expo Go)' : ' (Dev Client)'}`);
  const expoArgs = ['expo', 'start', '--host', 'lan', '--port', String(expoPort)];
  if (useExpoGo) expoArgs.splice(2, 0, '--go');
  expoProcess = startProcess(
    'mobile',
    NPX_CMD,
    expoArgs,
    process.cwd()
  );
}

void main();
