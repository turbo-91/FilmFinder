import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

// 1️⃣ Mock out the Mongo connector so it never actually talks to Mongo
jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

// 2️⃣ Mock the three service functions
jest.mock("@/services/watchlistService", () => ({
  getMoviesByUser: jest.fn(),
  addUserIdToMovie: jest.fn(),
  removeUserIdFromMovie: jest.fn(),
}));

// 3️⃣ Mock the error handler
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, msg, err) => res.status(500).json({ error: msg }))
);

import watchlistHandler from "@/pages/api/movies/watchlist";
import {
  getMoviesByUser,
  addUserIdToMovie,
  removeUserIdFromMovie,
} from "@/services/watchlistService";
import handleApiError from "@/lib/handleApiError";

describe("watchlistHandler – Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /watchlist?userid=", () => {
    it("returns 400 if userid is missing", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: {},
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toEqual({
        error: "UserId parameter is required",
      });
    });

    it("returns 200 and movies array", async () => {
      const movies = [{ id: 1 }, { id: 2 }];
      (getMoviesByUser as jest.Mock).mockResolvedValue(movies);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { userid: "alice" },
      });
      await watchlistHandler(req, res);

      expect(getMoviesByUser).toHaveBeenCalledWith("alice");
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual(movies);
    });

    it("returns 500 via handleApiError on service throw", async () => {
      const err = new Error("oops");
      (getMoviesByUser as jest.Mock).mockRejectedValue(err);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { userid: "alice" },
      });
      await watchlistHandler(req, res);

      expect(handleApiError).toHaveBeenCalledWith(
        res,
        "Error fetching movies",
        err
      );
      expect(res._getStatusCode()).toBe(500);
      expect(res._getJSONData()).toEqual({ error: "Error fetching movies" });
    });
  });

  describe("PUT /watchlist", () => {
    const validBody = { userId: "bob", movieId: 42 };

    it("returns 400 if body is malformed", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: { userId: "", movieId: "not-a-number" },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toEqual({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("returns 404 if addUserIdToMovie returns empty", async () => {
      (addUserIdToMovie as jest.Mock).mockResolvedValue([]);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: validBody,
      });
      await watchlistHandler(req, res);
      expect(addUserIdToMovie).toHaveBeenCalledWith(42, "bob");
      expect(res._getStatusCode()).toBe(404);
      expect(res._getJSONData()).toEqual({ status: "Movie not Found" });
    });

    it("returns 200 and updated movie on success", async () => {
      const updated = [{ id: 42, users: ["bob"] }];
      (addUserIdToMovie as jest.Mock).mockResolvedValue(updated);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: validBody,
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual(updated);
    });

    it("returns 500 on unexpected exception", async () => {
      const err = new Error("fail");
      (addUserIdToMovie as jest.Mock).mockRejectedValue(err);

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: validBody,
      });
      await watchlistHandler(req, res);
      expect(consoleSpy).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(500);
      expect(res._getJSONData()).toEqual({ error: "Something went wrong" });
      consoleSpy.mockRestore();
    });
  });

  describe("DELETE /watchlist", () => {
    const validBody = { userId: "carol", movieId: 99 };

    it("returns 400 if body is malformed", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: { userId: 123, movieId: null },
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toEqual({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("returns 404 if removeUserIdFromMovie returns empty", async () => {
      (removeUserIdFromMovie as jest.Mock).mockResolvedValue([]);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: validBody,
      });
      await watchlistHandler(req, res);
      expect(removeUserIdFromMovie).toHaveBeenCalledWith(99, "carol");
      expect(res._getStatusCode()).toBe(404);
      expect(res._getJSONData()).toEqual({ status: "Movie not Found" });
    });

    it("returns 200 and updated movie on success", async () => {
      const updated = [{ id: 99, users: [] }];
      (removeUserIdFromMovie as jest.Mock).mockResolvedValue(updated);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: validBody,
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual(updated);
    });

    it("returns 500 via handleApiError on exception", async () => {
      const err = new Error("bad");
      (removeUserIdFromMovie as jest.Mock).mockRejectedValue(err);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: validBody,
      });
      await watchlistHandler(req, res);
      expect(handleApiError).toHaveBeenCalledWith(
        res,
        "Error deleting userId from movie",
        err
      );
      expect(res._getStatusCode()).toBe(500);
      expect(res._getJSONData()).toEqual({
        error: "Error deleting userId from movie",
      });
    });
  });

  describe("other methods", () => {
    it("returns 405 for anything else", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
      });
      await watchlistHandler(req, res);
      expect(res._getStatusCode()).toBe(405);
      expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
    });
  });
});
