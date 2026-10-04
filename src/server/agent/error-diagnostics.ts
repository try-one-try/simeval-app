// 诊断只取固定字段和白名单值；不读取错误正文、请求内容或密钥。
import "server-only";

const errorClasses = [
  "MiddlewareError", "ContextOverflowError", "TimeoutError", "AbortError",
  "InsufficientQuotaError", "RateLimitQuotaExhaustedError", "RateLimitCapacityError",
  "OpenAIError", "APIError", "APIConnectionError", "APIConnectionTimeoutError", "APIUserAbortError",
  "BadRequestError", "AuthenticationError", "PermissionDeniedError", "NotFoundError",
  "ConflictError", "UnprocessableEntityError", "RateLimitError", "InternalServerError",
  "LengthFinishReasonError", "ContentFilterFinishReasonError",
] as const;
const providerCodes = [
  "invalid_api_key", "insufficient_quota", "rate_limit_exceeded", "model_not_found",
  "unsupported_parameter", "unsupported_value", "invalid_parameter", "invalid_value",
  "invalid_request_error", "context_length_exceeded", "permission_denied", "server_error",
  "billing_hard_limit_reached", "account_deactivated",
] as const;
const providerTypes = [
  "invalid_request_error", "authentication_error", "permission_error", "rate_limit_error",
  "server_error", "insufficient_quota", "tokens", "requests",
] as const;
const langchainCodes = [
  "MODEL_AUTHENTICATION", "MODEL_RATE_LIMIT", "MODEL_NOT_FOUND", "INVALID_TOOL_RESULTS",
] as const;
const parameters = [
  "model", "max_tokens", "max_completion_tokens", "reasoning_effort", "temperature", "top_p",
  "stream", "stream_options", "messages", "tools", "tool_choice", "parallel_tool_calls", "response_format",
] as const;
const networkCodes = [
  "ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
  "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
] as const;

export type AssistantErrorDiagnostics = {
  status?: number;
  errorClass?: typeof errorClasses[number];
  providerCode?: typeof providerCodes[number];
  providerType?: typeof providerTypes[number];
  langchainCode?: typeof langchainCodes[number];
  parameter?: typeof parameters[number];
  requestId?: string;
  networkCode?: typeof networkCodes[number];
};

function asObject(value: unknown): object | undefined {
  return typeof value === "object" && value !== null ? value : undefined;
}
function field(value: object, key: string): unknown {
  // 第三方错误可能带 getter，诊断失败不能盖掉原来的失败。
  try { return Reflect.get(value, key); } catch { return undefined; }
}
function allowed<T extends string>(value: unknown, whitelist: readonly T[]): T | undefined {
  return typeof value === "string" ? whitelist.find(candidate => candidate === value) : undefined;
}
function knownClass(value: object): AssistantErrorDiagnostics["errorClass"] {
  const constructor = field(value, "constructor");
  const className = typeof constructor === "function" ? field(constructor, "name") : undefined;
  // 类名只作补充线索，生产压缩可能改名；状态码与错误码不依赖类名。
  return allowed(className, errorClasses) ?? allowed(field(value, "name"), errorClasses);
}

export function getAssistantErrorDiagnostics(error: unknown): AssistantErrorDiagnostics {
  const diagnostics: AssistantErrorDiagnostics = {};
  const seen = new Set<object>();
  let current = asObject(error);
  // LangChain 将原错放在 cause；最多看六层，循环引用立即停止。
  for (let depth = 0; current && depth < 6 && !seen.has(current); depth++) {
    seen.add(current);
    const status = field(current, "status");
    if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) {
      diagnostics.status ??= status;
    }
    const errorClass = knownClass(current);
    if (errorClass) diagnostics.errorClass = errorClass;
    const code = field(current, "code");
    diagnostics.providerCode ??= allowed(code, providerCodes);
    diagnostics.providerType ??= allowed(field(current, "type"), providerTypes);
    diagnostics.langchainCode ??= allowed(field(current, "lc_error_code"), langchainCodes);
    diagnostics.parameter ??= allowed(field(current, "param"), parameters);
    diagnostics.networkCode ??= allowed(code, networkCodes);
    const requestId = field(current, "requestID");
    if (typeof requestId === "string" && /^req_[A-Za-z0-9]{8,80}$/.test(requestId)) {
      diagnostics.requestId ??= requestId;
    }
    current = asObject(field(current, "cause"));
  }
  return diagnostics;
}
