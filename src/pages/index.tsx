import { useState } from "react";
import { IMovie } from "@/db/models/Movie";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Slider from "react-slick";
import SliderCard from "@/components/SliderCard";
import MovieDetail from "@/components/MovieDetail";
import { useEffect } from "react";
import { SquareLoader } from "react-spinners";
import styled from "styled-components";

export interface HomeProps {
  selectedMovie: IMovie | null;
  setSelectedMovie: (movie: IMovie | null) => void;
}

const SpinnerWrapper = styled.div`
  margin-top: 1rem;
  display: flex;
  justify-content: center;
`;

export default function Home(props: Readonly<HomeProps>) {
  const { setSelectedMovie, selectedMovie } = props;
  const [movies, setMovies] = useState<IMovie[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // data fetching
  useEffect(() => {
    fetch("/api/moviesoftheday")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setMovies(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, []);

  // slider functionality

  const settings = {
    dots: false,
    infinite: true,
    slidesToShow: 1,
    autoplay: true,
    pauseOnHover: true,
    speed: 30000,
    autoplaySpeed: 1,
    cssEase: "linear",
    lazyload: "ondemand",
  };

  if (isLoading)
    return (
      <SpinnerWrapper>
        <SquareLoader color="#ffffff" size={20} />
      </SpinnerWrapper>
    );
  if (error) console.log(error.message);
  if (!movies.length && error) return <p>No movies found.</p>;

  return (
    <div>
      {selectedMovie ? (
        <MovieDetail
          movie={selectedMovie}
          onBack={() => setSelectedMovie(null)}
        />
      ) : (
        <Slider {...settings}>
          {movies.map((movie) => {
            return (
              <SliderCard
                key={movie._id}
                movie={movie}
                onClick={() => setSelectedMovie(movie)}
              />
            );
          })}
        </Slider>
      )}
    </div>
  );
}
