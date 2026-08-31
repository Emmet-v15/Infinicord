/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Multi-session management.
 *
 * A "session" is one named profile (--profile N). This module reconciles the
 * Start Menu with the desired session count: "Infinicord 1.lnk" …
 * "Infinicord N.lnk", each launching its own isolated instance, and can
 * spawn sessions directly. Non-Windows builds report supported:false.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";

export const SESSIONS_MAX = 9;

const SHORTCUT_PATTERN = /^Infinicord (\d+)\.lnk$/;

function isSupported() {
    return process.platform === "win32" && !!process.env.APPDATA;
}

function programsDir() {
    return join(process.env.APPDATA!, "Microsoft", "Windows", "Start Menu", "Programs");
}

function shortcutPath(n: number) {
    return join(programsDir(), `Infinicord ${n}.lnk`);
}

function existingShortcutNumbers(): number[] {
    const dir = programsDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .map(name => SHORTCUT_PATTERN.exec(name)?.[1])
        .filter((n): n is string => !!n)
        .map(Number);
}

function escapePsString(value: string) {
    return `'${value.replace(/'/g, "''")}'`;
}

function runPowerShell(script: string): Promise<void> {
    // lazy import keeps this module cheap to load everywhere else
    const { execFile } = require("node:child_process") as typeof import("node:child_process");
    return new Promise((resolve, reject) => {
        execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], err =>
            err ? reject(err) : resolve()
        );
    });
}

async function createShortcut(n: number) {
    const exe = process.execPath;
    const args = [...launchArgs(n)];
    const dir = programsDir();
    mkdirSync(dir, { recursive: true });
    const script = [
        `$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${escapePsString(shortcutPath(n))})`,
        `$s.TargetPath=${escapePsString(exe)}`,
        `$s.Arguments=${escapePsString(args.join(" "))}`,
        `$s.WorkingDirectory=${escapePsString(process.cwd())}`,
        `$s.IconLocation=${escapePsString(`${exe},0`)}`,
        "$s.Save()"
    ].join(";");

    await runPowerShell(script);
}

/** Arguments that re-launch this exact app instance as profile N. */
function launchArgs(n: number) {
    const args: string[] = [];
    if (basename(process.argv[0]).toLowerCase().startsWith("electron")) args.push(".");
    args.push("--profile", String(n));
    return args;
}

export interface SessionsState {
    supported: boolean;
    shortcuts: number[];
    max: number;
}

const PROFILE_DIR_PATTERN = /^infinicord-(\d+)$/;
const BASE_ROAMING_DIR = process.env.APPDATA ?? ".";

/**
 * Profile numbers that already have data on disk (i.e. were launched at
 * least once). The picker uses this instead of Start Menu shortcuts, so
 * the plain INFINICORD.lnk alone is enough to reach every profile.
 */
export function getKnownProfiles(): number[] {
    try {
        return readdirSync(BASE_ROAMING_DIR)
            .map(name => PROFILE_DIR_PATTERN.exec(name)?.[1])
            .filter((n): n is string => !!n)
            .map(Number)
            .filter(n => n >= 1 && n <= SESSIONS_MAX)
            .sort((a, b) => a - b);
    } catch {
        return [];
    }
}

export function getSessionsState(): SessionsState {
    if (!isSupported()) return { supported: false, shortcuts: [], max: SESSIONS_MAX };
    return { supported: true, shortcuts: existingShortcutNumbers().sort((a, b) => a - b), max: SESSIONS_MAX };
}

/**
 * Reconciles Start Menu shortcuts so exactly 1..count exist (count 0 removes
 * every managed shortcut). Profile data dirs are never touched.
 */
export async function setSessionCount(count: number): Promise<number[]> {
    if (!isSupported()) return [];
    if (!Number.isInteger(count) || count < 0 || count > SESSIONS_MAX)
        throw new Error(`Invalid session count: ${count}`);

    for (let n = 1; n <= SESSIONS_MAX; n++) {
        const path = shortcutPath(n);
        if (n <= count) {
            if (!existsSync(path)) await createShortcut(n);
        } else if (existsSync(path)) {
            unlinkSync(path);
        }
    }

    return existingShortcutNumbers().sort((a, b) => a - b);
}

/** Spawns a new, detached instance of the app for profile N. */
export function launchSession(n: number): boolean {
    if (!Number.isInteger(n) || n < 1 || n > SESSIONS_MAX) throw new Error(`Invalid session number: ${n}`);
    const child = spawn(process.execPath, launchArgs(n), {
        detached: true,
        stdio: "ignore",
        cwd: process.cwd()
    });
    child.unref();
    return true;
}
