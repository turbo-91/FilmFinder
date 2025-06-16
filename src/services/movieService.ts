import dbConnect from "../db/mongodb";
import Movie from "../db/models/Movie";
import { isQueryInDb, postQuery } from "./queryService";
import { getMoviesByQuery } from "./movieDB";
import { IMovie } from "@/db/models/Movie";
import { fetchMoviesFromNetzkino } from "./netzkinoService";
import { postMovies } from "./movieDB";
import { enrichMovies } from "./imdbService";
import Bottleneck from "bottleneck";

// I. Fetches movies of the day from Netzkino API, caches them in the database,
// and fetches additional image from ImdB.

export async function getMoviesOfTheDay(randomQueries: string[]) {
  await dbConnect();

  // Check if today's movies already exist in the database
  const today = new Date().toLocaleDateString();
  const todaysMovies = await Movie.find({ dateFetched: today });
  if (todaysMovies.length > 0) {
    return todaysMovies.slice(0, 5); // Return only the top 5
  }

  // movies have not been fetched today: fetch movies from APIs
  const moviesOfTheDay: IMovie[] = [];
  const usedQueries = [];
  const seenMovieIds = new Set<number>(); // Adjust type if necessary
  let attempts = 0;
  const maxAttempts = 10;

  while (moviesOfTheDay.length < 5 && attempts < maxAttempts) {
    attempts++;
    const query =
      randomQueries[Math.floor(Math.random() * randomQueries.length)];
    const movies = await fetchMoviesFromNetzkino(query);
    postQuery(query);

    for (const movie of movies) {
      if (!seenMovieIds.has(movie._id)) {
        moviesOfTheDay.push(movie);
        seenMovieIds.add(movie._id);
      }
      if (moviesOfTheDay.length === 5) break;
    }
  }

  if (moviesOfTheDay.length < 5) {
    console.warn(
      "Could not fetch 5 unique movies within the maximum number of attempts."
    );
  }
  await enrichMovies(moviesOfTheDay);
  postMovies(moviesOfTheDay);
  console.log("MOVIES OF THE DAY", moviesOfTheDay);

  return moviesOfTheDay;
}

const limiter = new Bottleneck({
  minTime: 1000, // Wait at least 1000ms between calls
});

// II. Fetches movies based on a search query from Netzkino API, caches them in the database,
// and fetches additional image from ImdB.

export async function getSearchMovies(query: string) {
  await dbConnect();
  const queryInDb = await isQueryInDb(query);
  if (queryInDb === true) {
    const cachedMovies = getMoviesByQuery(query);
    return cachedMovies;
  } else {
    const movies: IMovie[] = await limiter.schedule(() =>
      fetchMoviesFromNetzkino(query)
    );
    if (!movies.length) return [];
    await postQuery(query);
    const enrichedMovies = await enrichMovies(movies);
    postMovies(movies);
    return enrichedMovies;
  }
}
