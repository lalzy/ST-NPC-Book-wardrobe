// This extension's settings (its own entry in SillyTavern's extension settings) and its panel.

import { ctx, esc } from './host.js';

export const MODULE = 'npc_book_wardrobe';

export const DEFAULT_RULES = `Wardrobes:
- Characters only wear items from their own <wardrobe> (listed in the scene). Never invent clothing for someone who has a wardrobe; use its item ids or names.
[[GROWTH_RULE]]- A new character also gets "wardrobe": 4-8 items that fit their role, as [{"name": "...", "slots": ["..."]}], and their "outfit" names items from it.`;

export const DEFAULT_GROWTH_RULE = `- Clothing a character is given, buys or finds may be put on by name; it joins their wardrobe.
`;

export const DEFAULT_ASSIST_PROMPT = `You help build wardrobes for characters in a roleplay.
- Suggest clothing that fits the character (culture, era, job, personality, budget) and the request.
- Give each item a plain, specific name with color or material, e.g. "Green wool dress".
- Each item covers one or more body slots; a dress covers upper_outer and lower_outer, a jumpsuit too.
- Answer with one JSON object and nothing else.`;

const DEFAULTS = {
    enforce: true, // only wardrobe items can be worn (manual edits and the AI)
    includeWardrobe: true, // send each wardrobe to the AI
    allowGrowth: true, // the AI may put on new clothing, which joins the wardrobe (NPCs, in this chat only)
    rules: DEFAULT_RULES,
    assistPrompt: DEFAULT_ASSIST_PROMPT,
};

/** Settings, created on first use from NPC Book's older wardrobe settings when there are any. */
export function settings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE]) {
        const old = es.npc_book || {};
        es[MODULE] = structuredClone(DEFAULTS);
        if (typeof old.includeWardrobe === 'boolean') es[MODULE].includeWardrobe = old.includeWardrobe;
        if (old.wardrobeGrowthV2 && typeof old.allowWardrobeGrowth === 'boolean') es[MODULE].allowGrowth = old.allowWardrobeGrowth;
        if (typeof old.assistWardrobePrompt === 'string' && old.assistWardrobePrompt.trim()) es[MODULE].assistPrompt = old.assistWardrobePrompt;
    }
    const s = es[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) if (s[k] === undefined) s[k] = structuredClone(v);
    return s;
}

export const save = () => ctx().saveSettingsDebounced();

/** Drawer in Extensions → settings. */
export function mountSettings(api) {
    if ($('#npcbw_settings').length) return;
    const s = settings();
    const html = $(`<div id="npcbw_settings" class="npcbw-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b>NPC Book — Wardrobe</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input type="checkbox" data-k="enforce"> Only wear what is in the wardrobe <i class="fa-solid fa-circle-info" title="The paperdoll and the AI can only put on wardrobe items (characters without a wardrobe are not limited). Off: the wardrobe is a list of suggestions."></i></label>
                <label class="checkbox_label"><input type="checkbox" data-k="includeWardrobe"> Send wardrobes to the AI</label>
                <label class="checkbox_label"><input type="checkbox" data-k="allowGrowth"> NPCs can get new clothing <i class="fa-solid fa-circle-info" title="When an NPC puts on something it does not own (given, bought, found), the item is added to its wardrobe in this chat. The Library card is never changed."></i></label>
                <div class="flex-container">
                    <div class="menu_button" data-prompt="rules"><i class="fa-solid fa-pen-to-square"></i> Wardrobe rules</div>
                    <div class="menu_button" data-prompt="assistPrompt"><i class="fa-solid fa-pen-to-square"></i> Generate prompt</div>
                </div>
            </div>
        </div>
    </div>`);
    html.find('input[data-k]').each((_, el) => { $(el).prop('checked', !!s[$(el).data('k')]); });
    html.on('change', 'input[data-k]', (e) => { s[$(e.target).data('k')] = e.target.checked; save(); api.refreshScene(); });
    const DEFS = { rules: [DEFAULT_RULES, 'Added to NPC Book\'s clothing rules. [[GROWTH_RULE]] = the "new clothing" line while that is on.'], assistPrompt: [DEFAULT_ASSIST_PROMPT, 'System prompt for ✨ Generate on the Wardrobe tab.'] };
    html.on('click', '[data-prompt]', async (e) => {
        const k = String($(e.currentTarget).data('prompt'));
        const c = ctx();
        const box = $(`<div style="text-align:left;display:flex;flex-direction:column;gap:6px"><small>${esc(DEFS[k][1])}</small><textarea class="text_pole" rows="14"></textarea><div class="menu_button npcbw-reset" style="width:fit-content"><i class="fa-solid fa-rotate-left"></i> Reset to default</div></div>`);
        const ta = box.find('textarea').val(String(s[k] ?? ''));
        box.on('click', '.npcbw-reset', () => ta.val(DEFS[k][0]));
        if (!await c.callGenericPopup(box, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, okButton: 'Save', cancelButton: 'Cancel' })) return;
        s[k] = String(ta.val());
        save();
        api.refreshPrompts();
    });
    $('#extensions_settings2').append(html);
}
