
import { proto3 } from "@bufbuild/protobuf";
import { MethodKind } from "@bufbuild/protobuf";

// --- Minimal Schema Definitions (using makeMessageType) ---

// Metadata
export const Metadata = proto3.makeMessageType(
  "exa.codeium_common_pb.Metadata",
  [
    { no: 3, name: "api_key", kind: "scalar", T: 9 /* STRING */ },
    { no: 1, name: "ide_name", kind: "scalar", T: 9 },
    { no: 2, name: "ide_version", kind: "scalar", T: 9 },
    { no: 12, name: "extension_name", kind: "scalar", T: 9 },
    { no: 2, name: "extension_version", kind: "scalar", T: 9 },
    // ... complete as needed
  ]
);

// UserStatus (response part)
export const UserStatus = proto3.makeMessageType(
  "exa.language_server_pb.UserStatus",
  [
    { no: 1, name: "is_logged_in", kind: "scalar", T: 8 /* BOOL */ },
    { no: 2, name: "username", kind: "scalar", T: 9 },
    { no: 3, name: "name", kind: "scalar", T: 9 },
  ]
);

// Request/Response
export const GetUserStatusRequest = proto3.makeMessageType(
  "exa.language_server_pb.GetUserStatusRequest",
  [
    { no: 1, name: "metadata", kind: "message", T: Metadata },
  ]
);

export const GetUserStatusResponse = proto3.makeMessageType(
  "exa.language_server_pb.GetUserStatusResponse",
  [
    { no: 1, name: "user_status", kind: "message", T: UserStatus },
  ]
);

export const StartCascadeRequest = proto3.makeMessageType(
    "exa.language_server_pb.StartCascadeRequest",
    [
        { no: 3, name: "metadata", kind: "message", T: Metadata }
    ]
);

export const StartCascadeResponse = proto3.makeMessageType(
    "exa.language_server_pb.StartCascadeResponse",
    [
        { no: 1, name: "cascade_id", kind: "scalar", T: 9 }
    ]
);


// Service Definition
export const LanguageServerService = {
  typeName: "exa.language_server_pb.LanguageServerService",
  methods: {
    getUserStatus: {
      name: "GetUserStatus",
      I: GetUserStatusRequest,
      O: GetUserStatusResponse,
      kind: MethodKind.Unary,
    },
    startCascade: {
      name: "StartCascade",
      I: StartCascadeRequest,
      O: StartCascadeResponse,
      kind: MethodKind.Unary,
    }
  }
} as const;
