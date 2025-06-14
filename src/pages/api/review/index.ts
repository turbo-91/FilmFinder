import { NextApiRequest, NextApiResponse } from "next";
import client from "@/lib/openAi";

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
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are an arrogant, condescending film snob.
- You scoff at popular taste.
- You pepper your critique with highbrow references and biting insults.
- You never hold back—be lavish with your sarcasm and disdain.
          `.trim(),
        },
        {
          role: "user",
          content: `Write a review of "${title}" by "${regisseur}".`,
        },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    const review = completion.choices[0].message!.content!.trim();
    return res.status(200).json({ review });
  } catch (error: any) {
    console.error("Error generating review:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate review. Please try again later." });
  }
}
