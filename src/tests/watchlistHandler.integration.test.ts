// src/tests/watchlistHandler.integration.test.ts

import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { movieSeed1, movieSeed2, movieSeed3 } from "./movieSeeds";

jest.setTimeout(30000);

// Loosen types for dynamic imports
let watchlistHandler: (req: any, res: any) => Promise<void>;
let Movie: any;
let dbConnect: () => Promise<any>;
let clientPromise: Promise<any>;
let mongoServer: MongoMemoryServer;

describe("watchlistHandler — Integration Tests", () => {
  beforeAll(async () => {
    // 1) Start in-memory MongoDB and set env
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    // 2) Import & run real connector
    const dbMod = await import("@/db/mongodb");
    dbConnect = dbMod.default;
    clientPromise = dbMod.clientPromise;
    await dbConnect();

    // 3) Import handler & model after env
    const routeMod = await import("@/pages/api/movies/watchlist");
    watchlistHandler = routeMod.default;
    const movieMod = await import("@/db/models/Movie");
    Movie = movieMod.default;
  });

  afterAll(async () => {
    // Disconnect & cleanup
    await mongoose.disconnect();
    await mongoServer.stop();
    const client = await clientPromise;
    await client.close();
  });

  beforeEach(async () => {
    await Movie.deleteMany({});
  });

  describe("GET /watchlist?userid=...", () => {
    it("200 + empty array when user has no movies", async () => {
      const { req, res } = createMocks({
        method: "GET",
        query: { userid: "alice" },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual([]);
    });

    it("200 + only that user's movies", async () => {
      const aliceMovie = { ...movieSeed1, savedBy: ["alice"] };
      const bobMovie = { ...movieSeed2, savedBy: ["bob"] };
      await Movie.create([aliceMovie, bobMovie]);

      const { req, res } = createMocks({
        method: "GET",
        query: { userid: "alice" },
      });
      await watchlistHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = res._getJSONData();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0]._id).toBe(aliceMovie._id);
    });
  });

  describe("PUT /watchlist", () => {
    it("400 on invalid body", async () => {
      const { req, res } = createMocks({
        method: "PUT",
        body: { userId: "", movieId: "nope" },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toMatchObject({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("404 if movie not found", async () => {
      const { req, res } = createMocks({
        method: "PUT",
        body: { userId: "alice", movieId: 999 },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(404);
      expect(res._getJSONData()).toEqual({ status: "Movie not Found" });
    });

    it("200 + updated movie on success", async () => {
      const movie = { ...movieSeed3, savedBy: [] };
      await Movie.create(movie);

      const { req, res } = createMocks({
        method: "PUT",
        body: { userId: "alice", movieId: movie._id },
      });
      await watchlistHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const updated = res._getJSONData();
      expect(updated).toHaveProperty("savedBy");
      expect(updated.savedBy).toContain("alice");

      const fromDb = await Movie.findById(movie._id).lean();
      expect(fromDb.savedBy).toContain("alice");
    });
  });

  describe("DELETE /watchlist", () => {
    it("400 on invalid body", async () => {
      const { req, res } = createMocks({
        method: "DELETE",
        body: { userId: 123, movieId: null },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toMatchObject({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("200 + unchanged movie when nothing to delete", async () => {
      const movie = { ...movieSeed3, savedBy: [] };
      await Movie.create(movie);

      const { req, res } = createMocks({
        method: "DELETE",
        body: { userId: "bob", movieId: movie._id },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const updated = res._getJSONData();
      expect(updated).toHaveProperty("savedBy");
      expect(updated.savedBy).toEqual(movie.savedBy);

      const fromDb = await Movie.findById(movie._id).lean();
      expect(fromDb.savedBy).toEqual(movie.savedBy);
    });

    it("200 + updated movie on success", async () => {
      const movie = { ...movieSeed3, savedBy: ["bob"] };
      await Movie.create(movie);

      const { req, res } = createMocks({
        method: "DELETE",
        body: { userId: "bob", movieId: movie._id },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const updated = res._getJSONData();
      expect(updated).toHaveProperty("savedBy");
      expect(updated.savedBy).not.toContain("bob");

      const fromDb = await Movie.findById(movie._id).lean();
      expect(fromDb.savedBy).not.toContain("bob");
    });
  });

  it("405 on unsupported methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await watchlistHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });
});
