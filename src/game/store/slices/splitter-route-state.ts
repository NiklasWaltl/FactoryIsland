export type SplitterRouteState = Record<string, { lastSide: "left" | "right" }>;

export const initialSplitterRouteState: SplitterRouteState = {};

let _splitterRouteState: SplitterRouteState = initialSplitterRouteState;

export function getSplitterRouteState(): SplitterRouteState {
  return _splitterRouteState;
}

export function setSplitterLastSide(
  splitterId: string,
  side: "left" | "right",
): void {
  _splitterRouteState = {
    ..._splitterRouteState,
    [splitterId]: { lastSide: side },
  };
}

export function loadSplitterRouteState(state: SplitterRouteState): void {
  _splitterRouteState = state;
}

export function resetSplitterRouteState(): void {
  _splitterRouteState = {};
}
