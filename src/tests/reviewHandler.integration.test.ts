// reviewHandler.integration.test.ts
import { createMocks } from "node-mocks-http";
import reviewHandler from "@/pages/api/review";
import client from "@/lib/openAi";

jest.mock("@/lib/openAi", () => ({
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
}));

const mockedCreate = client.chat.completions.create as jest.Mock;

describe("reviewHandler - integration tests", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
  });

  it("returns 200 and formatted review from OpenAI client", async () => {
    mockedCreate.mockResolvedValue({
      choices: [{ message: { content: "Mocked AI review content." } }],
    });
    const body = { title: "Interstellar", regisseur: "Christopher Nolan" };
    const { req, res } = createMocks({ method: "POST", body });
    await reviewHandler(req as any, res as any);
    expect(mockedCreate).toHaveBeenCalledWith({
      model: "gpt-4.1-mini",
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({
          role: "user",
          content: `Schreibe eine humoristische Rezension des Films "Interstellar" von "Christopher Nolan".`,
        }),
      ]),
      temperature: 0.8,
      max_tokens: 300,
    });
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      review: "Mocked AI review content.",
    });
  });

  it("returns 500 when OpenAI client throws", async () => {
    mockedCreate.mockRejectedValue(new Error("OpenAI API error"));
    const body = { title: "Interstellar", regisseur: "Christopher Nolan" };
    const { req, res } = createMocks({ method: "POST", body });
    await reviewHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData()).error).toMatch(
      /Failed to generate review: OpenAI API error/
    );
  });
});
