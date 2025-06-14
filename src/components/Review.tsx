import { useState, FormEvent } from "react";
import { IMovie } from "@/db/models/Movie";
import styled from "styled-components";

const ReviewButton = styled.button`
  all: unset;
  cursor: pointer;
  text-align: center;
  height: 3vh;
  margin: 0;
  padding: 0 1rem;
  font-size: clamp(0.4rem, 1vw, 0.9rem);
  border: 1px solid white;
  border-radius: 10px;
  background-color: white;
  color: black;
  box-shadow: none;
`;

const Review = styled.p`
  font-size: clamp(0.4rem, 1vw, 0.9rem);
  line-height: var(--line-height);
  text-align: left;
  padding: 0;
`;

interface ReviewTesterProps {
  movie: IMovie;
}

export default function ReviewTester(props: Readonly<ReviewTesterProps>) {
  const { movie } = props;
  const title = movie.title;
  const regisseur = movie.regisseur;

  const [review, setReview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setReview(null);
    setIsLoading(true);

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
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      {!review && (
        <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
          <ReviewButton type="submit" disabled={isLoading}>
            {isLoading
              ? "Einen Moment Geduld, werter Filmenthusiast..."
              : "Frag den distinguierten Filmkritiker nach seiner Meinung."}
          </ReviewButton>
        </form>
      )}

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {review && <Review>"{review}"</Review>}
    </div>
  );
}
