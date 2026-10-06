import { Image } from "expo-image";
import { memo } from "react";

import { useArtwork } from "../hooks/use-artwork";
import { ArtworkPlaceholder } from "./ArtworkPlaceholder";

type Props = {
  songId: string | null | undefined;
  size: number;
  radius?: number;
  /** Pixel size asked from the engine (bigger = sharper, slower). */
  loadSize?: number;
};

/** Song artwork, or the gradient placeholder when the song has none. */
export const Artwork = memo(function Artwork({
  songId,
  size,
  radius = 10,
  loadSize = 128,
}: Props) {
  const uri = useArtwork(songId, loadSize);
  if (!uri) return <ArtworkPlaceholder width={size} radius={radius} />;
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      transition={120}
      recyclingKey={songId ?? undefined}
    />
  );
});
