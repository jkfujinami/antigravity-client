/**
 * Metadata Generator
 *
 * Generates the binary Metadata protobuf that must be written to LS's stdin on startup.
 * This is part of the LS initialization handshake.
 */
import { Metadata } from "../gen/exa/codeium_common_pb_pb.js";

export interface MetadataOptions {
    ideName?: string;
    ideVersion?: string;
    extensionName?: string;
    extensionVersion?: string;
    apiKey?: string;
    locale?: string;
    sessionId?: string;
}

/**
 * Create a Metadata protobuf binary for LS stdin initialization.
 */
export function createMetadataBinary(options: MetadataOptions = {}): Uint8Array {
    const metadata = new Metadata({
        ideName: options.ideName ?? "vscode",
        ideVersion: options.ideVersion ?? "1.18.4",
        extensionName: options.extensionName ?? "antigravity",
        extensionVersion: options.extensionVersion ?? "0.2.0",
        apiKey: options.apiKey ?? "",
        locale: options.locale ?? "en",
        sessionId: options.sessionId ?? `session-${Date.now()}`,
    });
    return metadata.toBinary();
}
