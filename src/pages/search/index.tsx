import React, { useState, useEffect } from "react";
import useSWR from "swr";
import MovieCard from "@/components/MovieCard";
import MovieDetail from "@/components/MovieDetail";
import { IMovie } from "@/db/models/Movie";
import { fetcher } from "@/lib/fetcher";
import { useDebounce } from "use-debounce";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import styled from "styled-components";
import { SquareLoader } from "react-spinners";
import ReviewTester from "@/components/Review";

const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0;
`;

const StyledInput = styled.input`
  width: 50vw; /* Set the desired width */
  padding: 0 1rem;
  font-size: 1rem;
  height: 3rem;
  border: 0.2rem solid white;
  border-radius: 5rem;
  background-color: black;
  color: white;
  box-shadow: none;

  &::placeholder {
    color: white;
    opacity: 1;
  }

  &:focus::placeholder {
    opacity: 0;
  }

  &:focus {
    outline: none;
  }
`;

const InputWrapperTop = styled.div`
  width: 50vw;
  margin: 1rem auto 0 auto;
  display: flex;
  justify-content: center;
`;

const ResponseWrapper = styled.div`
  width: 100%;
  align-self: flex-start;
  text-align: left;
  padding: 0 20px;
  font-weight: var(--font-weight-light);
  font-size: 1.5rem;
`;

const CardGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
`;

const SpinnerWrapper = styled.div`
  margin-top: 1rem;
  display: flex;
  justify-content: center;
`;

export interface SearchProps {
  selectedMovie: IMovie | null;
  setSelectedMovie: (movie: IMovie | null) => void;
}

function SearchPage(props: Readonly<SearchProps>) {
  const { setSelectedMovie, selectedMovie } = props;
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  // Debounce the query with 700ms delay
  const [debouncedQuery] = useDebounce(query, 1200);

  const { data: movies = [], isValidating } = useSWR(
    query ? `/api/movies/search?query=${debouncedQuery}` : null,
    fetcher,
    { dedupingInterval: 700 }
  );

  // Handles input while allowing only lowercase letters
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (/^[a-z]*$/.test(value)) {
      setQuery(value);
      setError(""); // Clears error when valid input
    } else {
      setError("Only lowercase letters (a-z) are allowed.");
    }
  };

  const isDebouncing = query.trim() !== "" && query !== debouncedQuery;

  // Route Protection
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "unauthenticated") {
    router.push("/");
  }

  if (status === "loading") {
    return (
      <SpinnerWrapper>
        <SquareLoader color="#ffffff" size={20} />
      </SpinnerWrapper>
    );
  }

  return (
    <SearchContainer>
      {/* Always render the input on top */}
      <InputWrapperTop>
        <StyledInput
          name="Search Input"
          type="text"
          placeholder=""
          value={query}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === " " && e.preventDefault()}
        />
      </InputWrapperTop>

      {/* Search Status Display */}
      {!selectedMovie ? (
        <>
          {query.trim() === "" ? (
            <p>Bitte gib einen Suchbegriff ein.</p>
          ) : isDebouncing || isValidating ? (
            <SpinnerWrapper>
              <SquareLoader color="#ffffff" size={20} />
            </SpinnerWrapper>
          ) : movies.results?.length === 0 ? (
            <p>{`Hmm... Wir konnten keine Filme finden für '${query}'.`}</p>
          ) : movies.length > 0 ? (
            <>
              <ResponseWrapper>
                <p>{`${movies.length} ${
                  movies.length === 1 ? "Suchergebnis" : "Suchergebnisse"
                } für '${query}'...`}</p>
              </ResponseWrapper>

              {/* Search Results Display with detail view on Click */}
              <CardGrid>
                {movies.map((movie: IMovie) => (
                  <MovieCard
                    key={movie._id}
                    onClick={() => setSelectedMovie(movie)}
                    movie={movie}
                  />
                ))}
              </CardGrid>
            </>
          ) : null}
        </>
      ) : (
        <MovieDetail
          movie={selectedMovie}
          onBack={() => setSelectedMovie(null)}
        />
      )}
    </SearchContainer>
  );
}
export default SearchPage;
