# next-rust-deep

next-rust-deep is a production-oriented Next.js 16 + React 19 project for benchmarking server-side JavaScript against a Rust native addon (NAPI-RS + rayon).

It is designed to answer a practical question with measurable data:

- When is Rust compute faster?
- When does JS<->native boundary/transfer overhead dominate?
- How much can native batching reduce callback overhead?

[English Version Below](#next-rust-deep-english)

## Ozet

Bu proje tarayici tarafi WASM benchmarki degil, **server-native benchmark** projesidir.
Agir hesaplamalar Node runtime icinde API route uzerinden calisir ve UI sadece kontrol/raporlama katmanidir.

## Ozellikler

- **Next.js 16 (App Router):** API route + modern app shell.
- **Node Runtime API:** Native addon importu icin `runtime = "nodejs"`.
- **Rust Native Addon:** `@napi-rs/cli` ile derlenen `@next-rust-deep/native-addon`.
- **rayon Parallelism:** Prime, matrix, dot islerinde cok cekirdekli hesaplama.
- **TypedArray Input Path:** Matrix/vector verileri `Float64Array` olarak hazirlanir.
- **Compute vs Transfer Metrics:** Her kosuda `durationMs`, `computeMs`, `transferMs` gorunur.
- **Native Batching:** Birden cok iterasyonu tek native cagrida kosturabilen mod.
- **Matrix Result Modes:** `full` (tum cikti) ve `summary` (len/first/checksum).
- **Input Validation:** zod ile sik request dogrulamasi.
- **Addon Health Endpoint:** Native addon erisilebilirligini ayrica raporlar.
- **Test + Lint + Rust Quality Gates:** Vitest, cargo test, clippy pedantic, audit.

## next-rust-basic ile Farklar

| Konu | next-rust-basic | next-rust-deep |
| --- | --- | --- |
| Ana odak | Browser + Worker + WASM | Server API + Native Addon |
| Rust entegrasyonu | `wasm-bindgen` | `NAPI-RS` |
| Zero-copy yaklasimi | Worker/SAB ve wasm memory patternleri | JS-Native sinirinda tipik kopya maliyeti olusur |
| Olcum modeli | UI agirlikli JS/WASM senaryolari | End-to-end API + compute/transfer ayrimi |
| Batching | Worker/protocol odakli | Native-side batch timing |

> Not: Bu projede next-rust-basic tarafindaki SAB tabanli browser zero-copy yolu yoktur.
> Buradaki odak, Node API sinirindaki gecis maliyetlerini de goren gercek server benchmarkidir.

## Benchmark Kapsami

### Algoritmalar

| Algorithm | Workload Alani | Aciklama |
| --- | --- | --- |
| `prime-count` | `workload.limit` | 2..N araliginda asal sayi adedi |
| `matrix-multiply` | `workload.matrixSize` | N x N matris carpimi |
| `dot-product` | `workload.vectorSize` | Vektor skaler carpimi |

### Cagri Modlari

- `implementation`: `js` | `rust` | `compare`
- `resultMode` (yalniz matrix): `full` | `summary`
- `rustBatching`: `none` | `native`
- `iterations`: 1-10
- `timeoutMs`: 200-30000 (default 8000)

### Matrix Result Mode

- `full`: Tum matrix sonucunu ozet stringe cevirir.
- `summary`: `len`, `first`, `checksum` uretir. Ozellikle buyuk matrix benchmarklarinda daha stabil/okunabilir rapor verir.

### Rust Batching

- `none`: Her iterasyon icin ayri native cagrisi.
- `native`: Tum iterasyonlar tek native cagrida kosturulur, callback/crossing maliyeti azalir.
- Matrix icin native batching yalnizca `summary` modunda kullanilir.

## API Endpoints

| Endpoint | Method | Aciklama |
| --- | --- | --- |
| `/api/benchmark` | `POST` | Benchmark calistirir, run bazli metrikleri dondurur |
| `/api/health/addon` | `GET` | Native addon saglik durumunu dondurur |

## Benchmark Request/Response Sozlesmesi

### Request Ornegi

```json
{
  "algorithm": "matrix-multiply",
  "implementation": "compare",
  "iterations": 3,
  "timeoutMs": 8000,
  "resultMode": "summary",
  "rustBatching": "native",
  "workload": {
    "matrixSize": 96
  }
}
```

### Response Ornegi

```json
{
  "ok": true,
  "requestId": "8f9f6d16-75f0-4f79-b14c-9d8f15afca2e",
  "algorithm": "matrix-multiply",
  "iterations": 3,
  "rustBatching": "native",
  "resultMode": "summary",
  "runs": [
    {
      "implementation": "js",
      "inputSize": 96,
      "resultSummary": "len=9216, first=23.510, checksum=220883.201",
      "durationMs": 5.911,
      "computeMs": 5.911,
      "transferMs": 0,
      "callbackCalls": 3,
      "resultMode": "summary"
    },
    {
      "implementation": "rust",
      "inputSize": 96,
      "resultSummary": "len=9216, first=23.510, checksum=220883.201",
      "durationMs": 2.801,
      "computeMs": 2.313,
      "transferMs": 0.488,
      "batchMode": "native",
      "callbackCalls": 1,
      "resultMode": "summary"
    }
  ],
  "addon": {
    "available": true
  },
  "comparison": {
    "faster": "rust",
    "speedupRatio": 2.11
  }
}
```

### Limitler (Route Tarafi)

| Alan | Min | Max | Not |
| --- | --- | --- | --- |
| Body size | - | 8192 bytes | Buyuk payload reddedilir |
| iterations | 1 | 10 | Tum algoritmalar |
| timeoutMs | 200 | 30000 | Default 8000 |
| prime limit | 10 | 10000000 | `prime-count` |
| matrix size | 8 | 240 | `matrix-multiply` |
| vector size | 1000 | 2000000 | `dot-product` |

> Rust addon icinde ek guvenlik limitleri de vardir (or. batch iterations max 1000),
> fakat route katmani daha dar bir pencere uygular.

## Mimarinin Akisi

1. UI, `/api/benchmark` endpointine JSON request gonderir.
2. Route, body boyutu + JSON parse + zod validation yapar.
3. Inputlar algorithm tipine gore hazirlanir (`Float64Array`, sayisal limitler).
4. JS kosusu TypeScript implementasyonlariyla calisir.
5. Rust kosusu `src/server/native-addon-bridge.ts` uzerinden native addonu cagirir.
6. Sonuc ve metrikler normalize edilir (`duration`, `compute`, `transfer`, `summary`).
7. Karsilastirma (`faster`, `speedupRatio`) hesaplanip response donulur.

## Gereksinimler

- **Bun** (onerilen paket yoneticisi)
- **Node.js 20+**
- **Rust stable toolchain**
- **cargo-audit** (`rust:audit` scripti icin)

### Windows icin Build Tools Notu

NAPI addon derlemesinde linker hatasi alirsaniz:

1. Visual Studio Build Tools kurun: https://visualstudio.microsoft.com/downloads/
2. "Desktop development with C++" workload secin.
3. MSVC toolset + Windows SDK bilesenlerini aktif edin.
4. Terminali yeniden acip tekrar deneyin.

## Baslangic

### 1) Depoyu klonla

```bash
git clone https://github.com/emirufak/next-rust-deep.git
cd next-rust-deep
```

### 2) Bagimliliklari yukle

```bash
bun install
```

### 3) Native addon derle

```bash
bun run build:rust
```

### 4) Gelistirme sunucusunu baslat

```bash
bun run dev
```

Uygulamayi ac: http://localhost:3000

> `predev` scripti dev oncesi addon build calistirir.

## Komutlar (Scripts)

| Command | Aciklama |
| --- | --- |
| `bun run dev` | Next.js dev server (webpack) |
| `bun run build` | Production build (once addon build) |
| `bun run start` | Production server |
| `bun run build:rust` | Native addon release build |
| `bun run lint` | TS lint + Rust clippy |
| `bun run lint:ts` | ESLint |
| `bun run test` | Vitest + Rust tests |
| `bun run test:watch` | Vitest watch |
| `bun run format` | Prettier + cargo fmt |
| `bun run format:check` | Prettier check |
| `bun run rust:test` | cargo test |
| `bun run rust:fmt:check` | cargo fmt --check |
| `bun run rust:clippy` | clippy pedantic, warnings denied |
| `bun run rust:audit` | cargo audit |

## Proje Yapisi

```plaintext
.github/workflows/ci.yml            # CI quality pipeline
rust-addon/                         # NAPI-RS crate + package
  src/lib.rs                        # Native algorithm implementations
  package.json                      # napi build scripts
src/
  app/
    api/benchmark/route.ts          # Main benchmark endpoint
    api/health/addon/route.ts       # Native addon health endpoint
  components/BenchmarkConsole.tsx   # UI controls + results panel
  lib/
    benchmark-js.ts                 # JS baseline implementations
    benchmark-types.ts              # Shared contracts + limits
    benchmark-runner.ts             # Iteration timing helpers
    validation.ts                   # zod request validation
  server/native-addon-bridge.ts     # Safe bridge to native addon
tests/
  unit/                             # Unit tests
  integration/                      # API contract-style tests
```

## Gelistirme Rehberi

### Yeni benchmark algoritmasi ekleme

1. Rust tarafinda `rust-addon/src/lib.rs` icine yeni fonksiyonlari ekle.
2. Gerekirse timed/batch timed exportlarini da ekle.
3. Addon tip yuzeyini (`rust-addon/index.d.ts`) guncelle (build ile uretilir).
4. `src/server/native-addon-bridge.ts` icine guvenli wrapper ekle.
5. JS baseline implementasyonunu `src/lib/benchmark-js.ts` dosyasina ekle.
6. Contract/limitleri `src/lib/benchmark-types.ts` ve `src/lib/validation.ts` tarafinda guncelle.
7. Endpoint orkestrasyonunu `src/app/api/benchmark/route.ts` icinde bagla.
8. UI kontrollerini `src/components/BenchmarkConsole.tsx` ile expose et.
9. Unit + integration + rust testleri ekle/calistir.

### Performans Sonucunu Dogru Okuma

- `durationMs`: API tarafinda gozlenen ortalama end-to-end sure.
- `computeMs`: Hesaplama cekirdegi suresi (JS veya native).
- `transferMs`: Yaklasik gecis/cevre maliyeti.
- Yuksek `computeMs` + dusuk `transferMs`: algoritma agirligi baskin.
- Dusuk `computeMs` + yuksek `transferMs`: sinir gecisi maliyeti baskin olabilir.
- `rustBatching=native`: callback sayisi dusurulerek transfer maliyeti azaltilabilir.

## Test ve Kalite

Lokal kalite kontrol icin tipik akis:

```bash
bun run lint:ts
bun run rust:clippy
bun run test
bun run build:rust
```

CI pipeline (`.github/workflows/ci.yml`) su adimlari calistirir:

1. bun install
2. lint
3. test
4. build
5. rust fmt check
6. rust clippy
7. cargo audit
8. addon build verification

## Troubleshooting

### 1) Addon available: false

- `bun run build:rust` calistir.
- Rust toolchain ve cargo PATH durumunu kontrol et.
- Endpointlerin Edge degil Node runtime oldugunu dogrula.

### 2) Windows EPERM unlink `.node`

- Calisan dev server/processleri kapat.
- Gerekirse editor/terminal oturumunu yenile.
- Tekrar `bun run build:rust` calistir.

### 3) Validation failed

- Algorithm ile workload alanlari eslesmeli.
- `resultMode` sadece `matrix-multiply` icin gecerlidir.
- Sayisal degerler limit tablolari icinde kalmalidir.

### 4) Matrix parity mismatch

- Floating-point toplama sirasindan kaynakli kucuk farklar normal olabilir.
- `summary` modunda length/first/checksum birlikte degerlendirilmelidir.

## Runtime ve Deployment Notlari

- Native addon importu sebebiyle Node runtime gereklidir.
- Sunucu ortaminda native binary calistirma destegi olmalidir.
- `next.config.ts` icinde addon paketi `serverExternalPackages` olarak tanimlidir.
- Native addon kodunu client component tarafina tasimayin.

## Lisans

MIT

---

<a id="next-rust-deep-english"></a>

# next-rust-deep (English)

next-rust-deep is a Next.js 16 + React 19 benchmark project that compares server-side JavaScript baselines against a Rust native addon powered by NAPI-RS and rayon.

Unlike browser-focused WASM templates, this project focuses on **Node runtime native execution** and reports both compute and transfer overhead.

## Key Features

- Next.js App Router with Node runtime API routes.
- Rust native addon built via `@napi-rs/cli`.
- Parallel Rust compute paths with rayon.
- TypedArray inputs for matrix/vector workloads.
- Per-run metrics: `durationMs`, `computeMs`, `transferMs`.
- Native batching mode to reduce boundary overhead.
- Matrix result modes: `full` and `summary`.
- Strict zod validation and workload limits.
- Addon health endpoint: `/api/health/addon`.
- Full quality pipeline: ESLint, Vitest, cargo test, clippy, audit.

## What Is Different From next-rust-basic?

- `next-rust-basic` emphasizes browser WASM + worker patterns.
- `next-rust-deep` emphasizes server native addon execution.
- Browser SAB zero-copy patterns in basic are not the main path here.
- Deep focuses on practical API-side benchmarking and overhead analysis.

## Supported Workloads

- `prime-count` with `workload.limit`
- `matrix-multiply` with `workload.matrixSize`
- `dot-product` with `workload.vectorSize`

Modes:

- `implementation`: `js` | `rust` | `compare`
- `resultMode`: `full` | `summary` (matrix only)
- `rustBatching`: `none` | `native`

## API Contract Example

Request:

```json
{
  "algorithm": "dot-product",
  "implementation": "compare",
  "iterations": 3,
  "timeoutMs": 8000,
  "rustBatching": "native",
  "workload": {
    "vectorSize": 1200000
  }
}
```

Response includes:

- `ok`, `requestId`, `runs`, `addon`, optional `comparison`
- per-run timing details and result summaries
- partial failure metadata when one side fails

## Prerequisites

- Bun
- Node.js 20+
- Rust stable toolchain
- cargo-audit (for the audit script)

## Quick Start

```bash
git clone https://github.com/emirufak/next-rust-deep.git
cd next-rust-deep
bun install
bun run build:rust
bun run dev
```

Open http://localhost:3000.

## Scripts

- `bun run dev`
- `bun run build`
- `bun run start`
- `bun run build:rust`
- `bun run lint`
- `bun run lint:ts`
- `bun run test`
- `bun run test:watch`
- `bun run format`
- `bun run format:check`
- `bun run rust:test`
- `bun run rust:fmt:check`
- `bun run rust:clippy`
- `bun run rust:audit`

## Architecture Flow

1. Client UI posts benchmark payload to `/api/benchmark`.
2. Route enforces size limits and zod validation.
3. JS path runs TypeScript baseline functions.
4. Rust path calls `src/server/native-addon-bridge.ts`.
5. Bridge loads `@next-rust-deep/native-addon` on Node runtime.
6. Endpoint returns normalized timing and summary fields.

## Troubleshooting

- If addon load fails, run `bun run build:rust` and verify Rust toolchain.
- If Windows `.node` unlink EPERM appears, stop running processes and rebuild.
- If validation fails, ensure workload fields match selected algorithm.
- If matrix parity seems off, compare summary values with tolerance.

## License

MIT
