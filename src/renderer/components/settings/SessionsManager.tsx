/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Heading, Paragraph, TextButton } from "@equicord/types/components";
import { useEffect, useState } from "@equicord/types/webpack/common";
import type { SessionsState } from "main/utils/profiles";

import { SettingsComponent } from "./Settings";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";

// VesktopNative is a global provided by the preload script (see src/globals.d.ts)
declare const VesktopNative: typeof import("preload/VesktopNative").VesktopNative;

/**
 * "Sessions" card: manage how many Infinicord Start Menu shortcuts exist
 * ("Infinicord 1.lnk" … each launching its own isolated --profile instance)
 * and launch any of them right away.
 */
export const SessionsManager: SettingsComponent = ({ settings }) => {
    const [state, setState] = useState<SessionsState | null>(null);

    useEffect(() => {
        VesktopNative.sessions
            .getState()
            .then(setState)
            .catch(e => console.error("[Infinicord] sessions:", e));
    }, []);

    if (!state?.supported) return null;

    const current = state.shortcuts.length ? Math.max(...state.shortcuts) : 0;
    const counts = Array.from({ length: state.max }, (_, i) => i);

    return (
        <div>
            <Heading tag="h5">Sessions</Heading>
            <Paragraph>
                Run multiple accounts at once. Each session gets its own Start Menu shortcut and its own Discord login,
                completely independent of the others.
            </Paragraph>
            <Paragraph>Shortcuts in Start Menu:</Paragraph>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {counts.map(n => (
                    <TextButton
                        key={n}
                        onClick={() =>
                            VesktopNative.sessions.setCount(n).then(shortcuts => setState({ ...state, shortcuts }))
                        }
                        variant={n <= current ? "primary" : "secondary"}
                    >
                        {n}
                    </TextButton>
                ))}
            </div>
            {state.shortcuts.length > 0 && (
                <>
                    <VesktopSettingsSwitch
                        title="Ask Which Profile on Launch"
                        description="Show a picker when starting Infinicord to choose which profile to open"
                        value={settings.askProfileOnLaunch ?? false}
                        onChange={v => (settings.askProfileOnLaunch = v)}
                    />
                    <Paragraph>Launch now:</Paragraph>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {state.shortcuts.map(n => (
                            <TextButton key={n} onClick={() => VesktopNative.sessions.launch(n)} variant="secondary">
                                Launch Infinicord {n}
                            </TextButton>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
