import { Topic } from "./src/gen/exa/unified_state_sync_pb/unified_state_sync_pb.js";
import { OAuthTokenInfo } from "./src/gen/exa/language_server_pb/language_server_pb.js";

const base64Str = "CqUEChlvYXV0aFRva2VuSW5mb1NlbnRpbmVsS2V5EocECoQEQ29VQ2VXRXlPUzVoTUVGUmRsQjVTVTFIUVhSblkzUTVTVXRLTURVeVpWTjZNRTFETjFWSE0zbG5VRTlKYTFkelRrUjJaMHhPVVd0NVJWRldVWFJUVFhsQmVteE5TbTU0WlVsUFZrNWtNa0pLYkdSNmR6VmhkMTlGUkVobFRuUk1kRk5KVkVac1ZVODBUWFJhUmtKNVN6UlJkRkJLZGxSQmNFcFVOV3hvVFdVMlgyeERkblpLVUhOWE5ITlpkVzU2VTJjMU9XNUNlVWRzYUhsV1UyTmpaVEpGVkd0amFtaFlNblZ1ZFdGeldEUXdZVmgzTkVSeFpETlBlR04wZVhjNWIyUk1jWGRZYjNwYU9GQjRWME42Y2xWaWFsTndja0kyYTJGRFoxbExRV0UwVTBGU1JWTkdVVWhIV0RKTmFUaHRjMDVNYjA4MWFuUjNkbGRxWkhoUE9WWnliRUV3TWpFMEVnWkNaV0Z5WlhJYVp6RXZMekJsYW5sZmF6QXlUMVJDWWxCRFoxbEpRVkpCUVVkQk5GTk9kMFl0VERsSmNqSjVWRU55TFRKaWRYRnFkM0pTUWxkMFZIWkJURFJSY0hoSU9YaGxVRkkwVGtsdmJHVmZObmhFVVZOVFVVRXlPVmxNWTBwVWVsOVlOMWc0TlZwblIwWktjR2NpQmdqbXpyUFFCZz09CvkBCh9hdXRoU3RhdGVXaXRoQ29udGV4dFNlbnRpbmVsS2V5EtUBCtIBeyJzdGF0ZSI6InNpZ25lZEluIiwiY29udGV4dCI6eyJwcm9qZWN0IjoiIiwic2hvd1Byb2plY3RFcnJvciI6ZmFsc2UsImVycm9yTWVzc2FnZSI6IiIsImluZWxpZ2libGVNZXNzYWdlIjoiIiwidmVyaWZpY2F0aW9uVXJsIjoiIiwiaXNHY3BUb3MiOmZhbHNlLCJicm93c2VyT3BlbkZhaWxlZCI6ZmFsc2UsImFwcGVhbFVybCI6IiIsImFwcGVhbExpbmtUZXh0IjoiIn19";
const bytes = Buffer.from(base64Str, 'base64');
const topic = Topic.fromBinary(bytes);
for (const entry of topic.data) {
    if (entry.key === "oauthTokenInfoSentinelKey") {
        const valBytes = Buffer.from(entry.value!.value, "base64");
        const tokenInfo = OAuthTokenInfo.fromBinary(valBytes);
        console.log("OAuthTokenInfo JSON:\n", JSON.stringify(tokenInfo.toJson(), null, 2));
    }
}
