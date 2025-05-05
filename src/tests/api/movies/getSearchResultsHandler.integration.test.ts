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
  // GIVEN an in-memory MongoDB and environment variable are set up
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();

  // AND the real dbConnect is imported and executed
  const dbMod = await import("@/db/mongodb");
  dbConnect = dbMod.default;
  clientPromise = dbMod.clientPromise;
  await dbConnect();

  // AND the handler and its dependencies are dynamically imported
  const routeMod = await import("@/pages/api/movies/search");
  getSearchResults = routeMod.default;
  const svc = await import("@/services/movieService");
  getSearchMovies = svc.getSearchMovies as jest.Mock;
  const errMod = await import("@/lib/handleApiError");
  handleApiError = errMod.default as jest.Mock;
});

afterAll(async () => {
  // Clean up connections
  await mongoose.disconnect();
  await mongoServer.stop();
  const client = await clientPromise;
  await client.close();
});

describe("getSearchResults — Full Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("400 if no query", async () => {
    // GIVEN no query parameter on the GET request
    const { req, res } = createMocks({ method: "GET", query: {} });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN it returns 400 and does not call the service
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "Query parameter is required",
    });
    expect(getSearchMovies).not.toHaveBeenCalled();
  });

  it("200 + empty array when none found", async () => {
    // GIVEN getSearchMovies resolves to an empty array
    (getSearchMovies as jest.Mock).mockResolvedValue([]);

    // AND a GET request with a valid query parameter
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed1.title },
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN it calls the service with the provided query and returns empty results
    expect(getSearchMovies).toHaveBeenCalledWith(movieSeed1.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      results: [],
      message: "No movies found",
    });
  });

  it("200 + data when service returns movies", async () => {
    // GIVEN getSearchMovies resolves with some movies
    const data = [movieSeed1, movieSeed2];
    (getSearchMovies as jest.Mock).mockResolvedValue(data);

    // AND a GET request for that query
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed2.title },
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN it returns status 200 with the same movie array
    expect(getSearchMovies).toHaveBeenCalledWith(movieSeed2.title);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(data);
  });

  it("500 via handleApiError if service throws", async () => {
    // GIVEN getSearchMovies throws an error
    const err = new Error("boom");
    (getSearchMovies as jest.Mock).mockRejectedValue(err);

    // AND a valid GET request
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed1.title },
    });

    // WHEN the handler is invoked
    await getSearchResults(req, res);

    // THEN handleApiError is called and returns status 500
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movies",
      err
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movies" });
  });
});
