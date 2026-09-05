/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { join } from "path";

import { DATA_DIR } from "./constants";
import { State } from "./settings";

// this is in a separate file to avoid circular dependencies.
// The cache lives in the shared data dir so every profile instance reuses
// one download instead of keeping a 16MB copy in its own sessionData.
export const VENCORD_DIR = State.store.infinicordDir
    ? join(State.store.infinicordDir, "infinicord")
    : join(DATA_DIR, "cache", "infinicord.asar");
