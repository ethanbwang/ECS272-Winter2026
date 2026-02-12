import { createContext, useContext } from "react";

export const NumTracksContext = createContext<{
    numTracks: number | null;
    setNumTracks: (numTracks: number | null) => void;
}>({ numTracks: null, setNumTracks: () => { } });

export function useNumTracks() {
    return useContext(NumTracksContext);
}
