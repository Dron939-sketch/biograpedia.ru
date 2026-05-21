/* ===================================================================
   Biograpedia — общий JS: данные, поиск, рендер, тема
   =================================================================== */

const DATA_URL = '/data/people.json';
const REPORTS_URL = '/data/reports.json';

const state = {
  data: null,
  reports: null,
  byCategory: {},
  bySlug: {},
};

/* ---------- helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const fmtYear = (iso) => iso ? new Date(iso).getUTCFullYear() : '';
const fmtLifespan = (p) => {
  const b = fmtYear(p.birth);
  const d = p.death ? fmtYear(p.death) : 'наст. время';
  return `${b} — ${d}`;
};
const ageAtDeath = (p) => {
  if (!p.death) return null;
  const b = new Date(p.birth), d = new Date(p.death);
  let a = d.getUTCFullYear() - b.getUTCFullYear();
  const m = d.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && d.getUTCDate() < b.getUTCDate())) a--;
  return a;
};
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const stableHash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
};

const initialsOf = (name) => {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const TR_MAP = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i',
  'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
  'у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
  'э':'e','ю':'yu','я':'ya'
};
const slugify = (s) => String(s).toLowerCase().split('').map(c => TR_MAP[c] !== undefined ? TR_MAP[c] : c)
  .join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const cityKey = (city) => slugify(city);

/* ---------- avatar (deterministic SVG) ---------- */

const PALETTES = [
  ['#FAE6C2', '#8B6F1F'], ['#E7E4F5', '#5B45A3'], ['#FBD7E0', '#A8275A'],
  ['#D6EBF5', '#1E6FA8'], ['#DBF0DC', '#1C7A3E'], ['#F3D9D3', '#A33920'],
  ['#E8DECB', '#5A4B26'], ['#D9D9E8', '#3F3E73'], ['#F0E1C9', '#7A5824'],
];

const avatarSVG = (person, size = 256) => {
  const h = stableHash(person.slug);
  const [bg, fg] = PALETTES[h % PALETTES.length];
  const init = initialsOf(person.shortName || person.name);
  const angle = (h % 360);
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-label="${escapeHtml(person.name)}">
    <defs>
      <linearGradient id="g${h}" gradientTransform="rotate(${angle} .5 .5)">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${fg}" stop-opacity=".25"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g${h})"/>
    <circle cx="${size/2}" cy="${size*0.36}" r="${size*0.16}" fill="${fg}" opacity=".82"/>
    <path d="M${size*0.18} ${size} C ${size*0.18} ${size*0.66}, ${size*0.82} ${size*0.66}, ${size*0.82} ${size} Z" fill="${fg}" opacity=".82"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
      font-family="Lora, Georgia, serif" font-weight="600" font-size="${size*0.18}"
      fill="${bg}" opacity=".95" style="paint-order:stroke">${init}</text>
  </svg>`;
};

/* ---------- icons ---------- */

const ICONS = {
  feather: '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>',
  atom: '<circle cx="12" cy="12" r="1.4"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  palette: '<circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.688-1.688h1.996c3.051 0 5.543-2.492 5.543-5.543C21 6.012 16.984 2 12 2z"/>',
  crown: '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7z"/>',
  trophy: '<path d="M8 21h8M12 17v4M17 4h3a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4M7 4H4a1 1 0 0 0-1 1v3a4 4 0 0 0 4 4M7 4h10v8a5 5 0 0 1-10 0V4z"/>',
  brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};

const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- data loading ---------- */

async function loadData() {
  if (state.data) return state.data;
  const res = await fetch(DATA_URL);
  state.data = await res.json();
  state.byCity = {};
  state.cityMeta = {};
  state.data.people.forEach((p) => {
    state.bySlug[p.slug] = p;
    (state.byCategory[p.category] = state.byCategory[p.category] || []).push(p);
    const cKey = cityKey(p.city);
    if (cKey) {
      (state.byCity[cKey] = state.byCity[cKey] || []).push(p);
      if (!state.cityMeta[cKey]) state.cityMeta[cKey] = { name: p.city, country: p.country, coords: p.coords };
    }
  });
  return state.data;
}

async function loadReports() {
  if (state.reports) return state.reports;
  const res = await fetch(REPORTS_URL);
  state.reports = await res.json();
  return state.reports;
}

/* ---------- theme ---------- */

function initTheme() {
  const stored = localStorage.getItem('bp-theme');
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', stored || prefers);
  $('.theme-toggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('bp-theme', next);
  });
}

/* ---------- search ---------- */

function searchPeople(query, limit = 8) {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  const matches = state.data.people.map((p) => {
    const haystack = `${p.name} ${p.shortName} ${p.tags.join(' ')} ${p.tagline} ${p.country}`.toLowerCase();
    let score = 0;
    if (p.shortName.toLowerCase().startsWith(q)) score += 100;
    if (p.name.toLowerCase().includes(q)) score += 50;
    if (haystack.includes(q)) score += 10;
    if (p.tags.some(t => t.toLowerCase().includes(q))) score += 25;
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return matches.slice(0, limit).map(x => x.p);
}

function attachSearch(input, suggestEl, onPick) {
  let active = -1;
  let items = [];
  const render = () => {
    if (!items.length) { suggestEl.classList.remove('is-open'); suggestEl.innerHTML = ''; return; }
    suggestEl.innerHTML = items.map((p, i) => `
      <a class="suggest__item ${i === active ? 'is-active' : ''}" href="/person.html?slug=${p.slug}" data-slug="${p.slug}">
        <span class="suggest__avatar">${avatarSVG(p, 64)}</span>
        <span>
          <span class="suggest__name">${escapeHtml(p.shortName || p.name)}</span><br>
          <span class="suggest__meta">${escapeHtml(p.tagline.slice(0, 60))}</span>
        </span>
      </a>`).join('');
    suggestEl.classList.add('is-open');
  };
  input.addEventListener('input', () => { active = -1; items = searchPeople(input.value); render(); });
  input.addEventListener('focus', () => { items = searchPeople(input.value); render(); });
  input.addEventListener('keydown', (e) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); const p = items[active]; if (onPick) onPick(p); else location.href = `/person.html?slug=${p.slug}`; }
    else if (e.key === 'Escape') { suggestEl.classList.remove('is-open'); input.blur(); }
  });
  document.addEventListener('click', (e) => {
    if (!suggestEl.contains(e.target) && e.target !== input) suggestEl.classList.remove('is-open');
  });
  if (onPick) {
    suggestEl.addEventListener('click', (e) => {
      const item = e.target.closest('.suggest__item');
      if (!item) return;
      e.preventDefault();
      const p = state.bySlug[item.dataset.slug];
      onPick(p);
      suggestEl.classList.remove('is-open');
    });
  }
}

/* ---------- card markup ---------- */

function personCard(p) {
  const cat = state.data.categories.find(c => c.id === p.category);
  return `
    <a class="card" href="/person.html?slug=${p.slug}">
      <div class="card__portrait">${avatarSVG(p, 320)}<span class="card__category">${escapeHtml(cat?.name || '')}</span></div>
      <div class="card__body">
        <div class="card__title">${escapeHtml(p.shortName || p.name)}</div>
        <div class="card__meta">${fmtLifespan(p)} · ${escapeHtml(p.country)}</div>
        <div class="card__tagline">${escapeHtml(p.tagline)}</div>
      </div>
    </a>`;
}

/* ---------- today widget ---------- */

function todayList() {
  const now = new Date();
  const md = (iso) => iso ? iso.slice(5, 10) : '';
  const today = `${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const born = state.data.people.filter(p => md(p.birth) === today).sort((a, b) => a.birth.localeCompare(b.birth));
  const died = state.data.people.filter(p => p.death && md(p.death) === today).sort((a, b) => a.death.localeCompare(b.death));
  return { born, died };
}

/* ---------- categories with counts ---------- */

function categoriesWithCounts() {
  return state.data.categories.map(c => ({
    ...c,
    count: (state.byCategory[c.id] || []).length
  }));
}

/* ---------- date in russian ---------- */

const russianTodayDate = () => {
  const d = new Date();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
};

/* ---------- header markup (shared) ---------- */

function mountHeader(activePath = '') {
  const header = $('.site-header__inner');
  if (!header) return;
  const isActive = (path) => activePath === path ? 'is-active' : '';
  header.innerHTML = `
    <a class="brand" href="/">
      <span class="brand__mark">Б</span>
      <span class="brand__name">Биографедия</span>
    </a>
    <nav class="nav" aria-label="Главное меню">
      <a href="/catalog.html" class="${isActive('catalog')}">Все персоны</a>
      <a href="/cities.html" class="${isActive('cities')}">Города</a>
      <a href="/compare.html" class="${isActive('compare')}">Сравнить</a>
      <a href="/blacklist/" class="${isActive('blacklist')}">Реестр HR</a>
    </nav>
    <div class="header-search">
      <span class="header-search__icon">${icon('search')}</span>
      <input class="header-search__input" type="search" placeholder="Найти персону…" aria-label="Поиск" id="hdr-search" autocomplete="off">
      <div class="suggest" id="hdr-suggest"></div>
    </div>
    <button class="theme-toggle" aria-label="Переключить тему" title="Переключить тему">
      <span class="moon">${icon('moon')}</span>
      <span class="sun">${icon('sun')}</span>
    </button>
  `;
  initTheme();
  const input = $('#hdr-search'), sug = $('#hdr-suggest');
  if (input && sug) attachSearch(input, sug);
}

function mountFooter() {
  const f = $('.site-footer__inner');
  if (!f) return;
  f.innerHTML = `
    <div>
      <a class="brand" href="/" style="margin-bottom:12px">
        <span class="brand__mark">Б</span>
        <span class="brand__name">Биографедия</span>
      </a>
      <p style="font-family:var(--serif); margin-top:12px">Биографический портал нового поколения: проверенные факты, хронология, связи и культурный контекст.</p>
    </div>
    <div>
      <h4>Разделы</h4>
      <ul>
        <li><a href="/catalog.html">Все персоны</a></li>
        <li><a href="/cities.html">Города и их люди</a></li>
        <li><a href="/catalog.html?era=20th">XX век</a></li>
        <li><a href="/catalog.html?era=19th">XIX век</a></li>
        <li><a href="/compare.html">Сравнить</a></li>
      </ul>
    </div>
    <div>
      <h4>Категории</h4>
      <ul>
        ${state.data.categories.slice(0, 5).map(c => `<li><a href="/catalog.html?cat=${c.id}">${escapeHtml(c.name)}</a></li>`).join('')}
      </ul>
    </div>
    <div>
      <h4>Проект</h4>
      <ul>
        <li><a href="/about.html">О проекте</a></li>
        <li><a href="/blacklist/">Реестр работодателей</a></li>
        <li><a href="https://github.com/dron939-sketch/biograpedia.ru">GitHub</a></li>
      </ul>
    </div>
  `;
  $('.site-footer__bottom').innerHTML = `
    <span>© ${new Date().getUTCFullYear()} Биографедия. Открытый проект.</span>
    <span>Сделано с уважением к фактам.</span>
  `;
}

/* ---------- export to global ---------- */

window.BG = {
  state, loadData, loadReports, $, $$,
  fmtDate, fmtYear, fmtLifespan, ageAtDeath, escapeHtml,
  avatarSVG, icon, ICONS, initialsOf, slugify, cityKey,
  searchPeople, attachSearch,
  personCard, todayList, categoriesWithCounts, russianTodayDate,
  mountHeader, mountFooter,
};
