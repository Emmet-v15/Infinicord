/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync } from "fs";
// Electron patches fs to treat .asar files as directories with synthesized
// stats — mtime from regular fs is not the real file's mtime. original-fs
// is Electron's unpatched fs and reads the actual filesystem mtime.
import { statSync } from "original-fs";
import { join } from "path";

import { USER_AGENT } from "../constants";
import { VENCORD_DIR } from "../vencordDir";
import { downloadFile, fetchie } from "./http";

const API_BASE = "https://api.github.com";

export interface ReleaseData {
    name: string;
    tag_name: string;
    html_url: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

export async function githubGet(endpoint: string) {
    const opts: RequestInit = {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": USER_AGENT
        }
    };

    if (process.env.GITHUB_TOKEN) (opts.headers! as any).Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    return fetchie(API_BASE + endpoint, opts, { retryOnNetworkError: true });
}

export async function downloadVencordAsar() {
    await downloadFile(
        "https://github.com/Equicord/Equicord/releases/latest/download/equibop.asar",
        VENCORD_DIR,
        {},
        { retryOnNetworkError: true }
    );
}

export function isValidVencordInstall(dir: string) {
    return existsSync(join(dir, "equibop/main.js"));
}

// Re-fetch the cached Equicord asar if it's older than this. Equicord ships
// frequent fixes for Discord-side breakage; without periodic refresh, users on
// older clones (e.g. additional profiles) silently keep running stale code.
const ASAR_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function ensureVencordFiles() {
    if (!existsSync(VENCORD_DIR)) {
        await downloadVencordAsar();
        return;
    }

    let ageMs: number;
    try {
        ageMs = Date.now() - statSync(VENCORD_DIR).mtimeMs;
    } catch {
        return;
    }

    if (ageMs < ASAR_MAX_AGE_MS) return;

    try {
        await downloadVencordAsar();
    } catch (e) {
        console.error("[Equicord] failed to refresh cached asar, using stale copy", e);
    }
}
