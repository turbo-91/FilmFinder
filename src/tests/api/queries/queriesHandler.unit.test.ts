import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/db/mongodb";
import Query from "@/db/models/Query";
import handleApiError from "@/lib/handleApiError";
import queriesHandler from "@/pages/api/queries";

// 1️Stub out the Mongo connector so it never actually connects
jest.mock("@/db/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

// Stub the Query model methods
jest.mock("@/db/models/Query", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    create: jest.fn(),
  },
}));

// Stub the error handler to respect optional status codes
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res: NextApiResponse, message: string, error: unknown, code = 500) =>
    res.status(code).json({ error: message })
  )
);

describe("queriesHandler – Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET → 200 when queries exist", async () => {
    // GIVEN Query.find resolves with some items
    const fakeQueries = [{ q: "a" }, { q: "b" }];
    (Query.find as jest.Mock).mockResolvedValue(fakeQueries);

    // WHEN we call the handler with GET
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });
    await queriesHandler(req, res);

    // THEN it should return 200 and the array
    expect(dbConnect).toHaveBeenCalled();
    expect(Query.find).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(fakeQueries);
  });

  it("GET → 404 when no queries found", async () => {
    // GIVEN Query.find resolves with empty array
    (Query.find as jest.Mock).mockResolvedValue([]);

    // WHEN we call GET
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });
    await queriesHandler(req, res);

    // THEN it should return 404 and a Not Found message
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  it("GET → 500 when Query.find throws", async () => {
    // GIVEN Query.find rejects
    const err = new Error("fail");
    (Query.find as jest.Mock).mockRejectedValue(err);

    // WHEN we call GET
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });
    await queriesHandler(req, res);

    // THEN it should delegate to handleApiError
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error fetching queries",
      err
    );
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Error fetching queries" });
  });

  it("POST → 201 when body is valid", async () => {
    // GIVEN Query.create resolves with the new object
    const newQ = { q: "new" };
    (Query.create as jest.Mock).mockResolvedValue(newQ);

    // WHEN we call POST
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: newQ,
    });
    await queriesHandler(req, res);

    // THEN should return 201 with success flag and data
    expect(Query.create).toHaveBeenCalledWith(newQ);
    expect(res._getStatusCode()).toBe(201);
    expect(res._getJSONData()).toEqual({
      success: true,
      status: "Query created",
      data: newQ,
    });
  });

  it("POST → 400 when Query.create throws validation error", async () => {
    // GIVEN Query.create rejects
    const err = new Error("invalid");
    (Query.create as jest.Mock).mockRejectedValue(err);

    // WHEN we call POST
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { q: "" },
    });
    await queriesHandler(req, res);

    // THEN it should delegate to handleApiError with 400
    expect(handleApiError).toHaveBeenCalledWith(
      res,
      "Error creating movie",
      err,
      400
    );
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Error creating movie" });
  });

  it("OTHER methods → 405 Method Not Allowed", async () => {
    // WHEN using an unsupported method
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
    });
    await queriesHandler(req, res);

    // THEN should return 405
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ status: "Method Not Allowed" });
  });
});
