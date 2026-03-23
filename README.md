# Infinicord [<img src="/static/icon.png" width="200" align="right" alt="Infinicord">](https://github.com/Emmet-v15/Infinicord)

[![Tests](https://github.com/Emmet-v15/Infinicord/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Emmet-v15/Infinicord/actions/workflows/test.yml)
[![Sync Upstream](https://github.com/Emmet-v15/Infinicord/actions/workflows/sync-upstream.yml/badge.svg)](https://github.com/Emmet-v15/Infinicord/actions/workflows/sync-upstream.yml)

A custom Discord desktop app built on [Vesktop](https://github.com/Vencord/Vesktop), with [Vencord](https://github.com/Vendicated/Vencord) preinstalled and enhanced audio quality out of the box.

## Features

- **Vencord preinstalled** — all plugins and themes ready to go
- **Enhanced audio** — stereo 48kHz, high bitrate Opus, VAD defeat, noise suppression disabled
- **Multi-profile support** — run two accounts simultaneously with `--profile <name>`
- **Lightweight** — faster and leaner than the official Discord client
- **Better privacy** — Discord has no access to your system
- **Linux screenshare** with audio and Wayland support

## Download

Check the [Releases](https://github.com/Emmet-v15/Infinicord/releases) page.

## Usage

### Multiple Instances

Run two Discord accounts at the same time — each gets its own isolated data directory:

```bash
# First account (default)
infinicord

# Second account
infinicord --profile 2
```

### Runtime Flags

| Flag | Description |
|---|---|
| `--profile <name>` | Use a named profile (separate settings & session) |
| `--start-minimized` | Start minimized to tray |
| `--disable-gpu` | Disable hardware acceleration |
| `--wayland` | Force Ozone Wayland platform |
| `--no-sandbox` | Disable Chromium sandbox (e.g. when running as root) |
| `--toggle-mic` | Toggle microphone (Linux, bind to a shortcut) |
| `--toggle-deafen` | Toggle deafen (Linux, bind to a shortcut) |

Flags can also be set persistently via the tray icon → **Launch arguments**.

### Flags File (Linux)

```
${XDG_CONFIG_HOME}/infinicord-flags.conf
```

Lines starting with `#` are comments. Each flag goes on its own line.

## Building from Source

**Requirements:** [Git](https://git-scm.com) · [Bun](https://bun.sh)

```sh
git clone https://github.com/Emmet-v15/Infinicord
cd Infinicord
bun install

# Run without packaging
bun start

# Package for your OS
bun package

# Package to a directory only
bun package:dir
```

## Syncing Upstream

Infinicord automatically pulls updates from [Equibop](https://github.com/Equicord/Equibop) daily and re-applies the rebrand. If a conflict is detected in a customized file, a GitHub issue is opened instead.

To sync manually:

```bash
git fetch upstream
git merge upstream/main
bash scripts/rebrand.sh
git add -A && git commit -m "chore: sync upstream + rebrand"
git push
```
