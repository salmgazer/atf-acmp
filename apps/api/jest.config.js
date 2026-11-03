/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { isolatedModules: true } }],
    "^.+\\.js$": "<rootDir>/test/transform-js.cjs",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@nestjs/cache-manager|@nestjs/schedule|htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities)/)",
  ],
  watchman: false,
  testPathIgnorePatterns: ["/node_modules/"],
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/index.ts",
    "!src/main.ts",
    "!src/database/migrations/**",
  ],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
  roots: ["<rootDir>/src/", "<rootDir>/test/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  testTimeout: 30000,
  verbose: true,
};
