import {
  getAllQueriesFromDB,
  postQuery,
  isQueryInDb,
} from "@/services/queryService";
import dbConnect from "@/db/mongodb";
import Query from "@/db/models/Query";

type MockedQueryModel = typeof Query & {
  find: jest.Mock;
  create: jest.Mock;
  findOne: jest.Mock;
};

// Mock dbConnect to no-op
jest.mock("@/db/mongodb", () => jest.fn());
// Mock Query model methods
jest.mock("@/db/models/Query", () => ({
  find: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
}));

const mockedDbConnect = dbConnect as jest.Mock;
const mockedQueryModel = Query as MockedQueryModel;

describe("queryService", () => {
  beforeEach(() => {
    mockedDbConnect.mockClear();
    mockedQueryModel.find.mockClear();
    mockedQueryModel.create.mockClear();
    mockedQueryModel.findOne.mockClear();
  });

  describe("getAllQueriesFromDB", () => {
    it("should call dbConnect and return queries on success", async () => {
      const fakeQueries = [{ query: "a" }, { query: "b" }];
      mockedQueryModel.find.mockResolvedValue(fakeQueries);

      const result = await getAllQueriesFromDB();

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedQueryModel.find).toHaveBeenCalled();
      expect(result).toBe(fakeQueries);
    });

    it("should throw an error when Query.find rejects", async () => {
      const err = new Error("db failure");
      mockedQueryModel.find.mockRejectedValue(err);
      await expect(getAllQueriesFromDB()).rejects.toThrow(
        "Unable to fetch queries"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });
  });

  describe("postQuery", () => {
    it("should throw for invalid input (empty string)", async () => {
      await expect(postQuery("")).rejects.toThrow(
        "Invalid input: query must be a non-empty string"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });

    it("should throw for invalid input (non-string)", async () => {
      // @ts-expect-error: testing invalid type
      await expect(postQuery(null)).rejects.toThrow(
        "Invalid input: query must be a non-empty string"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });

    it("should call Query.create and return success object", async () => {
      const fakeDoc = { query: "search term", _id: "1" };
      mockedQueryModel.create.mockResolvedValue(fakeDoc);

      const result = await postQuery("search term");

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedQueryModel.create).toHaveBeenCalledWith({
        query: "search term",
      });
      expect(result).toEqual({
        success: true,
        status: "Query successfully added",
        data: fakeDoc,
      });
    });

    it("should throw when Query.create rejects", async () => {
      const err = new Error("insert fail");
      mockedQueryModel.create.mockRejectedValue(err);
      await expect(postQuery("term")).rejects.toThrow(
        "Error inserting query into the database"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });
  });

  describe("isQueryInDb", () => {
    it("should throw for invalid input (empty string)", async () => {
      await expect(isQueryInDb("")).rejects.toThrow(
        "Invalid input: query must be a non-empty string"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });

    it("should return true when Query.findOne finds a document", async () => {
      const doc = { query: "x" };
      mockedQueryModel.findOne.mockResolvedValue(doc);

      const exists = await isQueryInDb("x");

      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedQueryModel.findOne).toHaveBeenCalledWith({ query: "x" });
      expect(exists).toBe(true);
    });

    it("should return false when Query.findOne returns null", async () => {
      mockedQueryModel.findOne.mockResolvedValue(null);

      const exists = await isQueryInDb("y");

      expect(exists).toBe(false);
    });

    it("should throw when Query.findOne rejects", async () => {
      const err = new Error("findOne fail");
      mockedQueryModel.findOne.mockRejectedValue(err);
      await expect(isQueryInDb("z")).rejects.toThrow(
        "Unable to check query existence"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });
  });
});
