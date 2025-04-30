// src/tests/movieByIdHandler.integration.test.ts
import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

jest.setTimeout(30000);

// Mock only the error‐handler
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, message, error) => res.status(500).json({ error: message }))
);

let movieByIdHandler: (req: any, res: any) => Promise<void>;
let handleApiError: jest.Mock;
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "testdb" });

  // Dynamically import after MONGODB_URI is set
  const routeMod = await import("@/pages/api/movies/[id]");
  movieByIdHandler = routeMod.default;

  const errorMod = await import("@/lib/handleApiError");
  handleApiError = errorMod.default as jest.Mock;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();

  // Close native driver from dbConnect()
  const { clientPromise } = await import("@/db/mongodb");
  const client = await clientPromise;
  await client.close();

  // Give any lingering handles a tick
  await new Promise((r) => setTimeout(r, 50));
});

describe("movieByIdHandler — Integration Tests", () => {
  beforeEach(async () => {
    // Clear real Movie collection
    const { default: MovieModel } = await import("@/db/models/Movie");
    await MovieModel.deleteMany({});
    handleApiError.mockClear();
  });

  it("returns 200 and the movie from DB", async () => {
    const { default: MovieModel } = await import("@/db/models/Movie");
    const seeded = await MovieModel.create({
      _id: 100,
      netzkinoId: 100,
      slug: "seed",
      title: "Seeded Movie",
      year: ["2025"],
      regisseur: ["Dir"],
      stars: ["Star"],
      overview: "Test",
      imgNetzkino: "x.jpg",
      imgNetzkinoSmall: "x-small.jpg",
      posterImdb: "p.jpg",
      backdropImdb: "b.jpg",
      queries: ["q"],
    });

    const { req, res } = createMocks({
      method: "GET",
      query: { id: seeded._id.toString() },
    });
    await movieByIdHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toMatchObject({
      _id: seeded._id,
      title: seeded.title,
    });
  });

  it("returns 404 for non-existent ID", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { id: "9999" },
    });
    await movieByIdHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Movie Not Found" });
  });

  it("returns 400 when ID param is invalid", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { id: ["bad"] },
    });
    await movieByIdHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Movie ID is required" });
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: { id: "100" },
    });
    await movieByIdHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });

  it("uses handleApiError on unexpected errors", async () => {
    // Force the service layer to throw by mocking getMovieById at runtime:
    const serviceMod = await import("@/services/movieDB");
    jest.spyOn(serviceMod, "getMovieById").mockRejectedValue(new Error("fail"));

    const { req, res } = createMocks({
      method: "GET",
      query: { id: "100" },
    });
    await movieByIdHandler(req as any, res as any);

    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movie by ID",
      expect.any(Error)
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movie by ID" });
  });
});
