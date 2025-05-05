import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { movieSeed1, movieSeed2 } from "@/tests/movieSeeds";
import { randomQueries } from "@/lib/constants/constants";
import moviesDayHandler from "@/pages/api/moviesoftheday";

// 1Stub out the Mongo connector so it never really opens a pool
jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

// Stub the two service functions
jest.mock("@/services/movieService", () => ({
  getMoviesOfTheDay: jest.fn(),
}));
jest.mock("@/services/movieDB", () => ({
  postMovies: jest.fn(),
}));

let mongoServer: MongoMemoryServer;
let handler: typeof moviesDayHandler;
let getMoviesMock: jest.Mock;
let postMoviesMock: jest.Mock;

beforeAll(async () => {
  // GIVEN an in‐memory MongoDB and MONGODB_URI pointing at it
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  // connect mongoose (to avoid an open handle)
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "testdb" });

  // clear module cache so our mocks are picked up
  jest.resetModules();
  const routeMod = await import("@/pages/api/moviesoftheday");
  handler = routeMod.default;

  const svc = await import("@/services/movieService");
  getMoviesMock = svc.getMoviesOfTheDay as jest.Mock;
  const dbSvc = await import("@/services/movieDB");
  postMoviesMock = dbSvc.postMovies as jest.Mock;
});

afterAll(async () => {
  // cleanup mongoose & in-memory server
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("moviesDayHandler — Integration Tests", () => {
  it("GET → 200 with movies when service returns data", async () => {
    // GIVEN getMoviesOfTheDay resolves to some array
    const data = [movieSeed1, movieSeed2];
    getMoviesMock.mockResolvedValue(data);

    // WHEN we call the handler with GET
    const { req, res } = createMocks({ method: "GET" });
    await handler(req as any, res as any);

    // THEN it should call the service with randomQueries and return 200 + data
    expect(getMoviesMock).toHaveBeenCalledWith(randomQueries);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(data);
  });

  it("GET → 500 when service throws", async () => {
    // GIVEN getMoviesOfTheDay throws
    getMoviesMock.mockRejectedValue(new Error("oops"));

    // WHEN we call GET
    const { req, res } = createMocks({ method: "GET" });
    await handler(req as any, res as any);

    // THEN it should return a 500
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal Server Error" });
  });

  it("POST → 400 when body.movies missing or not an array", async () => {
    // GIVEN a malformed POST body
    const { req, res } = createMocks({ method: "POST", body: { foo: "bar" } });
    await handler(req as any, res as any);

    // THEN we get 400 + error message
    expect(postMoviesMock).not.toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Invalid request. Expecting an array of movies.",
    });
  });

  it("POST → 201 with newMovies when postMovies resolves", async () => {
    // GIVEN valid input and stub returns an array
    const inMovies = [movieSeed1];
    const outMovies = [movieSeed2];
    postMoviesMock.mockResolvedValue(outMovies);

    // WHEN we call POST
    const { req, res } = createMocks({
      method: "POST",
      body: { movies: inMovies },
    });
    await handler(req as any, res as any);

    // THEN we get 201 + the returned array
    expect(postMoviesMock).toHaveBeenCalledWith(inMovies);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual(outMovies);
  });

  it("POST → 500 when postMovies throws", async () => {
    // GIVEN postMovies rejects
    postMoviesMock.mockRejectedValue(new Error("db fail"));

    // WHEN
    const { req, res } = createMocks({
      method: "POST",
      body: { movies: [movieSeed1] },
    });
    await handler(req as any, res as any);

    // THEN we get 500
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal Server Error" });
  });

  it("PUT → 400 when body.movies missing or not an array", async () => {
    // GIVEN bad PUT body
    const { req, res } = createMocks({ method: "PUT", body: { foo: "bar" } });
    await handler(req as any, res as any);

    // THEN 400
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Invalid request. Expecting an array of movies.",
    });
  });

  it("PUT → 200 with message + data when postMovies resolves", async () => {
    // GIVEN valid PUT body and stub resolves
    const inMovies = [movieSeed1];
    const updated = [movieSeed2];
    postMoviesMock.mockResolvedValue(updated);

    // WHEN
    const { req, res } = createMocks({
      method: "PUT",
      body: { movies: inMovies },
    });
    await handler(req as any, res as any);

    // THEN 200 + wrapper object
    expect(postMoviesMock).toHaveBeenCalledWith(inMovies);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      message: "Movies updated successfully",
      data: updated,
    });
  });

  it("OTHER methods → 405 Method Not Allowed", async () => {
    // WHEN we use an unsupported method
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req as any, res as any);

    // THEN 405
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ error: "Method Not Allowed" });
  });
});
