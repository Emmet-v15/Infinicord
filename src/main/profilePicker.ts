/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Profile picker: when enabled, the plain launcher (no --profile) shows a
 * Steam-style "Who's chatting?" window immediately as the app's first
 * window — no splash before it. "Default" continues in this process; a
 * numbered profile is spawned detached via --profile N and this launcher
 * exits, so no profile's single-instance lock is held by the picker.
 *
 * Profiles are discovered from existing data dirs, NOT Start Menu
 * shortcuts — INFINICORD.lnk alone is the only entry point.
 */

import { app, nativeTheme } from "electron";
import { BrowserWindow } from "electron/main";
import { join } from "path";
import { SplashProps } from "shared/browserWinProperties";
import { STATIC_DIR } from "shared/paths";

import { CommandLine } from "./cli";
import { createWindows } from "./mainWindow";
import { Settings, State } from "./settings";
import { startBootUpdateCheck } from "./updater";
import { makeLinksOpenExternally } from "./utils/makeLinksOpenExternally";
import { deleteProfile, getKnownProfiles, launchSession, SESSIONS_MAX } from "./utils/profiles";
import { loadView } from "./vesktopStatic";

export function shouldShowProfilePicker() {
    // explicit profile or autostart/boot launches skip the picker entirely
    if (CommandLine.values.profile || CommandLine.values["start-minimized"]) return false;

    // default ON: with no profiles yet the picker still offers Default and
    // "Add profile", which is how new users create their first profile
    return process.platform === "win32" && (Settings.store.askProfileOnLaunch ?? true);
}

// tile 96px + gap 22px on an 80px gutter; tiles wrap beyond 1280px width
const TILE_UNIT = 118;
const GUTTER = 90;
const BASE_HEIGHT = 250;
const ROW_HEIGHT = 146;

/** Fresh picker state — profiles come from disk on every (re)load. */
function pickerParams() {
    const profiles = getKnownProfiles();
    return new URLSearchParams({
        profiles: profiles.join(","),
        last: String(State.store.lastProfile ?? "default"),
        canAdd: profiles.length < SESSIONS_MAX ? "1" : "0"
    });
}

export function createProfilePicker() {
    const profiles = getKnownProfiles();

    const tiles = profiles.length + 2; // default + add-new
    const width = Math.min(1280, Math.max(560, tiles * TILE_UNIT + GUTTER));
    const perRow = Math.floor((width - GUTTER) / TILE_UNIT);
    const rows = Math.ceil(tiles / perRow);

    const win = new BrowserWindow({
        ...SplashProps,
        transparent: false,
        // match the view's light-dark --bg so the first frame never flashes
        // white while the picker HTML paints
        backgroundColor: nativeTheme.shouldUseDarkColors ? "#313338" : "#ffffff",
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

    loadView(win, "profile-picker.html", pickerParams());

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

        if (msg.startsWith("delete:")) {
            const profile = Number.parseInt(msg.slice("delete:".length), 10);
            if (!Number.isInteger(profile)) return;

            deleteProfile(profile).then(res => {
                if (!res.ok) {
                    // the picker has no preload, so results ride back in via
                    // executeJavaScript; the modal shows the error
                    win.webContents
                        .executeJavaScript(`window.__deleteResult && window.__deleteResult(${JSON.stringify(res)})`)
                        .catch(() => {});
                    return;
                }
                if (State.store.lastProfile === profile) State.store.lastProfile = "default";
                // fresh page: tiles are recomputed from what is now on disk
                loadView(win, "profile-picker.html", pickerParams());
            });
            return;
        }

        if (!msg.startsWith("picked:")) return;
        const choice = msg.slice("picked:".length);

        if (choice === "default") {
            settled = true;
            State.store.lastProfile = "default";
            // this process becomes the Default instance: its splash owns the
            // update check from here on. createWindows() constructs the
            // splash synchronously before its first await, so closing the
            // picker afterwards never trips window-all-closed → quit
            startBootUpdateCheck();
            createWindows();
            win.close();
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
