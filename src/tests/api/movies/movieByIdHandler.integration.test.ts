import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { movieSeed1 } from "../../movieSeeds";

jest.setTimeout(30000);

// Mock only the error‐handler
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, message, error) => res.status(500).json({ error: message }))
);

let movieByIdHandler: (req: any, res: any) => Promise<void>;
let handleApiError: jest.Mock;
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // GIVEN an in-memory MongoDB instance is started
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "testdb" });

  // AND the handler and error mock are dynamically imported
  const routeMod = await import("@/pages/api/movies/[id]");
  movieByIdHandler = routeMod.default;

  const errorMod = await import("@/lib/handleApiError");
  handleApiError = errorMod.default as jest.Mock;
});

afterAll(async () => {
  // Cleanup database connections and in-memory server
  await mongoose.disconnect();
  await mongoServer.stop();
  const { clientPromise } = await import("@/db/mongodb");
  const client = await clientPromise;
  await client.close();
  await new Promise((r) => setTimeout(r, 50));
});

describe("movieByIdHandler — Integration Tests", () => {
  beforeEach(async () => {
    const { default: MovieModel } = await import("@/db/models/Movie");
    await MovieModel.deleteMany({});
    handleApiError.mockClear();
  });

  it("returns 200 and the movie from DB", async () => {
    // GIVEN one movie is seeded
    const { default: MovieModel } = await import("@/db/models/Movie");
    const seeded = await MovieModel.create(movieSeed1);

    // WHEN the handler is invoked with that ID
    const { req, res } = createMocks({
      method: "GET",
      query: { id: seeded._id.toString() },
    });
    await movieByIdHandler(req as any, res as any);

    // THEN it responds with 200 and the seeded movie data
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toMatchObject({
      _id: seeded._id,
      title: seeded.title,
    });
  });

  it("GIVEN no movie exists for the ID WHEN requested THEN returns 404", async () => {
    // WHEN the handler is invoked with a non-existent ID
    const { req, res } = createMocks({
      method: "GET",
      query: { id: "9999" },
    });
    await movieByIdHandler(req as any, res as any);

    // THEN it responds with 404 and the correct status message
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Movie Not Found" });
  });

  it("GIVEN an invalid ID parameter WHEN requested THEN returns 400", async () => {
    // WHEN the handler is invoked with a non-string ID
    const { req, res } = createMocks({
      method: "GET",
      query: { id: ["bad"] },
    });
    await movieByIdHandler(req as any, res as any);

    // THEN it responds with 400 and the validation error
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Movie ID is required" });
  });

  it("GIVEN an unsupported HTTP method WHEN invoked THEN returns 405", async () => {
    // WHEN the handler is invoked with POST
    const { req, res } = createMocks({
      method: "POST",
      query: { id: "100" },
    });
    await movieByIdHandler(req as any, res as any);

    // THEN it responds with 405 and the method-not-allowed status
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });

  it("GIVEN the service throws an error WHEN requested THEN delegates to handleApiError", async () => {
    // GIVEN the underlying service will reject
    const serviceMod = await import("@/services/movieDB");
    jest.spyOn(serviceMod, "getMovieById").mockRejectedValue(new Error("fail"));

    // WHEN the handler is invoked
    const { req, res } = createMocks({
      method: "GET",
      query: { id: "100" },
    });
    await movieByIdHandler(req as any, res as any);

    // THEN handleApiError is called and a 500 is returned
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movie by ID",
      expect.any(Error)
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movie by ID" });
  });
});
