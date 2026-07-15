import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const FRONTEND_DIR = process.cwd();
const DEFAULT_BACKEND_DIR = path.resolve(
  FRONTEND_DIR,
  "..",
  "..",
  "GitHub",
  "VisionQC-Backend",
);
const BACKEND_DIR = process.env.BACKEND_DIR || DEFAULT_BACKEND_DIR;
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 7125);
const BACKEND_LAUNCH_PROFILE = process.env.BACKEND_LAUNCH_PROFILE || "https";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "127.0.0.1";
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function backendProjectExists(backendDir) {
  return fileExists(path.join(backendDir, "fyp.csproj"));
}

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

function spawnCommand(command, args, cwd) {
  const isWindowsCmd =
    process.platform === "win32" &&
    (command.toLowerCase().endsWith(".cmd") ||
      command.toLowerCase().endsWith(".bat"));

  if (isWindowsCmd) {
    const comspec = process.env.ComSpec || "cmd.exe";
    const fullCommand = [command, ...args].join(" ");
    return spawn(comspec, ["/d", "/s", "/c", fullCommand], {
      cwd,
      stdio: "inherit",
    });
  }

  return spawn(command, args, {
    cwd,
    stdio: "inherit",
  });
}

function readJsonUrl(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.setTimeout(1200, () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
  });
}

async function waitForPort(port, host, timeoutMs = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port, host)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
}

async function checkOllamaModel() {
  const payload = await readJsonUrl(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`);
  const models = Array.isArray(payload?.models) ? payload.models : [];

  return models.some((model) => {
    const name = typeof model?.name === "string" ? model.name : "";
    return name === OLLAMA_MODEL || name.startsWith(`${OLLAMA_MODEL}:`);
  });
}

async function ensureOllamaReady() {
  let ollamaProcess = null;
  let ollamaRunning = await isPortOpen(OLLAMA_PORT, OLLAMA_HOST);

  if (!ollamaRunning) {
    console.log(`[dev] Starting Ollama on ${OLLAMA_HOST}:${OLLAMA_PORT}...`);
    ollamaProcess = spawnCommand("ollama", ["serve"], FRONTEND_DIR);
    ollamaRunning = await waitForPort(OLLAMA_PORT, OLLAMA_HOST);
  }

  if (!ollamaRunning) {
    console.warn(
      `[dev] Ollama is not reachable on ${OLLAMA_HOST}:${OLLAMA_PORT}. More Info chat may be unavailable.`,
    );
    console.warn(`[dev] Start Ollama manually, then run: ollama pull ${OLLAMA_MODEL}`);
    return ollamaProcess;
  }

  try {
    const hasModel = await checkOllamaModel();
    if (hasModel) {
      console.log(`[dev] Ollama ready with model "${OLLAMA_MODEL}".`);
    } else {
      console.warn(`[dev] Ollama is running, but model "${OLLAMA_MODEL}" is not installed.`);
      console.warn(`[dev] Install it with: ollama pull ${OLLAMA_MODEL}`);
    }
  } catch (error) {
    console.warn(`[dev] Ollama is running, but model status could not be checked: ${error.message}`);
  }

  return ollamaProcess;
}

function killProcess(child) {
  if (!child || child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // no-op
  }
}

async function main() {
  let backendProcess = null;
  let ollamaProcess = null;
  let webProcess = null;
  let shuttingDown = false;

  const cleanupAndExit = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    killProcess(webProcess);
    killProcess(backendProcess);
    killProcess(ollamaProcess);
    process.exit(code);
  };

  process.on("SIGINT", () => cleanupAndExit(0));
  process.on("SIGTERM", () => cleanupAndExit(0));

  const backendRunning = await isPortOpen(BACKEND_PORT);
  if (backendRunning) {
    console.log(
      `[dev] Backend already running on port ${BACKEND_PORT}. Starting web only.`,
    );
  } else if (backendProjectExists(BACKEND_DIR)) {
    console.log(
      `[dev] Starting backend from ${BACKEND_DIR} on profile "${BACKEND_LAUNCH_PROFILE}"...`,
    );
    const dotnetCommand = process.platform === "win32" ? "dotnet.exe" : "dotnet";
    backendProcess = spawnCommand(
      dotnetCommand,
      ["run", "--launch-profile", BACKEND_LAUNCH_PROFILE],
      BACKEND_DIR,
    );
    backendProcess.on("exit", (code) => {
      if (!shuttingDown && code && code !== 0) {
        console.error(`[dev] Backend exited with code ${code}.`);
      }
    });
  } else {
    console.warn(
      `[dev] Backend not started: fyp.csproj not found at ${BACKEND_DIR}`,
    );
    console.warn(
      `[dev] Set BACKEND_DIR to your backend path if it differs on this machine.`,
    );
  }

  ollamaProcess = await ensureOllamaReady();

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  webProcess = spawnCommand(npmCommand, ["run", "dev:web"], FRONTEND_DIR);

  webProcess.on("exit", (code) => {
    cleanupAndExit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[dev] Failed to start dev launcher:", error);
  process.exit(1);
});
