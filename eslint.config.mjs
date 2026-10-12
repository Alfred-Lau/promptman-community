import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "dist-electron/**",
      "out/**",
      "src/lib/seekdb/**",
    ],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { "allowEmptyCatch": true }],
      // 项目未启用 React Compiler:Compiler 专用规则降为 warn,避免误报阻断 CI
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/incompatible-library": "warn",
      // JSX 中的引号/撇号保持字面可读(中文文案常见)
      "react/no-unescaped-entities": "off",
    },
  }
);
