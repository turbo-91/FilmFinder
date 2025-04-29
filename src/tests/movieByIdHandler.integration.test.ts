// src/tests/movieByIdHandler.integration.test.ts
import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import movieByIdHandler from "@/pages/api/movieById";
import { getMovieById } from "@/services/movieDB";
import handleApiError from "@/lib/handleApiError";

// We’ll use the real service here, so don’t mock movieDB.
// But we do mock handleApiError to prevent logging overhead.
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, message, error) => res.status(500).json({ error: message }))
);

let mongoServer: MongoMemoryServer;

jest.setTimeout(30000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "testdb" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  // Close native Mongo client pool from dbConnect
  const { clientPromise } = await import("@/db/mongodb");
  const client = await clientPromise;
  await client.close();
});

describe("movieByIdHandler — Integration Tests", () => {
  beforeEach(async () => {
    // Clear any existing test data via the service’s model:
    const { default: MovieModel } = await import("@/db/models/Movie");
    await MovieModel.deleteMany({});
    (handleApiError as jest.Mock).mockClear();
  });

  it("returns 200 and the movie from DB", async () => {
    // 1) Seed a movie via service/model
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

    // 2) Call handler
    const { req, res } = createMocks({
      method: "GET",
      query: { id: seeded._id.toString() },
    });
    await movieByIdHandler(req as any, res as any);

    // 3) Assert real DB retrieval
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
    // Spy on service to throw
    (getMovieById as jest.Mock).mockRejectedValue(new Error("fail"));
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
