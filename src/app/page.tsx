import { BenchmarkConsole } from "@/components/BenchmarkConsole";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-16">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase">
            Next.js + NAPI-RS + rayon
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            next-rust-deep
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 sm:text-base">
            Compare JavaScript baseline throughput against native Rust execution.
            Compute runs on Node runtime server endpoints via NAPI-RS.
          </p>
        </div>

        <BenchmarkConsole />
      </section>
    </main>
  );
}
