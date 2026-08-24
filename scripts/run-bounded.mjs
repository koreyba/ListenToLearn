#!/usr/bin/env node

import { spawn } from "node:child_process";

function fail(message) {
  console.error(`run-bounded: ${message}`);
  process.exit(64);
}

function parseDuration(value, option, allowZero = false) {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(String(value || ""));
  if (!match) fail(`${option} must use ms, s, m, or h (received ${value || "nothing"})`);

  const multipliers = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 };
  const milliseconds = Number(match[1]) * multipliers[match[2]];
  if (!Number.isFinite(milliseconds) || milliseconds < 0 || (!allowZero && milliseconds === 0)) {
    fail(`${option} must be ${allowZero ? "non-negative" : "positive"}`);
  }
  return milliseconds;
}

const separator = process.argv.indexOf("--");
if (separator === -1 || separator === process.argv.length - 1) {
  fail("usage: run-bounded.mjs --timeout <duration> --kill-after <duration> -- <command> [args...]");
}

const options = process.argv.slice(2, separator);
let timeoutValue = "";
let killAfterValue = "";
for (let index = 0; index < options.length; index += 2) {
  const option = options[index];
  const value = options[index + 1];
  if (option === "--timeout") timeoutValue = value;
  else if (option === "--kill-after") killAfterValue = value;
  else fail(`unknown option ${option || "nothing"}`);
}

const timeoutMs = parseDuration(timeoutValue, "--timeout");
const killAfterMs = parseDuration(killAfterValue, "--kill-after", true);
const [command, ...commandArgs] = process.argv.slice(separator + 1);
const usesProcessGroup = process.platform !== "win32";
const child = spawn(command, commandArgs, {
  detached: usesProcessGroup,
  stdio: "inherit",
});

let timedOut = false;
let spawnFailed = false;
let killTimer;

function signalChild(signal) {
  if (!child.pid) return;
  try {
    if (usesProcessGroup) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

const timeoutTimer = setTimeout(() => {
  timedOut = true;
  console.error(`Command timed out after ${timeoutValue}.`);
  signalChild("SIGTERM");
  killTimer = setTimeout(() => signalChild("SIGKILL"), killAfterMs);
}, timeoutMs);

child.once("error", error => {
  spawnFailed = true;
  console.error(`run-bounded: could not start ${command}: ${error.message}`);
});

child.once("close", (code, signal) => {
  clearTimeout(timeoutTimer);
  clearTimeout(killTimer);
  if (timedOut) process.exitCode = 124;
  else if (spawnFailed) process.exitCode = 127;
  else if (Number.isInteger(code)) process.exitCode = code;
  else process.exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
});
