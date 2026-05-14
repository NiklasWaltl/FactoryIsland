/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
const reactHooks = require("eslint-plugin-react-hooks");

const hasSetStateInEffectRule =
  reactHooks?.rules?.["set-state-in-effect"] !== undefined;
const hasPurityRule = reactHooks?.rules?.purity !== undefined;

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
    warnOnUnsupportedTypeScriptVersion: false,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  plugins: ["react", "@typescript-eslint", "unused-imports"],
  ignorePatterns: ["*.typegen.ts"],
  overrides: [
    {
      files: ["**/*.tsx"],
      rules: {
        "react/prop-types": "off",
      },
    },
    {
      files: ["src/**/*.tsx"],
      rules: {
        "react/jsx-no-literals": "off",
      },
    },
    {
      files: ["scripts/**/*.{js,ts}"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  rules: {
    "react/jsx-no-literals": "error",
    "no-console": "error",
    "no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
      },
    ],
  },
};
