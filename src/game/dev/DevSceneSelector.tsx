import React from "react";
import type { GameMode } from "../store/types";
import {
  DEFAULT_DEV_SCENE,
  DEV_SCENE_OPTIONS,
  type DevSceneId,
} from "./scene-types";
import { getDevSceneFromUrl } from "./get-dev-scene-from-url";

interface DevSceneSelectorProps {
  readonly mode: GameMode;
  readonly isDev?: boolean;
  readonly options?: readonly DevSceneId[];
  readonly reloadOnChange?: boolean;
}

export const setDevSceneInUrl = (
  scene: DevSceneId,
  options: { readonly reload?: boolean } = {},
): void => {
  const url = new URL(window.location.href);
  url.searchParams.set("scene", scene);
  const nextUrl = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
  if (options.reload !== false) {
    window.location.reload();
  }
};

export const DevSceneSelector: React.FC<DevSceneSelectorProps> = ({
  mode,
  isDev = import.meta.env.DEV,
  options = DEV_SCENE_OPTIONS,
  reloadOnChange = true,
}) => {
  if (!isDev || mode !== "debug" || options.length <= 1) return null;

  const urlScene = getDevSceneFromUrl();
  const currentScene = options.includes(urlScene)
    ? urlScene
    : DEFAULT_DEV_SCENE;

  const setScene = (scene: DevSceneId): void => {
    setDevSceneInUrl(scene, { reload: reloadOnChange });
  };

  return (
    <div
      aria-label="Dev scene selector"
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1000,
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 10px",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 6,
        background: "rgba(16, 20, 24, 0.9)",
        color: "#f8fafc",
        fontSize: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
      }}
    >
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span>Scene</span>
        <select
          aria-label="Scene"
          value={currentScene}
          onChange={(event) => setScene(event.target.value as DevSceneId)}
          style={{
            minWidth: 112,
            color: "#111827",
            background: "#f8fafc",
            border: 0,
            borderRadius: 4,
            padding: "4px 6px",
            fontSize: 12,
          }}
        >
          {options.map((sceneId) => (
            <option key={sceneId} value={sceneId}>
              {sceneId}
            </option>
          ))}
        </select>
      </label>
      {currentScene !== DEFAULT_DEV_SCENE && (
        <button
          type="button"
          onClick={() => setScene(DEFAULT_DEV_SCENE)}
          style={{
            color: "#f8fafc",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 4,
            padding: "4px 7px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
};
