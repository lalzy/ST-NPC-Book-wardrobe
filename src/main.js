// Registers the Wardrobe with NPC Book. Data: ext.wardrobe = { items: [{ id, name, slots, note }] } on NPC cards, on each
// chat's NPC copies and on personas. Cards and chats saved before this extension existed keep their wardrobe in NPC
// Book's old top-level `wardrobe` field; it is read from there until the wardrobe is saved here.

import { mountGenerator } from './generator.js';
import { SLOT_LABEL, api, clone, inferSlots, normalize, normalizeSlots, resolveOutfit, uniqueId, xt } from './host.js';
import { DEFAULT_GROWTH_RULE, mountSettings, settings } from './settings.js';
import { mountWardrobe } from './wardrobeEditor.js';

export const ID = 'wardrobe';

/** A character's wardrobe items: this extension's data, else NPC Book's older top-level `wardrobe`. */
export function itemsOf(data, subject) {
    if (Array.isArray(data?.items)) return data.items;
    return Array.isArray(subject?.wardrobe) ? subject.wardrobe : [];
}

/** Add raw items ({name, slots?, note?} or names) that are not in `items` yet. Returns { items, added }. */
function addItems(items, raws) {
    const out = [...items];
    const added = [];
    for (const raw of Array.isArray(raws) ? raws : []) {
        const name = String(typeof raw === 'string' ? raw : raw?.name ?? '').trim();
        if (!name || /^(nothing|none|naked|nude)$/i.test(name) || out.some(i => normalize(i.name) === normalize(name))) continue;
        const slots = raw && typeof raw === 'object' && (raw.slots ?? raw.slot) ? normalizeSlots(raw.slots ?? raw.slot) : inferSlots(name);
        const item = { id: uniqueId(raw?.id || name, x => out.some(i => i.id === x)), name, slots, note: String(raw?.note ?? raw?.description ?? '').trim() };
        out.push(item);
        added.push(item);
    }
    return { items: out, added };
}

/** Wardrobe tab / sheet: generator + editor on the draft `data`, filled from older data the first time. */
function renderSheet(host, data, legacySubject, who, note) {
    if (!Array.isArray(data.items)) data.items = clone(itemsOf(null, legacySubject));
    host.html(`${note ? `<small class="npcb-dim">${note}</small>` : ''}<div class="npcbw-gen-host"></div><div class="npcbw-ed-host"></div>`);
    const ed = mountWardrobe(host.find('.npcbw-ed-host'), data, { key: legacySubject?.id || 'persona' });
    mountGenerator(host.find('.npcbw-gen-host'), data, who, () => ed.refresh());
}

export async function register() {
    api.registerExtension({
        id: ID,
        label: 'Wardrobe',
        defaultData: () => ({}),
        sheetLabel: 'Wardrobe',
        cardTab: {
            label: 'Wardrobe',
            icon: 'fa-shirt',
            render(host, { data, template, scope }) {
                renderSheet(host, data, template, () => template, scope === 'instance'
                    ? 'This chat\'s own wardrobe. Changes stay in this chat; the Library card is not touched.'
                    : 'The clothing this NPC owns. Each chat starts from this list; set what they wear on the Outfit tab.');
            },
        },
        personaSheet: {
            label: 'Wardrobe',
            icon: 'fa-shirt',
            render(host, { data, subject, name }) {
                renderSheet(host, data, subject, () => ({ name, description: SillyTavern.getContext().powerUserSettings?.persona_description || '' }),
                    'The clothing you own. Set what you wear at the start on the Starting outfit tab.');
            },
        },

        // The paperdoll and the AI pick from the wardrobe. Strict while "Only wear what is in the wardrobe" is on,
        // except that NPCs may put on new clothing from the story ("NPCs can get new clothing"), and greetings may name
        // anything (it joins the wardrobe, as before). Characters without a wardrobe are not limited.
        outfitCatalog({ source, kind, subject, ext }) {
            const s = settings();
            const items = itemsOf(ext?.[ID], subject);
            const strict = !!items.length && s.enforce && (source === 'editor' || (source === 'tracker' && !(kind === 'char' && s.allowGrowth)));
            return { items, strict, editLabel: 'Edit wardrobe', editIcon: 'fa-shirt' };
        },

        // A new NPC's entry lists its wardrobe and names items from it in "outfit": give those names the wardrobe's slots.
        transformEntry(entry, { source }) {
            if (source !== 'tracker' || !Array.isArray(entry.wardrobe) || !entry.outfit) return undefined;
            const listed = addItems([], entry.wardrobe).items;
            const fix = (x) => {
                if (typeof x !== 'string') return x;
                const it = listed.find(i => normalize(i.name) === normalize(x) || i.id === String(x).trim().toLowerCase());
                return it ? { name: it.name, slots: it.slots } : x;
            };
            const o = entry.outfit;
            if (Array.isArray(o)) return { ...entry, outfit: o.map(fix) };
            if (typeof o === 'string') return { ...entry, outfit: [fix(o)] };
            if (o && typeof o === 'object' && Array.isArray(o.wear)) return { ...entry, outfit: { ...o, wear: o.wear.map(fix) } };
            return undefined;
        },
        entryKeys: ['wardrobe'],

        // A new NPC: its listed wardrobe, plus anything it wears that the list forgot.
        fromTracker(entry, template) {
            let { items } = addItems([], entry.wardrobe);
            items = addItems(items, (template.outfit || []).map(w => ({ id: w.id, name: w.name, slots: w.slots }))).items;
            return items.length ? { items } : null;
        },

        // New clothing from the story joins this chat's wardrobe: worn items it does not own yet (and any "wardrobe" list).
        onTrackerEntry({ kind, source, entry, data, instance, user }) {
            const s = settings();
            if (kind === 'char') {
                if (source === 'tracker' && !s.allowGrowth) return undefined;
                const have = itemsOf(data, instance);
                const worn = resolveOutfit(instance.outfit, instance.wardrobe || []);
                const r = addItems(have, [...(source === 'tracker' && Array.isArray(entry.wardrobe) ? entry.wardrobe : []), ...worn.map(w => ({ id: w.id, name: w.name, slots: w.slots }))]);
                return r.added.length ? { ...(data || {}), items: r.items } : undefined;
            }
            if (kind === 'user' && source === 'greeting' && user) {
                const have = itemsOf(data, api.getSettings().personas?.[user.persona] || null);
                const r = addItems(have, (user.outfit || []).filter(w => w?.name).map(w => ({ id: w.id, name: w.name, slots: w.slots })));
                return r.added.length ? { ...(data || {}), items: r.items } : undefined;
            }
            return undefined;
        },

        // What the AI is told: the wardrobe of everyone in the scene (also for older data, hence sceneXmlAlways).
        sceneXmlAlways: true,
        sceneXml({ kind, data, instance, subject }) {
            if (!settings().includeWardrobe || !api.getSettings().trackOutfits) return '';
            const items = itemsOf(data, kind === 'user' ? subject : instance);
            if (!items.length) return '';
            return `<wardrobe>${xt(items.map(i => `${i.id} = ${i.name} [${(i.slots || []).map(k => SLOT_LABEL[k] || k).join(', ')}]${i.note ? ` (${i.note})` : ''}`).join('; '))}</wardrobe>`;
        },
        instructions() {
            const s = settings();
            if (!api.getSettings().trackOutfits) return '';
            if (!s.enforce) return 'Wardrobes:\n- A character\'s <wardrobe> lists the clothing they own; prefer it when they change.\n- A new character also gets "wardrobe": 4-8 items that fit their role, as [{"name": "...", "slots": ["..."]}].';
            return String(s.rules || '').replaceAll('[[GROWTH_RULE]]', s.allowGrowth ? DEFAULT_GROWTH_RULE : '');
        },
    });
    mountSettings(api);
}
