import { createMocks } from "node-mocks-http";
import movieByIdHandler from "@/pages/api/movies/[id]";
import { getMovieById } from "@/services/movieDB";
import handleApiError from "@/lib/handleApiError";
import { movieSeed1 } from "@/tests/movieSeeds";

jest.mock("@/services/movieDB", () => ({
  getMovieById: jest.fn(),
}));
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, message, error) => res.status(500).json({ error: message }))
);

describe("movieByIdHandler – Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 405 on non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST", query: { id: "1" } });
    await movieByIdHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });

  it("returns 400 if id is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await movieByIdHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Movie ID is required" });
  });

  it("returns 400 if id is not a string", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { id: ["not-a-string"] },
    });
    await movieByIdHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Movie ID is required" });
  });

  it("returns 200 and movie when found", async () => {
    (getMovieById as jest.Mock).mockResolvedValue(movieSeed1);

    const { req, res } = createMocks({
      method: "GET",
      query: { id: movieSeed1._id.toString() },
    });
    await movieByIdHandler(req as any, res as any);

    expect(getMovieById).toHaveBeenCalledWith(movieSeed1._id.toString());
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(movieSeed1);
  });

  it("returns 404 if movie not found", async () => {
    (getMovieById as jest.Mock).mockResolvedValue(null);

    const { req, res } = createMocks({
      method: "GET",
      query: { id: "42" },
    });
    await movieByIdHandler(req as any, res as any);

    expect(getMovieById).toHaveBeenCalledWith("42");
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Movie Not Found" });
  });

  it("delegates to handleApiError on service throw", async () => {
    const error = new Error("DB fail");
    (getMovieById as jest.Mock).mockRejectedValue(error);

    const { req, res } = createMocks({
      method: "GET",
      query: { id: movieSeed1._id.toString() },
    });
    await movieByIdHandler(req as any, res as any);

    expect(getMovieById).toHaveBeenCalledWith(movieSeed1._id.toString());
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching movie by ID",
      error
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching movie by ID" });
  });
});
