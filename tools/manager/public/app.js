// Vanilla JS, no framework — this is a small internal tool, not worth a build step.
// Rendering model: full re-render of #main on structural changes (tab switch, add/remove,
// drag-reorder, toggles). Text inputs mutate `draft` in place on 'input' without
// re-rendering, so focus/caret position survive typing; only the header (save dot/button)
// is refreshed after each keystroke.

const clone = (x) => JSON.parse(JSON.stringify(x));
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let loaded = null; // last known on-disk state
let draft = null; // working copy
let pendingByPath = new Map(); // path -> dataURL, for photos not yet written to disk
let ui = { tab: 'collections', activeCollectionId: null, selectedPhotoPath: null, lang: 'en', faqLang: 'en' };
let dragState = null; // { kind, idx }
let currentPhotoList = []; // the exact ordered list currently rendered as the photo grid
let currentFeaturedList = [];

const $main = document.getElementById('main');
const $tabs = document.getElementById('tabs');

async function boot() {
  const res = await fetch('/api/state');
  loaded = await res.json();
  draft = clone(loaded);
  render();
}

function isDirty() {
  return pendingByPath.size > 0 || JSON.stringify(draft) !== JSON.stringify(loaded);
}

function refreshHeader() {
  const dirty = isDirty();
  document.getElementById('save-dot').className = `dot ${dirty ? 'dirty' : 'clean'}`;
  document.getElementById('save-label').textContent = dirty ? 'Unsaved changes' : 'No changes';
  document.getElementById('write-btn').disabled = !dirty;
}

function render() {
  renderTabs();
  renderMain();
  refreshHeader();
}

function renderTabs() {
  const tabs = [
    ['collections', 'Collections'],
    ['featured', 'Featured'],
    ['testimonials', 'Testimonials'],
    ['pricing', 'Pricing & FAQ'],
  ];
  $tabs.innerHTML = tabs
    .map(([id, label]) => `<button data-act="tab" data-id="${id}" class="${ui.tab === id ? 'active' : ''}">${label}</button>`)
    .join('');
}

function renderMain() {
  if (ui.tab === 'collections') return ui.activeCollectionId ? renderCollectionDetail() : renderCollectionsList();
  if (ui.tab === 'featured') return renderFeatured();
  if (ui.tab === 'testimonials') return renderTestimonials();
  if (ui.tab === 'pricing') return renderPricing();
}

// ---------- helpers ----------

function coverPath(colId) {
  const imgs = draft.images.filter((im) => im.collections.includes(colId));
  const featured = imgs.find((im) => im.collections.includes('featured'));
  return (featured || imgs[0] || {}).path;
}

function thumbSrc(path) {
  if (pendingByPath.has(path)) return pendingByPath.get(path);
  return `/thumb?path=${encodeURIComponent(path)}`;
}

function metaOf(id) {
  if (!draft.meta[id]) draft.meta[id] = { category: { en: '', pl: '' }, location: { en: '', pl: '' }, year: new Date().getFullYear() };
  return draft.meta[id];
}

function locText(loc, lang) {
  return (loc && loc[lang]) || '';
}

/** Substitutes `newOrder` (same items, reordered) back into `list` at the slots matching `predicate`. */
function reorderSubsequence(list, predicate, newOrder) {
  const queue = [...newOrder];
  return list.map((item) => (predicate(item) ? queue.shift() : item));
}

function moveItem(arr, fromIdx, toIdx) {
  const copy = arr.slice();
  const [item] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, item);
  return copy;
}

// ---------- Collections: list ----------

function renderCollectionsList() {
  const rows = draft.collections
    .map((c, i) => {
      const home = Boolean(metaOf(c.id).home);
      const title = (metaOf(c.id).name && metaOf(c.id).name[ui.lang]) || c.name;
      const count = draft.images.filter((im) => im.collections.includes(c.id)).length;
      const cat = locText(metaOf(c.id).category, ui.lang);
      return `
      <div class="col-row" draggable="true" data-drag="col:${i}">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <img class="cover-thumb" src="${thumbSrc(coverPath(c.id) || '')}" onerror="this.style.visibility='hidden'">
        <button class="label" data-act="open-col" data-id="${c.id}">
          <span class="name">${escapeHtml(title)}</span>
          <span class="sub">${escapeHtml(cat)}${cat ? ' · ' : ''}${count} photos</span>
        </button>
        <button class="home-toggle" data-act="toggle-home" data-id="${c.id}">
          <span class="txt">${home ? 'On home' : 'Off home'}</span>
          <span class="switch ${home ? 'on' : ''}"><span class="knob"></span></span>
        </button>
      </div>`;
    })
    .join('');

  const homeSlots = draft.collections
    .filter((c) => metaOf(c.id).home)
    .slice(0, 4)
    .map(
      (c, i) => `
      <div>
        <img class="cover-thumb" style="width:100%" src="${thumbSrc(coverPath(c.id) || '')}">
        <div style="font:700 13px 'Archivo',sans-serif;text-transform:uppercase;margin-top:6px">0${i + 1} ${escapeHtml(((metaOf(c.id).name || {})[ui.lang]) || c.name)}</div>
      </div>`
    )
    .join('');

  $main.innerHTML = `
    <span class="eyebrow">Series</span>
    <h1 class="title">Collections</h1>
    <div class="flex-split">
      <div class="main-col">
        ${rows}
        <p class="hint" style="margin-top:20px">Drag to set the Works page order. Series switched "on home" fill the homepage grid, first four.</p>
      </div>
      <aside>
        <span class="eyebrow">On the homepage</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${homeSlots || '<p class="hint">None yet.</p>'}</div>
        <div style="border-top:1px solid var(--line);padding-top:18px">
          <span class="eyebrow">New series</span>
          <div class="new-col-row">
            <input type="text" id="new-col-id" placeholder="collection-id">
            <button class="ghost" data-act="add-collection">Add</button>
          </div>
        </div>
      </aside>
    </div>`;
}

function addCollection() {
  const input = document.getElementById('new-col-id');
  const id = (input.value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (!id) return;
  if (draft.collections.some((c) => c.id === id)) {
    showToast('That id already exists');
    return;
  }
  draft.collections.push({ id, name: id });
  metaOf(id);
  render();
}

// ---------- Collections: detail (photo grid + editor) ----------

function renderCollectionDetail() {
  const id = ui.activeCollectionId;
  const col = draft.collections.find((c) => c.id === id);
  if (!col) {
    ui.activeCollectionId = null;
    return renderCollectionsList();
  }
  currentPhotoList = draft.images.filter((im) => im.collections.includes(id));
  const cells = currentPhotoList
    .map((im, i) => {
      const featured = im.collections.includes('featured');
      const isNew = pendingByPath.has(im.path);
      return `
      <figure draggable="true" data-drag="photo:${i}">
        <div class="photo-box ${ui.selectedPhotoPath === im.path ? 'selected' : ''}" data-act="select-photo" data-path="${escapeHtml(im.path)}">
          <img src="${thumbSrc(im.path)}" loading="lazy">
          <span class="badge num">${String(i + 1).padStart(2, '0')}</span>
          ${featured ? '<span class="badge feat">Featured</span>' : ''}
          ${isNew ? '<span class="badge" style="right:6px;bottom:6px">new</span>' : ''}
        </div>
        <figcaption>${escapeHtml(im.path.split('/').pop())}</figcaption>
      </figure>`;
    })
    .join('');

  const sel = ui.selectedPhotoPath ? draft.images.find((im) => im.path === ui.selectedPhotoPath) : null;
  const aside = sel ? renderPhotoEditor(sel) : renderCollectionEditor(id);

  $main.innerHTML = `
    <span class="eyebrow">Series</span>
    <h1 class="title">${escapeHtml((metaOf(id).name && metaOf(id).name[ui.lang]) || col.name)}</h1>
    <div class="flex-split">
      <div class="main-col">
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:16px">
          <button class="ghost" data-act="back-to-list">← All series</button>
          <span class="hint">Drag to reorder. Photos shared with other series keep their place there.</span>
        </div>
        <div class="photo-grid">
          ${cells}
          <label class="dropzone">
            <input type="file" multiple accept="image/jpeg" style="display:none" data-act="pick-files">
            <span class="plus">+</span>
            <span style="font:700 13px 'Archivo',sans-serif;text-transform:uppercase">Drop photos</span>
            <span class="hint">Added to ${escapeHtml(id)}</span>
          </label>
        </div>
      </div>
      <aside>${aside}</aside>
    </div>`;
}

function renderCollectionEditor(id) {
  const m = metaOf(id);
  const col = draft.collections.find((c) => c.id === id);
  const name = (m.name && m.name[ui.lang]) || col.name;
  const category = locText(m.category, ui.lang);
  const location = locText(m.location, ui.lang);
  const description = locText(m.description, ui.lang);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span class="eyebrow">Series details</span>
      ${langToggle('lang')}
    </div>
    <p class="hint">Pick a photo to edit it instead.</p>
    <label class="field"><span class="lbl">Title</span><input type="text" data-bind="meta.${id}.name.${ui.lang}" value="${escapeHtml(name)}"></label>
    <label class="field"><span class="lbl">Category</span><input type="text" data-bind="meta.${id}.category.${ui.lang}" value="${escapeHtml(category)}"></label>
    <label class="field"><span class="lbl">Location</span><input type="text" data-bind="meta.${id}.location.${ui.lang}" value="${escapeHtml(location)}"></label>
    <label class="field"><span class="lbl">Year</span><input type="number" data-bind="meta.${id}.year" value="${m.year || ''}"></label>
    <label class="field"><span class="lbl">Description</span><textarea data-bind="meta.${id}.description.${ui.lang}">${escapeHtml(description)}</textarea></label>`;
}

function renderPhotoEditor(im) {
  const desc = typeof im.description === 'string' ? im.description : (im.description && im.description[ui.lang]) || '';
  const featured = im.collections.includes('featured');
  const tags = draft.collections
    .map(
      (c) => `<button class="chip ${im.collections.includes(c.id) ? 'on' : ''}" data-act="toggle-tag" data-path="${escapeHtml(im.path)}" data-tag="${c.id}">${escapeHtml(c.name)}</button>`
    )
    .join('');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span class="eyebrow">Photograph</span>
      <button class="chip" data-act="deselect-photo">Close</button>
    </div>
    <img src="${thumbSrc(im.path)}" style="width:100%;aspect-ratio:4/5;object-fit:cover">
    <div style="font:700 16px 'Archivo',sans-serif;word-break:break-all">${escapeHtml(im.path)}</div>
    <div>
      <span class="lbl" style="font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)">In series</span>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${tags}</div>
    </div>
    <button class="home-toggle" data-act="toggle-featured" data-path="${escapeHtml(im.path)}" style="border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:14px 0">
      <span class="txt" style="flex:1;text-align:left;font:700 13px 'Archivo',sans-serif;text-transform:uppercase">Featured</span>
      <span class="switch ${featured ? 'on' : ''}"><span class="knob"></span></span>
    </button>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span class="lbl" style="font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)">Description</span>
      ${langToggle('lang')}
    </div>
    <textarea data-bind-desc="${escapeHtml(im.path)}" placeholder="Optional">${escapeHtml(desc)}</textarea>`;
}

function langToggle(field) {
  return `<span class="langsel">
    <button data-act="set-${field}" data-val="en" class="${ui[field] === 'en' ? 'active' : ''}">EN</button>
    <span style="color:var(--line)">/</span>
    <button data-act="set-${field}" data-val="pl" class="${ui[field] === 'pl' ? 'active' : ''}">PL</button>
  </span>`;
}

function handleFiles(fileList) {
  const id = ui.activeCollectionId;
  [...fileList].forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const relPath = `${id}/${file.name}`;
      if (draft.images.some((im) => im.path === relPath)) {
        showToast(`${file.name} already exists in ${id}`);
        return;
      }
      pendingByPath.set(relPath, dataUrl);
      draft.images.push({ path: relPath, collections: [id] });
      render();
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Featured ----------

function renderFeatured() {
  currentFeaturedList = draft.images.filter((im) => im.collections.includes('featured'));
  const strip = currentFeaturedList
    .map(
      (im, i) => `
      <figure draggable="true" data-drag="featured:${i}">
        <div class="photo-box"><img src="${thumbSrc(im.path)}" loading="lazy"><span class="badge num">${i < 9 ? 'home ' : ''}${String(i + 1).padStart(2, '0')}</span></div>
        <figcaption>${escapeHtml(im.path)}</figcaption>
      </figure>`
    )
    .join('');

  const covers = draft.collections
    .map((c) => {
      const cp = coverPath(c.id);
      const title = (metaOf(c.id).name && metaOf(c.id).name[ui.lang]) || c.name;
      return `
      <button class="ghost" style="all:unset;cursor:pointer;display:grid;grid-template-columns:56px 1fr;gap:14px;align-items:center;padding:10px;border:1px solid var(--line)" data-act="open-col" data-id="${c.id}">
        <img class="cover-thumb" style="width:56px" src="${thumbSrc(cp || '')}">
        <div><div style="font:700 15px 'Archivo',sans-serif;text-transform:uppercase">${escapeHtml(title)}</div></div>
      </button>`;
    })
    .join('');

  $main.innerHTML = `
    <span class="eyebrow">Home page</span>
    <h1 class="title">Featured</h1>
    <div style="display:flex;flex-direction:column;gap:56px">
      <div>
        <h3 style="font:800 clamp(22px,3vw,32px) 'Archivo',sans-serif;text-transform:uppercase;margin:0 0 16px">Hero strip</h3>
        <p class="hint">Every featured photo, in order. The homepage shows the first nine — drag to choose which.</p>
        <div class="photo-grid" style="margin-top:20px">${strip || '<p class="hint">No featured photos yet.</p>'}</div>
      </div>
      <div>
        <h3 style="font:800 clamp(22px,3vw,32px) 'Archivo',sans-serif;text-transform:uppercase;margin:0 0 16px">Series covers</h3>
        <p class="hint">Each cover is the series' first featured photo, or its first photo if none.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:20px">${covers}</div>
      </div>
    </div>`;
}

// ---------- Testimonials ----------

let newTestimonial = { type: 'quote', content: '', src: '', attribution: '', lang: 'en', date: new Date().toISOString().slice(0, 10), consent: false };

function renderTestimonials() {
  const rows = draft.testimonials
    .map(
      (t, i) => `
      <tr>
        <td><div style="font:700 15px 'Archivo',sans-serif;text-transform:uppercase">${escapeHtml(t.attribution || '(no name)')}</div>
        <div class="hint" style="margin-top:4px;max-width:44ch">${escapeHtml((t.content || t.src || '').slice(0, 140))}</div></td>
        <td>${escapeHtml(t.type)}</td>
        <td>${escapeHtml(t.lang || '')}</td>
        <td style="white-space:nowrap">${escapeHtml(t.date)}</td>
        <td><button class="chip ${t.consent ? 'on' : ''}" data-act="toggle-consent" data-idx="${i}">${t.consent ? 'Has consent' : 'No consent'}</button></td>
      </tr>`
    )
    .join('');

  $main.innerHTML = `
    <span class="eyebrow">Social proof</span>
    <h1 class="title">Testimonials</h1>
    <div class="flex-split">
      <div class="main-col">
        <p class="hint" style="margin-bottom:16px">Testimonials appear on the site once ${draft.testimonials.filter((t)=>t.consent).length >= 3 ? '' : 'at least '}three have consent.</p>
        <table>
          <thead><tr><th>From</th><th>Type</th><th>Lang</th><th>Date</th><th>Consent</th></tr></thead>
          <tbody>${rows || '<tr><td class="hint">None yet.</td></tr>'}</tbody>
        </table>
      </div>
      <aside>
        <span class="eyebrow">New testimonial</span>
        <span class="langsel">
          <button data-act="new-t-type" data-val="quote" class="${newTestimonial.type === 'quote' ? 'active' : ''}">Text</button>
          <span style="color:var(--line)">/</span>
          <button data-act="new-t-type" data-val="image" class="${newTestimonial.type === 'image' ? 'active' : ''}">Image</button>
        </span>
        ${
          newTestimonial.type === 'quote'
            ? `<label class="field"><span class="lbl">What they said</span><textarea data-nt="content">${escapeHtml(newTestimonial.content)}</textarea></label>`
            : `<label class="field"><span class="lbl">Image src</span><input type="text" data-nt="src" placeholder="/testimonials/screenshot.jpg" value="${escapeHtml(newTestimonial.src)}"></label>`
        }
        <label class="field"><span class="lbl">Attribution</span><input type="text" data-nt="attribution" placeholder="Name, context" value="${escapeHtml(newTestimonial.attribution)}"></label>
        <div style="display:flex;gap:16px;align-items:flex-end">
          <div><span class="lbl" style="display:block;margin-bottom:10px">Language</span>${langToggle('newTLang')}</div>
          <label class="field" style="flex:1;margin:0"><span class="lbl">Date</span><input type="date" data-nt="date" value="${newTestimonial.date}"></label>
        </div>
        <button class="home-toggle" data-act="toggle-new-t-consent" style="border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:12px 0">
          <span class="txt" style="flex:1;text-align:left">Client consented</span>
          <span class="switch ${newTestimonial.consent ? 'on' : ''}"><span class="knob"></span></span>
        </button>
        <button class="primary" data-act="save-testimonial" style="align-self:flex-start">Save testimonial →</button>
      </aside>
    </div>`;
}

// ---------- Pricing & FAQ ----------

function renderPricing() {
  const faqs = draft.faqs[ui.faqLang];
  const rows = faqs
    .map(
      (f, i) => `
      <div class="faq-row">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <div>
          <input type="text" data-faq="q" data-idx="${i}" value="${escapeHtml(f.q)}" placeholder="Question" style="font-weight:700;text-transform:uppercase;margin-bottom:8px">
          <textarea data-faq="a" data-idx="${i}" placeholder="Answer">${escapeHtml(f.a)}</textarea>
        </div>
        <button class="remove" data-act="remove-faq" data-idx="${i}" title="Remove">×</button>
      </div>`
    )
    .join('');

  $main.innerHTML = `
    <span class="eyebrow">Portraits from</span>
    <h1 class="title" style="margin-bottom:12px">Pricing</h1>
    <div class="price-row" style="margin-bottom:48px">
      <input type="number" id="price-input" value="${draft.pricing.portraitFrom}">
      <span style="font:italic 400 28px serif">${escapeHtml(draft.pricing.currency)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="font:800 clamp(22px,3vw,32px) 'Archivo',sans-serif;text-transform:uppercase;margin:0">Questions</h3>
      <div style="display:flex;gap:18px;align-items:center">${langToggle('faqLang')}<button class="ghost" data-act="add-faq">Add question</button></div>
    </div>
    ${rows}`;
}

// ---------- event delegation ----------

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (t) handleAction(t.dataset.act, t);
});

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-act="pick-files"]')) {
    handleFiles(e.target.files);
    return;
  }
  if (e.target.id === 'price-input') {
    draft.pricing.portraitFrom = Number(e.target.value) || 0;
    refreshHeader();
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.bind) {
    setByPath(draft, el.dataset.bind, el.value);
    refreshHeader();
  } else if (el.dataset.bindDesc) {
    const im = draft.images.find((i) => i.path === el.dataset.bindDesc);
    if (im) setDescription(im, el.value);
    refreshHeader();
  } else if (el.dataset.faq) {
    const faqs = draft.faqs[ui.faqLang];
    faqs[Number(el.dataset.idx)][el.dataset.faq] = el.value;
    refreshHeader();
  } else if (el.dataset.nt) {
    newTestimonial[el.dataset.nt] = el.value;
  } else if (el.id === 'price-input') {
    draft.pricing.portraitFrom = Number(el.value) || 0;
    refreshHeader();
  }
});

document.addEventListener('dragstart', (e) => {
  const d = e.target.closest('[data-drag]');
  if (!d) return;
  const [kind, idx] = d.dataset.drag.split(':');
  dragState = { kind, idx: Number(idx) };
});
document.addEventListener('dragover', (e) => {
  if (dragState && e.target.closest(`[data-drag^="${dragState.kind}:"]`)) e.preventDefault();
});
document.addEventListener('drop', (e) => {
  const d = e.target.closest('[data-drag]');
  if (!d || !dragState) return;
  const [kind, idx] = d.dataset.drag.split(':');
  if (kind !== dragState.kind) return;
  e.preventDefault();
  const toIdx = Number(idx);
  const fromIdx = dragState.idx;
  dragState = null;
  if (fromIdx === toIdx) return;
  if (kind === 'col') {
    draft.collections = moveItem(draft.collections, fromIdx, toIdx);
  } else if (kind === 'photo') {
    const reordered = moveItem(currentPhotoList, fromIdx, toIdx);
    const id = ui.activeCollectionId;
    draft.images = reorderSubsequence(draft.images, (im) => im.collections.includes(id), reordered);
  } else if (kind === 'featured') {
    const reordered = moveItem(currentFeaturedList, fromIdx, toIdx);
    draft.images = reorderSubsequence(draft.images, (im) => im.collections.includes('featured'), reordered);
  }
  render();
});

function setByPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  cur[last] = last === 'year' ? Number(value) || 0 : value;
}

function setDescription(im, text) {
  if (typeof im.description === 'object' && im.description) {
    im.description[ui.lang] = text;
  } else if (!text) {
    delete im.description;
  } else {
    im.description = text;
  }
}

function handleAction(act, t) {
  const id = t.dataset.id;
  const path = t.dataset.path;
  switch (act) {
    case 'tab':
      ui.tab = id;
      ui.activeCollectionId = null;
      ui.selectedPhotoPath = null;
      render();
      break;
    case 'open-col':
      ui.tab = 'collections';
      ui.activeCollectionId = id;
      ui.selectedPhotoPath = null;
      render();
      break;
    case 'back-to-list':
      ui.activeCollectionId = null;
      ui.selectedPhotoPath = null;
      render();
      break;
    case 'toggle-home': {
      const m = metaOf(id);
      m.home = !m.home;
      render();
      break;
    }
    case 'add-collection':
      addCollection();
      break;
    case 'select-photo':
      ui.selectedPhotoPath = ui.selectedPhotoPath === path ? null : path;
      render();
      break;
    case 'deselect-photo':
      ui.selectedPhotoPath = null;
      render();
      break;
    case 'toggle-tag': {
      const im = draft.images.find((i) => i.path === path);
      const tag = t.dataset.tag;
      const has = im.collections.includes(tag);
      im.collections = has ? im.collections.filter((c) => c !== tag) : [...im.collections, tag];
      render();
      break;
    }
    case 'toggle-featured': {
      const im = draft.images.find((i) => i.path === path);
      const has = im.collections.includes('featured');
      im.collections = has ? im.collections.filter((c) => c !== 'featured') : [...im.collections, 'featured'];
      render();
      break;
    }
    case 'set-lang':
      ui.lang = t.dataset.val;
      render();
      break;
    case 'set-faqLang':
      ui.faqLang = t.dataset.val;
      render();
      break;
    case 'set-newTLang':
      newTestimonial.lang = t.dataset.val;
      render();
      break;
    case 'add-faq':
      draft.faqs[ui.faqLang].push({ q: '', a: '' });
      render();
      break;
    case 'remove-faq':
      draft.faqs[ui.faqLang].splice(Number(t.dataset.idx), 1);
      render();
      break;
    case 'new-t-type':
      newTestimonial.type = t.dataset.val;
      render();
      break;
    case 'toggle-new-t-consent':
      newTestimonial.consent = !newTestimonial.consent;
      render();
      break;
    case 'toggle-consent':
      draft.testimonials[Number(t.dataset.idx)].consent = !draft.testimonials[Number(t.dataset.idx)].consent;
      render();
      break;
    case 'save-testimonial':
      saveTestimonial();
      break;
    case 'write-to-disk':
      openDiffModal();
      break;
  }
}

function saveTestimonial() {
  if (!newTestimonial.content && !newTestimonial.src) {
    showToast('Add text or an image path first');
    return;
  }
  const file = `testimonial-${Date.now()}.yaml`;
  const entry = { file, type: newTestimonial.type, attribution: newTestimonial.attribution, lang: newTestimonial.lang, date: newTestimonial.date, consent: newTestimonial.consent };
  if (newTestimonial.type === 'quote') entry.content = newTestimonial.content;
  else entry.src = newTestimonial.src;
  draft.testimonials.push(entry);
  newTestimonial = { type: 'quote', content: '', src: '', attribution: '', lang: 'en', date: new Date().toISOString().slice(0, 10), consent: false };
  render();
}

document.getElementById('write-btn').addEventListener('click', openDiffModal);

// ---------- dev server ----------

async function refreshDevStatus() {
  const res = await fetch('/api/dev/status');
  const s = await res.json();
  document.getElementById('dev-btn').textContent = s.running ? 'Stop dev server' : 'Start dev server';
  document.getElementById('dev-link').style.display = s.running ? '' : 'none';
}

document.getElementById('dev-btn').addEventListener('click', async () => {
  const res = await fetch('/api/dev/status');
  const s = await res.json();
  await fetch(s.running ? '/api/dev/stop' : '/api/dev/start', { method: 'POST' });
  showToast(s.running ? 'Stopping dev server' : 'Starting dev server (npm run dev)');
  setTimeout(refreshDevStatus, 500);
});

setInterval(refreshDevStatus, 3000);
refreshDevStatus();

// ---------- stage changes (git add) ----------

async function refreshGitStatus() {
  const s = await (await fetch('/api/git/status')).json();
  const n = s.unstaged.length;
  document.getElementById('stage-btn').textContent = n ? `Stage changes (${n})` : 'Stage changes';
  const deployBtn = document.getElementById('deploy-btn');
  deployBtn.disabled = n > 0;
  deployBtn.title = n > 0 ? 'Stage your changes first' : '';
  return s;
}

document.getElementById('stage-btn').addEventListener('click', openStageModal);

async function openStageModal() {
  const s = await (await fetch('/api/git/diff')).json();
  const untracked = s.unstaged.filter((e) => e.y === '?');
  const tracked = s.unstaged.filter((e) => e.y !== '?');
  const diffLines = diffTextToLines(s.diffText);
  const body = s.unstaged.length
    ? `
      <div class="diff-file">
        <div class="fname">${tracked.length} changed, ${untracked.length} new</div>
        <div class="diff-lines">${[...tracked, ...untracked]
          .map((e) => `<div class="${e.y === '?' ? 'add' : 'ctx'}">${e.y === '?' ? '+ new file' : statusLabel(e.y)} ${escapeHtml(e.path)}</div>`)
          .join('')}</div>
      </div>
      ${diffLines.length ? `<div class="diff-file"><div class="fname">Diff</div><div class="diff-lines">${diffLines}</div></div>` : ''}`
    : '<p class="hint">Nothing to stage — working tree is clean.</p>';

  document.getElementById('modal-root').innerHTML = `
    <div class="overlay" id="stage-overlay">
      <div class="modal">
        <span class="eyebrow">Review</span>
        <div style="font:800 32px 'Archivo',sans-serif;text-transform:uppercase">Stage ${s.unstaged.length} change${s.unstaged.length === 1 ? '' : 's'}?</div>
        ${body}
        <p class="hint">Runs <code>git add -A</code>. Staging doesn't push anything — you still need to commit before deploying.</p>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="stage-cancel">Cancel</button>
          <button class="primary" id="stage-confirm" ${s.unstaged.length === 0 ? 'disabled' : ''}>Stage all →</button>
        </div>
      </div>
    </div>`;
  document.getElementById('stage-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'stage-overlay') closeDiffModal();
  });
  document.getElementById('stage-cancel').addEventListener('click', closeDiffModal);
  document.getElementById('stage-confirm').addEventListener('click', runStage);
}

function statusLabel(y) {
  return { M: 'modified', D: 'deleted', A: 'added', R: 'renamed' }[y] || y;
}

function diffTextToLines(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter((l) => !l.startsWith('diff --git') && !l.startsWith('index ') && !l.startsWith('+++') && !l.startsWith('---'))
    .map((l) => {
      const type = l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : 'ctx';
      return `<div class="${type}">${escapeHtml(l)}</div>`;
    })
    .join('');
}

async function runStage() {
  const btn = document.getElementById('stage-confirm');
  btn.disabled = true;
  btn.textContent = 'Staging…';
  await fetch('/api/git/add', { method: 'POST' });
  closeDiffModal();
  showToast('Staged all changes');
  refreshGitStatus();
}

setInterval(refreshGitStatus, 3000);
refreshGitStatus();

// ---------- deploy ----------

document.getElementById('deploy-btn').addEventListener('click', openDeployModal);

async function openDeployModal() {
  const s = await (await fetch('/api/git/status')).json();
  const commits = s.ahead == null ? [] : s.ahead;
  const body = s.ahead == null
    ? '<p class="hint">No upstream tracking branch found — can\'t tell how many commits are ahead. Deploying will still run <code>npm run deploy</code>.</p>'
    : commits.length
      ? `<p class="hint">${commits.length} commit${commits.length === 1 ? '' : 's'} on <b>${escapeHtml(s.branch)}</b> will be pushed:</p>
         <div class="diff-lines">${commits.map((c) => `<div class="ctx">${escapeHtml(c)}</div>`).join('')}</div>`
      : '<p class="hint">Nothing to push — your branch is up to date with the remote.</p>';

  document.getElementById('modal-root').innerHTML = `
    <div class="overlay" id="deploy-overlay">
      <div class="modal">
        <span class="eyebrow">Deploy</span>
        <div style="font:800 32px 'Archivo',sans-serif;text-transform:uppercase">Push to Netlify?</div>
        ${body}
        <p class="hint">Runs <code>npm run deploy</code> (git push) — Netlify rebuilds the live site from the pushed commits.</p>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="deploy-cancel">Cancel</button>
          <button class="primary" id="deploy-confirm" ${commits.length === 0 && s.ahead != null ? 'disabled' : ''}>Push →</button>
        </div>
      </div>
    </div>`;
  document.getElementById('deploy-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'deploy-overlay') closeDiffModal();
  });
  document.getElementById('deploy-cancel').addEventListener('click', closeDiffModal);
  document.getElementById('deploy-confirm').addEventListener('click', runDeploy);
}

async function runDeploy() {
  const btn = document.getElementById('deploy-confirm');
  btn.disabled = true;
  btn.textContent = 'Pushing…';
  const res = await fetch('/api/deploy', { method: 'POST' });
  const { code, output } = await res.json();
  closeDiffModal();
  showToast(code === 0 ? 'Pushed — Netlify is rebuilding' : `git push failed: ${output.slice(0, 120)}`);
}

// ---------- diff / commit ----------

function buildPayload() {
  const pendingUploads = [...pendingByPath.entries()].map(([path, dataUrl]) => ({
    path,
    base64: dataUrl.split(',')[1],
  }));
  return { ...draft, pendingUploads };
}

async function openDiffModal() {
  const res = await fetch('/api/diff', { method: 'POST', body: JSON.stringify(buildPayload()) });
  const { files } = await res.json();
  const body = files.length
    ? files
        .map(
          (f) => `
      <div class="diff-file">
        <div class="fname">${escapeHtml(f.label)} ${f.isNew ? '<span class="hint">(new)</span>' : ''}${f.isDeleted ? '<span class="hint">(deleted)</span>' : ''}</div>
        <div class="diff-lines">${f.lines.map((l) => `<div class="${l.type}">${l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '} ${escapeHtml(l.text)}</div>`).join('')}</div>
      </div>`
        )
        .join('')
    : '<p class="hint">No file changes to write (only in-memory state).</p>';

  document.getElementById('modal-root').innerHTML = `
    <div class="overlay" id="diff-overlay">
      <div class="modal">
        <span class="eyebrow">Review</span>
        <div style="font:800 32px 'Archivo',sans-serif;text-transform:uppercase">Write ${files.length} file${files.length === 1 ? '' : 's'}?</div>
        ${body}
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="ghost" id="diff-cancel">Cancel</button>
          <button class="primary" id="diff-commit">Write files →</button>
        </div>
      </div>
    </div>`;
  document.getElementById('diff-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'diff-overlay') closeDiffModal();
  });
  document.getElementById('diff-cancel').addEventListener('click', closeDiffModal);
  document.getElementById('diff-commit').addEventListener('click', commit);
}

function closeDiffModal() {
  document.getElementById('modal-root').innerHTML = '';
}

async function commit() {
  const res = await fetch('/api/commit', { method: 'POST', body: JSON.stringify(buildPayload()) });
  const data = await res.json();
  closeDiffModal();
  if (!data.ok) {
    showToast('Write failed — see server log');
    return;
  }
  loaded = data.state;
  draft = clone(loaded);
  pendingByPath = new Map();
  ui.selectedPhotoPath = null;
  showToast('Written to disk');
  render();
}

function showToast(msg) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast">${escapeHtml(msg)}</div>`;
  setTimeout(() => (root.innerHTML = ''), 2600);
}

boot();
