/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater, UpdateInfo } from "electron-updater";
import { dirname, join } from "path";
import { IpcEvents, UpdaterIpcEvents } from "shared/IpcEvents";
import { STATIC_DIR } from "shared/paths";
import { Millis } from "shared/utils/millis";

import { DATA_DIR } from "./constants";
import { State } from "./settings";
import { setSplashIndeterminate, updateSplashMessage, updateSplashProgress } from "./splash";
import { handle } from "./utils/ipcWrappers";
import { makeLinksOpenExternally } from "./utils/makeLinksOpenExternally";
import { loadView } from "./vesktopStatic";

let updaterWindow: BrowserWindow | null = null;

autoUpdater.on("update-downloaded", () => {
    updateSplashMessage("Restarting to apply update...");
    setTimeout(() => autoUpdater.quitAndInstall(), 100);
});
autoUpdater.on("download-progress", p => {
    updaterWindow?.webContents.send(UpdaterIpcEvents.DOWNLOAD_PROGRESS, p.percent);
    updateSplashProgress(p.percent);
    if (p.percent < 100) updateSplashMessage(`Downloading update... ${Math.round(p.percent)}%`);
});
autoUpdater.on("error", err => updaterWindow?.webContents.send(UpdaterIpcEvents.ERROR, err.message));

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.fullChangelog = true;

/**
 * One lazy check per process (boot splash and settings flag share it), plus
 * a disk stamp shared by all profiles: sibling instances started within
 * CHECK_CACHE_TTL of a confirmed-current check skip the network fetch — a
 * multi-profile boot costs one latest.yml handshake instead of one per
 * process. Only "no update available" outcomes are stamped; while an update
 * exists every instance must still fetch so it can download it. Worst case
 * the stamp delays update pickup by its TTL.
 */
const CHECK_CACHE_FILE = join(DATA_DIR, "cache", "update-check.json");
const CHECK_CACHE_TTL = 10 * Millis.MINUTE;

type UpdateCheckResult = Awaited<ReturnType<typeof autoUpdater.checkForUpdates>>;

function readCheckCache(): string | null {
    try {
        const stamp = JSON.parse(readFileSync(CHECK_CACHE_FILE, "utf8")) as {
            checkedAt: number;
            latestVersion: string;
        };
        if (!stamp?.checkedAt || !stamp.latestVersion) return null;
        if (Date.now() - stamp.checkedAt > CHECK_CACHE_TTL) return null;
        return stamp.latestVersion;
    } catch {
        return null;
    }
}

let updateCheckPromise: Promise<UpdateCheckResult | null> | null = null;

function startUpdateCheck(): Promise<UpdateCheckResult | null> {
    // a sibling instance confirmed we're current recently — no fetch needed
    if (readCheckCache() === app.getVersion()) return Promise.resolve(null);

    updateCheckPromise ??= autoUpdater
        .checkForUpdates()
        .then(res => {
            if (res && !res.isUpdateAvailable) {
                try {
                    mkdirSync(dirname(CHECK_CACHE_FILE), { recursive: true });
                    writeFileSync(
                        CHECK_CACHE_FILE,
                        JSON.stringify({ checkedAt: Date.now(), latestVersion: app.getVersion() })
                    );
                } catch {
                    // a missing stamp just means the next instance refetches
                }
            }
            return res;
        })
        .catch(e => {
            // a failed check must not poison later ones in this process
            updateCheckPromise = null;
            throw e;
        });
    return updateCheckPromise;
}

handle(IpcEvents.UPDATER_IS_OUTDATED, () =>
    startUpdateCheck()
        .then(res => Boolean(res?.isUpdateAvailable))
        .catch(() => false)
);
handle(IpcEvents.UPDATER_OPEN, async () => {
    const res = await autoUpdater.checkForUpdates();
    if (res?.isUpdateAvailable && res.updateInfo) openUpdater(res.updateInfo);
});

/**
 * Launch-time update check, Discord style: progress lives on the splash
 * window and the app restarts itself once the update is downloaded. The
 * updater window stays available via the settings UI only.
 */
export function startBootUpdateCheck() {
    setSplashIndeterminate(true);
    updateSplashMessage("Checking for updates...");

    // shares the in-flight process check (or skips it via the cross-profile stamp)
    startUpdateCheck()
        .then(res => {
            if (!res?.isUpdateAvailable) {
                setSplashIndeterminate(false);
                return;
            }
            const update = res.updateInfo;
            if (State.store.updater?.ignoredVersion === update.version) {
                setSplashIndeterminate(false);
                return;
            }
            if ((State.store.updater?.snoozeUntil ?? 0) > Date.now()) {
                setSplashIndeterminate(false);
                return;
            }

            autoUpdater.downloadUpdate().catch(e => {
                setSplashIndeterminate(false);
                updateSplashMessage("Update download failed");
                console.error("[Infinicord] Update download failed:", e);
            });
        })
        .catch(e => {
            setSplashIndeterminate(false);
            console.error("[Infinicord] Update check failed:", e);
        });
}

function openUpdater(update: UpdateInfo) {
    updaterWindow = new BrowserWindow({
        title: "Infinicord Updater",
        autoHideMenuBar: true,
        ...(process.platform === "win32"
            ? { icon: join(STATIC_DIR, "icon.ico") }
            : process.platform === "linux"
              ? { icon: join(STATIC_DIR, "icon.png") }
              : {}),
        webPreferences: {
            preload: join(__dirname, "updaterPreload.js")
        },
        minHeight: 400,
        minWidth: 750
    });
    makeLinksOpenExternally(updaterWindow);

    handle(UpdaterIpcEvents.GET_DATA, () => ({ update, version: app.getVersion() }));
    handle(UpdaterIpcEvents.INSTALL, async () => {
        await autoUpdater.downloadUpdate();
    });
    handle(UpdaterIpcEvents.SNOOZE_UPDATE, () => {
        console.error("[UPD-DEBUG] SNOOZE hit");
        State.store.updater ??= {};
        State.store.updater.snoozeUntil = Date.now() + 1 * Millis.DAY;
        updaterWindow?.close();
    });
    handle(UpdaterIpcEvents.IGNORE_UPDATE, () => {
        State.store.updater ??= {};
        State.store.updater.ignoredVersion = update.version;
        updaterWindow?.close();
    });

    updaterWindow.on("closed", () => {
        ipcMain.removeHandler(UpdaterIpcEvents.GET_DATA);
        ipcMain.removeHandler(UpdaterIpcEvents.INSTALL);
        ipcMain.removeHandler(UpdaterIpcEvents.SNOOZE_UPDATE);
        ipcMain.removeHandler(UpdaterIpcEvents.IGNORE_UPDATE);
        updaterWindow = null;
    });

    loadView(updaterWindow, "updater/index.html");
}
