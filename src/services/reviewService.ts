import client from "@/lib/openAi";

export async function generateMovieReview(
  title: string,
  regisseur: string
): Promise<string> {
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
  return review;
}
