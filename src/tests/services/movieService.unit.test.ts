// Stub Bottleneck so limiter.schedule(fn) just invokes fn()
const scheduleMock = jest.fn((fn: () => Promise<any>) => fn());
jest.mock("bottleneck", () =>
  jest.fn().mockImplementation(() => ({ schedule: scheduleMock }))
);

import dbConnect from "@/db/mongodb";
import Movie, { IMovie } from "@/db/models/Movie";
import { fetchMoviesFromNetzkino } from "@/services/netzkinoFetcher";
import { isQueryInDb, postQuery } from "@/services/queryService";
import { getMoviesByQuery, postMovies } from "@/services/movieDB";
import { enrichMovies } from "@/services/imdbService";
import { getMoviesOfTheDay, getSearchMovies } from "@/services/movieService";

jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@/db/models/Movie", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock("@/services/netzkinoFetcher", () => ({
  __esModule: true,
  fetchMoviesFromNetzkino: jest.fn(),
}));
jest.mock("@/services/queryService", () => ({
  __esModule: true,
  isQueryInDb: jest.fn(),
  postQuery: jest.fn(),
}));
jest.mock("@/services/movieDB", () => ({
  __esModule: true,
  getMoviesByQuery: jest.fn(),
  postMovies: jest.fn(),
}));
jest.mock("@/services/imdbService", () => ({
  __esModule: true,
  enrichMovies: jest.fn(),
}));

describe("movieService", () => {
  const mockedDbConnect = dbConnect as jest.MockedFunction<typeof dbConnect>;
  const mockedFind = Movie.find as jest.MockedFunction<typeof Movie.find>;
  const mockedFetch = fetchMoviesFromNetzkino as jest.MockedFunction<
    typeof fetchMoviesFromNetzkino
  >;
  const mockedIsQueryInDb = isQueryInDb as jest.MockedFunction<
    typeof isQueryInDb
  >;
  const mockedPostQuery = postQuery as jest.MockedFunction<typeof postQuery>;
  const mockedGetMoviesByQuery = getMoviesByQuery as jest.MockedFunction<
    typeof getMoviesByQuery
  >;
  const mockedPostMovies = postMovies as jest.MockedFunction<typeof postMovies>;
  const mockedEnrichMovies = enrichMovies as jest.MockedFunction<
    typeof enrichMovies
  >;

  let randomSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedDbConnect.mockResolvedValue({} as any);
    randomSpy = jest.spyOn(global.Math, "random").mockReturnValue(0);
  });

  afterAll(() => {
    randomSpy.mockRestore();
  });

  describe("getMoviesOfTheDay", () => {
    it("returns top 5 when DB has today’s movies", async () => {
      const today = new Date().toLocaleDateString();
      const dbMovies = Array.from(
        { length: 7 },
        (_, i) =>
          ({
            _id: i + 1,
            title: `M${i + 1}`,
            dateFetched: today,
          } as unknown as IMovie)
      );
      mockedFind.mockResolvedValue(dbMovies);

      const result = await getMoviesOfTheDay(["q1", "q2"]);

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedFind).toHaveBeenCalledWith({ dateFetched: today });
      expect(result).toHaveLength(5);
      expect(result).toEqual(dbMovies.slice(0, 5));
      expect(mockedFetch).not.toHaveBeenCalled();
      expect(mockedPostQuery).not.toHaveBeenCalled();
      expect(mockedEnrichMovies).not.toHaveBeenCalled();
      expect(mockedPostMovies).not.toHaveBeenCalled();
    });

    it("fetches, caches, enriches and returns 5 movies when DB empty", async () => {
      mockedFind.mockResolvedValue([]);
      const fetched = Array.from(
        { length: 5 },
        (_, i) => ({ _id: i + 10, title: `F${i + 10}` } as unknown as IMovie)
      );
      mockedFetch.mockResolvedValue(fetched);
      mockedEnrichMovies.mockResolvedValue(fetched);

      const result = await getMoviesOfTheDay(["alpha", "beta"]);

      expect(mockedDbConnect).toHaveBeenCalledTimes(1);
      expect(mockedFind).toHaveBeenCalledTimes(1);
      expect(mockedFetch).toHaveBeenCalledWith("alpha");
      expect(mockedPostQuery).toHaveBeenCalledWith("alpha");
      expect(mockedEnrichMovies).toHaveBeenCalledWith(fetched);
      expect(mockedPostMovies).toHaveBeenCalledWith(fetched);
      expect(result).toEqual(fetched);
    });

    describe("getMoviesOfTheDay – error cases", () => {
      it("throws if dbConnect rejects", async () => {
        mockedDbConnect.mockRejectedValueOnce(new Error("DB failure"));
        await expect(getMoviesOfTheDay(["any"])).rejects.toThrow("DB failure");
      });

      it("throws if Movie.find rejects", async () => {
        mockedDbConnect.mockResolvedValueOnce({} as any);
        mockedFind.mockRejectedValueOnce(new Error("Find error"));
        await expect(getMoviesOfTheDay(["any"])).rejects.toThrow("Find error");
      });

      it("throws if fetchMoviesFromNetzkino rejects when DB is empty", async () => {
        mockedDbConnect.mockResolvedValueOnce({} as any);
        mockedFind.mockResolvedValueOnce([]); // DB empty
        mockedFetch.mockRejectedValueOnce(new Error("Fetch error"));
        await expect(getMoviesOfTheDay(["any"])).rejects.toThrow("Fetch error");
      });

      it("throws if enrichMovies rejects after fetch succeeds", async () => {
        mockedDbConnect.mockResolvedValueOnce({} as any);
        mockedFind.mockResolvedValueOnce([]); // DB empty
        const fetched = [{ _id: 1, title: "X" }] as unknown as IMovie[];
        mockedFetch.mockResolvedValueOnce(fetched);
        mockedEnrichMovies.mockRejectedValueOnce(new Error("Enrich error"));
        await expect(getMoviesOfTheDay(["any"])).rejects.toThrow(
          "Enrich error"
        );
      });
    });
  });

  describe("getSearchMovies", () => {
    const testQuery = "test";

    it("returns cached movies when query exists in DB", async () => {
      mockedIsQueryInDb.mockResolvedValue(true);
      const cached = [
        { _id: 101, title: "C1" },
        { _id: 102, title: "C2" },
      ] as unknown as IMovie[];
      mockedGetMoviesByQuery.mockResolvedValue(cached);

      const result = await getSearchMovies(testQuery);

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedIsQueryInDb).toHaveBeenCalledWith(testQuery);
      expect(mockedGetMoviesByQuery).toHaveBeenCalledWith(testQuery);
      expect(result).toBe(cached);
      expect(scheduleMock).not.toHaveBeenCalled();
      expect(mockedFetch).not.toHaveBeenCalled();
      expect(mockedPostQuery).not.toHaveBeenCalled();
      expect(mockedEnrichMovies).not.toHaveBeenCalled();
      expect(mockedPostMovies).not.toHaveBeenCalled();
    });

    it("returns empty array when fetch yields no movies", async () => {
      mockedIsQueryInDb.mockResolvedValue(false);
      mockedFetch.mockResolvedValue([]);

      const result = await getSearchMovies(testQuery);

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedIsQueryInDb).toHaveBeenCalledWith(testQuery);
      expect(scheduleMock).toHaveBeenCalled();
      expect(mockedFetch).toHaveBeenCalledWith(testQuery);
      expect(result).toEqual([]);
      expect(mockedPostQuery).not.toHaveBeenCalled();
      expect(mockedEnrichMovies).not.toHaveBeenCalled();
      expect(mockedPostMovies).not.toHaveBeenCalled();
    });

    it("fetches, caches, enriches and returns movies when not in DB", async () => {
      mockedIsQueryInDb.mockResolvedValue(false);
      const raw = [
        { _id: 201, title: "R1" },
        { _id: 202, title: "R2" },
      ] as unknown as IMovie[];
      mockedFetch.mockResolvedValue(raw);
      const enriched = [
        { _id: 201, title: "R1-enriched" },
        { _id: 202, title: "R2-enriched" },
      ] as unknown as IMovie[];
      mockedEnrichMovies.mockResolvedValue(enriched);

      const result = await getSearchMovies(testQuery);

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedIsQueryInDb).toHaveBeenCalledWith(testQuery);
      expect(scheduleMock).toHaveBeenCalled();
      expect(mockedFetch).toHaveBeenCalledWith(testQuery);
      expect(mockedPostQuery).toHaveBeenCalledWith(testQuery);
      expect(mockedEnrichMovies).toHaveBeenCalledWith(raw);
      expect(mockedPostMovies).toHaveBeenCalledWith(raw);
      expect(result).toEqual(enriched);
    });
  });
  describe("getSearchMovies – error cases", () => {
    const Q = "foo";

    it("throws if dbConnect rejects", async () => {
      mockedDbConnect.mockRejectedValueOnce(new Error("DB fail"));
      await expect(getSearchMovies(Q)).rejects.toThrow("DB fail");
    });

    it("throws if isQueryInDb rejects", async () => {
      mockedDbConnect.mockResolvedValueOnce({} as any);
      mockedIsQueryInDb.mockRejectedValueOnce(new Error("Check fail"));
      await expect(getSearchMovies(Q)).rejects.toThrow("Check fail");
    });

    it("throws if getMoviesByQuery throws on cache-hit", async () => {
      mockedDbConnect.mockResolvedValueOnce({} as any);
      mockedIsQueryInDb.mockResolvedValueOnce(true);
      mockedGetMoviesByQuery.mockImplementationOnce(() => {
        throw new Error("Cache fail");
      });
      await expect(getSearchMovies(Q)).rejects.toThrow("Cache fail");
    });

    it("throws if fetchMoviesFromNetzkino rejects on cache-miss", async () => {
      mockedDbConnect.mockResolvedValueOnce({} as any);
      mockedIsQueryInDb.mockResolvedValueOnce(false);
      mockedFetch.mockRejectedValueOnce(new Error("Fetch miss"));
      await expect(getSearchMovies(Q)).rejects.toThrow("Fetch miss");
    });

    it("throws if postQuery rejects after fetch succeeds", async () => {
      mockedDbConnect.mockResolvedValueOnce({} as any);
      mockedIsQueryInDb.mockResolvedValueOnce(false);
      const raw = [{ _id: 2, title: "Y" }] as unknown as IMovie[];
      mockedFetch.mockResolvedValueOnce(raw);
      // ← Here we reject, to simulate an insert failure
      mockedPostQuery.mockRejectedValueOnce(new Error("Post fail"));
      await expect(getSearchMovies(Q)).rejects.toThrow("Post fail");
    });

    it("throws if enrichMovies rejects after postQuery succeeds", async () => {
      mockedDbConnect.mockResolvedValueOnce({} as any);
      mockedIsQueryInDb.mockResolvedValueOnce(false);
      const raw = [{ _id: 3, title: "Z" }] as unknown as IMovie[];
      mockedFetch.mockResolvedValueOnce(raw);
      // ← Now we resolve postQuery to a valid object instead of {}
      mockedPostQuery.mockResolvedValueOnce({
        success: true,
        status: "Query successfully added",
        data: {} as any,
      });
      mockedEnrichMovies.mockRejectedValueOnce(new Error("Enrich miss"));
      await expect(getSearchMovies(Q)).rejects.toThrow("Enrich miss");
    });
  });
});
