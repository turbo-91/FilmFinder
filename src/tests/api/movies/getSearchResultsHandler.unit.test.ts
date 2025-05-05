import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import getSearchResults from "@/pages/api/movies/search";
import { getSearchMovies } from "@/services/movieService";
import handleApiError from "@/lib/handleApiError";
import { movieSeed1 } from "../../movieSeeds";

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
    // GIVEN a GET request with no query parameter
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {},
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN it responds with 400 and the correct error, and never calls the service
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Query parameter is required",
    });
    expect(getSearchMovies).not.toHaveBeenCalled();
  });

  it("returns 400 when query param is not a string", async () => {
    // GIVEN a GET request where query is an array instead of a string
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: ["arr"] },
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN it responds with 400 and the correct error, and never calls the service
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Query parameter is required",
    });
    expect(getSearchMovies).not.toHaveBeenCalled();
  });

  it("returns 200 with empty results when service returns []", async () => {
    // GIVEN getSearchMovies resolves to an empty array
    (getSearchMovies as jest.Mock).mockResolvedValue([]);

    // AND a GET request with a valid string query
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: movieSeed1.title },
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN it calls the service with the query and returns a 200 with an empty-results payload
    expect(getSearchMovies).toHaveBeenCalledWith(movieSeed1.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      results: [],
      message: "No movies found",
    });
  });

  it("returns 200 with movies when service returns data", async () => {
    // GIVEN getSearchMovies resolves with some movies
    const mockData = [movieSeed1];
    (getSearchMovies as jest.Mock).mockResolvedValue(mockData);

    // AND a GET request with that same query
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: movieSeed1.title },
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN it returns 200 and the exact array from the service
    expect(getSearchMovies).toHaveBeenCalledWith(movieSeed1.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockData);
  });

  it("uses handleApiError on service throw", async () => {
    // GIVEN getSearchMovies throws an error
    const error = new Error("fail");
    (getSearchMovies as jest.Mock).mockRejectedValue(error);

    // AND a GET request with a valid query
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { query: movieSeed1.title },
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN handleApiError is called and a 500 is returned with the error message
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movies",
      error
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movies" });
  });
});
