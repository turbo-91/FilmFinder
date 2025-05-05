import moviesHandler from "@/pages/api/movies";
import { createMocks } from "node-mocks-http";
import Movie from "@/db/models/Movie";
import { movieSeed1, movieSeed2 } from "@/tests/movieSeeds";

jest.mock("@/db/mongodb", () => jest.fn()); // Mock database connection
jest.mock("@/db/models/Movie"); // Mock Mongoose Model

describe("Movies API – Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("405 Method Not Allowed for unsupported methods", async () => {
    // GIVEN a PUT request to the movies endpoint
    const { req, res } = createMocks({ method: "PUT" });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should respond 405 with Method Not Allowed
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });

  test("getAllMovies → 200 when filtering by query", async () => {
    const mockMovies = [{ title: "Movie A" }];
    (Movie.find as jest.Mock).mockResolvedValue(mockMovies);

    // GIVEN a GET request with query='action'
    const { req, res } = createMocks({
      method: "GET",
      query: { query: "action" },
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should call Movie.find with the correct filter and return the movies
    expect(Movie.find).toHaveBeenCalledWith({ queries: "action" });
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockMovies);
  });

  test("getAllMovies → 404 when no movies found", async () => {
    (Movie.find as jest.Mock).mockResolvedValue([]);

    // GIVEN a GET request with no query
    const { req, res } = createMocks({ method: "GET" });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should return 404 Not Found
    expect(Movie.find).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  test("getMovieBySlug → 200 when slug matches", async () => {
    const mockMovie = [{ slug: "movie-1", title: "Movie 1" }];
    (Movie.find as jest.Mock).mockResolvedValue(mockMovie);

    // GIVEN a GET request with slug='movie-1'
    const { req, res } = createMocks({
      method: "GET",
      query: { slug: "movie-1" },
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should call Movie.find with the correct slug and return that movie
    expect(Movie.find).toHaveBeenCalledWith({ slug: "movie-1" });
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockMovie);
  });

  test("filterByQuery → 404 when query matches none", async () => {
    (Movie.find as jest.Mock).mockResolvedValue([]);

    // GIVEN a GET request with query='nonexistent'
    const { req, res } = createMocks({
      method: "GET",
      query: { query: "nonexistent" },
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should return 404 and the appropriate message
    expect(Movie.find).toHaveBeenCalledWith({ queries: "nonexistent" });
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({
      status: "No movies found for the given query",
    });
  });

  test("500 if Movie.find throws an error", async () => {
    (Movie.find as jest.Mock).mockRejectedValue(new Error("DB error"));

    // GIVEN a GET request with query='action'
    const { req, res } = createMocks({
      method: "GET",
      query: { query: "action" },
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should respond 500 and include an error property
    expect(Movie.find).toHaveBeenCalledWith({ queries: "action" });
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toHaveProperty("error");
  });

  test("createMovie → 201 and returns created movie", async () => {
    const movieData = movieSeed1;
    (Movie.create as jest.Mock).mockResolvedValue(movieData);

    // GIVEN a POST request with a valid movie body
    const { req, res } = createMocks({
      method: "POST",
      body: movieData,
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should create the movie and return 201 with the movie data
    expect(Movie.create).toHaveBeenCalledWith(movieData);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual({
      success: true,
      status: "Movie created",
      data: movieData,
    });
  });

  test("createMovies → 201 and returns created movies", async () => {
    const moviesData = [movieSeed1, movieSeed2];
    (Movie.insertMany as jest.Mock).mockResolvedValue(moviesData);

    // GIVEN a POST request with an array of movies
    const { req, res } = createMocks({
      method: "POST",
      body: moviesData,
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should insert all movies and return 201 with the array
    expect(Movie.insertMany).toHaveBeenCalledWith(moviesData);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual({
      success: true,
      status: "Movies created",
      data: moviesData,
    });
  });

  test("createMovie → 400 on missing required fields (single)", async () => {
    const incomplete = { title: "Bad" };
    (Movie.create as jest.Mock).mockRejectedValue(
      new Error("Movie validation failed: Missing required fields")
    );

    // GIVEN a POST request with incomplete body
    const { req, res } = createMocks({
      method: "POST",
      body: incomplete,
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should respond 400 with a missing-fields error
    expect(Movie.create).toHaveBeenCalledWith(incomplete);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Missing required fields" });
  });

  test("createMovies → 400 on missing required fields (multiple)", async () => {
    const incompletes = [{ title: "A" }, { title: "B" }];
    (Movie.insertMany as jest.Mock).mockRejectedValue(
      new Error("Movie validation failed: Missing required fields")
    );

    // GIVEN a POST request with an array of incomplete bodies
    const { req, res } = createMocks({
      method: "POST",
      body: incompletes,
    });

    // WHEN the handler is invoked
    await moviesHandler(req, res);

    // THEN it should respond 400 with a missing-fields error
    expect(Movie.insertMany).toHaveBeenCalledWith(incompletes);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Missing required fields" });
  });
});
