import { NextApiRequest, NextApiResponse } from "next";
import { generateMovieReview } from "@/services/reviewService";

export default async function reviewHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { title, regisseur } = req.body;
  if (!title || !regisseur) {
    return res
      .status(400)
      .json({ error: "Please provide both a movie title and a director." });
  }

  try {
    const review = await generateMovieReview(title, regisseur);
    return res.status(200).json({ review });
  } catch (error: unknown) {
    console.error("Error generating review:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return res
      .status(500)
      .json({ error: `Failed to generate review: ${message}` });
  }
}
