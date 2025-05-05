import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { movieSeed1, movieSeed2, movieSeed3 } from "../../movieSeeds";

jest.setTimeout(30000);

// Loosen types for dynamic imports
let watchlistHandler: (req: any, res: any) => Promise<void>;
let Movie: any;
let dbConnect: () => Promise<any>;
let clientPromise: Promise<any>;
let mongoServer: MongoMemoryServer;

describe("watchlistHandler — Integration Tests", () => {
  beforeAll(async () => {
    // Start in-memory MongoDB and set env
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    // Import & run real connector
    const dbMod = await import("@/db/mongodb");
    dbConnect = dbMod.default;
    clientPromise = dbMod.clientPromise;
    await dbConnect();

    // Import handler & model after env
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
    // Clear collection between tests
    await Movie.deleteMany({});
  });

  describe("GET /watchlist?userid=...", () => {
    it("200 + empty array when user has no movies", async () => {
      // GIVEN no movies in the database
      // AND a GET request with userid="alice"
      const { req, res } = createMocks({
        method: "GET",
        query: { userid: "alice" },
      });

      // WHEN the watchlistHandler is called
      await watchlistHandler(req, res);

      // THEN it should respond with 200 and an empty array
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual([]);
    });

    it("200 + only that user's movies", async () => {
      // GIVEN two seeded movies: one saved by "alice", one by "bob"
      const aliceMovie = { ...movieSeed1, savedBy: ["alice"] };
      const bobMovie = { ...movieSeed2, savedBy: ["bob"] };
      await Movie.create([aliceMovie, bobMovie]);

      // WHEN a GET request with userid="alice" is made
      const { req, res } = createMocks({
        method: "GET",
        query: { userid: "alice" },
      });
      await watchlistHandler(req, res);

      // THEN it should return 200 and only alice's movie
      expect(res._getStatusCode()).toBe(200);
      const data = res._getJSONData();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0]._id).toBe(aliceMovie._id);
    });
  });

  describe("PUT /watchlist", () => {
    it("400 on invalid body", async () => {
      // GIVEN a PUT request with invalid body
      const { req, res } = createMocks({
        method: "PUT",
        body: { userId: "", movieId: "nope" },
      });

      // WHEN the handler is invoked
      await watchlistHandler(req, res);

      // THEN it should respond 400 with validation error
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toMatchObject({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("404 if movie not found", async () => {
      // GIVEN a PUT request for a movieId that doesn't exist
      const { req, res } = createMocks({
        method: "PUT",
        body: { userId: "alice", movieId: 999 },
      });

      // WHEN the handler is invoked
      await watchlistHandler(req, res);

      // THEN it should respond 404 Movie not Found
      expect(res._getStatusCode()).toBe(404);
      expect(res._getJSONData()).toEqual({ status: "Movie not Found" });
    });

    it("200 + updated movie on success", async () => {
      // GIVEN a movie seeded without "alice" in savedBy
      const movie = { ...movieSeed3, savedBy: [] };
      await Movie.create(movie);

      // WHEN a PUT request to add "alice" is made
      const { req, res } = createMocks({
        method: "PUT",
        body: { userId: "alice", movieId: movie._id },
      });
      await watchlistHandler(req, res);

      // THEN it should return 200 and the movie should include "alice"
      expect(res._getStatusCode()).toBe(200);
      const updated = res._getJSONData();
      expect(updated).toHaveProperty("savedBy");
      expect(updated.savedBy).toContain("alice");

      // AND the change should persist in the database
      const fromDb = await Movie.findById(movie._id).lean();
      expect(fromDb.savedBy).toContain("alice");
    });
  });

  describe("DELETE /watchlist", () => {
    it("400 on invalid body", async () => {
      // GIVEN a DELETE request with invalid body types
      const { req, res } = createMocks({
        method: "DELETE",
        body: { userId: 123, movieId: null },
      });

      // WHEN the handler is invoked
      await watchlistHandler(req, res);

      // THEN it should respond 400 with validation error
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toMatchObject({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("200 + unchanged movie when nothing to delete", async () => {
      // GIVEN a movie seeded with no savedBy entries
      const movie = { ...movieSeed3, savedBy: [] };
      await Movie.create(movie);

      // WHEN a DELETE request for a user not on list is made
      const { req, res } = createMocks({
        method: "DELETE",
        body: { userId: "bob", movieId: movie._id },
      });
      await watchlistHandler(req, res);

      // THEN it should return 200 and the savedBy array remains unchanged
      expect(res._getStatusCode()).toBe(200);
      const updated = res._getJSONData();
      expect(updated).toHaveProperty("savedBy");
      expect(updated.savedBy).toEqual(movie.savedBy);

      // AND database should reflect no change
      const fromDb = await Movie.findById(movie._id).lean();
      expect(fromDb.savedBy).toEqual(movie.savedBy);
    });

    it("200 + updated movie on success", async () => {
      // GIVEN a movie seeded with "bob" in savedBy
      const movie = { ...movieSeed3, savedBy: ["bob"] };
      await Movie.create(movie);

      // WHEN a DELETE request to remove "bob" is made
      const { req, res } = createMocks({
        method: "DELETE",
        body: { userId: "bob", movieId: movie._id },
      });
      await watchlistHandler(req, res);

      // THEN it should return 200 and the savedBy array excludes "bob"
      expect(res._getStatusCode()).toBe(200);
      const updated = res._getJSONData();
      expect(updated).toHaveProperty("savedBy");
      expect(updated.savedBy).not.toContain("bob");

      // AND database should reflect removal
      const fromDb = await Movie.findById(movie._id).lean();
      expect(fromDb.savedBy).not.toContain("bob");
    });
  });

  it("405 on unsupported methods", async () => {
    // GIVEN an unsupported HTTP method
    const { req, res } = createMocks({ method: "POST" });

    // WHEN the handler is invoked
    await watchlistHandler(req, res);

    // THEN it should return 405 Method Not Allowed
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });
});
