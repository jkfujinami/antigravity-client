
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const isWindows = process.platform === "win32";

export interface ServerInfo {
  pid: number;
  httpPort: number;       // The port from --extension_server_port (HTTP/JSON)
  httpsPort?: number;     // The port for Connect RPC (HTTP/2 + TLS)
  csrfToken: string;
  workspaceId: string;
  startTime: Date;
}

export class AutoDetector {
  /**
   * Returns all running Language Server processes with extracted info.
   */
  async findAllServers(): Promise<ServerInfo[]> {
    const pids = await this.getLanguageServerPids();
    if (pids.length === 0) return [];

    const servers = (await Promise.all(pids.map((pid) => this.inspectProcess(pid))))
      .filter((s): s is ServerInfo => s !== null);

    // Sort by start time (newest first)
    servers.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Populate HTTPS ports
    for (const server of servers) {
      server.httpsPort = await this.findHttpsPort(server.pid) || undefined;
    }

    return servers;
  }

  /**
   * Finds the most relevant running Language Server process.
   */
  async findBestServer(workspacePath?: string): Promise<ServerInfo> {
    const servers = await this.findAllServers();
    if (servers.length === 0) {
      throw new Error("No Antigravity Language Server running. Please open Antigravity (VS Code).");
    }

    let targetServer: ServerInfo | undefined;

    if (workspacePath) {
      const normalizedPath = workspacePath.replace(/\//g, '_');
      targetServer = servers.find(s => s.workspaceId.includes(normalizedPath));
    }

    if (!targetServer) {
        targetServer = servers[0];
    }

    if (!targetServer.httpsPort) {
        console.warn(`[AutoDetector] Warning: Could not determine HTTPS port for PID ${targetServer.pid}. RPC might fail.`);
    }

    return targetServer;
  }

  /**
   * Returns a list of PIDs for language_server processes listening on TCP.
   */
  private async getLanguageServerPids(): Promise<number[]> {
    try {
      if (isWindows) {
        // Use PowerShell to find language_server.exe processes
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'language_server.exe\'\\" | Select-Object -ExpandProperty ProcessId"'
        );
        const pids = stdout.trim().split(/\r?\n/)
          .filter(Boolean)
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n));
        return [...new Set(pids)];
      } else {
        // lsof -nP -iTCP -sTCP:LISTEN | grep language_ | awk '{print $2}'
        const { stdout } = await execAsync("lsof -nP -iTCP -sTCP:LISTEN | grep language_ | awk '{print $2}'");
        const pids = stdout.trim().split("\n")
          .filter(Boolean)
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n));
        return [...new Set(pids)];
      }
    } catch (e) {
      return [];
    }
  }

  /**
   * Extract basic info from process command line and start time.
   */
  private async inspectProcess(pid: number): Promise<ServerInfo | null> {
    try {
      let argsOut: string;
      let startTimeStr: string;

      if (isWindows) {
        // Use WMI to get command line and creation date
        const { stdout: wmiOut } = await execAsync(
          `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}') | ForEach-Object { $_.CommandLine + '|||' + $_.CreationDate.ToString('o') }"`
        );
        const parts = wmiOut.trim().split('|||');
        argsOut = parts[0] || '';
        startTimeStr = parts[1] || '';
      } else {
        const { stdout: psArgs } = await execAsync(`ps -p ${pid} -o args=`);
        const { stdout: lstartOut } = await execAsync(`LC_ALL=C ps -p ${pid} -o lstart=`);
        argsOut = psArgs;
        startTimeStr = lstartOut.trim();
      }

      const portMatch = argsOut.match(/--extension_server_port\s+(\d+)/);
      const csrfMatch = argsOut.match(/--csrf_token\s+([a-f0-9-]+)/);
      const workspaceMatch = argsOut.match(/--workspace_id\s+([^\s]+)/);

      if (!csrfMatch) {
         return null;
      }

      return {
        pid,
        httpPort: portMatch ? parseInt(portMatch[1], 10) : 0,
        csrfToken: csrfMatch[1],
        workspaceId: workspaceMatch ? workspaceMatch[1] : "unknown",
        startTime: new Date(startTimeStr)
      };

    } catch (e) {
      return null;
    }
  }

  /**
   * Finds the HTTPS port (Connect RPC endpoint) for the given PID.
   * LS opens ports in order: HTTPS -> HTTP -> LSP, so lowest port/FD = HTTPS.
   */
  private async findHttpsPort(pid: number): Promise<number | null> {
    try {
      if (isWindows) {
        // Use PowerShell Get-NetTCPConnection to find listening ports
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort"`
        );
        const ports = stdout.trim().split(/\r?\n/)
          .filter(Boolean)
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n));
        if (ports.length === 0) return null;
        // Return the lowest port (HTTPS is typically opened first)
        ports.sort((a, b) => a - b);
        return ports[0];
      } else {
        const { stdout } = await execAsync(`lsof -nP -iTCP -sTCP:LISTEN -a -p ${pid}`);
        const lines = stdout.trim().split("\n").filter(l => l.includes("LISTEN"));

        const entries: { fd: number; port: number }[] = [];
        for (const line of lines) {
          const fdMatch = line.match(/\s+(\d+)u\s+IPv/);
          const portMatch = line.match(/:(\d+)\s+\(LISTEN\)/);
          if (fdMatch && portMatch) {
            entries.push({ fd: parseInt(fdMatch[1], 10), port: parseInt(portMatch[1], 10) });
          }
        }

        if (entries.length === 0) return null;
        entries.sort((a, b) => a.fd - b.fd);
        return entries[0].port;
      }
    } catch (e) {
      return null;
    }
  }
}
