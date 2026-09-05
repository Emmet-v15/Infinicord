/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyFileSync, existsSync, mkdirSync, rmSync } from "fs";
// raw reads on the .asar file itself must bypass Electron's asar interception
import { closeSync, fstatSync, openSync, readSync } from "original-fs";
import { dirname, join } from "path";

import { SESSION_DATA_DIR, USER_AGENT } from "../constants";
import { setSplashIndeterminate, updateSplashMessage, updateSplashProgress } from "../splash";
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

export async function downloadVencordAsar(onProgress?: (received: number, total: number) => void) {
    await downloadFile(
        "https://github.com/Equicord/Equicord/releases/latest/download/equibop.asar",
        VENCORD_DIR,
        {},
        // a stuck boot is worse than starting without the client mod:
        // cap the backoff loop instead of grinding for ~25 minutes
        { retryOnNetworkError: true, maxRetries: 3 },
        onProgress
    );
}

export function isValidVencordInstall(dir: string) {
    return existsSync(join(dir, "main.js")) || existsSync(join(dir, "equibop/main.js"));
}

/**
 * Resolve a client-mod file inside the cached asar. Equicord's archive used
 * to nest everything under equibop/; current releases put files at the root.
 * Electron's fs layer reads asars transparently, so plain existsSync works.
 */
export function vencordFilePath(file: string): string {
    return existsSync(join(VENCORD_DIR, file)) ? join(VENCORD_DIR, file) : join(VENCORD_DIR, "equibop", file);
}

export async function ensureVencordFiles() {
    // migrate pre-shared-cache copies (per-profile sessionData) so existing
    // installs don't re-download on first launch after this change
    const legacyCache = join(SESSION_DATA_DIR, "infinicord.asar");
    if (!existsSync(VENCORD_DIR) && isValidAsarArchive(legacyCache)) {
        try {
            mkdirSync(dirname(VENCORD_DIR), { recursive: true });
            copyFileSync(legacyCache, VENCORD_DIR);
            console.log("[Infinicord] migrated client-mod cache to the shared location");
        } catch (e) {
            console.warn("[Infinicord] client-mod cache migration failed:", e);
        }
    }

    if (existsSync(VENCORD_DIR)) {
        if (isValidAsarArchive(VENCORD_DIR)) return;

        // e.g. a previous instance was killed mid-download and left a
        // truncated archive at the real path — never trust it, re-download
        console.warn("[Infinicord] cached client-mod archive is corrupt — re-downloading");
        updateSplashMessage("Loading client mod...");
        setSplashIndeterminate(true);
        // recursive: the path may also be a leftover extraction directory,
        // which plain rmSync cannot remove (EISDIR)
        try {
            rmSync(VENCORD_DIR, { force: true, recursive: true });
        } catch (e) {
            console.error("[Infinicord] Failed to remove corrupt client-mod cache:", e);
        }
    }

    try {
        await downloadVencordAsar((received, total) => {
            const pct = total ? Math.round((received / total) * 100) : 0;
            // tick 3 of 9 spans 22%..33% on the splash bar
            updateSplashProgress(22 + Math.round((pct / 100) * 11));
            updateSplashMessage(`Downloading client mod... ${pct}%`);
        });
        setSplashIndeterminate(false);
        updateSplashMessage("");
    } catch (e) {
        setSplashIndeterminate(false);
        updateSplashMessage("");
        // never block startup on this — the app runs, just without the mod
        console.error("[Infinicord] Failed to download client-mod archive:", e);
    }
}

/**
 * Cheap integrity probe without @electron/asar (which is not packaged):
 * parse the asar header directly and confirm the archive is large enough to
 * contain every file entry — catches truncated downloads that pass
 * existsSync().
 */
function isValidAsarArchive(archivePath: string) {
    let fd: number | undefined;
    try {
        fd = openSync(archivePath, "r");
        // pickle framing: [4][4 headerSize][4 jsonLen][4 strLen][json...]
        const head = Buffer.alloc(16);
        if (readSync(fd, head, 0, 16, 0) !== 16) return false;
        const headerSize = head.readUInt32LE(4);
        const jsonLen = head.readUInt32LE(12);
        const json = Buffer.alloc(jsonLen);
        if (readSync(fd, json, 0, jsonLen, 16) !== jsonLen) return false;
        const root = JSON.parse(json.toString("utf8")).files;
        let maxEnd = 0;
        const walk = (files: Record<string, { size?: number; offset?: string; files?: unknown }>) => {
            for (const entry of Object.values(files)) {
                if (entry.files) walk(entry.files as typeof files);
                else if (entry.size != null && entry.offset != null) {
                    maxEnd = Math.max(maxEnd, Number(entry.offset) + entry.size);
                }
            }
        };
        walk(root);
        // file data begins after 8 + headerSize bytes of pickle framing
        return 8 + headerSize + maxEnd <= fstatSync(fd).size;
    } catch (e) {
        console.warn("[Infinicord] archive validation failed:", e);
        return false;
    } finally {
        if (fd != null) closeSync(fd);
    }
}
