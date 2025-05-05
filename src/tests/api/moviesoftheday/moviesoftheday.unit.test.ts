import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { movieSeed1, movieSeed2 } from "@/tests/movieSeeds";
import { getMoviesOfTheDay } from "@/services/movieService";
import { randomQueries } from "@/lib/constants/constants";
import moviesDayHandler from "@/pages/api/moviesoftheday";
import { postMovies } from "@/services/movieDB";

jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/db/models/Movie");
jest.mock("@/services/movieService", () => ({ getMoviesOfTheDay: jest.fn() }));
jest.mock("@/services/movieDB", () => ({ postMovies: jest.fn() }));

describe("moviesOfTheDayHandler – Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with movies when service returns data", async () => {
    const mockData = [movieSeed1, movieSeed2];
    (getMoviesOfTheDay as jest.Mock).mockResolvedValue(mockData);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });
    await moviesDayHandler(req, res);
    expect(getMoviesOfTheDay).toHaveBeenCalledWith(randomQueries);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockData);
  });

  it("500 when getMoviesOfTheDay throws", async () => {
    (getMoviesOfTheDay as jest.Mock).mockRejectedValue(new Error("oops"));
    const { req, res } = createMocks({ method: "GET" });
    await moviesDayHandler(req, res);
    expect(getMoviesOfTheDay).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal Server Error" });
  });

  it("should POST and return 201 when body.movies is a valid array", async () => {
    const inMovies = [movieSeed1];
    const outMovies = [movieSeed2];
    (postMovies as jest.Mock).mockResolvedValue(outMovies);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { movies: inMovies },
    });
    await moviesDayHandler(req, res);

    expect(postMovies).toHaveBeenCalledWith(inMovies);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual(outMovies);
  });
});
