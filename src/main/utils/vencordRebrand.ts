/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Infinicord client-mod rebrand.
 *
 * The bundled client mod (equibop.asar from upstream Equicord) renders many of
 * its own UI strings ("Equicord" settings section, updater dialogs, badges...).
 * We cannot rename those upstream, so the scripts are rewritten on the fly
 * while being served to the preload. The asar itself is never modified, so
 * update checks, changelogs and downloads keep working untouched.
 *
 * Rules are intentionally conservative:
 *  - URLs (github.com/Equicord, equicord.org, raw.githubusercontent.com...)
 *  - storage/settings keys (EquicordChangelog_LastRepoCheck, showEquicordDonor...)
 *  - route ids (equicord_main) and plugin names (EquicordHelper)
 *  - template tokens ({equicordVersion}, {equicordIcon}...)
 * must never change, so only exact display literals are replaced.
 */

const REPLACEMENTS: readonly [string, string][] = [
    // settings sidebar entry
    ['label:"Equicord"', 'label:"Infinicord"'],
    // settings section titles (useTitle / panelTitle / component title)
    ['"Equicord Settings"', '"Infinicord Settings"'],
    // quick-switcher / command palette titles
    ['"Open Equicord Settings', '"Open Infinicord Settings'],
    ['"Open Equicord tab', '"Open Infinicord tab'],
    // updater dialog
    ['Equibop & Equicord"', 'Equibop & Infinicord"'],
    [
        "Equibop and Equicord are two separate things. This updater is for Equicord.",
        "Equibop and Infinicord are two separate things. This updater is for Infinicord."
    ],
    ["A new version of Equicord is available!", "A new version of Infinicord is available!"],
    // version/about line (template prefix)
    ["`Equicord${cu", "`Infinicord${cu"],
    // "Support the Project" donate card — removed entirely (whole JSX call
    // swapped for null; the ternary's donated branch still renders fine).
    // NOTE: must stay above the broad sweeps, which would otherwise rewrite
    // "Equicord" inside this literal and break the match.
    [
        'i(Sw,{title:"Support the Project",description:"Please consider supporting the development of Equicord by donating!",cardImage:e,backgroundImage:jme,backgroundColor:"#c3a3ce"},i(BH,null))',
        "null"
    ],
    // ---- broad sweeps for remaining prose ----
    // Identifiers in this bundle are camelCase (no spaces), URLs are slash-
    // delimited and storage keys are single words, so space/quote-delimited
    // "Equicord" can only be human-visible text (notices, descriptions,
    // dialog titles, console labels...).
    [" Equicord ", " Infinicord "],
    ['"Equicord ', '"Infinicord '],
    [' Equicord"', ' Infinicord"'],
    [" Equicord.", " Infinicord."],
    [" Equicord!", " Infinicord!"],
    [" Equicord's", " Infinicord's"],
    [" Equicord\\u2019", " Infinicord\\u2019"]
];

/**
 * Rewrites user-facing "Equicord" branding inside a client-mod script.
 * Functional identifiers (urls, keys, routes, plugin names, tokens) are kept.
 */
export function rebrandClientMod(source: string): string {
    let out = source;

    for (const [find, replace] of REPLACEMENTS) {
        out = out.split(find).join(replace);
    }

    // any remaining standalone "Equicord" string literal (labels, titles,
    // webhook usernames, footer hints...) is pure display text
    out = out.replaceAll('"Equicord"', '"Infinicord"');

    // ...except the command registrar id, which acts as an identifier
    out = out.replaceAll('registrar:"Infinicord"', 'registrar:"Equicord"');

    return out;
}
