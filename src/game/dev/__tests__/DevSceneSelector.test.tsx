import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DevSceneSelector } from "../DevSceneSelector";
import { DEV_SCENE_OPTIONS } from "../scene-types";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const setUrl = (url: string): void => {
  window.history.pushState({}, "", url);
};

describe("DevSceneSelector", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    setUrl("/factory/?scene=debug");
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    setUrl("/");
  });

  it("renders nothing when only one scene option is visible", () => {
    act(() => {
      root.render(
        <DevSceneSelector mode="debug" isDev options={["debug"]} />,
      );
    });

    expect(container.textContent).toBe("");
  });

  it("renders only visible scene options", () => {
    act(() => {
      root.render(
        <DevSceneSelector
          mode="debug"
          isDev
          options={DEV_SCENE_OPTIONS}
          reloadOnChange={false}
        />,
      );
    });

    const options = Array.from(container.querySelectorAll("option")).map(
      (option) => option.value,
    );

    expect(options).toEqual([...DEV_SCENE_OPTIONS]);
    expect(options).not.toContain("logistics");
    expect(options).not.toContain("power");
    expect(options).not.toContain("assembler");
  });

  it("shows the default visible option when the URL scene is hidden", () => {
    setUrl("/factory/?scene=logistics");

    act(() => {
      root.render(
        <DevSceneSelector
          mode="debug"
          isDev
          options={DEV_SCENE_OPTIONS}
          reloadOnChange={false}
        />,
      );
    });

    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("debug");
  });

  it("changes only the query param when switching scenes", () => {
    setUrl("/factory/index.factory.html?scene=debug&foo=bar#view");

    act(() => {
      root.render(
        <DevSceneSelector
          mode="debug"
          isDev
          options={DEV_SCENE_OPTIONS}
          reloadOnChange={false}
        />,
      );
    });

    const select = container.querySelector("select") as HTMLSelectElement;
    act(() => {
      select.value = "empty";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(window.location.pathname).toBe("/factory/index.factory.html");
    expect(window.location.search).toBe("?scene=empty&foo=bar");
    expect(window.location.hash).toBe("#view");
  });
});