// jest.setup.ts
import "@testing-library/jest-dom/extend-expect";
import "@testing-library/jest-dom"; // For better assertions in tests
process.env.OPENAI_API_KEY = "test";
