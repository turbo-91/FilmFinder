// src/tests/services/netzkinoService.unit.test.ts

import axios from "axios";
import { fetchMoviesFromNetzkino } from "@/services/netzkinoService";
import { postQuery } from "../../services/queryService";
import getApiLink from "../../lib/getApiLink";
import starSanitizerDefault from "../../lib/starSanitizer";
import { netzkinoURL, netzkinoKey } from "../../lib/constants/constants";

// 1) Mocks before anything else
jest.mock("axios");
jest.mock("../../services/queryService", () => ({
  __esModule: true,
  postQuery: jest.fn(),
}));
jest.mock("../../lib/constants/constants", () => ({
  netzkinoURL: "https://netzkino.test/api",
  netzkinoKey: "APIKEY",
}));
jest.mock("../../lib/getApiLink", () =>
  jest.fn((link: string) => `imdb-api://${link}`)
);
// starSanitizer is a default export; mock it as a jest.fn that returns string[]
jest.mock("../../lib/starSanitizer", () => ({
  __esModule: true,
  default: jest.fn((stars?: string) => (stars ? stars.split(",") : [])),
}));

// 2) Grab typed references to the mocks
const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;
const mockedPostQuery = postQuery as jest.MockedFunction<typeof postQuery>;
const mockedGetApiLink = getApiLink as jest.MockedFunction<typeof getApiLink>;
// Cast via unknown so TS knows it returns string[]
const mockedStarSanitizer =
  starSanitizerDefault as unknown as jest.MockedFunction<
    (stars?: string) => string[]
  >;

describe("fetchMoviesFromNetzkino", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Freeze the date so dateFetched is predictable
    jest
      .spyOn(Date.prototype, "toLocaleDateString")
      .mockReturnValue("2025-06-16");
  });

  it("fetches & maps movies; calls postQuery when count_total > 0", async () => {
    const posts = [
      {
        id: 1,
        slug: "slug1",
        title: "Title 1",
        custom_fields: {
          Jahr: ["2020"],
          Regisseur: ["Director 1"],
          Stars: ["Star A,Star B"],
          featured_img_all: ["large.jpg"],
          featured_img_all_small: ["small.jpg"],
          "IMDb-Link": ["tt123"],
        },
        content: "Overview 1",
      },
      {
        id: 2,
        slug: null,
        title: null,
        custom_fields: {},
        content: null,
      },
    ] as any;

    mockedGet.mockResolvedValueOnce({ data: { posts, count_total: 2 } } as any);
    mockedStarSanitizer.mockReturnValueOnce(["Star A", "Star B"]);
    mockedGetApiLink.mockReturnValueOnce("imdb-api://tt123");

    const result = await fetchMoviesFromNetzkino("myquery");

    expect(mockedGet).toHaveBeenCalledWith(
      `${netzkinoURL}?q=myquery&d=${netzkinoKey}`
    );
    expect(mockedPostQuery).toHaveBeenCalledWith("myquery");

    // First movie is fully populated
    const m1 = result[0]!;
    expect(m1._id).toBe(1);
    expect(m1.netzkinoId).toBe(1);
    expect(m1.slug).toBe("slug1");
    expect(m1.title).toBe("Title 1");
    expect(m1.year).toEqual(["2020"]);
    expect(m1.regisseur).toEqual(["Director 1"]);
    expect(m1.stars).toEqual(["Star A", "Star B"]);
    expect(m1.overview).toBe("Overview 1");
    expect(m1.imgNetzkino).toBe("large.jpg");
    expect(m1.imgNetzkinoSmall).toBe("small.jpg");
    expect(m1.posterImdb).toBe("imdb-api://tt123");
    expect(m1.backdropImdb).toBe("imdb-api://tt123");
    expect(m1.queries).toBe("myquery");
    expect(m1.dateFetched).toBe("2025-06-16");

    // Second movie exercises all the fallbacks
    const m2 = result[1]!;
    expect(m2.slug).toBe("n/a");
    expect(m2.title).toBe("Untitled");
    expect(m2.year).toEqual(["n/a"]);
    expect(m2.regisseur).toEqual(["n/a"]);
    expect(m2.stars).toEqual([]); // from our sanitizer mock
    expect(m2.overview).toBe("n/a");
    expect(m2.imgNetzkino).toBe("/movieThumbnail.png");
    expect(m2.imgNetzkinoSmall).toBe("/movieThumbnail.png");
    expect(m2.posterImdb).toBe("n/a");
    expect(m2.backdropImdb).toBe("n/a");
    expect(m2.queries).toBe("myquery");
    expect(m2.dateFetched).toBe("2025-06-16");
  });

  it("does NOT call postQuery when count_total is 0", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { posts: [], count_total: 0 },
    } as any);
    const result = await fetchMoviesFromNetzkino("empty");
    expect(mockedPostQuery).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns [] on invalid response shape", async () => {
    mockedGet.mockResolvedValueOnce({ data: { foo: "bar" } } as any);
    const result = await fetchMoviesFromNetzkino("bad");
    expect(result).toEqual([]);
  });

  it("returns [] if axios.get throws", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    const result = await fetchMoviesFromNetzkino("error");
    expect(result).toEqual([]);
  });
});
