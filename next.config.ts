import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@next-rust-deep/native-addon"],
  webpack: (config) => {
    // Next/webpack's default content hash uses a bundled WASM xxhash64
    // implementation (WasmHash). Hashing this project's native .node addon
    // asset trips a bug in it -> "Cannot read properties of undefined
    // (reading 'length')" and the build crashes. The JS/crypto sha256 hasher
    // does not have this problem. (next-rust-basic never hits this because it
    // ships WASM, not a native .node binary.)
    config.output.hashFunction = "sha256";

    config.module.rules.push({
      test: /src[\\/]server[\\/]native-addon-bridge\.ts$/,
      parser: {
        createRequire: false,
      },
    });

    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /src[\\/]server[\\/]native-addon-bridge\.ts$/,
        message:
          /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
      },
    ];

    return config;
  },
};

export default nextConfig;
