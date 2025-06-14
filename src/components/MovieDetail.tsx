import { IMovie } from "@/db/models/Movie";
import { useRouter } from "next/router";
import { useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { customLoader } from "@/lib/constants/constants";
import movieThumbnail from "/public/movieThumbnail.png";
import styled from "styled-components";
import { Star } from "lucide-react";
import ReviewTester from "./Review";

const DetailContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const UnitContainer = styled.div`
  display: flex;
  flex-direction: row;
  /* Let the text and image each control their own widths */
  align-items: flex-start;
  justify-content: flex-start;
  max-width: 100%;
  max-height: 100%;
  margin: 2% auto;
  margin-top: 2%;
  margin-bottom: 2%;
  margin-left: 5%;
  margin-right: 5%;
`;

const ImageContainer = styled.div`
  position: relative;
  height: 70vh;
  width: 40vw; /* smaller than full width so there's more space for text */
  overflow: hidden;
  flex-shrink: 0; /* prevents image from shrinking; remove if you want it to shrink */
  margin-top: 0;
  margin-bottom: 0;
  margin-left: 0;
  margin-right: 2vw;
  border: 0.2rem solid white;
`;

const ContentContainer = styled.div<{ expanded: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  color: white;
  border: 0.2rem solid white;
  width: 40vw;
  margin-left: 2vw;
  margin-bottom: non;
  height: auto;
  min-height: 70vh;
  padding: 1rem;
`;

const BackButton = styled.button`
  all: unset;
  font-weight: var(--font-weight-light);
  cursor: pointer;
  font-size: 1.8rem;
  margin: 0;
  margin-top: auto; /* pushes the button to the bottom */
  padding: 0.5rem 1rem;
  align-self: flex-start;
  &:hover {
    color: lightgray;
  }
`;

const Title = styled.h3`
  font-size: 2.2rem;
  font-weight: var(--font-weight-light);
  text-align: left;
  margin: 0;
  padding: 0.5rem 1rem;
`;

const Info = styled.p`
  text-align: left;
  margin: 0;
  padding: 0.5rem 1rem;
  font-size: clamp(0.4rem, 1vw, 0.9rem);
`;

const OverviewText = styled.p<{ expanded: boolean }>`
  --line-height: 1.2;
  --lines-shown: 3;
  font-size: clamp(0.4rem, 1vw, 0.9rem);
  line-height: var(--line-height);
  text-align: left;
  padding: 0 1rem;

  max-height: ${(props) =>
    props.expanded
      ? "none"
      : `calc(var(--line-height) * var(--lines-shown) * 1em)`}; /* 1em is the font-size reference */

  overflow: hidden;
  transition: max-height 0.3s ease;
  text-align: justify;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.5rem;
  align-self: flex-end; /* aligns the button to the right end of the flex container */
  padding-right: 1vw;

  &:hover {
    color: lightgray;
  }
`;

const IconWrapper = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
`;

const WatchlistButton = styled.button`
  all: unset;
  cursor: pointer;
  font-size: 1.2rem;
`;

interface MovieDetailProps {
  movie: IMovie;
  onBack: () => void;
}

export default function MovieDetail({ movie, onBack }: MovieDetailProps) {
  // Session and Watchlist
  const { data: session, status } = useSession();
  const userId = session?.user?.userId; // custom nextAuth type in types folder ensures type safety
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } =
    useWatchlist(userId);
  const router = useRouter();

  // Image
  const [imgSrc, setImgSrc] = useState(
    movie.posterImdb || movie.imgNetzkino || movieThumbnail
  );
  const handleImageError = () => {
    setImgSrc(movieThumbnail);
  };

  // Overview expansion state
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const toggleOverview = () => {
    setOverviewExpanded((prev) => !prev);
  };

  return (
    <DetailContainer>
      <UnitContainer>
        <ImageContainer>
          {status === "authenticated" && (
            <IconWrapper>
              {isInWatchlist(movie._id) ? (
                <WatchlistButton
                  onClick={() => {
                    removeFromWatchlist(movie._id);
                    router.replace(router.asPath);
                  }}
                >
                  <Star
                    fill="#FFD700"
                    color="#FFD700"
                    size={35}
                    strokeWidth={1}
                  />
                </WatchlistButton>
              ) : (
                <WatchlistButton onClick={() => addToWatchlist(movie._id)}>
                  <Star color="#FFD700" size={35} strokeWidth={1.5} />
                </WatchlistButton>
              )}
            </IconWrapper>
          )}
          <Image
            loader={customLoader}
            src={imgSrc}
            alt={movie.title}
            fill
            style={{
              objectFit: "contain",
              objectPosition: "center",
            }}
            onError={handleImageError}
          />
        </ImageContainer>
        <ContentContainer expanded={overviewExpanded}>
          <Title>
            {movie.title} ({movie.year})
          </Title>
          <OverviewText expanded={overviewExpanded}>
            {movie.overview}
          </OverviewText>
          <ToggleButton onClick={toggleOverview}>
            {overviewExpanded ? "↑" : "↓"}
          </ToggleButton>
          <Info>Regie: {movie.regisseur}</Info>
          <Info>Mit {movie.stars}</Info>
          <ReviewTester movie={movie} />
          <BackButton onClick={onBack}>← Zurück</BackButton>
        </ContentContainer>
      </UnitContainer>
    </DetailContainer>
  );
}
