import { createMocks } from "node-mocks-http";
import movieByIdHandler from "@/pages/api/movies/[id]";
import { getMovieById } from "@/services/movieDB";
import handleApiError from "@/lib/handleApiError";
import { movieSeed1 } from "../../movieSeeds";
import type { NextApiRequest, NextApiResponse } from "next";

// Mock external dependencies
jest.mock("@/services/movieDB", () => ({
  getMovieById: jest.fn(),
}));
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, message, error) => res.status(500).json({ error: message }))
);

describe("movieByIdHandler – Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GIVEN a non-GET method WHEN called THEN returns 405", async () => {
    // GIVEN
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { id: "1" },
    });

    // WHEN
    await movieByIdHandler(req as any, res as any);

    // THEN
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });

  it("GIVEN missing id param WHEN GET called THEN returns 400", async () => {
    // GIVEN
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {},
    });

    // WHEN
    await movieByIdHandler(req as any, res as any);

    // THEN
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Movie ID is required" });
  });

  it("GIVEN id param is not a string WHEN GET called THEN returns 400", async () => {
    // GIVEN
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: [123] } as any,
    });

    // WHEN
    await movieByIdHandler(req as any, res as any);

    // THEN
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Movie ID is required" });
  });

  it("GIVEN a valid id and movie exists WHEN GET called THEN returns 200 with movie", async () => {
    // GIVEN
    (getMovieById as jest.Mock).mockResolvedValue(movieSeed1);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: movieSeed1._id.toString() },
    });

    // WHEN
    await movieByIdHandler(req as any, res as any);

    // THEN
    expect(getMovieById).toHaveBeenCalledWith(movieSeed1._id.toString());
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(movieSeed1);
  });

  it("GIVEN a valid id but movie missing WHEN GET called THEN returns 404", async () => {
    // GIVEN
    (getMovieById as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: "42" },
    });

    // WHEN
    await movieByIdHandler(req as any, res as any);

    // THEN
    expect(getMovieById).toHaveBeenCalledWith("42");
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Movie Not Found" });
  });

  it("GIVEN service error WHEN GET called THEN delegates to handleApiError", async () => {
    // GIVEN
    const error = new Error("DB fail");
    (getMovieById as jest.Mock).mockRejectedValue(error);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: movieSeed1._id.toString() },
    });

    // WHEN
    await movieByIdHandler(req as any, res as any);

    // THEN
    expect(getMovieById).toHaveBeenCalledWith(movieSeed1._id.toString());
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movie by ID",
      error
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movie by ID" });
  });
});
