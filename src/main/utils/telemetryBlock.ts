/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { session } from "electron";

const TELEMETRY_PATH = /\/api\/v\d+\/(science|metrics|tr)(\?|$)/;

export function blockDiscordTelemetry() {
    // api paths only — the gateway (wss) and cdn traffic is untouched
    session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["https://discord.com/api/*", "https://*.discord.com/api/*"] },
        (details, callback) => callback({ cancel: TELEMETRY_PATH.test(details.url) })
    );
}
