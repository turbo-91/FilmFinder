import axios from "axios";
import { netzkinoURL, netzkinoKey } from "@/lib/constants/constants";
import { IMovie } from "@/db/models/Movie";
import { postQuery } from "./queryService";
import { NetzkinoMovie } from "@/types/NetzkinoMovie";
import getApiLink from "@/lib/getApiLink";
import starSanitizer from "@/lib/starSanitizer";

// fetches and formats movies from Netzkino API

export async function fetchMoviesFromNetzkino(
  query: string
): Promise<IMovie[]> {
  try {
    const response = await axios.get(
      `${netzkinoURL}?q=${query}&d=${netzkinoKey}`
    );

    if (!response.data || !Array.isArray(response.data.posts)) {
      throw new Error("Invalid Netzkino API response");
    }

    if (response.data.count_total > 0) {
      await postQuery(query); // Store query in DB for caching purposes
    }

    const today = new Date().toLocaleDateString();
    const fallbackImg = "/movieThumbnail.png";

    return response.data.posts.map((movie: NetzkinoMovie) => {
      const imdbLink = movie.custom_fields?.["IMDb-Link"]?.[0];
      const imdbApiLink = imdbLink ? getApiLink(imdbLink) : null;
      const stars = movie.custom_fields?.["Stars"]?.[0];
      const sanitizedStars = starSanitizer(stars);

      return {
        _id: movie.id ?? null, // Ensure _id exists or set to null
        netzkinoId: movie.id ?? "n/a",
        slug: movie.slug ?? "n/a",
        title: movie.title ?? "Untitled",
        year: movie.custom_fields?.Jahr || ["n/a"],
        regisseur: movie.custom_fields?.Regisseur || ["n/a"],
        stars: sanitizedStars || ["n/a"],
        overview: movie.content || "n/a",
        imgNetzkino: movie.custom_fields?.featured_img_all?.[0] || fallbackImg,
        imgNetzkinoSmall:
          movie.custom_fields?.featured_img_all_small?.[0] || fallbackImg,
        posterImdb: imdbApiLink || "n/a",
        backdropImdb: imdbApiLink || "n/a",
        queries: query,
        dateFetched: today,
      };
    });
  } catch (error) {
    console.error(`Error fetching movies for query "${query}":`, error);
    return [];
  }
}
