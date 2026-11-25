// ✨ Generate: the LLM suggests wardrobe items for a character (moved from NPC Book's Assist panel).

import { SLOTS, ctx, esc, inferSlots, normalize, normalizeSlots, parseJson, uniqueId } from './host.js';
import { settings } from './settings.js';
import { SLOT_SHORT } from './wardrobeEditor.js';

/** Character facts for the prompt: an NPC card / instance, or the persona. */
function characterLines(who) {
    const out = [];
    if (who?.name) out.push(`Name: ${who.name}`);
    const traits = Object.entries(who?.traits || {}).filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => `${k}: ${v}`).join('; ');
    if (traits) out.push(`Identity: ${traits}`);
    for (const [k, label] of [['height', 'Height'], ['description', 'Description'], ['details', 'Details']]) if (String(who?.[k] ?? '').trim()) out.push(`${label}: ${String(who[k]).trim()}`);
    return out;
}

function buildPrompt(st, data, who, refine) {
    const existing = data.items.map(i => `${i.name} [${i.slots.join(', ')}]`);
    const lines = ['CHARACTER', ...(characterLines(who).length ? characterLines(who) : ['(no details yet)']), ''];
    if (st.mode === 'add' && existing.length) lines.push('ALREADY IN THE WARDROBE (do not repeat these)', existing.join('; '), '');
    if (refine) lines.push('YOUR PREVIOUS ANSWER', JSON.stringify({ items: st.result.map(({ name, slots, note }) => ({ name, slots, note })) }), '', 'CHANGE REQUEST', st.prompt.trim());
    else lines.push('REQUEST', st.prompt.trim() || '(no extra wishes: a practical, fitting everyday wardrobe)');
    lines.push('', `Suggest about ${Math.max(1, Number(st.count) || 8)} items.`);
    if (st.cover) lines.push('Make sure the set includes underwear (upper_inner, lower_inner), something to sleep in, and footwear.');
    lines.push(`Valid slots: ${SLOTS.map(x => x.key).join(', ')}.`, '', 'Answer with exactly this JSON shape:', JSON.stringify({ items: [{ name: 'Green wool dress', slots: ['upper_outer', 'lower_outer'], note: 'optional, short' }] }, null, 2));
    return { systemPrompt: settings().assistPrompt, prompt: lines.join('\n') };
}

function readAnswer(text, data) {
    const json = parseJson(String(text ?? '').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, ''));
    const raw = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : null;
    if (!raw) throw new Error('the answer had no "items" list');
    const owned = new Set(data.items.map(i => normalize(i.name)));
    const items = [];
    for (const r of raw) {
        const name = String(typeof r === 'string' ? r : r?.name ?? '').trim();
        if (!name || items.some(x => normalize(x.name) === normalize(name))) continue;
        const slots = (r?.slots ?? r?.slot) ? normalizeSlots(r.slots ?? r.slot) : inferSlots(name);
        items.push({ name, slots, note: String(r?.note ?? '').trim(), take: !owned.has(normalize(name)) });
    }
    if (!items.length) throw new Error('the answer had no items');
    return items;
}

/**
 * Mount the generator above a wardrobe editor. `data` = { items } (the draft the editor edits), `who` = character facts,
 * `onApply()` redraws the editor after items were added.
 */
export function mountGenerator(host, data, who, onApply) {
    const st = { open: false, busy: false, run: null, count: 8, mode: 'add', cover: true, prompt: '', result: null };
    const draw = () => {
        if (!st.open) { host.html('<div class="menu_button npcbw-gen-open" style="width:fit-content"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate items</div>'); return; }
        const owned = new Set(data.items.map(i => normalize(i.name)));
        const n = st.result ? st.result.filter(x => x.take).length : 0;
        host.html(`<div class="npcb-as-prop npcbw-gen">
            <div class="npcb-row"><b><i class="fa-solid fa-wand-magic-sparkles"></i> Generate wardrobe items</b><span class="npcb-spacer"></span><div class="menu_button npcbw-gen-close" title="Close"><i class="fa-solid fa-xmark"></i></div></div>
            <div class="npcb-row">
                <label>Items <input type="number" min="1" max="30" class="text_pole npcbw-opt" data-opt="count" value="${st.count}" style="width:5em"></label>
                <label>Mode <select class="text_pole npcbw-opt" data-opt="mode"><option value="add" ${st.mode === 'add' ? 'selected' : ''}>Add to wardrobe</option><option value="replace" ${st.mode === 'replace' ? 'selected' : ''}>Replace wardrobe</option></select></label>
                <label class="checkbox_label"><input type="checkbox" class="npcbw-opt" data-opt="cover" ${st.cover ? 'checked' : ''}> Cover the basics</label>
            </div>
            ${st.result ? st.result.map((it, i) => `<div class="npcb-as-item" data-i="${i}">
                <div class="npcb-row"><input type="checkbox" class="npcbw-take" ${it.take ? 'checked' : ''}><input class="text_pole npcbw-iname" value="${esc(it.name)}">${owned.has(normalize(it.name)) ? '<span class="npcb-as-owned">already owned</span>' : ''}</div>
                <div class="npcb-as-slots open">${SLOTS.map(x => `<span class="npcb-chip ${it.slots.includes(x.key) ? 'on' : ''}" data-slot="${x.key}">${esc(SLOT_SHORT[x.key])}</span>`).join('')}</div>
                ${it.note ? `<small class="npcb-dim">${esc(it.note)}</small>` : ''}
            </div>`).join('') : '<small class="npcb-dim">Describe the style you want and press Generate. The character\'s details are used as context.</small>'}
            <textarea class="text_pole npcbw-prompt" rows="2" placeholder="Describe what you want…">${esc(st.prompt)}</textarea>
            <div class="npcb-row">
                ${st.busy ? '<div class="menu_button npcbw-stop"><i class="fa-solid fa-stop"></i> Stop</div>' : '<div class="menu_button npcbw-gen"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate</div>'}
                ${st.result && !st.busy ? '<div class="menu_button npcbw-refine" title="Change the last answer according to your prompt"><i class="fa-solid fa-rotate"></i> Refine</div>' : ''}
                <span class="npcb-spacer"></span>
                ${st.result && !st.busy ? `<div class="menu_button npcbw-apply">${st.mode === 'replace' ? 'Replace with' : 'Add'} ${n} item${n === 1 ? '' : 's'}</div>` : ''}
            </div>
            <small class="npcb-dim">Items go into the wardrobe below; nothing is saved until you press Save.</small>
        </div>`);
    };
    const run = async (refine) => {
        if (st.busy) return;
        if (refine && !st.prompt.trim()) { toastr.info('Write what to change in the prompt box, then press Refine.', 'NPC Book — Wardrobe'); return; }
        const me = {};
        st.run = me; st.busy = true; draw();
        try {
            const { systemPrompt, prompt } = buildPrompt(st, data, who(), refine);
            const answer = await ctx().generateRaw({ systemPrompt, prompt });
            if (st.run !== me) return;
            st.result = readAnswer(answer, data);
        } catch (e) {
            if (st.run !== me) return;
            console.warn('[NPC Book — Wardrobe] generate failed', e);
            toastr.error(`Generate failed: ${e?.message || e}`, 'NPC Book — Wardrobe');
        } finally {
            if (st.run === me) { st.run = null; st.busy = false; draw(); }
        }
    };
    host.off('.npcbw');
    host.on('click.npcbw', '.npcbw-gen-open', () => { st.open = true; draw(); });
    host.on('click.npcbw', '.npcbw-gen-close', () => { st.open = false; draw(); });
    host.on('input.npcbw change.npcbw', '.npcbw-opt', (e) => {
        const k = $(e.target).data('opt');
        st[k] = e.target.type === 'checkbox' ? e.target.checked : k === 'count' ? Number(e.target.value) : String(e.target.value);
        if (k === 'mode' && st.result) draw();
    });
    host.on('input.npcbw', '.npcbw-prompt', (e) => { st.prompt = String(e.target.value); });
    host.on('click.npcbw', '.npcbw-gen', () => run(false));
    host.on('click.npcbw', '.npcbw-refine', () => run(true));
    host.on('click.npcbw', '.npcbw-stop', () => { st.run = null; st.busy = false; try { ctx().stopGeneration?.(); } catch { /* ignore */ } draw(); });
    const itemAt = (el) => st.result?.[Number($(el).closest('.npcb-as-item').data('i'))];
    host.on('change.npcbw', '.npcbw-take', (e) => { const it = itemAt(e.target); if (it) { it.take = e.target.checked; draw(); } });
    host.on('input.npcbw', '.npcbw-iname', (e) => { const it = itemAt(e.target); if (it) it.name = String(e.target.value); });
    host.on('click.npcbw', '.npcb-as-slots .npcb-chip[data-slot]', (e) => {
        const it = itemAt(e.target);
        if (!it) return;
        const k = $(e.currentTarget).data('slot');
        it.slots = it.slots.includes(k) ? it.slots.filter(x => x !== k) : [...it.slots, k];
        if (!it.slots.length) it.slots = [k];
        $(e.currentTarget).toggleClass('on', it.slots.includes(k));
    });
    host.on('click.npcbw', '.npcbw-apply', () => {
        if (!st.result) return;
        if (st.mode === 'replace') data.items.splice(0, data.items.length);
        let n = 0;
        for (const it of st.result) {
            if (!it.take || !it.name.trim() || data.items.some(x => normalize(x.name) === normalize(it.name))) continue;
            data.items.push({ id: uniqueId(it.name, x => data.items.some(y => y.id === x)), name: it.name.trim(), slots: it.slots.length ? it.slots : ['other'], note: it.note });
            n++;
        }
        st.result = null;
        draw();
        onApply?.();
        toastr.success(`${st.mode === 'replace' ? 'Wardrobe replaced' : 'Added'}: ${n} item${n === 1 ? '' : 's'}. Press Save to keep them.`, 'NPC Book — Wardrobe');
    });
    draw();
}
