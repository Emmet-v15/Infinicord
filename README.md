# Infinicord

Custom lightweight Discord desktop app (Electron + TypeScript), maintained locally as a
rebrand of [Equibop](https://github.com/Equicord/Equibop) v3.2.2 — which itself forks
[Vesktop](https://github.com/Vencord/Vesktop). GPL-3.0-or-later; branding and self-references
point at `Emmet-v15/Infinicord` / `infinicord.org`.

## What this is

- A personal fork that tracks upstream Equibop via merges (`upstream/main` → local `main`),
  then re-applies an Equibop/Equicord → Infinicord rename across source, packaging, and docs.
  The rename is scripted: run `bash scripts/rebrand.sh` after merging upstream.
  The script deliberately preserves upstream tokens it must not own: the `@equicord/types`
  npm package and the plugin asar URL (`Equicord/Equicord/releases/latest/download/equibop.asar`,
  loaded by `src/main/utils/vencordLoader.ts`).
- Features inherited from Equibop/Vesktop: lighter than official Discord, Linux screenshare
  with audio & Wayland, tray customization with voice detection/notification badges,
  arRPC Rich Presence (`arrpc-bun`), CLI flags to toggle mic/deafen/VAD.
  Global keybinds are unsupported on Windows/macOS (use Linux CLI flags).

## Layout

- `src/main` — Electron main process (window/tray/autoStart/updater, IPC, arRPC window, Vencord loading)
- `src/preload`, `src/renderer`, `src/shared` — native bridge, UI patches & settings components, shared types
- `packages/libvesktop` — C++ helper lib for Linux D-Bus StatusNotifierItem tray events (prebuilt x64/arm64; `bun buildLibVesktop` to rebuild)
- `scripts/build` — esbuild pipeline + electron-builder hooks; `scripts/rebrand.sh` — rebrand re-application
- `build/` — installer assets/icons; `static/` — splash/about/updater views
- `.env.example` — optional `GITHUB_TOKEN` (avoids API rate limits) and `ELECTRON_LAUNCH_FLAGS`

## How to run & use

Requires [Bun](https://bun.sh) ≥ 1.3 and Git.

```sh
bun install        # also fetches the arrpc DB and compiles arrpc-bun
bun start          # build + launch Electron
bun start:dev      # dev build + launch
bun start:watch    # dev build + watch mode
bun package        # build + electron-builder installers into dist/
bun package --dir # or: bun package:dir — unpacked directory only
bun lint           # eslint; bun testTypes runs tsc --noEmit
```

electron-builder targets (from `package.json`): Windows NSIS/zip, macOS dmg/universal,
Linux deb/rpm/AppImage/tar.gz (x64+arm64).

Useful launch flags: `--ozone-platform=wayland|x11`, `--no-sandbox`,
`--force_high_performance_gpu`, `--start-minimized`, `--toggle-mic`, `--toggle-deafen`,
`--toggle-vad`. Persist flags in `${XDG_CONFIG_HOME}/infinicord-flags.conf` (one per line).
Data/config dir can be overridden with `INFINICORD_USER_DATA_DIR` (`src/main/constants.ts`).

## Status & notes

- Active WIP: the working tree carries extensive uncommitted rebrand changes on top of
  `origin/main` (remote: `https://github.com/Equicord/Equibop.git`); `scripts/rebrand.sh`
  is still untracked. Commit or keep applying after upstream merges.
- Upstream CI workflows under `.github/workflows` were deleted locally — builds/packaging
  here run manually via the Bun scripts above.
- Version bumped independently of upstream (currently 3.2.11). Upstream attribution: Equibop by Equicord,
  Vesktop by Vendicated & contributors, both GPL-3.0-or-later (see `LICENSE`).
