# next-rust-deep

next-rust-deep is a Next.js App Router project focused on server-native compute performance.
It benchmarks JavaScript baseline algorithms against a Rust native addon built with NAPI-RS
and parallelized with rayon.

## Goals

- Keep heavy compute on the server only.
- Compare JS and Rust execution with a clear benchmark UI.
- Provide safe input validation, time budgets, and structured errors.
- Keep developer workflow Bun-first, while native execution stays Node runtime.

## Architecture

Text diagram:

1. Browser UI calls POST /api/benchmark.
2. Route handler validates payload and enforces size limits.
3. JS path uses TypeScript implementations in src/lib/benchmark-js.ts.
4. Rust path goes through src/server/native-addon-bridge.ts.
5. Bridge dynamically imports @next-rust-deep/native-addon (server-only).
6. Native addon executes countPrimes, matrixMultiplyParallel, dotProductParallel with rayon.
7. Route returns typed benchmark payload with durations, summaries, and optional errors.

## Project Layout

- src/app/api/benchmark/route.ts: Node runtime benchmark endpoint.
- src/app/api/health/addon/route.ts: Addon health endpoint.
- src/server/native-addon-bridge.ts: Safe server-only wrapper and fallback behavior.
- src/components/BenchmarkConsole.tsx: Benchmark UI controls/results.
- rust-addon: NAPI-RS crate and package metadata.

## Local Setup

Prerequisites:

- Bun
- Node.js 20+
- Rust toolchain (stable)
- cargo-audit (for rust:audit script)

Install dependencies:

```bash
bun install
```

Build native addon:

```bash
bun run build:rust
```

Start development server:

```bash
bun run dev
```

Open http://localhost:3000.

## Scripts

- bun run dev: Build Rust addon then run Next dev server.
- bun run build: Build Rust addon then run Next production build.
- bun run start: Start Next production server.
- bun run build:rust: Build NAPI addon with @napi-rs/cli.
- bun run lint: TypeScript lint + Rust clippy pedantic checks.
- bun run test: Vitest suite + Rust tests.
- bun run format: Prettier + cargo fmt.
- bun run rust:fmt:check: rustfmt check.
- bun run rust:clippy: clippy with warnings denied and pedantic enabled.
- bun run rust:audit: cargo audit.

## Native Addon Notes

The addon lives under rust-addon and compiles as a cdylib.
Build is driven by @napi-rs/cli from rust-addon/package.json.

Important runtime caveats:

- Native addon endpoints must run on Node runtime only.
- Edge runtime is not supported for native module import.
- next.config.ts marks @next-rust-deep/native-addon as server external package.

## Testing

- Unit tests: tests/unit
- Integration-style route contract test: tests/integration
- Rust correctness tests: rust-addon/src/lib.rs (cfg(test))

Run all tests:

```bash
bun run test
```

## CI

GitHub Actions workflow in .github/workflows/ci.yml runs:

1. bun install --frozen-lockfile
2. lint and tests
3. next build
4. rust fmt check
5. rust clippy pedantic deny warnings
6. cargo audit
7. addon build verification

## Troubleshooting

Native addon fails to load:

1. Run bun run build:rust.
2. Confirm Rust toolchain is installed and cargo is on PATH.
3. Confirm the endpoint uses Node runtime, not Edge.

Route returns validation errors:

1. Check algorithm-specific workload field (limit, matrixSize, vectorSize).
2. Keep values inside max limits defined in src/lib/benchmark-types.ts.

Clippy or audit issues:

1. Update Rust dependencies.
2. Re-run bun run rust:clippy and bun run rust:audit.

## Deployment Caveats

- Deploy on an environment that supports Node native binaries.
- Ensure Rust addon binary is built during CI/CD artifact generation.
- Do not expose native addon imports to client components.
