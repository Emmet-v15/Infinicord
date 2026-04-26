# Infinicord [<img src="/static/icon.png" width="225" align="right" alt="Infinicord">](https://github.com/Infinicord/Infinicord)

[![Infinicord](https://img.shields.io/badge/Infinicord-grey?style=flat)](https://github.com/Infinicord/Infinicord)
[![Tests](https://github.com/Infinicord/Infinicord/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Infinicord/Infinicord/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1173279886065029291.svg?color=768AD4&label=Discord&logo=discord&logoColor=white)](https://infinicord.org/discord)

Infinicord is a fork of [Vesktop](https://github.com/Vencord/Vesktop).

You can join our [discord server](https://infinicord.org/discord) for commits, changes, chat or even support.<br></br>

**Main features**:
- Infinicord preinstalled
- Much more lightweight and faster than the official Discord app
- Linux Screenshare with sound & wayland
- Much better privacy, since Discord has no access to your system

**Extra included changes**

- Tray Customization with voice detection and notification badges
- Command-line flags to toggle microphone and deafen status (Linux)
- Custom Arguments from [this PR](https://github.com/Infinicord/Infinicord/pull/46)
- arRPC-bun with debug logging support https://github.com/Creationsss/arrpc-bun

**Not fully Supported**:
- Global Keybinds (Windows/macOS - use command-line flags on Linux instead)

## Infinicord Arguments
> [!NOTE]
> For the full list of supported flags and how to apply them, see the
[Tips & Tricks](https://infinicord.org/wiki/linux/tips/) page on the wiki!

### Quick reference

| Flag                            | Description                             |
|---------------------------------|-----------------------------------------|
| `--ozone-platform=wayland`      | Force native Wayland                    |
| `--ozone-platform=x11`          | Force XWayland                          |
| `--no-sandbox`                  | Disable Chromium sandbox (use with caution) |
| `--force_high_performance_gpu`  | Prefer discrete GPU                     |
| `--start-minimized`             | Launch minimized to tray                |
| `--toggle-mic`                  | Toggle mic (bind to shortcuts)          |
| `--toggle-deafen`               | Toggle deafen (bind to shortcuts)       |
| `--toggle-vad`                  | Toggle Voice Activity Detection (Voice Activity <-> Push To Talk) |

### Persistent flags

Add flags to `${XDG_CONFIG_HOME}/infinicord-flags.conf` — one per line, lines starting with `#` are comments.

## Installing
Check the [Releases](https://github.com/Infinicord/Infinicord/releases) page

OR

Check The Downloads from the [website](https://infinicord.org/install)

### Linux

[![Infinicord](https://img.shields.io/badge/AVAILABLE_ON_THE_AUR-333232?style=for-the-badge&logo=arch-linux&logoColor=0F94D2&labelColor=%23171717)](https://aur.archlinux.org/packages?O=0&K=infinicord)
<br>
<!-- <a href="https://flathub.org/apps/io.github.infinicord.infinicord">
  <img src="https://flathub.org/api/badge?svg" alt="Download on Flathub" style="width:220px; height:auto;">
</a> -->

#### Community packages

Below you can find unofficial packages created by the community. They are not officially supported by us, so before reporting issues, please first confirm the issue also happens on official builds. When in doubt, consult with their packager first. The AppImage should work on any distro that supports them, so I recommend you just use that instead!

- Arch Linux: [Infinicord on the Arch user repository](https://aur.archlinux.org/packages?K=infinicord)
- Void Linux: [Infinicord on the Void repository](https://void.creations.works/)
- NixOS: `nix-shell -p infinicord`

## Building from Source

You need to have the following dependencies installed:
- [Git](https://git-scm.com/downloads)
- [Bun](https://bun.sh)

Packaging will create builds in the dist/ folder

```sh
git clone https://github.com/Infinicord/Infinicord
cd Infinicord

# Install Dependencies
bun install

# Either run it without packaging
bun start

# Or package (will build packages for your OS)
bun package

# Or only build the Linux Pacman package
bun package --linux pacman

# Or package to a directory only
bun package:dir
```

## Building LibVesktop from Source

This is a small C++ helper library Infinicord uses on Linux to emit D-Bus events. By default, prebuilt binaries for x64 and arm64 are used.

If you want to build it from source:
1. Install build dependencies:
    - Debian/Ubuntu: `apt install build-essential python3 curl pkg-config libglib2.0-dev`
    - Fedora: `dnf install @c-development @development-tools python3 curl pkgconf-pkg-config glib2-devel`
2. Run `bun buildLibVesktop`
3. From now on, building Infinicord will use your own build
