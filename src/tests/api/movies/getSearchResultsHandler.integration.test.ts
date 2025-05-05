// src/tests/getSearchResultsHandler.integration.test.ts

import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { movieSeed1, movieSeed2 } from "../../movieSeeds";

// Stub only the downstream service and error-handler
jest.mock("@/services/movieService", () => ({
  getSearchMovies: jest.fn(),
}));
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, msg, err) => res.status(500).json({ error: msg }))
);

let getSearchResults: (req: any, res: any) => Promise<void>;
let getSearchMovies: jest.Mock;
let handleApiError: jest.Mock;
// loosen the type here so it matches whatever dbConnect actually returns
let dbConnect: () => Promise<any>;
let clientPromise: Promise<any>;

let mongoServer: MongoMemoryServer;

jest.setTimeout(30000);

beforeAll(async () => {
  // 1) Spin up in-memory MongoDB and set the envvar
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();

  // 2) Dynamically import the DB-connector now that the env is set
  const dbMod = await import("@/db/mongodb");
  dbConnect = dbMod.default;
  clientPromise = dbMod.clientPromise;

  // 3) Connect via your real dbConnect()
  await dbConnect();

  // 4) Dynamically import your handler & its mocks
  const routeMod = await import("@/pages/api/movies/search");
  getSearchResults = routeMod.default;

  const svc = await import("@/services/movieService");
  getSearchMovies = svc.getSearchMovies as jest.Mock;

  const errMod = await import("@/lib/handleApiError");
  handleApiError = errMod.default as jest.Mock;
});

afterAll(async () => {
  // 1) Disconnect mongoose
  await mongoose.disconnect();
  // 2) Stop the in-memory server
  await mongoServer.stop();
  // 3) Close the native client from dbConnect
  const client = await clientPromise;
  await client.close();
});

describe("getSearchResults — Full Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("400 if no query", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await getSearchResults(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Query parameter is required",
    });
    expect(getSearchMovies).not.toHaveBeenCalled();
  });

  it("200 + empty array when none found", async () => {
    (getSearchMovies as jest.Mock).mockResolvedValue([]);
    const { req, res } = createMocks({
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

  it("200 + data when service returns movies", async () => {
    const data = [movieSeed1, movieSeed2];
    (getSearchMovies as jest.Mock).mockResolvedValue(data);
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed2.title },
    });
    await getSearchResults(req, res);

    expect(getSearchMovies).toHaveBeenCalledWith(movieSeed2.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(data);
  });

  it("500 via handleApiError if service throws", async () => {
    const err = new Error("boom");
    (getSearchMovies as jest.Mock).mockRejectedValue(err);
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
