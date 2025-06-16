import { createMocks } from "node-mocks-http";
import reviewHandler from "@/pages/api/review";
import { generateMovieReview } from "@/services/reviewService";
import { NextApiRequest, NextApiResponse } from "next";

jest.mock("@/services/reviewService");
const mockedGenerateMovieReview = generateMovieReview as jest.Mock;

describe("reviewHandler - unit tests", () => {
  beforeEach(() => {
    mockedGenerateMovieReview.mockReset();
  });

  it("returns 400 if title is missing", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { regisseur: "Director" },
    });
    await reviewHandler(req as NextApiRequest, res as NextApiResponse);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: "Please provide both a movie title and a director.",
    });
  });

  it("returns 400 if regisseur is missing", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { title: "Title" },
    });
    await reviewHandler(req as NextApiRequest, res as NextApiResponse);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: "Please provide both a movie title and a director.",
    });
  });

  it("calls generateMovieReview and returns 200 with review", async () => {
    const fakeReview = "This is a great movie review.";
    mockedGenerateMovieReview.mockResolvedValue(fakeReview);
    const body = { title: "Inception", regisseur: "Christopher Nolan" };
    const { req, res } = createMocks({ method: "POST", body });
    await reviewHandler(req as NextApiRequest, res as NextApiResponse);
    expect(mockedGenerateMovieReview).toHaveBeenCalledWith(
      body.title,
      body.regisseur
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ review: fakeReview });
  });

  it("handles errors thrown by generateMovieReview", async () => {
    mockedGenerateMovieReview.mockRejectedValue(new Error("Service failure"));
    const body = { title: "Inception", regisseur: "Christopher Nolan" };
    const { req, res } = createMocks({ method: "POST", body });
    await reviewHandler(req as NextApiRequest, res as NextApiResponse);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData()).error).toMatch(
      /Failed to generate review: Service failure/
    );
  });

  it("handles non-Error thrown by generateMovieReview", async () => {
    mockedGenerateMovieReview.mockRejectedValue("string error");
    const { req, res } = createMocks({
      method: "POST",
      body: { title: "T", regisseur: "R" },
    });
    await reviewHandler(req as NextApiRequest, res as NextApiResponse);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData()).error).toBe(
      "Failed to generate review: An unexpected error occurred"
    );
  });

  it("returns 200 with empty review string", async () => {
    mockedGenerateMovieReview.mockResolvedValue("");
    const { req, res } = createMocks({
      method: "POST",
      body: { title: "T", regisseur: "R" },
    });
    await reviewHandler(req as NextApiRequest, res as NextApiResponse);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ review: "" });
  });
});
