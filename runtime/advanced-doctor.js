#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const home = os.homedir();
const appRoot = path.join(home, "Library/Application Support/BlackMambaInput");
const debugPort = Number(process.env.DEBUG_PORT || 9224);
const root = path.resolve(__dirname, "..");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return null;
  }
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    return String(error.stdout || error.stderr || error.message || "").trim();
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

function launchctl(label) {
  const out = run("launchctl", ["print", `gui/${process.getuid()}/${label}`]);
  return {
    loaded: !/Could not find service|Bad request|failed/i.test(out),
    running: /state = running/.test(out),
    pid: out.match(/\bpid = (\d+)/)?.[1] || null,
    lastExit: out.match(/last exit code = ([^\n]+)/)?.[1]?.trim() || null
  };
}

function diskLine(target) {
  return run("df", ["-h", target]).split(/\n/).slice(-1)[0] || "";
}

function size(target) {
  return run("du", ["-sh", target]).split(/\s+/)[0] || "n/a";
}

function status(label, pass, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
}

function psRows(pattern) {
  const out = run("ps", ["-axo", "pid,ppid,rss,command"]);
  return out.split(/\n/)
    .filter((line) => pattern.test(line) && !/advanced-doctor\.js/.test(line))
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
      return match ? {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        rssKb: Number(match[3]),
        command: match[4]
      } : null;
    })
    .filter(Boolean);
}

function formatMb(kb) {
  return `${Math.round(kb / 1024)}MB`;
}

async function main() {
  console.log("BlackMamba Advanced Doctor");
  console.log(`Root: ${root}`);
  console.log("");

  const liveAgent = launchctl("com.blackmamba.live-monitor");
  const hidAgent = launchctl("com.blackmamba.hid-live-source");
  const xcloudAgent = launchctl("com.blackmamba.xcloud-bridge");
  status("LaunchAgent live-monitor", liveAgent.running, `pid=${liveAgent.pid || "n/a"} lastExit=${liveAgent.lastExit || "n/a"}`);
  status("LaunchAgent hid-live-source", hidAgent.running, `pid=${hidAgent.pid || "n/a"} lastExit=${hidAgent.lastExit || "n/a"}`);
  status("LaunchAgent xcloud-bridge", xcloudAgent.running, `pid=${xcloudAgent.pid || "n/a"} lastExit=${xcloudAgent.lastExit || "n/a"}`);

  const liveStatus = readJson(path.join(appRoot, "reports/live-status.json"));
  status("Live status file", Boolean(liveStatus), liveStatus?.updatedAt || "missing");
  if (liveStatus) {
    status("Browser polling", liveStatus.browserPolling === "PASS", `staleMs=${liveStatus.staleMs}`);
    console.log(`frames=${liveStatus.frameCount} clients=${liveStatus.clients}`);
  }

  const liveRows = psRows(/live-monitor\.js/);
  const liveRssKb = liveRows.reduce((sum, row) => sum + row.rssKb, 0);
  status("Live monitor memory", liveRssKb > 0 && liveRssKb < 220 * 1024, liveRssKb ? `${formatMb(liveRssKb)} rss` : "not running");

  const hidRows = psRows(/hid-live-source-agent\.sh|[.]tmp-runtime-test\/hid-live-source/);
  const appHidRows = hidRows.filter((row) => /Application Support\/BlackMambaInput/.test(row.command));
  const repoHidRows = hidRows.filter((row) => /Documents\/Codex\/2026-04-28\/acabo-de-conectar-un-control-ruby/.test(row.command));
  status("HID source duplicates", repoHidRows.length === 0 || appHidRows.length === 0, `app=${appHidRows.length} repo=${repoHidRows.length}`);
  for (const row of hidRows.slice(0, 8)) {
    console.log(`  hid pid=${row.pid} ppid=${row.ppid} rss=${formatMb(row.rssKb)} ${row.command}`);
  }

  const xcloudStatus = readJson(path.join(appRoot, "reports/xcloud-bridge-status.json"));
  status("xCloud bridge status file", Boolean(xcloudStatus), xcloudStatus?.state || "missing");
  if (xcloudStatus) {
    const cdpExpectedIdle = xcloudStatus.autoOpenXcloud === false && xcloudStatus.state === "idle_no_cdp";
    status("xCloud bridge CDP", xcloudStatus.cdp === "available" || cdpExpectedIdle, `state=${xcloudStatus.state} playTarget=${xcloudStatus.playTarget || "n/a"}`);
    console.log(`autoOpenXcloud=${xcloudStatus.autoOpenXcloud} targets=${xcloudStatus.targets ?? "n/a"}`);
    if (cdpExpectedIdle) {
      console.log("  nota: CDP apagado es esperado en modo no intrusivo; corre ./bmctl wake para jugar.");
    }
  }

  const version = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
  status("Chrome CDP", !version.error, version.error || `port=${debugPort}`);
  const tabs = await fetchJson(`http://127.0.0.1:${debugPort}/json`);
  if (!tabs.error && Array.isArray(tabs)) {
    const playTabs = tabs.filter((tab) => tab.type === "page" && /xbox\.com/.test(tab.url || ""));
    status("Xbox tabs", playTabs.length > 0, `${playTabs.length} tab(s)`);
    for (const [index, tab] of playTabs.entries()) {
      console.log(`  ${index}: ${tab.title} ${tab.url}`);
    }
  }

  const verify = run(process.execPath, [path.join(root, "runtime/inject-bridge-cdp.js"), String(debugPort), "--verify"]);
  const parsedVerify = verify.match(/\{[\s\S]*\}/);
  const verifyJson = parsedVerify ? readJsonFromString(parsedVerify[0]) : null;
  status("Bridge installed", verifyJson?.installed === true, `version=${verifyJson?.version || "n/a"}`);
  status("Virtual pad", (verifyJson?.pads || []).length > 0, `pads=${verifyJson?.pads?.length || 0}`);
  if (verifyJson?.debug) {
    status("Bridge websocket", verifyJson.debug.connected === true, `hasFrame=${verifyJson.debug.hasFrame} lastError=${verifyJson.debug.lastError || "none"}`);
  }

  console.log("");
  console.log("Storage");
  console.log(`disk: ${diskLine(root)}`);
  console.log(`logs: ${size(path.join(appRoot, "logs"))}`);
  console.log(`cdp profile: ${size("/tmp/blackmamba-xcloud-cdp-profile")}`);
}

function readJsonFromString(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
