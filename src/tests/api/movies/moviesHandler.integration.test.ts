import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  movieSeed1,
  movieSeed2,
  movieSeed3,
  newMovie,
  newMovies,
} from "../../movieSeeds";

jest.setTimeout(30000);

let moviesHandler: (req: any, res: any) => Promise<void>;
let Movie: mongoose.Model<any>;
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Start in-memory MongoDB and connect Mongoose
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "testdb" });

  // Dynamically import handler and model after URI is set
  const moviesMod = await import("@/pages/api/movies");
  moviesHandler = moviesMod.default;
  const movieMod = await import("@/db/models/Movie");
  Movie = movieMod.default;
});

afterEach(async () => {
  // Clean up between tests
  await Movie.deleteMany({});
});

afterAll(async () => {
  // Disconnect and stop in-memory
  await mongoose.disconnect();
  await mongoServer.stop();

  // Close any extra MongoClient from dbConnect
  const { clientPromise } = await import("@/db/mongodb");
  const client = await clientPromise;
  await client.close();

  // Give any lingering handles a moment
  await new Promise((r) => setTimeout(r, 50));
});

describe("Movies API — Integration Test", () => {
  it("getAllMovies → 200 when movies exist", async () => {
    // GIVEN three movies in the database
    await Movie.create([movieSeed1, movieSeed2, movieSeed3]);

    // WHEN a GET request with no query is sent
    const { req, res } = createMocks({ method: "GET" });
    await moviesHandler(req, res);

    // THEN we receive 200 and an array containing all three titles
    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);
    const titles = data.map((m: any) => m.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        movieSeed1.title,
        movieSeed2.title,
        movieSeed3.title,
      ])
    );
  });

  it("getAllMovies → 404 when none exist", async () => {
    // GIVEN an empty database

    // WHEN a GET request with no query is sent
    const { req, res } = createMocks({ method: "GET" });
    await moviesHandler(req, res);

    // THEN we receive 404 Not Found
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  it("getMovieBySlug → 200 when found", async () => {
    // GIVEN one movie seeded
    await Movie.create(movieSeed1);

    // WHEN a GET request with slug query is sent
    const { req, res } = createMocks({
      method: "GET",
      query: { slug: movieSeed1.slug },
    });
    await moviesHandler(req, res);

    // THEN we receive 200 and the matching movie
    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].slug).toBe(movieSeed1.slug);
  });

  it("getMovieBySlug → 404 when missing", async () => {
    // GIVEN an empty database

    // WHEN a GET request with a non-existing slug is sent
    const { req, res } = createMocks({
      method: "GET",
      query: { slug: "nope" },
    });
    await moviesHandler(req, res);

    // THEN we receive 404 Not Found
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  it("filterByQuery → 200 only matching", async () => {
    // GIVEN three movies, two with 'action' and one with 'drama'
    await Movie.create([movieSeed1, movieSeed2, movieSeed3]);

    // WHEN a GET request with query='action' is sent
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed1.queries[0] },
    });
    await moviesHandler(req, res);

    // THEN we receive 200 and only movies tagged 'action'
    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(data.every((m: any) => m.queries.includes("action"))).toBe(true);
  });

  it("filterByQuery → 404 when none match", async () => {
    // GIVEN two movies without the 'no-match' tag
    await Movie.create([movieSeed1, movieSeed2]);

    // WHEN a GET request with query='no-match' is sent
    const { req, res } = createMocks({
      method: "GET",
      query: { query: "no-match" },
    });
    await moviesHandler(req, res);

    // THEN we receive 404 and appropriate message
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({
      status: "No movies found for the given query",
    });
  });

  it("createMovie → 201 and stored", async () => {
    // GIVEN a valid new movie payload
    const { req, res } = createMocks({ method: "POST", body: newMovie });

    // WHEN the POST request is sent
    await moviesHandler(req, res);

    // THEN we receive 201 and the movie is persisted
    expect(res._getStatusCode()).toBe(201);
    const json = res._getJSONData();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe(newMovie.title);
    const found = await Movie.findOne({ slug: newMovie.slug });
    expect(found).not.toBeNull();
  });

  it("createMovies → 201 and stored", async () => {
    // GIVEN a valid array of new movies
    const { req, res } = createMocks({ method: "POST", body: newMovies });

    // WHEN the POST request is sent
    await moviesHandler(req, res);

    // THEN we receive 201 and all movies are persisted
    expect(res._getStatusCode()).toBe(201);
    const json = res._getJSONData();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(newMovies.length);
    const all = await Movie.find();
    expect(all).toHaveLength(newMovies.length);
  });

  it("createMovie → 400 on missing fields", async () => {
    // GIVEN an incomplete movie payload
    const { req, res } = createMocks({
      method: "POST",
      body: { title: "bad" },
    });

    // WHEN the POST request is sent
    await moviesHandler(req, res);

    // THEN we receive 400 with a missing-fields error
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toHaveProperty(
      "error",
      "Missing required fields"
    );
  });

  it("createMovies → 400 on missing fields", async () => {
    // GIVEN an array of incomplete movie payloads
    const { req, res } = createMocks({
      method: "POST",
      body: [{ title: "a" }, { title: "b" }],
    });

    // WHEN the POST request is sent
    await moviesHandler(req, res);

    // THEN we receive 400 with a missing-fields error
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toHaveProperty(
      "error",
      "Missing required fields"
    );
  });
});
