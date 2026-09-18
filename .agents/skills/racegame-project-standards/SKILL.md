---
name: racegame-project-standards
description: Apply RaceGame repository architecture, C#/.NET, TypeScript/Cocos, PostgreSQL, API, security, idempotency, concurrency, testing, and change-scope rules. Use whenever analyzing, implementing, reviewing, debugging, documenting, or configuring code in this repository.
---

# RaceGame Project Standards

Use this skill for every engineering task in the RaceGame repository. The current release baseline is V2.0.0 / Cocos Creator 3.8.8.

## Start with repository context

1. Read `Docs/PROJECT_STANDARDS.md` before proposing or making changes.
2. Read the files directly involved in the request and their project files or call sites.
3. Treat the current repository as a V2.0 release-candidate codebase, not as production-ready software.
4. Distinguish observed behavior from desired standards. Existing one-line formatting and insecure development shortcuts are technical debt, not patterns to copy.
5. Keep changes focused. Do not fix unrelated baseline issues unless they block the requested work.

## Preserve architecture boundaries

- Keep `RaceGame.Domain` independent of ASP.NET Core, EF Core, Redis, Cocos, and infrastructure concerns.
- Put use cases and business orchestration in `RaceGame.Application`.
- Put PostgreSQL, EF Core, Redis, and external-system implementations in `RaceGame.Infrastructure`.
- Keep HTTP and SignalR transport logic in `RaceGame.Api`.
- Keep scheduled state progression in `RaceGame.Worker`.
- Keep client presentation and animation in `Client`; never make the client authoritative for race outcomes, wallet balances, odds, or settlement.
- Do not create circular project references.
- When Application needs persistence or cache access, prefer an abstraction implemented by Infrastructure. Be aware that the current Application source directly uses `AppDbContext` despite lacking the matching project reference; do not hide this inconsistency or worsen it.

## Enforce coding standards

### C#

- Write readable, formatted C# with 4-space indentation and one statement per line.
- Use file-scoped namespaces, nullable annotations, meaningful names, and one primary public type per file.
- Use `PascalCase` for types and members and `camelCase` for parameters and locals.
- Suffix asynchronous methods with `Async` and propagate `CancellationToken` through I/O paths.
- Use constructor injection. Do not add service-locator patterns.
- Use `ILogger<T>` with structured fields; do not add `Console.WriteLine` or expose secrets/internal exception details.
- Keep controllers thin and use explicit API DTOs rather than exposing EF entities as durable contracts.
- Add clear XML documentation or explanatory comments to every new or modified public type, public member, business workflow, constant, enum, and non-obvious code block. Comments must explain purpose, invariants, inputs, outputs, side effects, and important failure behavior instead of merely restating syntax.
- Keep comments accurate when behavior changes. Do not add noisy line-by-line comments for self-evident assignments, braces, or trivial control flow.
- Do not hardcode business rules, status text, identifiers, durations, amounts, limits, or algorithm versions inside workflows. Use centralized constants, enums, options/configuration, or persisted versioned configuration according to whether the value is protocol-level, environment-level, or operator-managed.
- Prefer small cohesive methods and existing project patterns. Do not over-abstract, over-split, or introduce layers/interfaces that have only one trivial use unless they protect an architectural boundary or business invariant.
- Keep shared server contracts, constants, and enums in one discoverable server-side location. Keep client/server wire contracts synchronized, but do not directly share C# runtime types with TypeScript; define explicit compatible DTOs in each platform and document the shared protocol.
- Keep reusable code close to its owning layer: domain-wide rules in Domain, use-case orchestration in Application, persistence details in Infrastructure, transport DTOs and HTTP concerns in Api, and client presentation concerns in Client.

### TypeScript and Cocos

- Write readable, formatted TypeScript with 4-space indentation, semicolons, and explicit DTOs.
- Do not add `any`; narrow unknown API data before use.
- Keep API configuration centralized and environment-aware rather than adding hardcoded URLs.
- Handle network failures, cancellation, component cleanup, and nullable Cocos node references.
- Do not perform network I/O in per-frame `update` methods.
- Preserve documented scene node paths or update bindings and `Docs/08_Client/SCENE_NODE_STRUCTURE.md` together.

## Protect game and money invariants

- Keep horse numbers in the inclusive range 1–6 and preserve six horses per round unless an approved requirement changes the entire contract.
- Accept bets only during `RaceState.Betting` and before the UTC deadline.
- Allow one selected horse per player per round.
- Reject non-positive amounts and insufficient balances.
- Use `decimal`/PostgreSQL `NUMERIC` for money and odds; never use binary floating-point for money.
- Perform every wallet mutation and its `wallet_transactions` audit entry in one database transaction.
- Make retriable money operations idempotent with database-enforced unique keys. A read-before-write check alone is insufficient.
- Use locked order odds for settlement.
- Prevent duplicate settlement and invalid backward state transitions.
- Use UTC for all persisted and compared timestamps.
- Never renumber or reuse existing `RaceState` integer values because they are persisted in PostgreSQL.

## Respect database and API compatibility

- Never edit an already shared/deployed migration to change history. Add a numbered migration under `Database/DeployInit`.
- Keep EF mappings and SQL migrations synchronized.
- Require an explicit migration, compatibility, rollback, and data plan for destructive schema changes.
- Preserve the existing `/api/...` route prefix and `{ code, data/message }` envelope unless the task explicitly approves a breaking API change.
- Return meaningful HTTP status codes and validate all untrusted input server-side.
- Treat DTO, route, enum number, database column, SignalR event, and Cocos node changes as cross-layer contracts; search and update all consumers.

## Apply security restrictions

Do not normalize or reproduce these development-only shortcuts in new code:

- `dev-login` as production authentication.
- Hardcoded `playerId = 1`.
- Unrestricted production CORS or Swagger.
- Hardcoded credentials, secrets, or production endpoints.
- Worker execution without a multi-instance-safe lock.
- Redis locks without ownership-checked release.
- `string.GetHashCode()` as a cross-process deterministic race seed.
- Raw internal exception messages returned to clients.

Never claim the current system is production-ready, financially safe, or fairness-audited. Never commit real secrets or personal data.

## Validate changes

1. Start with diagnostics or tests closest to changed files.
2. For server changes, run the most specific available command, then build a real entry project:

```bash
dotnet restore Server/RaceGame.Api/RaceGame.Api.csproj
dotnet build Server/RaceGame.Api/RaceGame.Api.csproj --configuration Release
```

Do not treat the current `RaceGame.sln` build as sufficient: it lacks project configuration mappings and can return success without compiling projects. Use solution-level validation only after that mapping is repaired.

3. Run relevant tests if test projects exist. Do not claim tests passed when the repository has no tests or when they were not run.
4. For client changes, verify TypeScript compilation and Cocos Creator 3.8.x scene bindings when the project metadata and tools permit it.
5. Report pre-existing failures separately from failures caused by the change.
6. Update documentation when behavior, API contracts, database structure, configuration, deployment, or scene nodes change.

## Finish with a concise report

State:

- what changed and why;
- the project-relative files changed;
- validation commands actually run and their results;
- known limitations or follow-up work that directly affects the requested change.
