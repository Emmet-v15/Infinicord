/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Profile picker: when enabled, the plain launcher (no --profile) shows a
 * Steam-style "Who's chatting?" window after the loading splash. "Default"
 * continues in this process; a numbered profile is spawned detached via
 * --profile N and this launcher exits, so no profile's single-instance lock
 * is held by the picker.
 *
 * Profiles are discovered from existing data dirs, NOT Start Menu
 * shortcuts — INFINICORD.lnk alone is the only entry point.
 */

import { app } from "electron";
import { BrowserWindow } from "electron/main";
import { join } from "path";
import { SplashProps } from "shared/browserWinProperties";
import { STATIC_DIR } from "shared/paths";

import { CommandLine } from "./cli";
import { createWindows } from "./mainWindow";
import { Settings, State } from "./settings";
import { getSplash } from "./splash";
import { makeLinksOpenExternally } from "./utils/makeLinksOpenExternally";
import { getKnownProfiles, launchSession, SESSIONS_MAX } from "./utils/profiles";
import { loadView } from "./vesktopStatic";

export function shouldShowProfilePicker() {
    // explicit profile or autostart/boot launches skip the picker entirely
    if (CommandLine.values.profile || CommandLine.values["start-minimized"]) return false;

    // nothing to pick until at least one profile exists on disk
    return process.platform === "win32" && getKnownProfiles().length > 0 && !!Settings.store.askProfileOnLaunch;
}

// tile 96px + gap 22px on an 80px gutter; tiles wrap beyond 1280px width
const TILE_UNIT = 118;
const GUTTER = 90;
const BASE_HEIGHT = 250;
const ROW_HEIGHT = 146;

export function createProfilePicker() {
    const profiles = getKnownProfiles();

    const tiles = profiles.length + 2; // default + add-new
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
        profiles: profiles.join(","),
        last: String(State.store.lastProfile ?? "default"),
        canAdd: profiles.length < SESSIONS_MAX ? "1" : "0"
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
            // first free number — fills gaps if a profile dir was removed
            const next =
                Array.from({ length: SESSIONS_MAX }, (_, i) => i + 1).find(n => !profiles.includes(n)) ?? SESSIONS_MAX;
            State.store.lastProfile = next;
            launchSession(next);
            app.exit();
            return;
        }

        if (!msg.startsWith("picked:")) return;
        const choice = msg.slice("picked:".length);

        if (choice === "default") {
            settled = true;
            State.store.lastProfile = "default";
            win.close();
            // the pre-picker splash is done; createWindows shows a fresh one
            getSplash()?.destroy();
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
