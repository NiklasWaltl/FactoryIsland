// Crafting Commit-Check
// Ausführen in Browser DevTools bevor ein Crafting-relevanter Commit gemacht wird.
// Alle 8 Checks müssen true loggen.

const s = window.__store__.getState();

const existingJob = s.crafting?.jobs?.[0];
const recipeId = existingJob?.recipeId ?? "wood_pickaxe";
const wb = existingJob?.workbenchId;
console.log("Using workbenchId:", wb, "/ recipeId:", recipeId);

// JOB_ENQUEUE Normalfall
window.dispatch({
  type: "JOB_ENQUEUE",
  recipeId,
  workbenchId: wb,
  source: "player",
});
const a1 = window.__store__.getState();
console.log("JOB_ENQUEUE crafting updated:", a1.crafting !== s.crafting);
console.log("JOB_ENQUEUE network untouched:", a1.network === s.network);
console.log("JOB_ENQUEUE lastError null:", a1.crafting?.lastError == null);

// JOB_ENQUEUE Guard-Fail
window.dispatch({
  type: "JOB_ENQUEUE",
  recipeId,
  workbenchId: "__invalid__",
  source: "player",
});
const a2 = window.__store__.getState();
console.log("JOB_ENQUEUE guard no-op:", a2.crafting.jobs === a1.crafting.jobs);

// CRAFT_REQUEST Normalfall
window.dispatch({
  type: "CRAFT_REQUEST_WITH_PREREQUISITES",
  recipeId,
  workbenchId: wb,
  source: "player",
  amount: 1,
});
const a3 = window.__store__.getState();
console.log("CRAFT_REQUEST jobs planned:", a3.crafting !== a2.crafting);
console.log("CRAFT_REQUEST network untouched:", a3.network === a2.network);
console.log("CRAFT_REQUEST lastError null:", a3.crafting?.lastError == null);

// CRAFT_REQUEST Guard-Fail
window.dispatch({
  type: "CRAFT_REQUEST_WITH_PREREQUISITES",
  recipeId,
  workbenchId: "__invalid__",
  source: "player",
  amount: 1,
});
const a4 = window.__store__.getState();
console.log("CRAFT_REQUEST guard no-op:", a4.crafting === a3.crafting);

console.log("--- Alle true = commit freigegeben ---");
