import { createContext, useContext, useRef, useCallback } from "react";

type RequestRandomTrack = () => void;

const RandomTrackContext = createContext<{
  requestRandomTrack: RequestRandomTrack;
  registerRequestRandomTrack: (fn: RequestRandomTrack) => void;
}>({
  requestRandomTrack: () => {},
  registerRequestRandomTrack: () => {},
});

export function RandomTrackProvider({ children }: { children: React.ReactNode }) {
  const fnRef = useRef<RequestRandomTrack>(() => {});

  const requestRandomTrack = useCallback(() => {
    fnRef.current();
  }, []);

  const registerRequestRandomTrack = useCallback((fn: RequestRandomTrack) => {
    fnRef.current = fn;
  }, []);

  return (
    <RandomTrackContext.Provider value={{ requestRandomTrack, registerRequestRandomTrack }}>
      {children}
    </RandomTrackContext.Provider>
  );
}

export function useRandomTrack() {
  return useContext(RandomTrackContext);
}
