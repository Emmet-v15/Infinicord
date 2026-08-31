/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { protocol } from "electron/main";

import { CommandLine, isQueryInstance } from "./cli";

// Must happen before app ready: gives infinicord:// a real origin so module
// scripts, fetch and CORS work from our views (script type=module is
// CORS-blocked on non-standard schemes, which dead-ended the updater view).
protocol.registerSchemesAsPrivileged([
    {
        scheme: "infinicord",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

if (isQueryInstance) {
    // Query-only instance, don't start the app
} else if (CommandLine.values.repair) {
    (async () => {
        const { State } = await import("./settings");
        if (State.store.infinicordDir) {
            console.error("Cannot repair: using custom Infinicord directory.");
            process.exit(1);
        }
        console.log("Repairing Infinicord...");
        const { downloadVencordAsar } = await import("./utils/vencordLoader");
        await downloadVencordAsar();
        console.log("Repair complete.");
        process.exit(0);
    })();
} else {
    require("./startup");
}
