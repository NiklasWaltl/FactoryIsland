import { drawQuest, getQuestId, QUEST_POOLS } from "../quest-registry";

describe("quest pool content", () => {
  it.each([1, 2, 3, 4, 5])("phase %i pool is non-empty", (phase) => {
    expect(QUEST_POOLS[phase].length).toBeGreaterThan(0);
  });

  it.each([1, 2, 3, 4, 5])(
    "every quest in phase %i pool carries that phase tag",
    (phase) => {
      for (const quest of QUEST_POOLS[phase]) {
        expect(quest.phase).toBe(phase);
      }
    },
  );

  it("phase 4 amounts strictly exceed phase 3 max for shared items", () => {
    const phase3Max = new Map<string, number>();
    for (const q of QUEST_POOLS[3]) {
      phase3Max.set(q.itemId, Math.max(phase3Max.get(q.itemId) ?? 0, q.amount));
    }
    for (const q of QUEST_POOLS[4]) {
      const prev = phase3Max.get(q.itemId);
      if (prev !== undefined) {
        expect(q.amount).toBeGreaterThan(prev);
      }
    }
  });

  it("phase 5 amounts strictly exceed phase 4 max for shared items", () => {
    const phase4Max = new Map<string, number>();
    for (const q of QUEST_POOLS[4]) {
      phase4Max.set(q.itemId, Math.max(phase4Max.get(q.itemId) ?? 0, q.amount));
    }
    for (const q of QUEST_POOLS[5]) {
      const prev = phase4Max.get(q.itemId);
      if (prev !== undefined) {
        expect(q.amount).toBeGreaterThan(prev);
      }
    }
  });
});

describe("drawQuest pool selection", () => {
  it.each([1, 2, 3, 4, 5])(
    "drawQuest(%i) returns a quest from phase %i",
    (phase) => {
      const allowedItems = new Set(QUEST_POOLS[phase].map((q) => q.itemId));
      for (let i = 0; i < 50; i++) {
        const quest = drawQuest(phase);
        expect(quest.phase).toBe(phase);
        expect(allowedItems.has(quest.itemId)).toBe(true);
      }
    },
  );

  it("drawQuest(4) covers every entry in PHASE_4_QUESTS over many draws", () => {
    const seen = new Set<string>();
    const origRandom = Math.random;
    try {
      for (let i = 0; i < QUEST_POOLS[4].length; i++) {
        Math.random = () => i / QUEST_POOLS[4].length;
        const quest = drawQuest(4);
        seen.add(`${quest.itemId}:${quest.amount}`);
      }
    } finally {
      Math.random = origRandom;
    }
    expect(seen.size).toBe(QUEST_POOLS[4].length);
  });

  it("drawQuest(5) covers every entry in PHASE_5_QUESTS over many draws", () => {
    const seen = new Set<string>();
    const origRandom = Math.random;
    try {
      for (let i = 0; i < QUEST_POOLS[5].length; i++) {
        Math.random = () => i / QUEST_POOLS[5].length;
        const quest = drawQuest(5);
        seen.add(`${quest.itemId}:${quest.amount}`);
      }
    } finally {
      Math.random = origRandom;
    }
    expect(seen.size).toBe(QUEST_POOLS[5].length);
  });

  it("drawQuest with empty/unknown phase falls back to phase 1", () => {
    const phase1Items = new Set(QUEST_POOLS[1].map((q) => q.itemId));
    const quest = drawQuest(99);
    expect(quest.phase).toBe(1);
    expect(phase1Items.has(quest.itemId)).toBe(true);
  });

  it("drawQuest avoids blocked recent quest IDs when alternatives exist", () => {
    const blockedQuest = QUEST_POOLS[4][0];
    const origRandom = Math.random;
    try {
      Math.random = () => 0;
      const quest = drawQuest(4, [getQuestId(blockedQuest)]);
      expect(getQuestId(quest)).not.toBe(getQuestId(blockedQuest));
    } finally {
      Math.random = origRandom;
    }
  });

  it("drawQuest falls back to full pool when every quest ID is blocked", () => {
    const blockedIds = QUEST_POOLS[2].map((quest) => getQuestId(quest));
    const quest = drawQuest(2, blockedIds);
    expect(quest.phase).toBe(2);
  });
});
