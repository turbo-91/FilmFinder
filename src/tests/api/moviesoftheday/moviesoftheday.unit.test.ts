import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { movieSeed1, movieSeed2 } from "@/tests/movieSeeds";
import { getMoviesOfTheDay } from "@/services/movieService";
import { randomQueries } from "@/lib/constants/constants";
import moviesDayHandler from "@/pages/api/moviesoftheday";
import { postMovies } from "@/services/movieDB";

// MOCKS
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

  it("GET → 200 with movies when service returns data", async () => {
    // GIVEN getMoviesOfTheDay will resolve with two movies
    const mockData = [movieSeed1, movieSeed2];
    (getMoviesOfTheDay as jest.Mock).mockResolvedValue(mockData);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN service is called with randomQueries and response is 200 with the returned array
    expect(getMoviesOfTheDay).toHaveBeenCalledWith(randomQueries);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockData);
  });

  it("GET → 500 when getMoviesOfTheDay throws", async () => {
    // GIVEN getMoviesOfTheDay will reject
    (getMoviesOfTheDay as jest.Mock).mockRejectedValue(new Error("oops"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN response is 500 with generic error message
    expect(getMoviesOfTheDay).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal Server Error" });
  });

  it("POST → 201 when body.movies is valid array", async () => {
    // GIVEN postMovies will resolve with an array of new movies
    const inMovies = [movieSeed1];
    const outMovies = [movieSeed2];
    (postMovies as jest.Mock).mockResolvedValue(outMovies);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { movies: inMovies },
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN postMovies is called with input and response is 201 with its return value
    expect(postMovies).toHaveBeenCalledWith(inMovies);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual(outMovies);
  });

  it("POST → 400 when body.movies missing or not array", async () => {
    // GIVEN a POST without movies array
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { foo: "bar" },
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN response is 400 with validation error
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Invalid request. Expecting an array of movies.",
    });
  });

  it("POST → 500 when postMovies throws", async () => {
    // GIVEN postMovies will reject
    (postMovies as jest.Mock).mockRejectedValue(new Error("db fail"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { movies: [movieSeed1] },
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN response is 500 with generic error
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal Server Error" });
  });

  it("PUT → 200 wraps postMovies output when body.movies is valid array", async () => {
    // GIVEN postMovies will resolve with updated movies
    const inMovies = [movieSeed1];
    const updatedMovies = [movieSeed2];
    (postMovies as jest.Mock).mockResolvedValue(updatedMovies);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      body: { movies: inMovies },
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN postMovies is called and response is 200 with message+data
    expect(postMovies).toHaveBeenCalledWith(inMovies);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      message: "Movies updated successfully",
      data: updatedMovies,
    });
  });

  it("PUT → 400 when body.movies missing or not array", async () => {
    // GIVEN a PUT without valid movies array
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      body: { movies: "nope" },
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN response is 400 with validation error
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Invalid request. Expecting an array of movies.",
    });
  });

  it("OTHER → 405 for any unsupported HTTP method", async () => {
    // GIVEN a DELETE request
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
    });

    // WHEN the handler is invoked
    await moviesDayHandler(req, res);

    // THEN response is 405 Method Not Allowed
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ error: "Method Not Allowed" });
  });
});
