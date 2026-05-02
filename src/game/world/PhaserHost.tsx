import React, { useRef, useEffect } from "react";
import {
  createPhaserGame,
  FLOOR_MAP_EVENT,
  TILE_MAP_EVENT,
  STATIC_ASSETS_EVENT,
  DRONE_STATE_EVENT,
  COLLECTION_NODES_EVENT,
  SHIP_STATE_EVENT,
  type FloorMapData,
  type TileMapData,
  type StaticAssetSnapshot,
  type DroneSnapshot,
  type CollectionNodeSnapshot,
  type ShipSnapshot,
} from "./PhaserGame";

interface PhaserHostProps {
  tileMap: TileMapData;
  floorMap: FloorMapData;
  staticAssets: StaticAssetSnapshot[];
  drones: DroneSnapshot[];
  collectionNodes: CollectionNodeSnapshot[];
  ship: ShipSnapshot;
}

/**
 * React wrapper that mounts a Phaser canvas into the DOM.
 * Handles clean mount/unmount and prevents double-init in React Strict Mode.
 */
export const PhaserHost: React.FC<PhaserHostProps> = ({
  tileMap,
  floorMap,
  staticAssets,
  drones,
  collectionNodes,
  ship,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || gameRef.current) return;

    const game = createPhaserGame(el);
    // Ensure Phaser canvas never captures pointer events from the React grid.
    const canvas = el.querySelector("canvas");
    if (canvas) {
      canvas.style.pointerEvents = "none";
    }
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Push tileMap into Phaser scene whenever its reducer-owned reference changes.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    const tryEmit = (): boolean => {
      try {
        const scene = game.scene.getScene("WorldScene");
        if (scene && scene.scene.isActive()) {
          scene.events.emit(TILE_MAP_EVENT, tileMap);
          return true;
        }
      } catch {
        // Scene may not be registered yet; retry on next step.
      }
      return false;
    };

    if (tryEmit()) return;

    const onStep = () => {
      if (tryEmit()) {
        game.events.off("step", onStep);
      }
    };
    game.events.on("step", onStep);
    return () => {
      game.events.off("step", onStep);
    };
  }, [tileMap]);

  // Push floorMap into Phaser scene whenever it changes
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    const tryEmit = (): boolean => {
      try {
        const scene = game.scene.getScene("WorldScene");
        if (scene && scene.scene.isActive()) {
          // Scene is ready – emit current snapshot.
          scene.events.emit(FLOOR_MAP_EVENT, floorMap);
          return true;
        }
      } catch {
        // Scene may not be registered yet; retry on next step.
      }
      return false;
    };

    if (tryEmit()) return;

    // Retry until scene is active; avoids one-shot timing races.
    const onStep = () => {
      if (tryEmit()) {
        game.events.off("step", onStep);
      }
    };
    game.events.on("step", onStep);
    return () => {
      game.events.off("step", onStep);
    };
  }, [floorMap]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    const tryEmit = (): boolean => {
      try {
        const scene = game.scene.getScene("WorldScene");
        if (scene && scene.scene.isActive()) {
          scene.events.emit(STATIC_ASSETS_EVENT, staticAssets);
          return true;
        }
      } catch {
        // Scene may not be registered yet; retry on next step.
      }
      return false;
    };

    if (tryEmit()) return;

    const onStep = () => {
      if (tryEmit()) {
        game.events.off("step", onStep);
      }
    };
    game.events.on("step", onStep);
    return () => {
      game.events.off("step", onStep);
    };
  }, [staticAssets]);

  // Push drone snapshots into Phaser scene whenever they change.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    const tryEmit = (): boolean => {
      try {
        const scene = game.scene.getScene("WorldScene");
        if (scene && scene.scene.isActive()) {
          scene.events.emit(DRONE_STATE_EVENT, drones);
          return true;
        }
      } catch {
        // Scene may not be registered yet; retry on next step.
      }
      return false;
    };

    if (tryEmit()) return;

    const onStep = () => {
      if (tryEmit()) {
        game.events.off("step", onStep);
      }
    };
    game.events.on("step", onStep);
    return () => {
      game.events.off("step", onStep);
    };
  }, [drones]);

  // Push collection-node snapshots (manual harvest drops) into Phaser scene.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    const tryEmit = (): boolean => {
      try {
        const scene = game.scene.getScene("WorldScene");
        if (scene && scene.scene.isActive()) {
          scene.events.emit(COLLECTION_NODES_EVENT, collectionNodes);
          return true;
        }
      } catch {
        // Scene may not be registered yet; retry on next step.
      }
      return false;
    };

    if (tryEmit()) return;

    const onStep = () => {
      if (tryEmit()) {
        game.events.off("step", onStep);
      }
    };
    game.events.on("step", onStep);
    return () => {
      game.events.off("step", onStep);
    };
  }, [collectionNodes]);

  // Push ship snapshot into Phaser scene whenever status or dock position changes.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    const tryEmit = (): boolean => {
      try {
        const scene = game.scene.getScene("WorldScene");
        if (scene && scene.scene.isActive()) {
          scene.events.emit(SHIP_STATE_EVENT, ship);
          return true;
        }
      } catch {
        // Scene may not be registered yet; retry on next step.
      }
      return false;
    };

    if (tryEmit()) return;

    const onStep = () => {
      if (tryEmit()) {
        game.events.off("step", onStep);
      }
    };
    game.events.on("step", onStep);
    return () => {
      game.events.off("step", onStep);
    };
  }, [ship]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
};
