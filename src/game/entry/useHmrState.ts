import { useEffect, useState } from "react";
import { IS_DEV, getHmrModules, getHmrStatus } from "../debug";

export function useHmrState(): { modules: string[]; status: string } {
  const [hmrState, setHmrState] = useState<{
    modules: string[];
    status: string;
  }>(() => ({
    modules: IS_DEV ? getHmrModules() : [],
    status: IS_DEV ? getHmrStatus() : "disabled",
  }));

  useEffect(() => {
    if (!IS_DEV) return;
    const id = setInterval(() => {
      setHmrState({ modules: [...getHmrModules()], status: getHmrStatus() });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return hmrState;
}
