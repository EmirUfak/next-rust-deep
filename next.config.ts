import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@next-rust-deep/native-addon"],
  webpack: (config) => {
    // webpack's default WASM-based xxhash64 (WasmHash) crashes in this
    // Node/CI environment ("Cannot read properties of undefined (reading
    // 'length')"). Force the JS/crypto hash to avoid the WASM path.
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
