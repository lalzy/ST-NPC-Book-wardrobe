// NPC Book — Wardrobe: a sister extension for NPC Book (API 7+).
// Gives every NPC and your persona a wardrobe (the clothing they own). When it is on, characters can only wear what is
// in their wardrobe (new clothing they are given can join it), the wardrobe is sent to the AI, new NPCs get one, and
// the paperdoll offers wardrobe items. Without this extension, NPC Book lets anyone wear any clothing.
// Built only on NPC Book's public API (window.NPCBook): see NPC Book's EXTENDING.md.

const MIN_API = 7;

async function start(api) {
    if (!(api?.apiVersion >= MIN_API)) {
        console.warn(`[NPC Book — Wardrobe] needs NPC Book API ${MIN_API}+, found ${api?.apiVersion}`);
        toastr.warning('NPC Book — Wardrobe needs a newer NPC Book.', 'NPC Book — Wardrobe');
        return;
    }
    const { register } = await import('./src/main.js');
    await register(api);
}

if (window.NPCBook) start(window.NPCBook);
else document.addEventListener('npcbook:ready', (e) => start(e.detail), { once: true });
