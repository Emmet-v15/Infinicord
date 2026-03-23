/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { contextBridge, ipcRenderer, webFrame } from "electron/renderer";

import { IpcEvents } from "../shared/IpcEvents";
import { VesktopNative } from "./VesktopNative";

contextBridge.exposeInMainWorld("VesktopNative", VesktopNative);

const isSandboxed = typeof __dirname === "undefined";
if (isSandboxed) {
    Function(
        "require",
        "Buffer",
        "process",
        "clearImmediate",
        "setImmediate",
        ipcRenderer.sendSync(IpcEvents.GET_VENCORD_PRELOAD_SCRIPT)
    )(require, Buffer, process, clearImmediate, setImmediate);
} else {
    require(ipcRenderer.sendSync(IpcEvents.DEPRECATED_GET_VENCORD_PRELOAD_SCRIPT_PATH));
}

function audioEnhancePatch() {
    const { prototype: rtcProto } = RTCPeerConnection;
    const origSetLocal = rtcProto.setLocalDescription;
    const origSetRemote = rtcProto.setRemoteDescription;
    const origGetStats = rtcProto.getStats;
    const origWsSend = WebSocket.prototype.send;
    const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    function mungeOpus(sdp: string): string {
        if (!sdp) return sdp;
        sdp = sdp.replace(
            /a=fmtp:(\d+) minptime=10;useinbandfec=1/g,
            "a=fmtp:$1 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=384000;cbr=1"
        );
        return sdp.replace(/(m=audio .*)\r\n/, (match, mline) => {
            const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000/)?.[1];
            if (!pt) return match;
            const parts = mline.split(" ");
            return [...parts.slice(0, 3), pt, ...parts.slice(3).filter((p: string) => p !== pt)].join(" ") + "\r\n";
        });
    }

    function applyBitrate(pc: RTCPeerConnection) {
        for (const s of pc.getSenders()) {
            if (s.track?.kind !== "audio" || !s.getParameters().encodings?.length) continue;
            const p = s.getParameters();
            Object.assign(p.encodings[0], { maxBitrate: 384000, priority: "high", networkPriority: "high" });
            s.setParameters(p).catch(() => {});
        }
    }

    function patchSdpMethod(orig: Function) {
        return function (this: RTCPeerConnection, desc: any) {
            if (desc?.sdp) desc.sdp = mungeOpus(desc.sdp);
            const result = orig.apply(this, arguments as any);
            result.then(() => applyBitrate(this)).catch(() => {});
            return result;
        };
    }

    rtcProto.setLocalDescription = patchSdpMethod(origSetLocal);
    rtcProto.setRemoteDescription = patchSdpMethod(origSetRemote);

    // VAD defeat: AnalyserNode — clamp all read methods to minimum floors
    const origByteFreq = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = function (arr: Uint8Array) {
        // @ts-ignore
        origByteFreq.call(this, arr);
        const cutoff = Math.floor(arr.length * (4000 / (this.context.sampleRate / 2)));
        for (let i = 0; i < cutoff; i++) {
            if (arr[i] < 80) arr[i] = 80;
        }
    };

    const analyserPatches: [string, number, number][] = [
        // [method, floor, silenceThreshold]
        ["getByteTimeDomainData", 145, 132], // silence ~128
        ["getFloatFrequencyData", -40, -80],
        ["getFloatTimeDomainData", 0.05, 0.01]
    ];
    for (const [method, floor, threshold] of analyserPatches) {
        const orig = (AnalyserNode.prototype as any)[method];
        (AnalyserNode.prototype as any)[method] = function (arr: any) {
            orig.call(this, arr);
            const isAbs = method === "getFloatTimeDomainData";

            // Check if there's real signal
            let peak = 0;
            for (let i = 0; i < arr.length; i++) {
                const v = isAbs ? Math.abs(arr[i]) : arr[i];
                if (v > peak) peak = v;
            }
            if (peak < threshold) return; // actually silent, don't spoof

            for (let i = 0; i < arr.length; i++) {
                const val = isAbs ? Math.abs(arr[i]) : arr[i];
                if (val < floor) arr[i] = floor + (arr[i] - floor) * 0.3;
            }
        };
    }

    // VAD defeat: getStats — inflate audioLevel/totalAudioEnergy
    rtcProto.getStats = async function (...args: any[]) {
        const stats: RTCStatsReport = await (origGetStats as any).apply(this, args);
        stats.forEach((r: any) => {
            if (r.kind !== "audio") return;
            try {
                if (r.audioLevel === 0) r.audioLevel = 1e-6;
            } catch {}
            try {
                if (r.totalAudioEnergy === 0) r.totalAudioEnergy = 1e-6;
            } catch {}
        });
        return stats;
    };

    // VAD defeat: WebSocket speaking flag
    WebSocket.prototype.send = function (data) {
        if (typeof data === "string") {
            try {
                const j = JSON.parse(data);
                if (j.op === 5 && j.d) {
                    j.d.speaking |= 1;
                    data = JSON.stringify(j);
                }
            } catch {}
        }
        return origWsSend.call(this, data);
    };

    // getUserMedia: disable processing, inject gain
    navigator.mediaDevices.getUserMedia = async function (constraints?: MediaStreamConstraints) {
        if (constraints?.audio) {
            if (typeof constraints.audio === "boolean") constraints.audio = {};
            Object.assign(constraints.audio, {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                voiceActivityDetection: false,
                sampleRate: 48000,
                channelCount: 2
            });
        }
        const stream = await origGUM(constraints);
        if (!constraints?.audio || !stream.getAudioTracks().length) return stream;

        const ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(2.0, ctx.currentTime);

        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(stream).connect(gain).connect(dest);
        return new MediaStream([...dest.stream.getAudioTracks(), ...stream.getVideoTracks()]);
    };
}

webFrame.executeJavaScript("(" + audioEnhancePatch.toString() + ")()");

webFrame.executeJavaScript(ipcRenderer.sendSync(IpcEvents.GET_VENCORD_RENDERER_SCRIPT));
webFrame.executeJavaScript(ipcRenderer.sendSync(IpcEvents.GET_VESKTOP_RENDERER_SCRIPT));
