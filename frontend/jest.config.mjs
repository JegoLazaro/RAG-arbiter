import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config = {
  // Simulates a fake web browser environment in your terminal so we can test React UI
  testEnvironment: "jest-environment-jsdom",
  // Loads our custom testing commands before each test runs
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default createJestConfig(config);
