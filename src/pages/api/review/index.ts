import { NextApiRequest, NextApiResponse } from "next";

export default async function reviewHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const getReview = async (req: NextApiRequest, res: NextApiResponse) => {
    console.log("here's your review");
    // receive movie object from user, ask chatGPT to generate review, return review to user
  };
}
