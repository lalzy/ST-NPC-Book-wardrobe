// NPC Book's public API, and the pieces of it this extension uses. Loaded only after NPC Book is ready.

export const api = window.NPCBook;
export const { SLOTS, SLOT_LABEL, STACKING_SLOTS, inferSlots, normalizeSlots, findItem, findItemLoose, makeItem, resolveOutfit } = api.clothing;
export const { esc, xa, xt, clone, normalize, uniqueId, parseJson } = api.util;
export const ctx = () => SillyTavern.getContext();
