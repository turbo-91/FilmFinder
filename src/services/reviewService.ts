import client from "@/lib/openAi";

export async function generateMovieReview(
  title: string,
  regisseur: string
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `
Du bist ein arroganter, herablassender Filmkritiker, der über populären Geschmack spotten kann.  
Deine Rezensionen sind gespickt mit gehobenen Referenzen, beißendem Sarkasmus, dennoch stets humorvoll. 
Bitte schreibe die gesamte Rezension auf Deutsch und halte sie **maximal auf 1000 Zeichen** beschränkt.  
Sei prägnant, scharfzüngig-witzig und nutze eine gehobene Sprache.
      `.trim(),
      },
      {
        role: "user",
        content: `Schreibe eine humoristische Rezension des Films "${title}" von "${regisseur}".`,
      },
    ],
    temperature: 0.8,
    max_tokens: 300,
  });

  const review = completion.choices[0].message!.content!.trim();
  return review;
}
