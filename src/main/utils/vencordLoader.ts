/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, rmSync } from "fs";
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

export async function ensureVencordFiles() {
    if (existsSync(VENCORD_DIR)) {
        if (isValidAsarArchive(VENCORD_DIR)) return;

        // e.g. a previous instance was killed mid-download and left a
        // truncated archive at the real path — never trust it, re-download
        console.warn("[Infinicord] cached client-mod archive is corrupt — re-downloading");
        // recursive: the path may also be a leftover extraction directory,
        // which plain rmSync cannot remove (EISDIR)
        try {
            rmSync(VENCORD_DIR, { force: true, recursive: true });
        } catch (e) {
            console.error("[Infinicord] Failed to remove corrupt client-mod cache:", e);
        }
    }

    try {
        await downloadVencordAsar();
    } catch (e) {
        // never block startup on this — the app runs, just without the mod
        console.error("[Infinicord] Failed to download client-mod archive:", e);
    }
}

/**
 * Cheap integrity probe: the archive must be parseable by @electron/asar and
 * contain an entry point. Catches truncated downloads that pass existsSync().
 */
function isValidAsarArchive(archivePath: string) {
    try {
        const asar = require("@electron/asar") as { extractFile(p: string, f: string): Buffer };
        asar.extractFile(archivePath, "package.json");
        return true;
    } catch (e) {
        console.warn("[Infinicord] archive validation failed:", e);
        return false;
    }
}
