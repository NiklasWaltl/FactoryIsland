import { getDevSceneFromUrl } from "../get-dev-scene-from-url";

const setUrl = (search: string): void => {
  window.history.pushState({}, "", `/${search}`);
};

describe("getDevSceneFromUrl", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    setUrl("");
  });

  it("falls back to debug when no scene query param exists", () => {
    setUrl("");

    expect(getDevSceneFromUrl()).toBe("debug");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["?scene=debug", "debug"],
    ["?scene=logistics", "logistics"],
    ["?scene=assembler", "assembler"],
  ] as const)("parses %s", (search, expectedScene) => {
    setUrl(search);

    expect(getDevSceneFromUrl()).toBe(expectedScene);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to debug for unknown scene ids", () => {
    setUrl("?scene=unknown");

    expect(getDevSceneFromUrl()).toBe("debug");
    expect(warnSpy).toHaveBeenCalledWith(
      '[dev-scene] Unknown scene "unknown", falling back to "debug"',
    );
  });

  it("falls back to debug for an empty scene query value", () => {
    setUrl("?scene=");

    expect(getDevSceneFromUrl()).toBe("debug");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});