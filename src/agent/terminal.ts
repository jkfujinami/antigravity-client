
import * as pty from 'node-pty';
import * as os from 'os';
import { Timestamp } from "@bufbuild/protobuf";
import { PromiseClient } from "@connectrpc/connect";
import { LanguageServerService } from "../gen/exa/language_server_pb_connect.js";
import {
    TerminalShellCommandStreamChunk,
    TerminalShellCommandHeader,
    TerminalShellCommandData,
    TerminalShellCommandTrailer
} from "../gen/exa/codeium_common_pb_pb.js";

export class TerminalSession {
    constructor(private client: PromiseClient<typeof LanguageServerService>) {}

    async execute(command: string, cwd: string) {
        const isWin = os.platform() === 'win32';
        let shell = process.env.SHELL;

        if (!shell) {
            if (isWin) {
                shell = 'powershell.exe';
            } else {
                const fs = require('fs');
                if (fs.existsSync('/bin/zsh')) shell = '/bin/zsh';
                else if (fs.existsSync('/bin/bash')) shell = '/bin/bash';
                else shell = 'bash';
            }
        }

        const args = isWin ? ['-Command', command] : ['-c', command];

        const ptyProcess = pty.spawn(shell as string, args, {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: cwd || process.cwd(),
            env: process.env
        });

        // Queue to bridge events to async iterator
        const queue: (TerminalShellCommandStreamChunk | null)[] = [];
        let resolveQueue: (() => void) | null = null;
        let rejectQueue: ((err: any) => void) | null = null;

        const push = (chunk: TerminalShellCommandStreamChunk | null) => {
            queue.push(chunk);
            if (resolveQueue) {
                const resolve = resolveQueue;
                resolveQueue = null;
                resolve();
            }
        };

        const error = (err: any) => {
             if (rejectQueue) {
                 const reject = rejectQueue;
                 rejectQueue = null;
                 reject(err);
             }
        };

        // Header
        const header = new TerminalShellCommandHeader({
            commandLine: command,
            cwd: cwd,
            startTime: Timestamp.now(),
            terminalId: "term-" + Date.now(),
        });

        push(new TerminalShellCommandStreamChunk({
            value: { case: "header", value: header }
        }));

        // Data
        ptyProcess.onData((data) => {
            const dataMsg = new TerminalShellCommandData({
                rawData: new TextEncoder().encode(data)
            });
            push(new TerminalShellCommandStreamChunk({
                value: { case: "data", value: dataMsg }
            }));
        });

        // Exit
        ptyProcess.onExit((e) => {
             const trailer = new TerminalShellCommandTrailer({
                 exitCode: e.exitCode,
                 endTime: Timestamp.now(),
             });
             push(new TerminalShellCommandStreamChunk({
                 value: { case: "trailer", value: trailer }
             }));
             push(null); // End of stream
        });

        // Start execution - no need to write command as it is passed in spawn args


        const generator = async function* () {
            while (true) {
                if (queue.length > 0) {
                    const chunk = queue.shift();
                    if (chunk === null) return;
                    yield chunk;
                } else {
                    await new Promise<void>((resolve, reject) => {
                        resolveQueue = resolve;
                        rejectQueue = reject;
                    });
                }
            }
        };

        try {
            await this.client.streamTerminalShellCommand(generator() as any);
        } catch (err) {
            console.error("Failed to stream terminal output", err);
            // Ensure pty is killed
            try { ptyProcess.kill(); } catch {}
        }
    }
}
