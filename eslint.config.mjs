import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-plugin-react's version auto-detect calls context.getFilename(),
  // which ESLint 10 removed. Pinning the version skips the detection.
  { settings: { react: { version: "19.2" } } },
  globalIgnores([".next/**", "out/**", "build/**", "supabase/**", "node_modules/**", "next-env.d.ts"]),
]);
