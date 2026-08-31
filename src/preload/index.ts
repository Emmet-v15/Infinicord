/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { contextBridge, ipcRenderer, webFrame } from "electron/renderer";

import { IpcEvents } from "../shared/IpcEvents";
import { VesktopNative } from "./VesktopNative";

contextBridge.exposeInMainWorld("VesktopNative", VesktopNative);

// Infinicord opus voice enhancement: force stereo, high-bitrate CBR opus on all voice connections
function audioEnhancePatch() {
    const { prototype: rtcProto } = RTCPeerConnection;
    const origSetLocal = rtcProto.setLocalDescription;
    const origSetRemote = rtcProto.setRemoteDescription;

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
}

webFrame
    .executeJavaScript("(" + audioEnhancePatch.toString() + ")()")
    .then(() => console.log("[Infinicord] opus audioEnhancePatch applied"))
    .catch(e => console.error("[Infinicord] audioEnhancePatch failed:", e));

// While sandboxed, Electron "polyfills" these APIs as local variables.
// We have to pass them as arguments as they are not global
Function(
    "require",
    "Buffer",
    "process",
    "clearImmediate",
    "setImmediate",
    ipcRenderer.sendSync(IpcEvents.GET_VENCORD_PRELOAD_SCRIPT)
)(require, Buffer, process, clearImmediate, setImmediate);

webFrame.executeJavaScript(ipcRenderer.sendSync(IpcEvents.GET_VENCORD_RENDERER_SCRIPT));
webFrame.executeJavaScript(ipcRenderer.sendSync(IpcEvents.GET_VESKTOP_RENDERER_SCRIPT));
