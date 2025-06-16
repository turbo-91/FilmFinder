jest.mock("axios");
jest.mock("@/lib/constants/constants", () => ({
  imgImdbUrl: "https://img.url",
}));

import axios from "axios";
import type { IMovie } from "@/db/models/Movie";
import { addImgImdb, enrichMovies } from "@/services/imdbService";

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

describe("imdbService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("addImgImdb()", () => {
    it('returns undefined if posterImdb is "n/a"', async () => {
      const movie = { posterImdb: "n/a" } as unknown as IMovie;
      const result = await addImgImdb(movie);
      expect(result).toBeUndefined();
      expect(movie.posterImdb).toBe("n/a");
    });

    it("sets posterImdb and backdropImdb when both paths present", async () => {
      const movie = { posterImdb: "https://api.test/1" } as unknown as IMovie;
      mockedGet.mockResolvedValueOnce({
        data: {
          movie_results: [{ poster_path: "/p1.jpg", backdrop_path: "/b1.jpg" }],
        },
      } as any);

      const result = await addImgImdb(movie);
      expect(mockedGet).toHaveBeenCalledWith("https://api.test/1");
      expect(result).toBe(movie);
      expect(result!.posterImdb).toBe("https://img.url/p1.jpg");
      expect(result!.backdropImdb).toBe("https://img.url/b1.jpg");
    });

    it("falls back to thumbnail when poster_path and backdrop_path are missing", async () => {
      const movie = { posterImdb: "https://api.test/2" } as unknown as IMovie;
      mockedGet.mockResolvedValueOnce({
        data: { movie_results: [{}] },
      } as any);

      const result = await addImgImdb(movie);
      expect(result!.posterImdb).toBe("/movieThumbnail.png");
      expect(result!.backdropImdb).toBe("/movieThumbnail.png");
    });

    it("falls back backdrop only when backdrop_path is missing", async () => {
      const movie = { posterImdb: "https://api.test/3" } as unknown as IMovie;
      mockedGet.mockResolvedValueOnce({
        data: { movie_results: [{ poster_path: "/p3.jpg" }] },
      } as any);

      const result = await addImgImdb(movie);
      expect(result!.posterImdb).toBe("https://img.url/p3.jpg");
      expect(result!.backdropImdb).toBe("/movieThumbnail.png");
    });

    it("falls back poster only when poster_path is missing", async () => {
      const movie = { posterImdb: "https://api.test/4" } as unknown as IMovie;
      mockedGet.mockResolvedValueOnce({
        data: { movie_results: [{ backdrop_path: "/b4.jpg" }] },
      } as any);

      const result = await addImgImdb(movie);
      expect(result!.posterImdb).toBe("/movieThumbnail.png");
      expect(result!.backdropImdb).toBe("https://img.url/b4.jpg");
    });
  });

  describe("enrichMovies()", () => {
    it("returns original movie when addImgImdb returns undefined", async () => {
      const m1 = { posterImdb: "n/a", title: "A" } as unknown as IMovie;
      const m2 = {
        posterImdb: "https://api.test/5",
        title: "B",
      } as unknown as IMovie;
      mockedGet.mockResolvedValueOnce({ data: { movie_results: [{}] } } as any);

      const result = await enrichMovies([m1, m2]);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(m1);
      expect(result[1].posterImdb).toBe("/movieThumbnail.png");
      expect(result[1].backdropImdb).toBe("/movieThumbnail.png");
    });

    it("processes multiple movies correctly", async () => {
      const m1 = { posterImdb: "https://api.test/6" } as unknown as IMovie;
      const m2 = { posterImdb: "https://api.test/7" } as unknown as IMovie;

      // First call: both poster & backdrop
      mockedGet.mockResolvedValueOnce({
        data: {
          movie_results: [{ poster_path: "/p6.jpg", backdrop_path: "/b6.jpg" }],
        },
      } as any);
      // Second call: only poster
      mockedGet.mockResolvedValueOnce({
        data: { movie_results: [{ poster_path: "/p7.jpg" }] },
      } as any);

      const [r1, r2] = await enrichMovies([m1, m2]);

      expect(r1.posterImdb).toBe("https://img.url/p6.jpg");
      expect(r1.backdropImdb).toBe("https://img.url/b6.jpg");
      expect(r2.posterImdb).toBe("https://img.url/p7.jpg");
      expect(r2.backdropImdb).toBe("/movieThumbnail.png");
    });
  });
});
