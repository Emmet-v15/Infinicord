/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, net } from "electron";
import { join } from "path";
import { pathToFileURL } from "url";

import { isPathInDirectory } from "./utils/isPathInDirectory";

const STATIC_DIR = join(__dirname, "..", "..", "static");

/** local files are free to refetch — never let a stale copy outlive an update */
export function noCache(res: Response) {
    return new Response(res.body, {
        status: res.status,
        headers: { ...Object.fromEntries(res.headers), "cache-control": "no-cache" }
    });
}

export async function handleVesktopStaticProtocol(path: string, req: Request) {
    const fullPath = join(STATIC_DIR, path);
    if (!isPathInDirectory(fullPath, STATIC_DIR)) {
        return new Response(null, { status: 404 });
    }

    return noCache(await net.fetch(pathToFileURL(fullPath).href));
}

export function loadView(browserWindow: BrowserWindow, view: string, params?: URLSearchParams) {
    const url = new URL(`infinicord://static/views/${view}`);
    // cache-bust per release so an updated view can never be shadowed by an
    // entry cached under the old version
    url.searchParams.set("v", app.getVersion());
    if (params) {
        for (const [key, value] of params) url.searchParams.set(key, value);
    }

    return browserWindow.loadURL(url.toString());
}
