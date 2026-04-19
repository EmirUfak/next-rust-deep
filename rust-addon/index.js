let nativeBinding;

try {
  nativeBinding = require("./next_rust_deep_native.node");
} catch (cause) {
  const error = new Error(
    "Native addon binary is missing. Run 'bun run build:rust' from project root.",
  );
  error.cause = cause;
  throw error;
}

module.exports = nativeBinding;
