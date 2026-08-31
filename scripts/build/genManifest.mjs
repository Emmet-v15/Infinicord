/*
 * Reads dist/latest.yml (written by electron-builder) and writes the
 * human-friendly dist/infinicord.json manifest mirrored to the update
 * server. electron-updater itself consumes latest.yml.
 */

import { readFileSync, writeFileSync } from "node:fs";

const yml = readFileSync("dist/latest.yml", "utf8");
const grab = re => {
    const m = re.exec(yml);
    if (!m) throw new Error(`latest.yml is missing ${re}`);
    return m[1].trim();
};

const version = grab(/^version:\s*(.+)$/m);
const sha512 = grab(/^sha512:\s*(\S+)/m);
const size = Number(grab(/size:\s*(\d+)/m));
const releaseDate = grab(/^releaseDate:\s*(.+)$/m).replace(/'/g, "");

const manifest = {
    name: "infinicord",
    version,
    url: "https://v15.studio/infinicord.exe",
    blockmap: "https://v15.studio/infinicord.exe.blockmap",
    sha512,
    size,
    isAdminRightsRequired: true,
    releaseDate
};

writeFileSync("dist/infinicord.json", JSON.stringify(manifest, null, 4) + "\n");
console.log(`[genManifest] wrote dist/infinicord.json (v${version})`);
