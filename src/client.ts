
import { createPromiseClient, PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { Message } from "@bufbuild/protobuf";
import { AutoDetector } from "./autodetect.js";
import { Launcher, type LauncherOptions } from "./server/launcher.js";
import { readAuthStatus } from "./server/auth-reader.js";

// --- Node.js Debug Hack: Make console.log output recursive and clean ---
import util from "util";
const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");
if (typeof process !== "undefined") {
  util.inspect.defaultOptions.depth = null;
  util.inspect.defaultOptions.colors = true;
  util.inspect.defaultOptions.maxArrayLength = null;

  if (Message.prototype as any) {
    (Message.prototype as any)[inspectSymbol] = function () {
      return this.toJson();
    };
  }
}
// -----------------------------------------------------------------------

function resolveApiKey(explicit?: string): string {
    return explicit || process.env.ANTIGRAVITY_API_KEY || readAuthStatus().apiKey || "";
}

// Generated Imports from src/gen
import { LanguageServerService } from "./gen/exa/language_server_pb/language_server_connect.js";
import { Metadata, TextOrScopeItem, ModelOrAlias, Model, ModelAlias, ConversationalPlannerMode } from "./gen/exa/codeium_common_pb/codeium_common_pb.js";
import { StartCascadeRequest, SendUserCascadeMessageRequest, GetCascadeTrajectoryRequest, GetUserStatusResponse, GetModelStatusesResponse, GetWorkingDirectoriesResponse, AddTrackedWorkspaceRequest, GetModelResponseRequest } from "./gen/exa/language_server_pb/language_server_pb.js";
import { StreamReactiveUpdatesRequest, StreamReactiveUpdatesResponse } from "./gen/exa/reactive_component_pb/reactive_component_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig } from "./gen/exa/cortex_pb/cortex_pb.js";

// Note: UnaryResponse might be needed depending on return types, but let's see what the service returns.
import { CascadeTrajectorySummaries } from "./gen/exa/jetski_cortex_pb/jetski_cortex_pb.js";
import { Cascade } from "./cascade.js";
import { ServerInfo } from "./autodetect.js";
import { T } from "./facade/index.js";
import { LanguageServerFacade } from "./facade/services.js";

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
  public readonly languageServer: LanguageServerFacade;

  // Cached model lookup. Populated lazily on first resolveModelId / resolveDefaultModelId.
  private _modelCache: Record<string, ModelInfo> | null = null;
  private _defaultModelId: number | null = null;
  private activeCascades: Set<Cascade> = new Set();

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
    this.languageServer = new LanguageServerFacade(this.transport);
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

  /**
   * Resolve a model identifier to a numeric model id accepted by the LS.
   * Accepts: numeric id (passed through), a `MODEL_NAMES.*` key, or a label key
   * from `getAvailableModels()`. Falls back to the cached default when given
   * an empty string / undefined.
   *
   * Cached after first call; invalidate by setting `_modelCache = null` if the
   * LS catalog can change at runtime (typically it cannot during a session).
   */
  async resolveModelId(nameOrId?: number | string): Promise<number> {
      if (typeof nameOrId === "number") return nameOrId;

      if (!this._modelCache) {
          this._modelCache = await this.getAvailableModels();
      }
      const models = this._modelCache;

      // No name given → default
      if (!nameOrId) {
          if (this._defaultModelId !== null) return this._defaultModelId;
          const flash = models["Gemini_3_Flash"];
          if (flash?.modelId !== undefined) {
              this._defaultModelId = flash.modelId;
              return flash.modelId;
          }
          const firstRec = Object.values(models).find(
              (m) => m.isRecommended && !m.disabled && m.modelId !== undefined
          );
          if (firstRec?.modelId !== undefined) {
              this._defaultModelId = firstRec.modelId;
              return firstRec.modelId;
          }
          throw new Error(
              "resolveModelId: no model available from getAvailableModels(). " +
              "Is the LS reachable and authenticated?"
          );
      }

      // Named lookup
      const direct = models[nameOrId];
      if (direct?.modelId !== undefined) return direct.modelId;

      throw new Error(
          `resolveModelId: model "${nameOrId}" not found. ` +
          `Available: ${Object.keys(models).join(", ")}`
      );
  }

  /** Shortcut for resolveModelId() with no argument. */
  async getDefaultModelId(): Promise<number> {
      return this.resolveModelId();
  }

  async getWorkingDirectories(): Promise<GetWorkingDirectoriesResponse> {
      const response = await this.lsClient.getWorkingDirectories({});
      return response;
  }

  /**
   * Explictly tell the Language Server to track a workspace directory.
   */
  async addTrackedWorkspace(workspacePath: string): Promise<void> {
      await this.lsClient.addTrackedWorkspace(new AddTrackedWorkspaceRequest({
          workspace: workspacePath,
          isPassiveWorkspace: false
      }));
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
          ideVersion: "1.107.0",
          extensionName: "antigravity",
          extensionVersion: "0.2.0",
      });

      const req = new StartCascadeRequest({
          metadata,
      });

      const { cascadeId } = await this.lsClient.startCascade(req);
      const cascade = new Cascade(
          cascadeId,
          this.lsClient,
          this.apiKey,
          (nameOrId) => this.resolveModelId(nameOrId),
      );

      this.activeCascades.add(cascade);

      // Auto-start listening in background
      cascade.listen();

      return cascade;
  }

  async getMcpServerStates(): Promise<import("./gen/exa/language_server_pb/language_server_pb.js").GetMcpServerStatesResponse> {
      return this.lsClient.getMcpServerStates({});
  }

  async refreshMcpServers(): Promise<import("./gen/exa/language_server_pb/language_server_pb.js").RefreshMcpServersResponse> {
      return this.lsClient.refreshMcpServers({});
  }

  /**
   * Resumes an existing cascade by ID. Does NOT verify that the cascade is alive.
   * Use `resumeCascade(id)` if you need a guaranteed-live cascade.
   */
  getCascade(cascadeId: string): Cascade {
      const cascade = new Cascade(
          cascadeId,
          this.lsClient,
          this.apiKey,
          (nameOrId) => this.resolveModelId(nameOrId),
      );
      this.activeCascades.add(cascade);
      cascade.listen();
      return cascade;
  }

  /**
   * Cleans up all active cascade update streams and listener resources.
   * Call this before stopping the Language Server process (e.g. client.launcher.stop()).
   */
  dispose(): void {
      for (const cascade of this.activeCascades) {
          try {
              cascade.dispose();
          } catch (e) {
              // ignore errors during individual cascade disposal
          }
      }
      this.activeCascades.clear();
  }

  /**
   * Resumes an existing cascade and verifies it's still alive on the LS side by
   * calling `getHistory()`. Throws a clear error if the cascade is missing,
   * expired, or unreachable.
   */
  async resumeCascade(cascadeId: string): Promise<Cascade> {
      const cascade = this.getCascade(cascadeId);
      try {
          const history = await cascade.getHistory();
          if (!history?.trajectory) {
              throw new Error("Cascade returned no trajectory (possibly expired).");
          }
      } catch (e: any) {
          throw new Error(
              `resumeCascade: failed to resume cascade "${cascadeId}": ${e?.message ?? e}`
          );
      }
      return cascade;
  }

  /**
   * Sends a simple prompt to the model and gets a string response.
   * This is a quick and direct way to get an AI response without starting a cascade.
   *
   * @param prompt The prompt string to send to the AI.
   * @param model An optional model enum value (defaults to Model.UNSPECIFIED).
   * @returns The AI's response string.
   */
  async getModelResponse(prompt: string, model: Model = Model.UNSPECIFIED): Promise<string> {
      const req = new GetModelResponseRequest({
          prompt: prompt,
          model: model,
      });

      const response = await this.lsClient.getModelResponse(req);
      return response.response;
  }
}

export { T };


