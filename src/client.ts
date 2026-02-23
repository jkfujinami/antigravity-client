
import { createPromiseClient, PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { AutoDetector } from "./autodetect.js";
import { Launcher, type LauncherOptions } from "./server/launcher.js";
import { readAuthStatus } from "./server/auth-reader.js";

function resolveApiKey(explicit?: string): string {
    return explicit || process.env.ANTIGRAVITY_API_KEY || readAuthStatus().apiKey || "";
}

// Generated Imports from src/gen
import { LanguageServerService } from "./gen/exa/language_server_pb_connect.js";
import { Metadata, TextOrScopeItem, ModelOrAlias, Model, ModelAlias, ConversationalPlannerMode } from "./gen/exa/codeium_common_pb_pb.js";
import { StartCascadeRequest, SendUserCascadeMessageRequest, GetCascadeTrajectoryRequest, GetUserStatusResponse, GetModelStatusesResponse, GetWorkingDirectoriesResponse } from "./gen/exa/language_server_pb_pb.js";
import { StreamReactiveUpdatesRequest, StreamReactiveUpdatesResponse } from "./gen/exa/reactive_component_pb_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig } from "./gen/exa/cortex_pb_pb.js";

// Note: UnaryResponse might be needed depending on return types, but let's see what the service returns.
import { CascadeTrajectorySummaries } from "./gen/exa/jetski_cortex_pb_pb.js";
import { Cascade } from "./cascade.js";
import { ServerInfo } from "./autodetect.js";

/**
 * Options for connecting to an existing Antigravity Language Server.
 */
export interface ClientOptions {
  /**
   * If true, automatically scans running processes to find an active Antigravity Language Server.
   * If false, you MUST provide `port` and `csrfToken` manually.
   * @default true
   */
  autoDetect?: boolean;

  /**
   * The HTTP/HTTPS port the Language Server is listening on.
   * Required if `autoDetect` is false.
   */
  port?: number;

  /**
   * The CSRF token required to authenticate with the Language Server.
   * Required if `autoDetect` is false.
   */
  csrfToken?: string;

  /**
   * Optional. If provided during auto-detection, it will prioritize finding a Language Server
   * that is serving this specific workspace path.
   */
  workspacePath?: string;

  /**
   * Optional. Your Antigravity API key.
   * If not provided, it will try to read from `process.env.ANTIGRAVITY_API_KEY`,
   * and fallback to reading the saved credentials from `~/.codeium/auth.json`.
   */
  apiKey?: string;
}

export interface ModelInfo {
  label: string;
  isPremium: boolean;
  isRecommended: boolean;
  disabled: boolean;
  model?: string;
  modelId?: number;
  alias?: string;
  aliasId?: number;
}

export { ServerInfo };

export class AntigravityClient {
  private transport;
  public lsClient: PromiseClient<typeof LanguageServerService>;
  private csrfToken: string;
  private apiKey: string;

  private constructor(port: number, csrfToken: string, apiKey: string) {
    this.csrfToken = csrfToken;
    this.apiKey = apiKey;

    // Connect RPC Transport (HTTP/2 + TLS)
    this.transport = createConnectTransport({
      baseUrl: `https://127.0.0.1:${port}`,
      httpVersion: "2",
      nodeOptions: {
        rejectUnauthorized: false,
      },
      interceptors: [
        (next) => async (req) => {
          req.header.set("x-codeium-csrf-token", this.csrfToken);
          return await next(req);
        },
      ],
    });

    this.lsClient = createPromiseClient(LanguageServerService, this.transport);
  }

  /**
   * Returns all running Language Server processes. (Low-level API)
   */
  static async listServers(): Promise<ServerInfo[]> {
    const detector = new AutoDetector();
    return await detector.findAllServers();
  }

  /**
   * Standard connection method. (High-level API)
   */
  static async connect(options: ClientOptions = {}): Promise<AntigravityClient> {
    let port = options.port;
    let csrfToken = options.csrfToken;
    let apiKey = resolveApiKey(options.apiKey);

    if (!port || !csrfToken) {
        const detector = new AutoDetector();
        if (options.autoDetect !== false) {
          const server = await detector.findBestServer(options.workspacePath);
          port = server.httpsPort || server.httpPort;
          csrfToken = server.csrfToken;
          console.log(`[Client] Connected to LS (PID: ${server.pid}, Port: ${port})`);
        } else {
          throw new Error("Port and CSRF token required when autoDetect is false.");
        }
    }

    return new AntigravityClient(port!, csrfToken!, apiKey);
  }

  /**
   * Connect using a specific ServerInfo object. (Low-level API)
   */
  static async connectWithServer(server: ServerInfo, apiKey?: string): Promise<AntigravityClient> {
     const port = server.httpsPort || server.httpPort;
     const token = server.csrfToken;
     const finalApiKey = resolveApiKey(apiKey);

     if (!port) {
         throw new Error(`Server at PID ${server.pid} does not have a valid port.`);
     }

     return new AntigravityClient(port, token, finalApiKey);
  }

  /**
   * Launch an independent LS and connect to it. (Standalone mode)
   * No running Antigravity IDE required — starts its own LS process.
   *
   * Returns a client with a `launcher` property for lifecycle management.
   * Call `client.launcher.stop()` when done.
   */
  static async launch(options: LauncherOptions = {}): Promise<AntigravityClient & { launcher: Launcher }> {
      const launcher = await Launcher.start(options);
      const client = new AntigravityClient(
          launcher.httpsPort,
          launcher.csrfToken,
          resolveApiKey()
      );
      return Object.assign(client, { launcher });
  }

  async getUserStatus(): Promise<GetUserStatusResponse> {
      const response = await this.lsClient.getUserStatus({});
      return response;
  }

  async getModelStatuses(): Promise<GetModelStatusesResponse> {
      const response = await this.lsClient.getModelStatuses({});
      return response;
  }

  /**
   * Returns a structured map of available models from UserStatus.
   */
  async getAvailableModels(): Promise<Record<string, ModelInfo>> {
      const userStatus = await this.getUserStatus();
      const configs = userStatus.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];

      const models: Record<string, ModelInfo> = {};

      configs.forEach((m: any) => {
          const label = m.label;
          const choice = m.modelOrAlias?.choice;

          if (!label || !choice) return;

          const info: ModelInfo = {
              label: label,
              isPremium: !!m.isPremium,
              isRecommended: !!m.isRecommended,
              disabled: !!m.disabled,
          };

          if (choice.case === "model") {
              info.model = Model[choice.value];
              info.modelId = choice.value;
          } else if (choice.case === "alias") {
              info.alias = ModelAlias[choice.value];
              info.aliasId = choice.value;
          }

          // Use label as key, removing special characters for cleaner keys
          const key = label.replace(/\s+/g, '_').replace(/[()]/g, '');
          models[key] = info;
      });

      return models;
  }

  async getWorkingDirectories(): Promise<GetWorkingDirectoriesResponse> {
      const response = await this.lsClient.getWorkingDirectories({});
      return response;
  }

  async *getSummariesStream(): AsyncGenerator<StreamReactiveUpdatesResponse, void, unknown> {
      const stream = this.lsClient.streamCascadeSummariesReactiveUpdates(
          new StreamReactiveUpdatesRequest({
              protocolVersion: 1,
              id: "summaries",
          })
      );

      for await (const res of stream) {
          if (res.diff) {
              const state = new CascadeTrajectorySummaries();
              // Note: Ideally we should accumulate state, but for a quick check we'll return the diff-applied empty state
              // Or better, let the caller handle state accumulation if they want full sync.
              // For now, let's yield the raw diff for the test script to handle, or apply it to a fresh object.
              // Given applyMessageDiff is not a method of the client, we might want to just yield the response and let the caller handle it.
              // But to be consistent with getCascade, let's yield the raw response for now.
              yield res;
          }
      }
  }

  async startCascade(): Promise<Cascade> {
      const metadata = new Metadata({
          apiKey: this.apiKey,
          ideName: "vscode",
          ideVersion: "1.18.4",
          extensionName: "antigravity",
          extensionVersion: "0.2.0",
      });

      const req = new StartCascadeRequest({
          metadata,
      });

      const { cascadeId } = await this.lsClient.startCascade(req);
      const cascade = new Cascade(cascadeId, this.lsClient, this.apiKey);

      // Auto-start listening in background
      cascade.listen();

      return cascade;
  }

  /**
   * Resumes an existing cascade by ID.
   */
  getCascade(cascadeId: string): Cascade {
      const cascade = new Cascade(cascadeId, this.lsClient, this.apiKey);
      cascade.listen();
      return cascade;
  }
}


