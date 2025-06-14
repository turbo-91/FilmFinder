// pages/test-review.tsx
import { useState, FormEvent } from "react";
import { IMovie } from "@/db/models/Movie";

interface ReviewTesterProps {
  movie: IMovie;
}

export default function ReviewTester(props: Readonly<ReviewTesterProps>) {
  const { movie } = props;
  const [title, setTitle] = useState("");
  const [regisseur, setRegisseur] = useState("");
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setReview(null);
    setLoading(true);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, regisseur }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setReview(data.review);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>🎬 Review API Tester</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: 8, maxWidth: 400 }}
      >
        <input
          placeholder="Movie Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          placeholder="Director"
          value={regisseur}
          onChange={(e) => setRegisseur(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Get Review"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {review && (
        <div style={{ marginTop: 20 }}>
          <h2>Review:</h2>
          <p>{review}</p>
        </div>
      )}
    </div>
  );
}
