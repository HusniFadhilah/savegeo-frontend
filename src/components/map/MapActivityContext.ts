import { createContext } from "react";
/** Dashboard modules preserve analysis state while hidden, but their renderers should stop. */
export const MapActivityContext = createContext(true);
