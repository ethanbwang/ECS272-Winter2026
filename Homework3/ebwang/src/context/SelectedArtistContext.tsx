import { createContext, useContext } from "react";

export const SelectedArtistContext = createContext<{
  selectedArtist: string | null;
  setSelectedArtist: (artist: string | null) => void;
}>({ selectedArtist: null, setSelectedArtist: () => { } });

export function useSelectedArtist() {
  return useContext(SelectedArtistContext);
}
