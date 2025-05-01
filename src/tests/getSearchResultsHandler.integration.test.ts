import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { movieSeed1, movieSeed2 } from "./movieSeeds";

// Stub out dbConnect so no real Mongo client pools linger
jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(null),
}));

jest.setTimeout(30000);

// Stub out the movieService to avoid loading static assets and downstream fetchers
jest.mock("@/services/movieService", () => ({ getSearchMovies: jest.fn() }));

// Mock only the error handler
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, message, error) => res.status(500).json({ error: message }))
);

let getSearchResults: (req: any, res: any) => Promise<void>;
let serviceMod: typeof import("@/services/movieService");
let handleApiError: jest.Mock;
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // start in-memory MongoDB and set env
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "testdb" });

  // clear module cache so handler picks up env
  jest.resetModules();

  // import handler and modules after env is set
  const routeMod = await import("@/pages/api/movies/search");
  getSearchResults = routeMod.default;

  serviceMod = await import("@/services/movieService");

  const errorMod = await import("@/lib/handleApiError");
  handleApiError = errorMod.default as jest.Mock;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  // No real dbConnect client to close, since we mocked it
});

describe("getSearchResults — Integration Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when query param is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await getSearchResults(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Query parameter is required",
    });
    expect(serviceMod.getSearchMovies).not.toHaveBeenCalled();
  });

  it("returns 200 with empty results when service returns []", async () => {
    jest.spyOn(serviceMod, "getSearchMovies").mockResolvedValue([]);
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed1.title },
    });
    await getSearchResults(req, res);

    expect(serviceMod.getSearchMovies).toHaveBeenCalledWith(movieSeed1.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      results: [],
      message: "No movies found",
    });
  });

  it("returns 200 with movies when service returns data", async () => {
    const data = [movieSeed1, movieSeed2];
    jest.spyOn(serviceMod, "getSearchMovies").mockResolvedValue(data);
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed2.title },
    });

    await getSearchResults(req, res);
    expect(serviceMod.getSearchMovies).toHaveBeenCalledWith(movieSeed2.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(data);
  });

  it("uses handleApiError on service throw", async () => {
    const err = new Error("fail");
    jest.spyOn(serviceMod, "getSearchMovies").mockRejectedValue(err);
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed1.title },
    });

    await getSearchResults(req, res);
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movies",
      err
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movies" });
  });
});
