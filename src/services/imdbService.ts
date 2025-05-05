import axios from "axios";
const movieThumbnail = require("@/public/movieThumbnail.png");
import { imgImdbUrl } from "@/lib/constants/constants";
import { IMovie } from "@/db/models/Movie";

// ensures that movies get image from both APIs

export async function addImgImdb(movie: IMovie) {
  if (movie.posterImdb === "n/a") return;
  const imdbData = await axios.get(movie.posterImdb);
  const poster = imdbData.data.movie_results?.[0]?.poster_path;
  const backdrop = imdbData.data.movie_results?.[0]?.backdrop_path;
  movie.posterImdb = poster ? `${imgImdbUrl}${poster}` : movieThumbnail.src;
  movie.backdropImdb = backdrop
    ? `${imgImdbUrl}${backdrop}`
    : movieThumbnail.src;
  return movie;
}

export async function enrichMovies(movies: IMovie[]): Promise<IMovie[]> {
  const enrichedMovies = await Promise.all(
    movies.map(async (movie) => {
      const enriched = await addImgImdb(movie);
      return enriched || movie;
    })
  );

  return enrichedMovies;
}
