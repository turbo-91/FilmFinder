// watchlistService.unit.test.ts
import dbConnect from "@/db/mongodb";
import Movie from "@/db/models/Movie";
import {
  getMoviesByUser,
  addUserIdToMovie,
  removeUserIdFromMovie,
} from "@/services/watchlistService";

type MockedMovieModel = typeof Movie & {
  find: jest.Mock;
  findOneAndUpdate: jest.Mock;
};

// Mock dbConnect to no-op
jest.mock("@/db/mongodb", () => jest.fn());

// Mock Movie model methods
jest.mock("@/db/models/Movie", () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const mockedDbConnect = dbConnect as jest.Mock;
const mockedMovieModel = Movie as MockedMovieModel;

describe("watchlistService", () => {
  beforeEach(() => {
    mockedDbConnect.mockClear();
    mockedMovieModel.find.mockClear();
    mockedMovieModel.findOneAndUpdate.mockClear();
  });

  describe("getMoviesByUser", () => {
    it("throws for invalid userId (empty)", async () => {
      await expect(getMoviesByUser("")).rejects.toThrow(
        "Invalid input: userId must be a non-empty string"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });

    it("throws for invalid userId (non-string)", async () => {
      // @ts-expect-error: passing wrong type
      await expect(getMoviesByUser(null)).rejects.toThrow(
        "Invalid input: userId must be a non-empty string"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });

    it("returns movies array on success", async () => {
      const fakeMovies = [
        { _id: 1, savedBy: ["u1"] },
        { _id: 2, savedBy: ["u1"] },
      ];
      mockedMovieModel.find.mockResolvedValue(fakeMovies);

      const result = await getMoviesByUser("u1");
      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedMovieModel.find).toHaveBeenCalledWith({ savedBy: "u1" });
      expect(result).toBe(fakeMovies);
    });

    it("throws on database error", async () => {
      mockedMovieModel.find.mockRejectedValue(new Error("db error"));
      await expect(getMoviesByUser("u2")).rejects.toThrow(
        "Unable to fetch movies"
      );
    });
  });

  describe("addUserIdToMovie", () => {
    it("throws for invalid inputs", async () => {
      await expect(addUserIdToMovie(0, "")).rejects.toThrow(
        "Invalid input: userId and movieId must be non-empty strings"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });

    it("returns updated movie on success", async () => {
      const updated = { _id: 5, savedBy: ["u3"] };
      mockedMovieModel.findOneAndUpdate.mockResolvedValue(updated);

      const result = await addUserIdToMovie(5, "u3");
      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedMovieModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 5 },
        { $addToSet: { savedBy: "u3" } },
        { new: true }
      );
      expect(result).toBe(updated);
    });

    it("throws on database error", async () => {
      mockedMovieModel.findOneAndUpdate.mockRejectedValue(new Error("fail"));
      await expect(addUserIdToMovie(10, "u4")).rejects.toThrow(
        "Unable to fetch movies"
      );
    });
  });

  describe("removeUserIdFromMovie", () => {
    it("throws for invalid inputs", async () => {
      await expect(removeUserIdFromMovie(0, "   ")).rejects.toThrow(
        "Invalid input: userId and movieId must be non-empty strings"
      );
      expect(mockedDbConnect).toHaveBeenCalled();
    });

    it("returns updated movie on success", async () => {
      const updated = { _id: 7, savedBy: [] };
      mockedMovieModel.findOneAndUpdate.mockResolvedValue(updated);

      const result = await removeUserIdFromMovie(7, "u5");
      expect(mockedDbConnect).toHaveBeenCalled();
      expect(mockedMovieModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 7 },
        { $pull: { savedBy: "u5" } },
        { new: true }
      );
      expect(result).toBe(updated);
    });

    it("throws on database error", async () => {
      mockedMovieModel.findOneAndUpdate.mockRejectedValue(new Error("fail"));
      await expect(removeUserIdFromMovie(15, "u6")).rejects.toThrow(
        "Unable to fetch movies"
      );
    });
  });
});
