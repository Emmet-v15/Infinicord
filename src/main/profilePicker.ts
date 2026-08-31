/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Profile picker: when enabled, the plain launcher (no --profile) shows a
 * Steam-style "Who's chatting?" window. "Default" continues in this process;
 * a numbered profile is spawned detached via --profile N and this launcher
 * exits, so no profile's single-instance lock is held by the picker.
 */

import { app } from "electron";
import { BrowserWindow } from "electron/main";
import { join } from "path";
import { SplashProps } from "shared/browserWinProperties";
import { STATIC_DIR } from "shared/paths";

import { CommandLine } from "./cli";
import { createWindows } from "./mainWindow";
import { Settings, State } from "./settings";
import { makeLinksOpenExternally } from "./utils/makeLinksOpenExternally";
import { getSessionsState, launchSession, SESSIONS_MAX, setSessionCount } from "./utils/profiles";
import { loadView } from "./vesktopStatic";

export function shouldShowProfilePicker() {
    // explicit profile or autostart/boot launches skip the picker entirely
    if (CommandLine.values.profile || CommandLine.values["start-minimized"]) return false;

    const sessions = getSessionsState();
    // nothing to pick until at least one profile shortcut exists
    return sessions.supported && sessions.shortcuts.length > 0 && !!Settings.store.askProfileOnLaunch;
}

// tile 96px + gap 22px on an 80px gutter; tiles wrap beyond 1280px width
const TILE_UNIT = 118;
const GUTTER = 90;
const BASE_HEIGHT = 250;
const ROW_HEIGHT = 146;

export function createProfilePicker() {
    const { shortcuts } = getSessionsState();

    const tiles = shortcuts.length + 2; // default + add-new
    const width = Math.min(1280, Math.max(560, tiles * TILE_UNIT + GUTTER));
    const perRow = Math.floor((width - GUTTER) / TILE_UNIT);
    const rows = Math.ceil(tiles / perRow);

    const win = new BrowserWindow({
        ...SplashProps,
        transparent: false,
        frame: false,
        autoHideMenuBar: true,
        ...(process.platform === "win32"
            ? { icon: join(STATIC_DIR, "icon.ico") }
            : process.platform === "linux"
              ? { icon: join(STATIC_DIR, "icon.png") }
              : {}),
        width,
        height: BASE_HEIGHT + rows * ROW_HEIGHT
    });

    makeLinksOpenExternally(win);

    const params = new URLSearchParams({
        profiles: shortcuts.join(","),
        last: String(State.store.lastProfile ?? "default"),
        canAdd: shortcuts.length < SESSIONS_MAX ? "1" : "0"
    });
    loadView(win, "profile-picker.html", params);

    // only the first choice counts: the listener is async, so a slow add-new
    // must not let later messages (or a second click) interleave
    let settled = false;
    win.webContents.addListener("console-message", (_e, _l, msg) => {
        if (settled) return;
        if (msg === "cancel") return app.exit();

        if (msg === "addnew") {
            settled = true;
            const next = shortcuts.length ? Math.min(Math.max(...shortcuts) + 1, SESSIONS_MAX) : 1;
            State.store.lastProfile = next;
            launchSession(next);
            // reconcile Start Menu shortcuts before exiting — exiting earlier
            // kills the spawn before PowerShell ever starts
            setSessionCount(next)
                .catch(e => console.error("Failed to create profile shortcuts:", e))
                .finally(() => app.exit());
            return;
        }

        if (!msg.startsWith("picked:")) return;
        const choice = msg.slice("picked:".length);

        if (choice === "default") {
            settled = true;
            State.store.lastProfile = "default";
            win.close();
            createWindows();
            return;
        }

        const profile = Number.parseInt(choice, 10);
        if (!Number.isInteger(profile)) return;

        settled = true;
        State.store.lastProfile = profile;
        launchSession(profile);
        app.exit();
    });
}
