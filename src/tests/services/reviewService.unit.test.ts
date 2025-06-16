// Mock the OpenAI client before importing the service
jest.mock("@/lib/openAi", () => ({
  __esModule: true,
  default: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

import client from "@/lib/openAi";
import { generateMovieReview } from "@/services/reviewService";

// Now client.chat.completions.create is a Jest mock function
const mockedCreate = client.chat.completions.create as jest.Mock;

describe("reviewService", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
  });

  it("calls OpenAI client with correct parameters and returns trimmed review", async () => {
    const fakeResponse = {
      choices: [{ message: { content: "   This is a review.   " } }],
    };
    mockedCreate.mockResolvedValue(fakeResponse);

    const title = "Inception";
    const regisseur = "Christopher Nolan";
    const review = await generateMovieReview(title, regisseur);

    expect(mockedCreate).toHaveBeenCalledWith({
      model: "gpt-4.1-mini",
      messages: [
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Du bist ein arroganter"),
        }),
        expect.objectContaining({
          role: "user",
          content: `Schreibe eine humoristische Rezension des Films "${title}" von "${regisseur}".`,
        }),
      ],
      temperature: 0.8,
      max_tokens: 300,
    });
    expect(review).toBe("This is a review.");
  });

  it("propagates errors from the OpenAI client", async () => {
    const error = new Error("API error");
    mockedCreate.mockRejectedValue(error);
    await expect(generateMovieReview("T", "R")).rejects.toThrow("API error");
  });
});
