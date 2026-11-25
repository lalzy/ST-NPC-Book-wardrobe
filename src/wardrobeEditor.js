// Wardrobe editor widget: item list grouped by slot, search, filters, inline item editor, bulk actions, quick add.
// (Moved from NPC Book. What a character wears now, and their starting outfit, is NPC Book's paperdoll.)

import { SLOTS, SLOT_LABEL, clone, esc, inferSlots, normalize, uniqueId } from './host.js';

const wardrobeUi = new Map(); // per owner (NPC id / persona key), this session: { open: Set<slot> } of unfolded groups
const GROUP_FOLD = 5;
export const SLOT_SHORT = { head: 'Head', hair: 'Hair', face: 'Face', glasses: 'Glasses', piercings: 'Piercings', neck: 'Neck', cover: 'Cover', upper_outer: 'Upper', upper_inner: 'Upper inner', hands: 'Hands', waist: 'Waist', lower_outer: 'Lower', lower_inner: 'Lower inner', feet_outer: 'Feet', feet_inner: 'Feet inner', other: 'Other' };
const slotIndex = (k) => SLOTS.findIndex(x => x.key === k);
const primarySlot = (item) => [...(item.slots || [])].sort((a, b) => slotIndex(a) - slotIndex(b))[0] || 'other';

/**
 * Wardrobe editor. Mutates data = { items: [] } in place. Returns { refresh }.
 * onChange(data) is called after every change (e.g. to update a count).
 */
export function mountWardrobe(host, data, { key = '', onChange } = {}) {
    if (!Array.isArray(data.items)) data.items = [];
    if (!wardrobeUi.has(key)) wardrobeUi.set(key, { open: new Set() });
    const ui = wardrobeUi.get(key);
    const st = { q: '', slot: '', sort: 'slot', expanded: null, selected: new Set() };
    host.html(`<div class="npcb-wdx npcb-doll-collapsed npcb-wdx-nostart">
        <div class="npcb-wdx-list">
            <div class="npcb-wdx-tb">
                <input type="search" class="text_pole npcb-wdx-q" placeholder="Search…">
                <select class="text_pole npcb-wdx-slot"><option value="">All slots</option>${SLOTS.map(x => `<option value="${x.key}">${esc(x.label)}</option>`).join('')}</select>
                <select class="text_pole npcb-wdx-sort"><option value="slot">By slot</option><option value="name">By name</option><option value="recent">Newest</option></select>
            </div>
            <div class="npcb-wdx-rows"></div>
            <div class="npcb-wdx-bulk" style="display:none"></div>
            <div class="npcb-wdx-add"><i class="fa-solid fa-plus"></i><input class="text_pole npcb-wdx-new" placeholder="New item… (Enter)"><small class="npcb-dim npcb-wdx-newslot"></small></div>
        </div>
    </div>`);
    const root = host.find('.npcb-wdx');
    const byId = (id) => data.items.find(i => i.id === id);
    const changed = () => onChange?.(data);
    const removeIds = (ids) => {
        data.items = data.items.filter(i => !ids.has(i.id));
        for (const id of ids) st.selected.delete(id);
        if (ids.has(st.expanded)) st.expanded = null;
    };
    const rowHtml = (it) => {
        const sel = st.selected.has(it.id);
        const open = st.expanded === it.id;
        return `<div class="npcb-wdx-row ${open ? 'exp' : ''} ${sel ? 'sel' : ''}" data-item="${esc(it.id)}">
            <input type="checkbox" class="npcb-wdx-pick" ${sel ? 'checked' : ''} title="Select">
            <span class="npcb-wdx-name">${esc(it.name)}</span>
            ${it.note ? `<i class="fa-solid fa-note-sticky npcb-dim" title="${esc(it.note)}"></i>` : ''}
            <span class="npcb-wdx-badges">${it.slots.map(k => `<span class="npcb-wdx-badge">${esc(SLOT_SHORT[k] || k)}</span>`).join('')}</span>
            <i class="fa-solid fa-ellipsis npcb-wdx-dots" title="Edit"></i>
        </div>${open ? `<div class="npcb-wdx-ed" data-item="${esc(it.id)}">
            <div class="npcb-wdx-edmain">
                <label>Name<input class="text_pole npcb-wdx-edname" value="${esc(it.name)}"></label>
                <label>Note <small class="npcb-dim">(optional, sent to the LLM)</small><input class="text_pole npcb-wdx-ednote" value="${esc(it.note || '')}" placeholder="e.g. only worn for festivals"></label>
                <div class="npcb-row"><div class="menu_button npcb-wdx-dup"><i class="fa-solid fa-clone"></i> Duplicate</div><div class="menu_button redWarningBG npcb-wdx-del"><i class="fa-solid fa-trash-can"></i> Delete</div><small class="npcb-dim">id: ${esc(it.id)}</small></div>
            </div>
            <div><div class="npcb-wdx-sec">Covers</div><div class="npcb-wdx-mini">${SLOTS.map(x => `<div class="npcb-wdx-mc ${it.slots.includes(x.key) ? 'on' : ''}" data-slot="${x.key}" style="grid-area:${x.key}">${esc(x.label)}</div>`).join('')}</div></div>
        </div>` : ''}`;
    };
    const drawRows = () => {
        const q = normalize(st.q);
        const filtering = !!(q || st.slot);
        let items = data.items.filter(i => (!st.slot || i.slots.includes(st.slot)) && (!q || normalize(`${i.name} ${i.note || ''}`).includes(q)));
        let html = '';
        if (!data.items.length) html = '<div class="npcb-empty">No clothing yet. Add items below, or use ✨ Generate.</div>';
        else if (!items.length) html = '<div class="npcb-empty">No matching items.</div>';
        else if (st.sort === 'slot') {
            for (const x of SLOTS) {
                const group = items.filter(i => primarySlot(i) === x.key);
                if (!group.length) continue;
                const foldable = !filtering && group.length > GROUP_FOLD + 1;
                const open = !foldable || ui.open.has(x.key) || group.slice(GROUP_FOLD).some(i => i.id === st.expanded);
                html += `<div class="npcb-wdx-grp">${esc(x.label)} · ${group.length}</div>${(open ? group : group.slice(0, GROUP_FOLD)).map(rowHtml).join('')}`;
                if (foldable) html += `<div class="npcb-wdx-more" data-slot="${x.key}">${open ? '▴ Show less' : `▸ ${group.length - GROUP_FOLD} more`}</div>`;
            }
        } else {
            items = st.sort === 'name' ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : [...items].reverse();
            html = items.map(rowHtml).join('');
        }
        root.find('.npcb-wdx-rows').html(html);
        const n = st.selected.size;
        root.find('.npcb-wdx-bulk').toggle(n > 0).html(n ? `<b>${n} selected</b><span class="npcb-spacer"></span>
            <select class="text_pole npcb-wdx-bulkslot"><option value="">Set slot…</option>${SLOTS.map(x => `<option value="${x.key}">${esc(x.label)}</option>`).join('')}</select>
            <div class="menu_button redWarningBG npcb-wdx-bulkdel"><i class="fa-solid fa-trash-can"></i></div>
            <div class="menu_button npcb-wdx-bulkclear" title="Clear selection"><i class="fa-solid fa-xmark"></i></div>` : '');
        root.find('.npcb-wdx-newslot').text(`slot: ${st.slot ? SLOT_LABEL[st.slot] : 'auto'}`);
    };
    const itemOf = (el) => byId($(el).closest('[data-item]').data('item'));

    host.off('.wdx');
    host.on('input.wdx', '.npcb-wdx-q', (e) => { st.q = String(e.target.value); drawRows(); });
    host.on('change.wdx', '.npcb-wdx-slot', (e) => { st.slot = String(e.target.value); drawRows(); });
    host.on('change.wdx', '.npcb-wdx-sort', (e) => { st.sort = String(e.target.value); drawRows(); });
    host.on('click.wdx', '.npcb-wdx-more', (e) => {
        const k = $(e.currentTarget).data('slot');
        if (ui.open.has(k)) ui.open.delete(k); else ui.open.add(k);
        drawRows();
    });
    host.on('click.wdx', '.npcb-wdx-row', (e) => {
        if ($(e.target).is('.npcb-wdx-pick')) return;
        const id = $(e.currentTarget).data('item');
        st.expanded = st.expanded === id ? null : id;
        drawRows();
    });
    host.on('change.wdx', '.npcb-wdx-pick', (e) => {
        const it = itemOf(e.target);
        if (!it) return;
        if (e.target.checked) st.selected.add(it.id); else st.selected.delete(it.id);
        drawRows();
    });
    host.on('input.wdx', '.npcb-wdx-edname', (e) => {
        const it = itemOf(e.target);
        if (!it) return;
        it.name = String(e.target.value);
        root.find('.npcb-wdx-row').filter((_, el) => $(el).data('item') === it.id).find('.npcb-wdx-name').text(it.name);
        changed();
    });
    host.on('input.wdx', '.npcb-wdx-ednote', (e) => { const it = itemOf(e.target); if (it) { it.note = String(e.target.value).trim(); changed(); } });
    host.on('click.wdx', '.npcb-wdx-mc', (e) => {
        const it = itemOf(e.target);
        if (!it) return;
        const k = $(e.currentTarget).data('slot');
        it.slots = it.slots.includes(k) ? it.slots.filter(x => x !== k) : [...it.slots, k].sort((a, b) => slotIndex(a) - slotIndex(b));
        if (!it.slots.length) it.slots = [k];
        drawRows(); changed();
    });
    host.on('click.wdx', '.npcb-wdx-dup', (e) => {
        const it = itemOf(e.target);
        if (!it) return;
        const copy = { ...clone(it), id: uniqueId(it.id, x => !!byId(x)), name: `${it.name} (copy)` };
        data.items.splice(data.items.indexOf(it) + 1, 0, copy);
        st.expanded = copy.id;
        drawRows(); changed();
    });
    host.on('click.wdx', '.npcb-wdx-del', (e) => {
        const it = itemOf(e.target);
        if (!it) return;
        removeIds(new Set([it.id]));
        drawRows(); changed();
    });
    host.on('change.wdx', '.npcb-wdx-bulkslot', (e) => {
        const k = String(e.target.value);
        if (!k) return;
        for (const id of st.selected) { const it = byId(id); if (it) it.slots = [k]; }
        drawRows(); changed();
    });
    host.on('click.wdx', '.npcb-wdx-bulkdel', () => { removeIds(new Set(st.selected)); drawRows(); changed(); });
    host.on('click.wdx', '.npcb-wdx-bulkclear', () => { st.selected.clear(); drawRows(); });
    host.on('keydown.wdx', '.npcb-wdx-new', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const name = String($(e.target).val() ?? '').trim();
        if (!name) return;
        const item = { id: uniqueId(name, x => !!byId(x)), name, slots: st.slot ? [st.slot] : inferSlots(name), note: '' };
        data.items.push(item);
        st.expanded = item.id; // open it, so the guessed slots can be checked right away
        $(e.target).val('');
        drawRows(); changed();
        root.find('.npcb-wdx-row').filter((_, el) => $(el).data('item') === item.id)[0]?.scrollIntoView({ block: 'nearest' });
    });
    drawRows();
    return { refresh: drawRows };
}
