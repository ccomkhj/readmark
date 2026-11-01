import { homedir } from "node:os";
import { join } from "node:path";

/** Environment variable that overrides the data directory (tests use a temp dir). */
export const DATA_DIR_ENV = "READMARK_DATA_DIR";

const APP_NAME = "readmark";

/** The data dir: `$READMARK_DATA_DIR`, else the per-user app data dir for this OS. */
export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env[DATA_DIR_ENV];
  if (override) return override;
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", APP_NAME);
    case "win32":
      return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), APP_NAME);
    default:
      return join(env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), APP_NAME);
  }
}
