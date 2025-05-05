import { createMocks } from "node-mocks-http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

jest.setTimeout(30000);
// 1️⃣ Stub the error handler to avoid polluting logs
jest.mock("@/lib/handleApiError", () =>
  jest.fn((res, message, error, code = 500) =>
    res.status(code).json({ error: message })
  )
);

let queriesHandler: (req: any, res: any) => Promise<void>;
let QueryModel: mongoose.Model<any>;
let clientPromise: Promise<any>;
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // GIVEN an in‐memory MongoDB and MONGODB_URI is set
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();

  // WHEN we import and run our real db connector
  const dbMod = await import("@/db/mongodb");
  await dbMod.default();
  clientPromise = dbMod.clientPromise;

  // THEN import handler and model after DB is ready
  const handlerMod = await import("@/pages/api/queries");
  queriesHandler = handlerMod.default;
  const qm = await import("@/db/models/Query");
  QueryModel = qm.default;
});

afterAll(async () => {
  // cleanup
  await mongoose.disconnect();
  await mongoServer.stop();
  const client = await clientPromise;
  await client.close();
});

beforeEach(async () => {
  // ensure a clean slate
  await QueryModel.deleteMany({});
});

describe("queriesHandler — Integration Tests", () => {
  it("GET → 404 when no queries exist", async () => {
    // GIVEN no documents in the collection

    // WHEN we send a GET request
    const { req, res } = createMocks({ method: "GET" });
    await queriesHandler(req, res);

    // THEN we get a 404 with a Not Found status
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ status: "Not Found" });
  });

  it("GET → 200 and returns all queries when they exist", async () => {
    // GIVEN two seeded queries
    await QueryModel.create({ query: "first" });
    await QueryModel.create({ query: "second" });

    // WHEN we send a GET request
    const { req, res } = createMocks({ method: "GET" });
    await queriesHandler(req, res);

    // THEN we receive them with 200
    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(Array.isArray(data)).toBe(true);
    expect(data.map((d: any) => d.query).sort()).toEqual(["first", "second"]);
  });

  it("POST → 201 and creates a new query", async () => {
    // GIVEN a valid body
    const body = { query: "new-search" };

    // WHEN we POST it
    const { req, res } = createMocks({
      method: "POST",
      body,
    });
    await queriesHandler(req, res);

    // THEN we get back the created document
    expect(res._getStatusCode()).toBe(201);
    const json = res._getJSONData();
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("status", "Query created");
    expect(json.data).toMatchObject({ query: "new-search" });

    // ...and it really exists in the DB
    const fromDb = await QueryModel.findOne({ query: "new-search" }).lean();
    expect(fromDb).not.toBeNull();
  });

  it("POST → 400 when body is invalid", async () => {
    // GIVEN a missing 'query' field
    const { req, res } = createMocks({
      method: "POST",
      body: { foo: "bar" },
    });
    await queriesHandler(req, res);

    // THEN handler reports a creation error with 400
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: "Error creating movie" });
  });

  it("returns 405 for unsupported methods", async () => {
    // WHEN we use PUT
    const { req, res } = createMocks({ method: "PUT" });
    await queriesHandler(req, res);

    // THEN it’s not allowed
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({
      status: "Method Not Allowed",
    });
  });
});
