# NPC Book — Wardrobe

A sister extension for [NPC Book](https://github.com/lalzy/ST-NPC-Book) (needs NPC Book 2.0, API 7+).

NPC Book on its own lets anyone wear any clothing: you type items into the paper doll, and the AI names them. This extension adds **wardrobes**, the clothing each character owns:

- A **Wardrobe** tab on every NPC card, a **Wardrobe** sheet for each NPC in a chat (that chat's own copy), and a **Wardrobe** tab in your persona window.
- **Only wear what is in the wardrobe** (on by default): the paper doll offers wardrobe items per slot, and the AI can only dress characters from their wardrobe.
- **NPCs can get new clothing** (on by default): when the AI puts something new on an NPC (given, bought, found), it joins that NPC's wardrobe in this chat. The Library card is never changed.
- **Send wardrobes to the AI**: each character in the scene sends its wardrobe, and new NPCs the AI introduces get one.
- **✨ Generate items** on the Wardrobe tab: the LLM suggests clothing that fits the character.

Settings: **Extensions** → **NPC Book — Wardrobe**.

## Install
Install it like any SillyTavern extension (Extensions → Install extension, or copy this folder to `SillyTavern/data/<your-user>/extensions/`), next to NPC Book.

## Upgrading from NPC Book 1.x
Wardrobes you made with NPC Book 1.x are read as they are, so nothing is lost. A wardrobe is stored in this extension's format the next time you save it. Starring items as the starting outfit is now NPC Book's **Outfit** tab on the card (your persona: **Starting outfit**), where wardrobe items are offered per slot.

## How it is built
Only through NPC Book's public API (`window.NPCBook`), so it is also a full example for writing your own sister extension. See NPC Book's `EXTENDING.md`. Hooks used: `cardTab`, `personaSheet`, `outfitCatalog`, `transformEntry`, `fromTracker`, `onTrackerEntry`, `entryKeys`, `sceneXml` (`sceneXmlAlways`), `instructions`.
