import axios from "axios";
import { imgImdbUrl } from "@/lib/constants/constants";
import { IMovie } from "@/db/models/Movie";

// ensures that movies get image from both APIs

const movieThumbnailSrc = "/movieThumbnail.png";

export async function addImgImdb(movie: IMovie) {
  if (movie.posterImdb === "n/a") return;
  const imdbData = await axios.get(movie.posterImdb);
  const poster = imdbData.data.movie_results?.[0]?.poster_path;
  const backdrop = imdbData.data.movie_results?.[0]?.backdrop_path;

  movie.posterImdb = poster ? `${imgImdbUrl}${poster}` : movieThumbnailSrc;
  movie.backdropImdb = backdrop
    ? `${imgImdbUrl}${backdrop}`
    : movieThumbnailSrc;

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
