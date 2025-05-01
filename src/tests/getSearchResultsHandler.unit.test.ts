import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import getSearchResults from "@/pages/api/movies/search";
import { getSearchMovies } from "@/services/movieService";
import handleApiError from "@/lib/handleApiError";
import { movieSeed1 } from "./movieSeeds";

// Mock out dependencies before any code runs
jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/services/movieService", () => ({ getSearchMovies: jest.fn() }));
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res: NextApiResponse, message: string, error: unknown) =>
    res.status(500).json({ error: message })
  )
);

describe("getSearchResults – Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when query param is missing", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {},
    });
    await getSearchResults(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Query parameter is required",
    });
    expect(getSearchMovies).not.toHaveBeenCalled();
  });

  it("returns 400 when query param is not a string", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: ["arr"] },
    });
    await getSearchResults(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Query parameter is required",
    });
    expect(getSearchMovies).not.toHaveBeenCalled();
  });

  it("returns 200 with empty results when service returns []", async () => {
    (getSearchMovies as jest.Mock).mockResolvedValue([]);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: movieSeed1.title },
    });
    await getSearchResults(req, res);
    expect(getSearchMovies).toHaveBeenCalledWith(movieSeed1.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      results: [],
      message: "No movies found",
    });
  });

  it("returns 200 with movies when service returns data", async () => {
    const mockData = [movieSeed1];
    (getSearchMovies as jest.Mock).mockResolvedValue(mockData);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: movieSeed1.title },
    });
    await getSearchResults(req, res);
    expect(getSearchMovies).toHaveBeenCalledWith(movieSeed1.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockData);
  });

  it("uses handleApiError on service throw", async () => {
    const error = new Error("fail");
    (getSearchMovies as jest.Mock).mockRejectedValue(error);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: movieSeed1.title },
    });
    await getSearchResults(req, res);
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movies",
      error
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movies" });
  });
});
