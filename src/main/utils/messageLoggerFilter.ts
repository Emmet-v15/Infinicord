/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const BLOCKED_PREFIX = "b4n1sh";

/** minified identifier */
const ID = "[A-Za-z_$][\\w$]*";

/** author fields seen raw (global_name) and normalized (globalName) */
function guard(messageExpr: string, returnValue: string) {
    return (
        `if(["username","global_name","globalName"].some(n=>` +
        `String(${messageExpr}?.author?.[n]??"").toLowerCase().startsWith("${BLOCKED_PREFIX}")))` +
        `return ${returnValue};`
    );
}

interface AnchorPatch {
    name: string;
    find: RegExp;
    /** builds the full replacement from the match's capture groups */
    build: (groups: string[]) => string;
}

const PATCHES: AnchorPatch[] = [
    {
        name: "MessageLogger.shouldIgnore",
        find: new RegExp(`shouldIgnore\\((${ID})(,${ID}=!1)?\\)\\{try\\{`),
        build: ([msg, rest]) => `shouldIgnore(${msg}${rest ?? ""}){try{${guard(msg, "!0")}`
    },
    {
        name: "MessageLoggerEnhanced.MESSAGE_CREATE",
        find: new RegExp(
            `function (${ID})\\((${ID})\\)\\{if\\(!(${ID})\\.store\\.cacheMessagesFromServers&&\\2\\.guildId!=null\\)\\{`
        ),
        build: ([fn, ev, store]) =>
            `function ${fn}(${ev}){${guard(`${ev}.message`, "")}` +
            `if(!${store}.store.cacheMessagesFromServers&&${ev}.guildId!=null){`
    }
];

/** Rewrites the renderer bundle so the logger plugins skip blocked authors. */
export function blockB4n1shFromMessageLoggers(source: string): string {
    let out = source;
    let applied = 0;

    for (const patch of PATCHES) {
        const match = out.match(patch.find);
        if (!match) {
            console.warn(
                `[Infinicord] message-logger filter: anchor for ${patch.name} not found — plugin is UNPATCHED`
            );
            continue;
        }
        out = out.replace(patch.find, patch.build(match.slice(1) as string[]));
        applied++;
    }

    console.log(`[Infinicord] message-logger filter: ${applied}/${PATCHES.length} patches applied`);
    return out;
}
