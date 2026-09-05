/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createWriteStream, mkdirSync, renameSync, rmSync } from "original-fs";
import { dirname } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { setTimeout } from "timers/promises";

interface FetchieOptions {
    retryOnNetworkError?: boolean;
    /** cap for the network-error backoff loop (default 20, which can take ~25min) */
    maxRetries?: number;
}

export async function downloadFile(
    url: string,
    file: string,
    options: RequestInit = {},
    fetchieOpts?: FetchieOptions,
    onProgress?: (received: number, total: number) => void
) {
    const res = await fetchie(url, options, fetchieOpts);

    mkdirSync(dirname(file), { recursive: true });

    // stream to a partial file and swap into place: an interrupted download
    // must never corrupt the live file (the client-mod asar loads every launch)
    const partial = `${file}.partial`;
    try {
        const total = Number(res.headers.get("content-length") ?? 0);
        let received = 0;
        // @ts-expect-error odd type error between web ReadableStream and node Readable
        const stream = Readable.fromWeb(res.body!) as Readable;
        stream.on("data", (chunk: Buffer) => {
            received += chunk.length;
            onProgress?.(received, total);
        });
        await pipeline(
            stream,
            createWriteStream(partial, {
                autoClose: true
            })
        );
        // target may be a file or a leftover extraction directory
        rmSync(file, { force: true, recursive: true });
        renameSync(partial, file);
    } catch (e) {
        rmSync(partial, { force: true, recursive: true });
        throw e;
    }
}

const ONE_MINUTE_MS = 1000 * 60;

export async function fetchie(
    url: string,
    options?: RequestInit,
    { retryOnNetworkError, maxRetries = 20 }: FetchieOptions = {}
) {
    let res: Response | undefined;

    try {
        res = await fetch(url, options);
    } catch (err) {
        if (retryOnNetworkError) {
            console.error("Failed to fetch", url + ".", "Gonna retry with backoff.");

            for (
                let tries = 0, delayMs = 500;
                tries < maxRetries;
                tries++, delayMs = Math.min(2 * delayMs, ONE_MINUTE_MS)
            ) {
                await setTimeout(delayMs);
                try {
                    res = await fetch(url, options);
                    break;
                } catch {}
            }
        }

        if (!res) throw new Error(`Failed to fetch ${url}\n${err}`);
    }

    if (res.ok) return res;

    let msg = `Got non-OK response for ${url}: ${res.status} ${res.statusText}`;

    const reason = await res.text().catch(() => "");
    if (reason) msg += `\n${reason}`;

    throw new Error(msg);
}
