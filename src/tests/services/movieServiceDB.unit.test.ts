// src/tests/services/movieDBService.unit.test.ts
import dbConnect from "@/db/mongodb";
import Movie from "@/db/models/Movie";
import type { IMovie } from "@/db/models/Movie";
import {
  postMovies,
  getAllMoviesFromDB,
  getMoviesByQuery,
  getMovieById,
} from "@/services/movieDB";

jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/db/models/Movie", () => ({
  __esModule: true,
  default: {
    bulkWrite: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

describe("movieDB service – unit tests", () => {
  const mockedDbConnect = dbConnect as jest.MockedFunction<typeof dbConnect>;
  const mockedBulkWrite = (Movie as any).bulkWrite as jest.MockedFunction<
    typeof Movie.bulkWrite
  >;
  const mockedFind = (Movie as any).find as jest.MockedFunction<
    typeof Movie.find
  >;
  const mockedFindOne = (Movie as any).findOne as jest.MockedFunction<
    typeof Movie.findOne
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedDbConnect.mockResolvedValue({} as any);
  });

  describe("postMovies()", () => {
    it("throws on empty array", async () => {
      await expect(postMovies([])).rejects.toThrow(
        "Invalid input: movies must be a non-empty array"
      );
    });

    it("calls bulkWrite with the correct operations on valid input", async () => {
      const movies = [
        { _id: 1, title: "A" },
        { _id: 2, title: "B" },
      ] as unknown as IMovie[];

      await postMovies(movies);

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedBulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: 1 },
            update: { $setOnInsert: movies[0] },
            upsert: true,
          },
        },
        {
          updateOne: {
            filter: { _id: 2 },
            update: { $setOnInsert: movies[1] },
            upsert: true,
          },
        },
      ]);
    });

    it("throws if bulkWrite fails", async () => {
      const movies = [{ _id: 3 }] as unknown as IMovie[];
      mockedBulkWrite.mockRejectedValueOnce(new Error("bulk error"));

      await expect(postMovies(movies)).rejects.toThrow(
        "Database insertion failed"
      );
    });
  });

  describe("getAllMoviesFromDB()", () => {
    it("returns array of movies on success", async () => {
      const dbMovies = [
        { _id: 10, title: "X" },
        { _id: 11, title: "Y" },
      ] as unknown as IMovie[];
      mockedFind.mockResolvedValueOnce(dbMovies);

      const result = await getAllMoviesFromDB();

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedFind).toHaveBeenCalledWith();
      expect(result).toBe(dbMovies);
    });

    it("throws if find fails", async () => {
      mockedFind.mockRejectedValueOnce(new Error("find error"));

      await expect(getAllMoviesFromDB()).rejects.toThrow(
        "Unable to fetch movies from the database"
      );
    });
  });

  describe("getMoviesByQuery()", () => {
    it("throws on empty query", async () => {
      await expect(getMoviesByQuery("")).rejects.toThrow(
        "Invalid input: query must be a non-empty string"
      );
    });

    it("returns array of movies matching the query", async () => {
      const matched = [{ _id: 20 }, { _id: 21 }] as unknown as IMovie[];
      mockedFind.mockResolvedValueOnce(matched);

      const result = await getMoviesByQuery("test");

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedFind).toHaveBeenCalledWith({ queries: "test" });
      expect(result).toBe(matched);
    });

    it("throws if find fails", async () => {
      mockedFind.mockRejectedValueOnce(new Error("find by query error"));

      await expect(getMoviesByQuery("foo")).rejects.toThrow(
        "Unable to fetch movies"
      );
    });
  });

  describe("getMovieById()", () => {
    it("throws on non-numeric movieId", async () => {
      await expect(getMovieById("abc")).rejects.toThrow(
        "Invalid input: movieId must be a valid number"
      );
    });

    it("returns the movie when found", async () => {
      const movie = { _id: 42, title: "Answer" } as unknown as IMovie;
      mockedFindOne.mockResolvedValueOnce(movie);

      const result = await getMovieById("42");

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedFindOne).toHaveBeenCalledWith({ _id: 42 });
      expect(result).toBe(movie);
    });

    it("returns null when no movie is found", async () => {
      mockedFindOne.mockResolvedValueOnce(null);

      const result = await getMovieById("99");

      expect(result).toBeNull();
    });

    it("throws if findOne fails", async () => {
      mockedFindOne.mockRejectedValueOnce(new Error("findOne error"));

      await expect(getMovieById("100")).rejects.toThrow(
        "Unable to fetch movie by ID"
      );
    });
  });
});
