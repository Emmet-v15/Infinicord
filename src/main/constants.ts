/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app } from "electron";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

import { baseUserDataPath, CommandLine } from "./cli";

const infinicordDir = dirname(process.execPath);

export const PORTABLE =
    process.platform === "win32" &&
    !process.execPath.toLowerCase().endsWith("electron.exe") &&
    !existsSync(join(infinicordDir, "Uninstall Infinicord.exe"));

// Shared across all profiles (settings, themes, etc.)
export const DATA_DIR =
    process.env.INFINICORD_USER_DATA_DIR || (PORTABLE ? join(infinicordDir, "Data") : baseUserDataPath);

mkdirSync(DATA_DIR, { recursive: true });

// Profile-specific: app.getPath("userData") is suffixed with profile name if --profile is set
export const SESSION_DATA_DIR = join(app.getPath("userData"), "sessionData");
app.setPath("sessionData", SESSION_DATA_DIR);

// Per-profile: each session gets its own plugin settings and quickCSS
export const VENCORD_SETTINGS_DIR = join(app.getPath("userData"), "settings");
mkdirSync(VENCORD_SETTINGS_DIR, { recursive: true });
export const VENCORD_QUICKCSS_FILE = join(VENCORD_SETTINGS_DIR, "quickCss.css");
export const VENCORD_SETTINGS_FILE = join(VENCORD_SETTINGS_DIR, "settings.json");

// Shared across all profiles
export const VENCORD_THEMES_DIR = join(DATA_DIR, "themes");

export const USER_AGENT = `Infinicord/${app.getVersion()} (https://github.com/Emmet-v15/Infinicord)`;

// dimensions shamelessly stolen from Discord Desktop :3
export const MIN_WIDTH = 940;
export const MIN_HEIGHT = 500;
export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;

export const DISCORD_HOSTNAMES = ["discord.com", "canary.discord.com", "ptb.discord.com"];

const VersionString = `AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome.split(".")[0]}.0.0.0 Safari/537.36`;
const BrowserUserAgents = {
    darwin: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${VersionString}`,
    linux: `Mozilla/5.0 (X11; Linux x86_64) ${VersionString}`,
    windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${VersionString}`
};

export const BrowserUserAgent =
    CommandLine.values["user-agent"] ||
    BrowserUserAgents[CommandLine.values["user-agent-os"] || process.platform] ||
    BrowserUserAgents.windows;

export const enum MessageBoxChoice {
    Default,
    Cancel
}

export const IS_FLATPAK = process.env.FLATPAK_ID !== undefined;
export const isWayland =
    process.platform === "linux" && (process.env.XDG_SESSION_TYPE === "wayland" || !!process.env.WAYLAND_DISPLAY);
export const isLinux = process.platform === "linux";
