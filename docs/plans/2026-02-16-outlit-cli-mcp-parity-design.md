# Outlit CLI + MCP Parity Design (Remote-First Beta)

## Context

Outlit wants a public `outlit` CLI that:

- has feature parity with the existing MCP tool surface,
- supports additional onboarding automation beyond MCP,
- is optimized for AI agents and non-interactive usage,
- ships early as open beta,
- remains compatible with Clerk-based auth and existing platform APIs.

This design chooses a lean internal adapter strategy over building a generalized code generator.

## Decisions

### 1) Repository and packaging

- Build in `outlit-sdk` as `packages/cli`.
- Publish package name `outlit` (beta dist-tag initially).
- Keep platform-sensitive orchestration in Outlit platform APIs.

Rationale: fastest OSS iteration, shared SDK/runtime code reuse, no cross-repo release drift.

### 2) Transport strategy

- Beta v1 is **remote MCP first**.
- No stdio transport requirement in v1.
- Keep design extensible for future `--transport stdio` fallback.

Rationale: centralized updates, less client version drift, simpler support/debug.

### 3) Parity model

- `outlit mcp <operation>` is a parity namespace for MCP-equivalent operations.
- CLI commands do not need to call the MCP protocol directly.
- Both CLI and MCP adapters call the same underlying operation implementations and platform APIs.

Rationale: true contract parity without adapter-to-adapter coupling.

### 4) Auth strategy (Clerk-native)

- Post-beta default: `outlit auth login` uses web OAuth (PKCE/public client).
- Beta support includes `--api-key` fallback (explicit mode), especially for CI/headless.
- CLI stores both credential types by profile:
  - `oauth_session`: access token + refresh token + expiry metadata
  - `api_key`: key + metadata
- Session refresh should be silent and automatic to maximize DX and agent reliability.

## Architecture

## Shared operation core

Create a shared operation registry in SDK (for example `packages/operations`) as source of truth.

```ts
type OperationSpec<TInput, TOutput> = {
  id: string;
  mcpToolName: string;
  cliPath: readonly string[];
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  examples: readonly { name: string; input: TInput }[];
  execute: (ctx: OperationContext, input: TInput) => Promise<TOutput>;
};
```

This registry feeds:

- MCP adapter (`tools/list`, tool handlers)
- CLI adapter (`citty` command tree)
- Docs/help generation
- Parity tests

## Core repo impact (required)

This plan requires coordinated changes in `Core` (platform + hosted MCP server). Current MCP traffic in `Core` is routed through:

- Hosted MCP server: `apps/mcp/app/mcp/route.ts`
- MCP server HTTP client to platform: `apps/mcp/lib/platform-client.ts`
- Platform auth gate: `apps/platform/lib/api/internal-mcp-auth.ts`
- Platform internal MCP routes:
  - `apps/platform/app/api/internal/mcp/customers/route.ts`
  - `apps/platform/app/api/internal/mcp/users/route.ts`
  - `apps/platform/app/api/internal/mcp/timeline/route.ts`
  - `apps/platform/app/api/internal/mcp/facts/route.ts`
  - `apps/platform/app/api/internal/mcp/context-search/route.ts`
  - `apps/platform/app/api/internal/mcp/sql/route.ts`
  - `apps/platform/app/api/internal/mcp/sql-schema/route.ts`
  - `apps/platform/app/api/internal/mcp/revenue/route.ts`
  - `apps/platform/app/api/internal/mcp/validate-api-key/route.ts`

Important: there is another consumer that calls these same routes directly (Outlit agent workflow tools), but this is a secondary Slack-bot integration and should not drive primary CLI/MCP architecture decisions. Contract changes should consider it for compatibility, not as a design constraint:

- `apps/platform/lib/outlit-agent/tools.ts`

## Core repo current-state audit

### Auth state today

- Internal routes currently authenticate via:
  1. `x-internal-secret` + `x-internal-org-id` (trusted service path)
  2. `Authorization: Bearer ok_*` (MCP API keys)
- This is implemented in `apps/platform/lib/api/internal-mcp-auth.ts`.
- Hosted MCP server validates `ok_*` keys via `validate-api-key` and then forwards org context.

Implication: public CLI cannot rely on internal-secret auth and should not use it.

### Response shape state today

- Response and error shapes are not fully uniform across internal MCP routes.
- Most routes return route-specific JSON payloads on success and `{ error, details? }` on failure.
- SQL route returns `executeRawSql()` result object directly (different shape semantics).
- MCP server tools stringify route responses into text content without canonical envelope guarantees.

Implication: parity and agent-debug reliability require explicit envelope normalization.

### Trace/correlation state today

- MCP server client (`apps/mcp/lib/platform-client.ts`) currently forwards `x-internal-secret` and `x-internal-org-id`, but not `x-request-id` / `x-trace-id`.
- Internal MCP route handlers do not currently use `createRequestContext` / `withRequestContext` directly.
- Existing platform logging context supports request/trace IDs, but MCP path is not consistently wiring adapter-generated IDs through.

Implication: request-level cross-surface debugging is incomplete today.

## Required Core repo changes

### A) Introduce shared MCP/CLI envelope contract in platform

Create shared response helpers in `Core` (for example `apps/platform/lib/api/mcp-response.ts`) and migrate all internal MCP routes to use them.

Requirements:

- success: `{ ok: true, data, error: null, meta }`
- failure: `{ ok: false, data: null, error, meta }`
- `meta.schemaVersion = "1.0"`
- `meta.source` reflects route execution source (`remote` for platform APIs)
- `meta.requestId` included only when available

Apply to every route under `apps/platform/app/api/internal/mcp/*` so all operations are consistent.

### B) Add correlation propagation + response headers

On every MCP/CLI-related request path:

- accept incoming `x-request-id` and `x-trace-id`
- if missing, generate one and use same value for both initially
- bind IDs into request log context
- return `x-request-id` response header

Hosted MCP server and CLI adapters must both send these headers on outbound calls.

### C) Expand auth acceptance for CLI-compatible calls

Keep existing internal service auth, but add a public-safe auth path for CLI/API consumers using Clerk machine auth.

Recommended implementation:

- introduce shared auth validator for MCP/CLI routes that accepts:
  - internal service secret path (for hosted MCP server to platform)
  - Clerk OAuth token and API key token path (for direct CLI access)
- use Clerk backend auth patterns with explicit accepted token types where applicable
- normalize auth failures to canonical `AUTH_*` codes

This avoids exposing `INTERNAL_API_SECRET` to end users and keeps hosted MCP server compatibility.

### D) Add capability/version negotiation endpoint in platform

Add endpoint (for example `/api/mcp/capabilities`) returning:

- `minCliVersion`
- `recommendedCliVersion`
- `contractVersion`
- optionally `minMcpVersion`

Use this in:

- CLI startup and command execution
- hosted MCP server request path

Return canonical `UPGRADE_REQUIRED` when below minimum.

### E) Keep internal consumers compatible (non-blocking)

`apps/platform/lib/outlit-agent/tools.ts` currently expects raw text bodies from internal routes. This is a small Slack agent integration and should be treated as a follow-on compatibility task, not a blocker for core CLI/MCP parity work. During migration:

- either update it to parse canonical envelope,
- or provide temporary compatibility unwrapping until fully migrated.

Do not break workflow tooling while introducing parity contracts, but prioritize canonical CLI/MCP contracts first.

### F) Route-by-route migration checklist

For each route in `apps/platform/app/api/internal/mcp/*`:

1. convert success and failure responses to canonical envelope,
2. map validation/auth/not-found/rate-limit/internal errors to canonical error codes,
3. include correlation meta and response `x-request-id`,
4. add/refresh tests for envelope and error parity,
5. verify backward compatibility expectations for existing callers.

## Core repo testing requirements

Add test coverage in `Core` for:

- auth matrix:
  - internal secret auth
  - Clerk OAuth token auth
  - Clerk API key auth
  - invalid/expired/revoked tokens
- envelope consistency across all MCP routes
- correlation propagation (`x-request-id` roundtrip)
- version-gate behavior (`UPGRADE_REQUIRED`)
- compatibility checks for hosted MCP server adapter and `outlit-agent` tools

## Cross-repo ownership and rollout

Because `outlit-sdk` CLI and `Core` platform contracts will evolve together, designate a temporary cross-repo compatibility window:

- `Core` supports both legacy and canonical response formats for a short period if needed,
- `outlit-sdk` beta tracks canonical format,
- parity CI should include fixture runs against a staging `Core` environment before promoting CLI releases.

## Adapters

### MCP adapter

- Registers each `OperationSpec` as a tool.
- Validates input via shared Zod schema.
- Executes shared operation runtime.
- Returns canonical envelope JSON.

### CLI adapter (`citty`)

- Exposes same operations as `outlit mcp ...` commands.
- Supports global agent flags:
  - `--json`
  - `--non-interactive`
  - `--yes`
  - `--profile`
- In `--json` mode outputs exact canonical envelope.

## Canonical output contract

Use one envelope for CLI and MCP:

```ts
type OutlitErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_EXPIRED"
  | "AUTH_REVOKED"
  | "AUTH_INVALID"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "UPGRADE_REQUIRED"
  | "INTERNAL_ERROR";

type OutlitEnvelope<TData, TMeta extends object = {}> =
  | {
      ok: true;
      data: TData;
      error: null;
      meta: TMeta & { source: "remote" | "local"; schemaVersion: "1.0" };
    }
  | {
      ok: false;
      data: null;
      error: {
        code: OutlitErrorCode;
        message: string;
        details?: Record<string, unknown>;
        retryable?: boolean;
      };
      meta: TMeta & { source: "remote" | "local"; schemaVersion: "1.0" };
    };
```

`meta.requestId` is optional and omitted when unavailable.

## Observability and correlation

- Generate a correlation id per operation invocation in adapters.
- Send both headers with the same value initially:
  - `x-request-id`
  - `x-trace-id`
- Platform request context binds these and forwards to Axiom logs.
- API should return request id header when available.
- Adapters include `meta.requestId` only when present.

Local validation failures set `meta.source = "local"` and omit `requestId`.

## AuthManager design

```ts
type AuthMethod = "oauth_session" | "api_key";

type OAuthCreds = {
  method: "oauth_session";
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
};

type ApiKeyCreds = {
  method: "api_key";
  apiKey: string;
  scopes?: string[];
};

type Credentials = OAuthCreds | ApiKeyCreds;

interface AuthManager {
  getValidAccessToken(ctx: AuthContext): Promise<{ token: string; method: AuthMethod }>;
  loginWeb(ctx: AuthContext): Promise<void>;
  loginApiKey(apiKey: string, ctx: AuthContext): Promise<void>;
  logout(ctx: AuthContext): Promise<void>;
  status(ctx: AuthContext): Promise<AuthState>;
}
```

Lifecycle requirements:

- proactive refresh before expiry (clock skew buffer),
- single refresh lock per profile to prevent refresh stampedes,
- one automatic retry after refresh on 401,
- atomic token persistence,
- re-login required only when refresh fails/revoked.

## CLI command shape

Core onboarding commands:

- `outlit init`
- `outlit auth login`
- `outlit auth status`
- `outlit auth logout`
- `outlit agent setup --client <claude|cursor|vscode|opencode>`
- `outlit integrations list|connect|open`
- `outlit doctor`

Parity namespace:

- `outlit mcp ...` maps 1:1 with MCP operations and output contracts.

## Drift protection and CI policy

### Required gates

1. **Coverage parity**
   - every `OperationSpec` appears in both adapters.
2. **Schema parity**
   - MCP and CLI both derive from the same schemas.
3. **Behavior parity**
   - fixtures executed via both surfaces produce deep-equal canonical JSON.
4. **Error parity**
   - same inputs produce same `error.code`.
5. **Help/docs snapshots**
   - `outlit --help`, per-command help, and MCP tool list snapshots.

### CLI exit codes

- `0` success
- `1` unknown/internal
- `2` validation
- `3` auth errors
- `4` forbidden
- `5` not found
- `6` rate limited
- `7` upgrade required

## Version governance

Backend capability metadata should expose:

- `minCliVersion`
- `recommendedCliVersion`
- `contractVersion`

Behavior:

- below minimum -> deterministic `UPGRADE_REQUIRED`
- below recommended -> warning only

## Implementation phases

### Phase 1: foundation

- Create shared operation registry.
- Wire 2-3 core operations in both adapters.
- Implement canonical envelope and error catalog.

### Phase 2: auth + onboarding

- Implement Clerk web login flow + refresh manager.
- Add api-key fallback mode.
- Add `init`, `auth`, `doctor`, `agent setup`.

### Phase 3: full parity + hardening

- Migrate all MCP operations into operation registry.
- Add full parity CI gates.
- Ship beta docs and examples for human + agent usage.

## Open questions

1. Which client config targets are mandatory in beta for `outlit agent setup`?
2. Which operations are MVP-critical for parity in phase 1?
3. Do we require org/workspace selection during login for all profiles?
