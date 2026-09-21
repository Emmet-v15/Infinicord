/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@equicord/types/utils";
import { findByProps } from "@equicord/types/webpack";
import { FluxDispatcher, MediaEngineStore } from "@equicord/types/webpack/common";

import { localStorage } from "../utils";

const logger = new Logger("FakeDeafen");

// Runtime-toggleable via localStorage.setItem("infinicord.fdDebug", "1") + reload.
// Logs outgoing op-4 payloads, our own server voice-state echo, and heal sends,
// so a dropout repro distinguishes the server stopping audio forwarding (echo
// still deafened, nothing muted locally) from a local mute.
function is_debug_enabled() {
    return localStorage.getItem("infinicord.fdDebug") === "1";
}

// Gateway opcode 4 (VOICE_STATE_UPDATE)
const VOICE_STATE_UPDATE_OPCODE = 4;
// The faked self_deaf flag makes the server's view of us permanently disagree
// with our real state. When someone joins, the server recomputes its
// per-receiver audio forwarding while our stale "deafened" flag is on record,
// and can drop the already-connected participants' streams until we rejoin
// (new joiners keep working since their streams register fresh). To heal that
// without a rejoin, re-assert our voice state shortly after join churn so the
// forwarding gets rebuilt with us still marked deafened.
const HEAL_DEBOUNCE_MS = 500;
const SOCKET_RETRY_MS = 2000;
const SOCKET_MAX_RETRIES = 5;

interface VoiceStatePayload {
    guild_id: string | null;
    channel_id: string | null;
    self_mute: boolean;
    self_deaf: boolean;
    self_video: boolean;
    flags: number;
    [key: string]: unknown; // preferred_region, tracks, ...
}

class FakeDeafen {
    private socket: any = null;
    private original_send: ((this: unknown, op: number, data: any, ...rest: unknown[]) => unknown) | null = null;
    private is_fd_enabled = false;
    // The last op-4 payload Discord itself committed, snapshotted before we
    // tamper with it. Re-asserted states are rebuilt from this so fields we
    // don't manage (flags, preferred_region, tracks) survive untouched.
    private last_committed_voice_state: VoiceStatePayload | null = null;
    private heal_timer: ReturnType<typeof setTimeout> | null = null;
    private ui_mutation_observer: MutationObserver | null = null;
    private button_mount_pending = false;

    public start() {
        this.hook_gateway_socket();
        FluxDispatcher?.subscribe("VOICE_STATE_UPDATES", this.on_voice_state_updates);

        this.ui_mutation_observer = new MutationObserver(() => this.schedule_button_mount());
        this.ui_mutation_observer.observe(document.body, { childList: true, subtree: true });
        this.mount_fd_button();
    }

    public stop() {
        if (this.socket && this.original_send) {
            this.socket.send = this.original_send;
        }
        this.socket = null;
        this.original_send = null;
        this.last_committed_voice_state = null;
        if (this.heal_timer !== null) {
            clearTimeout(this.heal_timer);
            this.heal_timer = null;
        }
        FluxDispatcher?.unsubscribe("VOICE_STATE_UPDATES", this.on_voice_state_updates);

        this.ui_mutation_observer?.disconnect();
        this.ui_mutation_observer = null;
        document.getElementById("fd-btn")?.remove();
    }

    // Intercept op-4 at the transport layer instead of wrapping the socket's
    // voiceStateUpdate(): every internal path that announces our voice state
    // funnels through send(), and the interception survives Discord renaming
    // or closing over the sender, which has happened before.
    private hook_gateway_socket(retry = 0) {
        const socket = findByProps("getSocket")?.getSocket?.();
        if (!socket || typeof socket.send !== "function") {
            if (retry < SOCKET_MAX_RETRIES) {
                setTimeout(() => this.hook_gateway_socket(retry + 1), SOCKET_RETRY_MS);
            } else {
                logger.warn("Gateway socket not found, fake deafen unavailable");
            }
            return;
        }

        this.socket = socket;
        this.original_send = socket.send;
        const self = this;
        socket.send = function (op: number, data: any, ...rest: unknown[]) {
            if (op === VOICE_STATE_UPDATE_OPCODE) self.handle_outgoing_voice_state(data);
            return self.original_send!.apply(this, [op, data, ...rest]);
        };
    }

    private handle_outgoing_voice_state(data: any) {
        if (!data || typeof data !== "object") return;

        this.last_committed_voice_state = { ...data };

        if (this.is_fd_enabled) {
            data.self_mute = true;
            data.self_deaf = true;
        }

        if (is_debug_enabled()) logger.info("op4 ->", { ...data });
    }

    private on_voice_state_updates = (update: any) => {
        const voice_states: any[] | undefined = update?.voiceStates;
        if (!voice_states?.length) return;

        const self_id = this.get_self_user_id();

        if (is_debug_enabled()) {
            for (const vs of voice_states) {
                if (vs?.userId === self_id) {
                    logger.info("op4 <- self echo", {
                        channelId: vs.channelId,
                        selfMute: vs.selfMute,
                        selfDeaf: vs.selfDeaf
                    });
                }
            }
        }

        if (!this.is_fd_enabled || self_id === null) return;

        const channel_id = this.get_voice_channel_id();
        if (!channel_id) return;
        const someone_entered = voice_states.some(vs => vs && vs.userId !== self_id && vs.channelId === channel_id);
        if (someone_entered) this.schedule_heal();
    };

    private schedule_heal() {
        if (this.heal_timer !== null) clearTimeout(this.heal_timer);
        this.heal_timer = setTimeout(() => {
            this.heal_timer = null;
            this.reassert_voice_state();
        }, HEAL_DEBOUNCE_MS);
    }

    private reassert_voice_state() {
        if (!this.is_fd_enabled || !this.socket) return;
        this.send_voice_state("re-assert after join churn");
    }

    private send_voice_state(reason: string) {
        const payload = this.build_voice_state_payload();
        if (!payload) return;
        if (is_debug_enabled()) logger.info(reason, { ...payload });
        this.socket.send(VOICE_STATE_UPDATE_OPCODE, payload);
    }

    private toggle_fd() {
        this.is_fd_enabled = !this.is_fd_enabled;
        // Sending in both directions matters: with FD off the payload carries
        // our true local state, which undoes the lie server-side.
        this.send_voice_state("toggle");
    }

    private build_voice_state_payload(): VoiceStatePayload | null {
        const channel_id = this.get_voice_channel_id();
        // Not connected to voice - never re-join via a stale template.
        if (!channel_id) return null;

        const template = this.last_committed_voice_state;
        const channel = findByProps("getChannel", "getDMFromUserId")?.getChannel?.(channel_id);
        const media_engine = MediaEngineStore as any;

        return {
            guild_id: channel?.guild_id ?? template?.guild_id ?? null,
            channel_id,
            self_mute: this.is_fd_enabled || (media_engine?.isMute?.() ?? false),
            self_deaf: this.is_fd_enabled || (media_engine?.isDeaf?.() ?? false),
            self_video: media_engine?.isVideoEnabled?.() ?? template?.self_video ?? false,
            flags: template?.flags ?? 0
        };
    }

    private get_voice_channel_id(): string | null {
        return findByProps("getVoiceChannelId")?.getVoiceChannelId?.() ?? null;
    }

    private get_self_user_id(): string | null {
        return findByProps("getCurrentUser")?.getCurrentUser?.()?.id ?? null;
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

    private schedule_button_mount() {
        if (this.button_mount_pending) return;
        this.button_mount_pending = true;
        requestAnimationFrame(() => {
            this.button_mount_pending = false;
            this.mount_fd_button();
        });
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
            this.toggle_fd();
            update_view();
        };

        update_view();
        mute_btn.parentElement?.insertBefore(fd_btn, mute_btn);
    }
}

export const fakeDeafen = new FakeDeafen();
