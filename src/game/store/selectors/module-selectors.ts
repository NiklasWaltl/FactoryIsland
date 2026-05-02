import type { Module } from "../../modules/module.types";
import type { GameState } from "../types";

export const selectModules = (state: GameState): Module[] =>
  state.moduleInventory;

export const selectModuleCount = (state: GameState): number =>
  selectModules(state).length;
