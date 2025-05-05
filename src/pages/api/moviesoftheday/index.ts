import dbConnect from "@/db/mongodb";
import { randomQueries } from "@/lib/constants/constants";
import { getMoviesOfTheDay } from "@/services/movieService";
import { addImgImdb } from "@/services/imdbService";
import { postMovies } from "@/services/movieDB";
import { IMovie } from "@/db/models/Movie";

export default async function moviesDayHandler(req, res) {
  await dbConnect();

  try {
    if (req.method === "GET") {
      const movies = await getMoviesOfTheDay(randomQueries);
      return res.status(200).json(movies);
    }

    if (req.method === "POST") {
      if (!req.body || !Array.isArray(req.body.movies)) {
        return res
          .status(400)
          .json({ error: "Invalid request. Expecting an array of movies." });
      }
      const newMovies = await postMovies(req.body.movies as IMovie[]);
      return res.status(201).json(newMovies);
    }

    if (req.method === "PUT") {
      if (!req.body || !Array.isArray(req.body.movies)) {
        return res
          .status(400)
          .json({ error: "Invalid request. Expecting an array of movies." });
      }
      const updatedMovies = await postMovies(req.body.movies as IMovie[]);
      return res
        .status(200)
        .json({ message: "Movies updated successfully", data: updatedMovies });
    }

    // Method not allowed
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("Error handling movies API:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
