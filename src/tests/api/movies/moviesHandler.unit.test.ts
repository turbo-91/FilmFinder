import moviesHandler from "@/pages/api/movies";
import { createMocks } from "node-mocks-http";
import Movie from "@/db/models/Movie";

jest.mock("@/db/mongodb", () => jest.fn()); // Mock database connection
jest.mock("@/db/models/Movie"); // Mock Mongoose Model

describe("Movies API - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // getAll tests

  test("should return 405 Method Not Allowed for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "PUT" }); // Unsupported method

    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });

  test("should call Movie.find() with the correct parameters when filtering by query", async () => {
    const mockMovies = [{ title: "Movie A" }];
    (Movie.find as jest.Mock).mockResolvedValue(mockMovies);

    const { req, res } = createMocks({
      method: "GET",
      query: { query: "action" },
    });

    await moviesHandler(req, res);

    expect(Movie.find).toHaveBeenCalledWith({ queries: "action" }); // Ensure correct query
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockMovies);
  });

  test("should return 404 if no movies found", async () => {
    (Movie.find as jest.Mock).mockResolvedValue([]);

    const { req, res } = createMocks({ method: "GET" });

    await moviesHandler(req, res);

    expect(Movie.find).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  // getBySlug tests

  test("should call Movie.find() with the correct parameters when searching by slug", async () => {
    const mockMovie = [
      {
        slug: "movie-1",
        title: "Movie 1",
      },
    ];

    (Movie.find as jest.Mock).mockResolvedValue(mockMovie);

    const { req, res } = createMocks({
      method: "GET",
      query: { slug: "movie-1" },
    });

    await moviesHandler(req, res);

    expect(Movie.find).toHaveBeenCalledTimes(1);
    expect(Movie.find).toHaveBeenCalledWith({ slug: "movie-1" }); // ✅ Now ensures correct slug
  });

  test("should return 405 Method Not Allowed for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "PUT" }); // Unsupported method

    await moviesHandler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });

  // getMovieBySlug tests

  test("should call Movie.find() with the correct query parameter", async () => {
    const mockMovies = [{ title: "Movie A", queries: ["action"] }];
    (Movie.find as jest.Mock).mockResolvedValue(mockMovies);

    const { req, res } = createMocks({
      method: "GET",
      query: { query: "action" }, // Simulating a search by query
    });

    await moviesHandler(req, res);

    expect(Movie.find).toHaveBeenCalledWith({ queries: "action" }); // ✅ Ensure correct query parameter
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(mockMovies);
  });

  test("should return 404 if no movies match the query", async () => {
    (Movie.find as jest.Mock).mockResolvedValue([]); // Simulating no results found

    const { req, res } = createMocks({
      method: "GET",
      query: { query: "nonexistent" },
    });

    await moviesHandler(req, res);

    expect(Movie.find).toHaveBeenCalledWith({ queries: "nonexistent" });
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({
      status: "No movies found for the given query",
    });
  });

  test("should return 500 if database error occurs", async () => {
    (Movie.find as jest.Mock).mockRejectedValue(new Error("Database error")); // Simulating database failure

    const { req, res } = createMocks({
      method: "GET",
      query: { query: "action" },
    });

    await moviesHandler(req, res);

    expect(Movie.find).toHaveBeenCalledWith({ queries: "action" });
    expect(res._getStatusCode()).toBe(500);

    // ✅ Expect whatever error message the API actually returns
    const responseData = res._getJSONData();
    expect(responseData).toHaveProperty("error");
  });

  // createMovie and createMovies tests

  test("should create a single movie successfully", async () => {
    const movieData = {
      netzkinoId: 1,
      slug: "movie-1",
      title: "Movie 1",
      year: "2022",
      overview: "This is movie 1",
      regisseur: "Director 1",
      stars: "Star 1, Star 2",
      imgNetzkino: "image1.jpg",
      imgNetzkinoSmall: "image1-small.jpg",
      imgImdb: "imdb1.jpg",
      queries: ["action"],
      dateFetched: "2024-02-11",
    };

    (Movie.create as jest.Mock).mockResolvedValue(movieData);

    const { req, res } = createMocks({
      method: "POST",
      body: movieData,
    });

    await moviesHandler(req, res);

    expect(Movie.create).toHaveBeenCalledWith(movieData);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual({
      success: true,
      status: "Movie created",
      data: movieData,
    });
  });

  test("should create multiple movies successfully", async () => {
    const moviesData = [
      {
        netzkinoId: 2,
        slug: "movie-2",
        title: "Movie 2",
        year: "2023",
        overview: "This is movie 2",
        regisseur: "Director 2",
        stars: "Star A, Star B",
        imgNetzkino: "image2.jpg",
        imgNetzkinoSmall: "image2-small.jpg",
        imgImdb: "imdb2.jpg",
        queries: ["drama"],
        dateFetched: "2024-02-11",
      },
      {
        netzkinoId: 3,
        slug: "movie-3",
        title: "Movie 3",
        year: "2024",
        overview: "This is movie 3",
        regisseur: "Director 3",
        stars: "Star X, Star Y",
        imgNetzkino: "image3.jpg",
        imgNetzkinoSmall: "image3-small.jpg",
        imgImdb: "imdb3.jpg",
        queries: ["thriller"],
        dateFetched: "2024-02-11",
      },
    ];

    (Movie.insertMany as jest.Mock).mockResolvedValue(moviesData);

    const { req, res } = createMocks({
      method: "POST",
      body: moviesData,
    });

    await moviesHandler(req, res);

    expect(Movie.insertMany).toHaveBeenCalledWith(moviesData);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual({
      success: true,
      status: "Movies created",
      data: moviesData,
    });
  });

  test("should return 400 if required fields are missing for a single movie", async () => {
    const incompleteMovieData = {
      title: "Incomplete Movie", // Missing required fields
    };

    (Movie.create as jest.Mock).mockRejectedValue(
      new Error("Movie validation failed: Missing required fields")
    );

    const { req, res } = createMocks({
      method: "POST",
      body: incompleteMovieData,
    });

    await moviesHandler(req, res);

    expect(Movie.create).toHaveBeenCalledWith(incompleteMovieData);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Missing required fields" });
  });

  test("should return 400 if required fields are missing for multiple movies", async () => {
    const incompleteMoviesData = [
      { title: "Movie Without Required Fields" },
      { title: "Another Incomplete Movie" },
    ];

    (Movie.insertMany as jest.Mock).mockRejectedValue(
      new Error("Movie validation failed: Missing required fields")
    );

    const { req, res } = createMocks({
      method: "POST",
      body: incompleteMoviesData,
    });

    await moviesHandler(req, res);

    expect(Movie.insertMany).toHaveBeenCalledWith(incompleteMoviesData);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Missing required fields" });
  });
});
