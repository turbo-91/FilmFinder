import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  movieSeed1,
  movieSeed2,
  movieSeed3,
  newMovie,
  newMovies,
} from "./movieSeeds";

jest.setTimeout(30000);

let moviesHandler: (req: any, res: any) => Promise<void>;
let Movie: mongoose.Model<any>;
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "testdb" });

  const moviesMod = await import("@/pages/api/movies");
  moviesHandler = moviesMod.default;
  const movieMod = await import("@/db/models/Movie");
  Movie = movieMod.default;
});

afterEach(async () => {
  await Movie.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  const { clientPromise } = await import("@/db/mongodb");
  const client = await clientPromise;
  await client.close();
  await new Promise((r) => setTimeout(r, 50));
});

describe("Movies API — Integration Test", () => {
  it("getAllMovies → 200 when movies exist", async () => {
    await Movie.create([movieSeed1, movieSeed2, movieSeed3]);
    const { req, res } = createMocks({ method: "GET" });
    await moviesHandler(req, res);

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
    const { req, res } = createMocks({ method: "GET" });
    await moviesHandler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  it("getMovieBySlug → 200 when found", async () => {
    await Movie.create(movieSeed1);
    const { req, res } = createMocks({
      method: "GET",
      query: { slug: movieSeed1.slug },
    });
    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].slug).toBe(movieSeed1.slug);
  });

  it("getMovieBySlug → 404 when missing", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { slug: "nope" },
    });
    await moviesHandler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  it("filterByQuery → 200 only matching", async () => {
    await Movie.create([movieSeed1, movieSeed2, movieSeed3]);
    const { req, res } = createMocks({
      method: "GET",
      query: { query: movieSeed1.queries[0] },
    });
    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(
      data.every((m: any) => m.queries.includes(movieSeed1.queries[0]))
    ).toBe(true);
  });

  it("filterByQuery → 404 when none match", async () => {
    await Movie.create([movieSeed1, movieSeed2]);
    const { req, res } = createMocks({
      method: "GET",
      query: { query: "no-match" },
    });
    await moviesHandler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({
      status: "No movies found for the given query",
    });
  });

  it("createMovie → 201 and stored", async () => {
    const { req, res } = createMocks({ method: "POST", body: newMovie });
    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(201);
    const json = res._getJSONData();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe(newMovie.title);

    const found = await Movie.findOne({ slug: newMovie.slug });
    expect(found).not.toBeNull();
  });

  it("createMovies → 201 and stored", async () => {
    const { req, res } = createMocks({ method: "POST", body: newMovies });
    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(201);
    const json = res._getJSONData();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(newMovies.length);

    const all = await Movie.find();
    expect(all).toHaveLength(newMovies.length);
  });

  it("createMovie → 400 on missing fields", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { title: "bad" },
    });
    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toHaveProperty(
      "error",
      "Missing required fields"
    );
  });

  it("createMovies → 400 on missing fields", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: [{ title: "a" }, { title: "b" }],
    });
    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toHaveProperty(
      "error",
      "Missing required fields"
    );
  });
});
