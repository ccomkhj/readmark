/**
 * Desktop shell (Electron main process). Runs the same Hono app as
 * src/server/main.ts, but in-process: requests to readmark://app/ are handed
 * straight to `app.fetch`, so no HTTP port is opened. The scheme gives the
 * window a stable origin, which keeps localStorage (reader prefs) across
 * launches.
 */
import { app as electronApp, BrowserWindow, protocol, shell } from "electron";
import { createApp } from "../server/app.ts";
import { resolveDataDir } from "../server/data-dir.ts";
import { clientDir, serveClient } from "../server/serve-client.ts";

const SCHEME = "readmark";
const ORIGIN = `${SCHEME}://app`;

protocol.registerSchemesAsPrivileged([
  // standard: relative URLs resolve; secure + supportFetchAPI: fetch and
  // module workers (PDF.js) work; stream: large PDF responses stream.
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!electronApp.requestSingleInstanceLock()) {
  electronApp.quit();
} else {
  electronApp.whenReady().then(start);
}

function start(): void {
  const server = createApp({ dataDir: resolveDataDir() });
  serveClient(server, clientDir(electronApp.getAppPath()));
  protocol.handle(SCHEME, (request) => server.fetch(request));
  electronApp.on("will-quit", () => server.close());

  // macOS: closing the last window keeps the app alive; the Dock icon reopens it.
  electronApp.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
  electronApp.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return openWindow();
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  openWindow();
}

function openWindow(): void {
  const win = new BrowserWindow({ width: 1280, height: 860, title: "Readmark" });
  // Web links leaving the app open in the default browser, never inside the shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openIfWeb(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${ORIGIN}/`)) return;
    event.preventDefault();
    openIfWeb(url);
  });
  void win.loadURL(`${ORIGIN}/`);
}

function openIfWeb(url: string): void {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url);
}
