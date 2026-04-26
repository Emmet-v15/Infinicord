/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { find } from "@equicord/types/webpack";

// Suppress the verbose "no module found" warnings from webpack lookups for
// selectors Discord no longer exposes; the plugin already no-ops on null.
function safeFind<T = any>(filter: (m: any) => boolean): T | null {
    try {
        return (find(filter) as T) ?? null;
    } catch {
        return null;
    }
}

class FakeDeafen {
    private original_voice_state_update: any;
    private ui_mutation_observer: MutationObserver | null = null;
    private is_fd_enabled = false;

    public start() {
        // TODO: Discord no longer exposes a `voiceStateUpdate` function on any
        // module — the gateway send is captured in a closure. Reimplement by
        // patching the WebSocket send (preload-side) or by splicing into the
        // sender via Vencord.Webpack.Patches once we identify the right find.
        const GatewayConnection = safeFind<any>(m => typeof m?.voiceStateUpdate === "function");
        if (GatewayConnection) {
            this.original_voice_state_update = GatewayConnection.voiceStateUpdate;
            const self = this;
            GatewayConnection.voiceStateUpdate = function (args: any) {
                if (self.is_fd_enabled && args) {
                    args.selfMute = true;
                    args.selfDeaf = true;
                }
                return self.original_voice_state_update.apply(this, arguments);
            };
        }

        this.ui_mutation_observer = new MutationObserver(() => this.mount_fd_button());
        this.ui_mutation_observer.observe(document.body, { childList: true, subtree: true });
        this.mount_fd_button();
    }

    public stop() {
        const GatewayConnection = safeFind<any>(m => typeof m?.voiceStateUpdate === "function");
        if (GatewayConnection && this.original_voice_state_update) {
            GatewayConnection.voiceStateUpdate = this.original_voice_state_update;
        }

        this.ui_mutation_observer?.disconnect();
        document.getElementById("fd-btn")?.remove();
    }

    private refresh_voice_state() {
        const ChannelStore = safeFind<any>(
            m => typeof m?.getChannel === "function" && typeof m?.getDMFromUserId === "function"
        );
        const SelectedChannelStore = safeFind<any>(m => typeof m?.getVoiceChannelId === "function");
        const GatewayConnection = safeFind<any>(m => typeof m?.voiceStateUpdate === "function");
        const MediaEngineStore = safeFind<any>(m => typeof m?.isDeaf === "function" && typeof m?.isMute === "function");
        if (!GatewayConnection || !SelectedChannelStore) return;

        const channelId = SelectedChannelStore.getVoiceChannelId();
        const channel = channelId ? ChannelStore?.getChannel(channelId) : null;

        if (channel) {
            GatewayConnection.voiceStateUpdate({
                channelId: channel.id,
                guildId: channel.guild_id,
                selfMute: this.is_fd_enabled || (MediaEngineStore?.isMute() ?? false),
                selfDeaf: this.is_fd_enabled || (MediaEngineStore?.isDeaf() ?? false)
            });
        }
    }

    private get_icon_svg(is_active: boolean) {
        const icon_color = is_active ? "#ed4245" : "currentColor";
        return `
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="8" width="20" height="4" rx="2" fill="${icon_color}"/>
            <rect x="11" y="3" width="10" height="8" rx="3" fill="${icon_color}"/>
            ${
                is_active
                    ? `
            <line x1="7" y1="18" x2="13" y2="24" stroke="${icon_color}" stroke-width="2"/>
            <line x1="13" y1="18" x2="7" y2="24" stroke="${icon_color}" stroke-width="2"/>
            <line x1="19" y1="18" x2="25" y2="24" stroke="${icon_color}" stroke-width="2"/>
            <line x1="25" y1="18" x2="19" y2="24" stroke="${icon_color}" stroke-width="2"/>
            <path d="M14 23c1-1 3-1 4 0" stroke="${icon_color}" stroke-width="2" stroke-linecap="round"/>
            `
                    : `
            <circle cx="10" cy="21" r="4" stroke="${icon_color}" stroke-width="2" fill="none"/>
            <circle cx="22" cy="21" r="4" stroke="${icon_color}" stroke-width="2" fill="none"/>
            <path d="M14 21c1 1 3 1 4 0" stroke="${icon_color}" stroke-width="2" stroke-linecap="round"/>
            `
            }
        </svg>`;
    }

    private find_discord_mute_button(): HTMLElement | null {
        const panels = document.querySelector('[class^="panels_"]');
        if (!panels) return null;
        const buttons = panels.querySelectorAll("button");
        return buttons.length > 0 ? buttons[0] : null;
    }

    private mount_fd_button() {
        if (document.getElementById("fd-btn")) return;

        const mute_btn = this.find_discord_mute_button();
        if (!mute_btn) return;

        const fd_btn = document.createElement("button");
        fd_btn.id = "fd-btn";
        fd_btn.className = mute_btn.className;
        fd_btn.setAttribute("aria-label", "Fake Deafen");

        const update_view = () => {
            const inner_class = mute_btn.querySelector("div")?.className || "";
            fd_btn.innerHTML = `<div class="${inner_class}">${this.get_icon_svg(this.is_fd_enabled)}</div>`;
        };

        fd_btn.onclick = () => {
            this.is_fd_enabled = !this.is_fd_enabled;
            update_view();
            this.refresh_voice_state();
        };

        update_view();
        mute_btn.parentElement?.insertBefore(fd_btn, mute_btn);
    }
}

export const fakeDeafen = new FakeDeafen();
