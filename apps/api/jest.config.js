/** @type {import('jest').Config} */
export default {
  rootDir: "../..",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@vms/shared$": "<rootDir>/packages/shared/src/index.ts",
    "^@vms/shared/(.*)$": "<rootDir>/packages/shared/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/apps/api/tsconfig.test.json",
      },
    ],
  },
  setupFiles: ["<rootDir>/apps/api/src/test/jest-env.ts"],
  testMatch: ["<rootDir>/apps/api/src/**/*.test.ts"],
  maxWorkers: 1,
  testTimeout: 15000,
};
