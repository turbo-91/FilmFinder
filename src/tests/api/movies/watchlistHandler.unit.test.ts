import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

// mock out the Mongo connector so it never actually talks to Mongo
jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

// mock the service functions
jest.mock("@/services/watchlistService", () => ({
  getMoviesByUser: jest.fn(),
  addUserIdToMovie: jest.fn(),
  removeUserIdFromMovie: jest.fn(),
}));

// mock the error handler
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
    it("GIVEN no userid query param WHEN GET is called THEN responds 400 with error", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: {},
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toEqual({
        error: "UserId parameter is required",
      });
    });

    it("GIVEN valid userid WHEN GET is called THEN responds 200 with movies list", async () => {
      // GIVEN
      const movies = [{ id: 1 }, { id: 2 }];
      (getMoviesByUser as jest.Mock).mockResolvedValue(movies);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { userid: "alice" },
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(getMoviesByUser).toHaveBeenCalledWith("alice");
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual(movies);
    });

    it("GIVEN service throws WHEN GET is called THEN delegates to error handler", async () => {
      // GIVEN
      const err = new Error("oops");
      (getMoviesByUser as jest.Mock).mockRejectedValue(err);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { userid: "alice" },
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
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

    it("GIVEN malformed body WHEN PUT is called THEN responds 400 with error", async () => {
      // GIVEN
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: { userId: "", movieId: "not-a-number" },
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toEqual({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("GIVEN addUserIdToMovie returns empty WHEN PUT is called THEN responds 404", async () => {
      // GIVEN
      (addUserIdToMovie as jest.Mock).mockResolvedValue([]);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: validBody,
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(addUserIdToMovie).toHaveBeenCalledWith(42, "bob");
      expect(res._getStatusCode()).toBe(404);
      expect(res._getJSONData()).toEqual({ status: "Movie not Found" });
    });

    it("GIVEN addUserIdToMovie succeeds WHEN PUT is called THEN responds 200 with updated movie", async () => {
      // GIVEN
      const updated = [{ id: 42, users: ["bob"] }];
      (addUserIdToMovie as jest.Mock).mockResolvedValue(updated);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: validBody,
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual(updated);
    });

    it("GIVEN exception in service WHEN PUT is called THEN responds 500 with generic error", async () => {
      // GIVEN
      const err = new Error("fail");
      (addUserIdToMovie as jest.Mock).mockRejectedValue(err);
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
        body: validBody,
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(consoleSpy).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(500);
      expect(res._getJSONData()).toEqual({ error: "Something went wrong" });
      consoleSpy.mockRestore();
    });
  });

  describe("DELETE /watchlist", () => {
    const validBody = { userId: "carol", movieId: 99 };

    it("GIVEN malformed body WHEN DELETE is called THEN responds 400 with error", async () => {
      // GIVEN
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: { userId: 123, movieId: null },
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toEqual({
        error: "userId and movieId must be non-empty strings",
      });
    });

    it("GIVEN removeUserIdFromMovie returns empty WHEN DELETE is called THEN responds 404", async () => {
      // GIVEN
      (removeUserIdFromMovie as jest.Mock).mockResolvedValue([]);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: validBody,
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(removeUserIdFromMovie).toHaveBeenCalledWith(99, "carol");
      expect(res._getStatusCode()).toBe(404);
      expect(res._getJSONData()).toEqual({ status: "Movie not Found" });
    });

    it("GIVEN removeUserIdFromMovie succeeds WHEN DELETE is called THEN responds 200 with updated movie", async () => {
      // GIVEN
      const updated = [{ id: 99, users: [] }];
      (removeUserIdFromMovie as jest.Mock).mockResolvedValue(updated);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: validBody,
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual(updated);
    });

    it("GIVEN exception in service WHEN DELETE is called THEN delegates to error handler", async () => {
      // GIVEN
      const err = new Error("bad");
      (removeUserIdFromMovie as jest.Mock).mockRejectedValue(err);
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
        body: validBody,
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
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
    it("GIVEN unsupported HTTP verb WHEN called THEN responds 405 Method Not Allowed", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
      });

      // WHEN
      await watchlistHandler(req, res);

      // THEN
      expect(res._getStatusCode()).toBe(405);
      expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
    });
  });
});
