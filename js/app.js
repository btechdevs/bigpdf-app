/* =========================================================================
   PDFNest — app shell: router, pages, tool UI
   ========================================================================= */
(function () {
  'use strict';

  const U = window.PDFNest.util;
  const toast = window.PDFNest.toast;
  const confirmDialog = window.PDFNest.confirm;
  const askPassword = window.PDFNest.askPassword;
  const CFG = window.BigPDF;
  const app = document.getElementById('app');

  /* =====================================================================
     Small DOM helpers
     ===================================================================== */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  const esc = U.escapeHtml;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  /* =====================================================================
     File entry model
     ===================================================================== */
  let fileSeq = 0;
  class FileEntry {
    constructor(file) {
      this.id = 'f' + (++fileSeq);
      this.file = file;
      this.name = file.name;
      this.size = file.size;
      this.kind = FileEntry.kindOf(file);
      this.bytes = null;      // Uint8Array once loaded
      this.pageCount = 0;
      this.rotation = 0;
      this.thumbUrl = null;
      this.status = 'idle';   // idle | loading | ready | error
      this.error = null;
    }
    static kindOf(file) {
      const type = (file.type || '').toLowerCase();
      const name = (file.name || '').toLowerCase();
      if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
      if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?|jfif)$/.test(name)) return 'image';
      if (type.startsWith('text/') || /\.(txt|md|csv|log|json)$/.test(name)) return 'text';
      return 'other';
    }
  }

  /* =====================================================================
     Router
     ===================================================================== */
  const routes = {
    '': homePage,
    'tools': toolsPage,
    'category': categoryPage,
    'tool': toolPage,
    'about': aboutPage,
    'privacy': privacyPage,
    'help': helpPage
  };

  function parseHash() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    if (!parts.length) return { name: '', params: [] };
    return { name: parts[0], params: parts.slice(1) };
  }

  function navigate(path) {
    if (location.hash === '#' + path) render();
    else location.hash = path;
  }

  function render() {
    const { name, params } = parseHash();
    const page = routes[name] || homePage;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    app.innerHTML = '';
    app.appendChild(shell(page(params)));
    highlightNav(name, params[0]);
    document.getElementById('mobileMenu')?.classList.add('hidden');
  }

  window.addEventListener('hashchange', render);

  /* =====================================================================
     Header / footer
     ===================================================================== */
  function header() {
    const nav = el(`
      <header class="sticky top-0 z-50 glass border-b border-slate-200/80">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="h-16 flex items-center gap-4">
            <a href="#/" class="flex items-center gap-2.5 shrink-0 group">
              <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white grid place-items-center shadow-lg shadow-indigo-500/25">
                <i class="fa-solid fa-layer-group text-sm"></i>
              </span>
              <span class="font-extrabold text-lg tracking-tight text-slate-900">PDF<span class="text-indigo-600">Nest</span></span>
            </a>

            <nav class="hidden lg:flex items-center gap-1 ml-2" id="desktopNav">
              <a href="#/tools" data-nav="tools" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition">All tools</a>
              ${CFG.CATEGORIES.map(c => `
                <a href="#/category/${c.id}" data-nav="category:${c.id}" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition">${esc(c.name.replace(' PDF',''))}</a>
              `).join('')}
            </nav>

            <div class="ml-auto flex items-center gap-2">
              <div class="hidden md:block relative">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input id="navSearch" type="search" placeholder="Search tools…" class="w-56 pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white/70 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none">
              </div>
              <a href="#/tools" class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition">
                <i class="fa-solid fa-bolt text-xs"></i> Start
              </a>
              <button id="burger" class="lg:hidden w-10 h-10 grid place-items-center rounded-lg text-slate-700 hover:bg-slate-100">
                <i class="fa-solid fa-bars"></i>
              </button>
            </div>
          </div>

          <div id="mobileMenu" class="hidden lg:hidden pb-4 space-y-1">
            <input id="navSearchM" type="search" placeholder="Search tools…" class="w-full mb-2 px-3 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-indigo-400">
            <a href="#/tools" class="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">All tools</a>
            ${CFG.CATEGORIES.map(c => `<a href="#/category/${c.id}" class="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">${esc(c.name)}</a>`).join('')}
          </div>
        </div>
      </header>`);

    nav.querySelector('#burger').onclick = () => $('#mobileMenu', nav).classList.toggle('hidden');
    const searchHandler = e => {
      const q = e.target.value.trim();
      if (q.length > 1) navigate('/tools?q=' + encodeURIComponent(q));
      else if (parseHash().name === 'tools') render();
    };
    nav.querySelector('#navSearch').oninput = searchHandler;
    nav.querySelector('#navSearchM').oninput = searchHandler;
    return nav;
  }

  function footer() {
    return el(`
      <footer class="mt-20 border-t border-slate-200 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div class="grid gap-10 md:grid-cols-4">
            <div>
              <div class="flex items-center gap-2.5 mb-3">
                <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white grid place-items-center">
                  <i class="fa-solid fa-layer-group text-sm"></i>
                </span>
                <span class="font-extrabold text-lg text-slate-900">PDF<span class="text-indigo-600">Nest</span></span>
              </div>
              <p class="text-sm text-slate-600 leading-relaxed">A complete PDF toolbox that runs entirely in your browser. Your documents never leave your device.</p>
              <div class="flex gap-2 mt-4">
                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                  <i class="fa-solid fa-shield-halved"></i> 100% offline
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1">
                  <i class="fa-solid fa-infinity"></i> No limits
                </span>
              </div>
            </div>
            ${CFG.CATEGORIES.map(c => `
              <div>
                <h4 class="font-semibold text-slate-900 text-sm mb-3">${esc(c.name)}</h4>
                <ul class="space-y-2">
                  ${CFG.toolsByCategory(c.id).slice(0, 6).map(t => `<li><a href="#/tool/${t.id}" class="text-sm text-slate-600 hover:text-indigo-600">${esc(t.name)}</a></li>`).join('')}
                </ul>
              </div>`).join('')}
          </div>
          <div class="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p class="text-sm text-slate-500">© ${new Date().getFullYear()} PDFNest. Built with HTML, Tailwind CSS &amp; JavaScript.</p>
            <div class="flex items-center gap-5 text-sm">
              <a href="#/help" class="text-slate-600 hover:text-indigo-600">Help</a>
              <a href="#/privacy" class="text-slate-600 hover:text-indigo-600">Privacy</a>
              <a href="#/about" class="text-slate-600 hover:text-indigo-600">About</a>
            </div>
          </div>
        </div>
      </footer>`);
  }

  function highlightNav(name, param) {
    $$('[data-nav]').forEach(a => {
      const key = a.dataset.nav;
      const active = (key === name) || (key === 'category:' + param && name === 'category');
      a.classList.toggle('bg-indigo-50', active);
      a.classList.toggle('text-indigo-600', active);
    });
  }

  function shell(content) {
    const frag = document.createDocumentFragment();
    frag.appendChild(header());
    const main = el('<main class="min-h-[60vh]"></main>');
    main.appendChild(content);
    frag.appendChild(main);
    frag.appendChild(footer());
    return frag;
  }

  /* =====================================================================
     Tool cards
     ===================================================================== */
  function toolCard(tool, opts) {
    opts = opts || {};
    const cat = CFG.CATEGORIES.find(c => c.id === tool.category) || {};
    return el(`
      <a href="#/tool/${tool.id}" class="card-hover group relative bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 p-5 flex flex-col">
        ${tool.popular ? '<span class="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">Popular</span>' : ''}
        <span class="w-11 h-11 rounded-xl bg-gradient-to-br ${cat.color || 'from-slate-500 to-slate-700'} text-white grid place-items-center shadow-sm mb-4 group-hover:scale-105 transition">
          <i class="fa-solid ${tool.icon}"></i>
        </span>
        <h3 class="font-semibold text-slate-900 leading-snug">${esc(tool.name)}</h3>
        <p class="text-sm text-slate-600 mt-1.5 leading-relaxed flex-1">${esc(tool.desc)}</p>
        <span class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
          Open tool <i class="fa-solid fa-arrow-right text-xs group-hover:translate-x-0.5 transition"></i>
        </span>
      </a>`);
  }

  /* =====================================================================
     HOME
     ===================================================================== */
  function homePage() {
    const wrap = el('<div></div>');
    wrap.innerHTML = `
      <section class="relative overflow-hidden bg-grid">
        <div class="absolute -top-32 -right-24 w-[38rem] h-[38rem] bg-gradient-to-br from-indigo-200/50 to-violet-200/40 rounded-full blur-3xl"></div>
        <div class="absolute top-40 -left-32 w-[30rem] h-[30rem] bg-gradient-to-br from-sky-200/40 to-cyan-100/40 rounded-full blur-3xl"></div>
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-14 text-center">
          <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white/80 border border-indigo-100 rounded-full px-3.5 py-1.5 shadow-sm">
            <i class="fa-solid fa-shield-halved"></i> Files are processed on your device — nothing is uploaded
          </span>
          <h1 class="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 text-balance">
            The complete <span class="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">PDF toolbox</span><br class="hidden sm:block"> that never uploads your files
          </h1>
          <p class="mt-5 text-lg text-slate-600 max-w-2xl mx-auto text-balance">
            Merge, split, compress, crop, protect, convert and extract — 20+ tools powered by JavaScript right in your browser. No sign-up, no file size limits, no waiting in an upload queue.
          </p>

          <div id="heroDrop" class="dropzone mt-9 max-w-2xl mx-auto bg-white/85 backdrop-blur rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 px-6 py-9 cursor-pointer shadow-xl shadow-slate-900/5">
            <input id="heroInput" type="file" multiple class="hidden">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white grid place-items-center shadow-lg shadow-indigo-500/25">
              <i class="fa-solid fa-cloud-arrow-up text-xl"></i>
            </div>
            <p class="mt-4 font-semibold text-slate-900">Drop your files here</p>
            <p class="text-sm text-slate-500 mt-1">PDF, images or text — we will suggest the right tool</p>
            <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm">Choose files</span>
              <a href="#/tools" class="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-sm font-semibold">Browse all tools</a>
            </div>
          </div>

          <div class="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <span class="inline-flex items-center gap-2"><i class="fa-solid fa-bolt text-indigo-500"></i> Instant processing</span>
            <span class="inline-flex items-center gap-2"><i class="fa-solid fa-lock text-emerald-500"></i> Private by design</span>
            <span class="inline-flex items-center gap-2"><i class="fa-solid fa-infinity text-violet-500"></i> Unlimited &amp; free</span>
            <span class="inline-flex items-center gap-2"><i class="fa-solid fa-desktop text-sky-500"></i> Works offline</span>
          </div>
        </div>
      </section>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div class="flex items-end justify-between gap-4 mb-7">
          <div>
            <h2 class="text-2xl sm:text-3xl font-bold text-slate-900">Popular tools</h2>
            <p class="text-slate-600 mt-1">The tools people reach for most often.</p>
          </div>
          <a href="#/tools" class="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">All tools <i class="fa-solid fa-arrow-right text-xs"></i></a>
        </div>
        <div id="popularGrid" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>
      </section>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <div class="grid gap-6 lg:grid-cols-3">
          ${[
            ['fa-shield-halved', 'Your files stay yours', 'Everything runs with JavaScript inside this tab. No upload, no server, no storage — close the tab and nothing is left behind.', 'from-emerald-500 to-teal-500'],
            ['fa-gauge-high', 'Fast, even for big files', 'Streaming page rendering and vector page embedding keep memory use low and output quality high.', 'from-indigo-500 to-blue-500'],
            ['fa-wand-magic-sparkles', 'Built for real documents', 'Page ranges, drag & drop reordering, watermarks, permissions, metadata — the details that matter are all here.', 'from-fuchsia-500 to-purple-500']
          ].map(([icon, title, text, color]) => `
            <div class="bg-white rounded-2xl border border-slate-200 p-6">
              <span class="w-11 h-11 rounded-xl bg-gradient-to-br ${color} text-white grid place-items-center shadow-sm"><i class="fa-solid ${icon}"></i></span>
              <h3 class="mt-4 font-semibold text-slate-900">${title}</h3>
              <p class="mt-2 text-sm text-slate-600 leading-relaxed">${text}</p>
            </div>`).join('')}
        </div>
      </section>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div id="homeCategories" class="space-y-12"></div>
      </section>`;

    // popular tools
    const pop = CFG.TOOLS.filter(t => t.popular).map(CFG.resolveTool);
    const pg = $('#popularGrid', wrap);
    pop.forEach(t => pg.appendChild(toolCard(t)));

    // categories with their tools
    const cats = $('#homeCategories', wrap);
    CFG.CATEGORIES.forEach(c => {
      const tools = CFG.toolsByCategory(c.id);
      if (!tools.length) return;
      const block = el(`
        <div>
          <div class="flex items-center gap-3 mb-5">
            <span class="w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} text-white grid place-items-center shadow-sm"><i class="fa-solid ${c.icon}"></i></span>
            <div>
              <h3 class="text-xl font-bold text-slate-900">${esc(c.name)}</h3>
              <p class="text-sm text-slate-500">${tools.length} tools</p>
            </div>
            <a href="#/category/${c.id}" class="ml-auto text-sm font-semibold text-indigo-600 hover:text-indigo-700">View all <i class="fa-solid fa-arrow-right text-xs"></i></a>
          </div>
          <div class="cat-tool-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>
        </div>`);
      const grid = $('.cat-tool-grid', block);
      tools.slice(0, 8).forEach(t => grid.appendChild(toolCard(t)));
      cats.appendChild(block);
    });

    // hero dropzone -> tool suggester
    const dz = $('#heroDrop', wrap);
    const input = $('#heroInput', wrap);
    dz.onclick = e => { if (e.target.tagName !== 'A') input.click(); };
    input.onchange = () => { if (input.files.length) suggestTools([...input.files]); };
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('is-dragover'); }));
    dz.addEventListener('drop', e => {
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) suggestTools(files);
    });

    return wrap;
  }

  function suggestTools(files) {
    const kinds = new Set(files.map(f => FileEntry.kindOf(f)));
    const allPdf = kinds.size === 1 && kinds.has('pdf');
    const allImg = kinds.size === 1 && kinds.has('image');
    const allTxt = kinds.size === 1 && kinds.has('text');

    let ids;
    if (allPdf && files.length > 1) ids = ['merge-pdf', 'compress-pdf', 'split-pdf', 'protect-pdf', 'pdf-to-image', 'pdf-to-text'];
    else if (allPdf) ids = ['compress-pdf', 'split-pdf', 'organize-pdf', 'pdf-to-image', 'protect-pdf', 'crop-pdf'];
    else if (allImg) ids = ['image-to-pdf', 'merge-pdf-image'];
    else if (allTxt) ids = ['txt-to-pdf'];
    else ids = ['merge-pdf-image', 'image-to-pdf', 'merge-pdf'];

    const tools = ids.map(CFG.toolById).filter(Boolean);
    const back = el(`
      <div class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-auto p-6">
          <div class="flex items-start gap-4">
            <div class="w-11 h-11 rounded-full bg-indigo-100 text-indigo-600 grid place-items-center shrink-0"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="flex-1">
              <h3 class="font-semibold text-slate-900 text-lg">What would you like to do?</h3>
              <p class="text-sm text-slate-600 mt-1">${files.length} file${files.length > 1 ? 's' : ''} ready: ${esc(files.slice(0, 3).map(f => f.name).join(', '))}${files.length > 3 ? ' …' : ''}</p>
            </div>
            <button data-close class="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 grid place-items-center"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="suggest-grid grid sm:grid-cols-2 gap-3 mt-6"></div>
        </div>
      </div>`);
    const grid = $('.suggest-grid', back);
    tools.forEach(t => {
      const card = el(`
        <button class="text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition flex items-start gap-3">
          <span class="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 grid place-items-center shrink-0"><i class="fa-solid ${t.icon}"></i></span>
          <span>
            <span class="block font-semibold text-slate-900 text-sm">${esc(t.name)}</span>
            <span class="block text-xs text-slate-500 mt-0.5 leading-snug">${esc(t.desc)}</span>
          </span>
        </button>`);
      card.onclick = () => {
        back.remove();
        ToolSession.pending = { toolId: t.id, files };
        navigate('/tool/' + t.id);
      };
      grid.appendChild(card);
    });
    back.querySelector('[data-close]').onclick = () => back.remove();
    back.onclick = e => { if (e.target === back) back.remove(); };
    document.body.appendChild(back);
  }

  /* =====================================================================
     ALL TOOLS + CATEGORY
     ===================================================================== */
  function searchFromHash() {
    const m = /[?&]q=([^&]*)/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function toolsPage() {
    const q = searchFromHash().toLowerCase();
    const wrap = el(`
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div class="text-center max-w-2xl mx-auto">
          <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">All PDF tools</h1>
          <p class="text-slate-600 mt-3">${CFG.TOOLS.length} tools that run completely in your browser — pick one to get started.</p>
          <div class="relative mt-6 max-w-md mx-auto">
            <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input id="toolsSearch" type="search" value="${esc(q)}" placeholder="Search: merge, compress, watermark…" class="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none">
          </div>
        </div>
        <div id="toolsResults" class="mt-10 space-y-12"></div>
      </div>`);

    const results = $('#toolsResults', wrap);
    const input = $('#toolsSearch', wrap);

    function draw(query) {
      results.innerHTML = '';
      const needle = (query || '').trim().toLowerCase();
      let matches = CFG.TOOLS.map(CFG.resolveTool);
      if (needle) {
        matches = matches.filter(t =>
          (t.name + ' ' + t.desc + ' ' + t.category).toLowerCase().includes(needle));
      }
      if (!matches.length) {
        results.appendChild(el(`<p class="text-center text-slate-500 py-16">No tool matches “${esc(needle)}”.</p>`));
        return;
      }
      CFG.CATEGORIES.forEach(c => {
        const group = matches.filter(t => t.category === c.id);
        if (!group.length) return;
        const block = el(`
          <div>
            <div class="flex items-center gap-3 mb-5">
              <span class="w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} text-white grid place-items-center"><i class="fa-solid ${c.icon}"></i></span>
              <h2 class="text-xl font-bold text-slate-900">${esc(c.name)}</h2>
              <span class="text-sm text-slate-400">${group.length} tool${group.length > 1 ? 's' : ''}</span>
            </div>
            <div class="tools-cat-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>
          </div>`);
        const grid = $('.tools-cat-grid', block);
        group.forEach(t => grid.appendChild(toolCard(t)));
        results.appendChild(block);
      });
    }

    draw(q);
    let t;
    input.oninput = () => { clearTimeout(t); t = setTimeout(() => draw(input.value), 140); };
    return wrap;
  }

  function categoryPage(params) {
    const cat = CFG.CATEGORIES.find(c => c.id === params[0]);
    if (!cat) return notFound();
    const tools = CFG.toolsByCategory(cat.id);
    const wrap = el(`
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <nav class="text-sm text-slate-500 mb-6"><a href="#/" class="hover:text-indigo-600">Home</a> <i class="fa-solid fa-chevron-right text-[10px] mx-1"></i> <a href="#/tools" class="hover:text-indigo-600">Tools</a> <i class="fa-solid fa-chevron-right text-[10px] mx-1"></i> <span class="text-slate-700 font-medium">${esc(cat.name)}</span></nav>
        <div class="flex items-center gap-4">
          <span class="w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.color} text-white grid place-items-center shadow-lg"><i class="fa-solid ${cat.icon} text-xl"></i></span>
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">${esc(cat.name)}</h1>
            <p class="text-slate-600 mt-1">${tools.length} tools · all processing happens in your browser</p>
          </div>
        </div>
        <div id="catGrid" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-9"></div>
      </div>`);
    const grid = $('#catGrid', wrap);
    tools.forEach(t => grid.appendChild(toolCard(t)));
    return wrap;
  }

  function notFound() {
    return el(`
      <div class="max-w-xl mx-auto text-center py-24 px-4">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 grid place-items-center text-2xl"><i class="fa-solid fa-compass"></i></div>
        <h1 class="mt-5 text-2xl font-bold text-slate-900">Page not found</h1>
        <p class="text-slate-600 mt-2">The page you were looking for does not exist.</p>
        <a href="#/tools" class="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm">Browse all tools</a>
      </div>`);
  }

  /* =====================================================================
     Static pages
     ===================================================================== */
  function aboutPage() {
    return el(`
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-14 prose-slate">
        <h1 class="text-3xl font-extrabold text-slate-900">About PDFNest</h1>
        <p class="text-slate-600 mt-4 leading-relaxed">PDFNest is a fully client-side PDF toolkit. Every operation — merging, splitting, compressing, converting, encrypting — is performed by JavaScript running in your own browser tab.</p>
        <h2 class="text-xl font-bold text-slate-900 mt-8">Why client-side?</h2>
        <p class="text-slate-600 mt-3 leading-relaxed">Classic online PDF tools upload your documents to a server, process them there and delete them "after a while". That means your contracts, invoices and IDs travel across the internet and sit on someone else's disk. PDFNest skips that entirely: there is no backend, so there is nothing to trust.</p>
        <h2 class="text-xl font-bold text-slate-900 mt-8">Technology</h2>
        <ul class="mt-3 space-y-2 text-slate-600">
          <li class="flex gap-3"><i class="fa-solid fa-check text-emerald-500 mt-1"></i><span><strong class="text-slate-800">Tailwind CSS</strong> for the interface.</span></li>
          <li class="flex gap-3"><i class="fa-solid fa-check text-emerald-500 mt-1"></i><span><strong class="text-slate-800">pdf-lib</strong> (cantoo fork) for creating, editing and AES-256 encrypting PDFs.</span></li>
          <li class="flex gap-3"><i class="fa-solid fa-check text-emerald-500 mt-1"></i><span><strong class="text-slate-800">pdf.js</strong> for rendering pages, extracting text and images.</span></li>
          <li class="flex gap-3"><i class="fa-solid fa-check text-emerald-500 mt-1"></i><span><strong class="text-slate-800">JSZip</strong> for packaging multiple results.</span></li>
        </ul>
        <p class="text-slate-600 mt-8">Open <code class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-sm">index.html</code> and the app works — you can even keep a copy on a USB stick and use it with no internet connection.</p>
      </div>`);
  }

  function privacyPage() {
    return el(`
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <h1 class="text-3xl font-extrabold text-slate-900">Privacy</h1>
        <div class="mt-6 bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex gap-4">
          <i class="fa-solid fa-shield-halved text-emerald-600 text-xl mt-0.5"></i>
          <p class="text-emerald-900 text-sm leading-relaxed"><strong>Your files are never uploaded.</strong> PDFNest has no server component. All files you open are read with the browser File API, processed in memory and written back to your disk with a download — they never leave your computer.</p>
        </div>
        <h2 class="text-xl font-bold text-slate-900 mt-8">What we collect</h2>
        <p class="text-slate-600 mt-3 leading-relaxed">Nothing. There are no accounts, no analytics and no cookies set by this application. Because the app can run from a local file, it also works with no network connection at all.</p>
        <h2 class="text-xl font-bold text-slate-900 mt-8">Local storage</h2>
        <p class="text-slate-600 mt-3 leading-relaxed">Only your UI preferences (such as the last used theme or recent tool) may be stored in your browser's local storage. Clearing site data removes them.</p>
      </div>`);
  }

  function helpPage() {
    const faqs = [
      ['Is there a file size limit?', 'No hard limit is imposed by the app — the practical limit is your device memory. Files of several hundred megabytes work on a normal laptop, and compression handles big scans best.'],
      ['Why is my scanned PDF not converting to text?', 'A scan is an image, not text. Use Compress PDF or PDF to Image for those files, or run OCR in another tool first.'],
      ['Which password do I need for Protect PDF?', 'You choose a new password. Anyone opening the file will need it — there is no recovery, so store it safely.'],
      ['Can I use the tools offline?', 'Yes. Download the folder and open index.html. Everything (including the libraries) is bundled locally.'],
      ['Do the tools add watermarks?', 'Never. Your output is exactly what you asked for.'],
      ['What is the difference between the two compression modes?', 'Strong renders each page as an optimised JPEG (great for scans and photos). Light keeps the text vector and only repacks the file, which is safe for documents that must stay searchable.']
    ];
    const wrap = el(`
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <h1 class="text-3xl font-extrabold text-slate-900">Help & FAQ</h1>
        <p class="text-slate-600 mt-3">Answers to the questions we get most often.</p>
        <div class="mt-8 space-y-3"></div>
      </div>`);
    const list = $('.space-y-3', wrap);
    faqs.forEach(([q, a]) => list.appendChild(el(`
      <details class="group bg-white rounded-xl border border-slate-200 p-5">
        <summary class="flex items-center justify-between gap-4 font-semibold text-slate-900">
          <span>${esc(q)}</span>
          <i class="fa-solid fa-chevron-down faq-chevron text-slate-400 text-xs"></i>
        </summary>
        <p class="text-slate-600 text-sm mt-3 leading-relaxed">${esc(a)}</p>
      </details>`)));
    return wrap;
  }

  /* =====================================================================
     TOOL PAGE
     ===================================================================== */
  const ToolSession = {
    pending: null,
    files: [],
    options: {},
    selectedPages: new Set(),
    pageOrder: null,
    rotations: {},
    outputs: [],
    pageCount: 0,
    pdfDoc: null
  };

  function toolPage(params) {
    const tool = CFG.toolById(params[0]);
    if (!tool) return notFound();
    const cat = CFG.CATEGORIES.find(c => c.id === tool.category) || {};

    // fresh session
    ToolSession.files = [];
    ToolSession.options = {};
    ToolSession.selectedPages = new Set();
    ToolSession.pageOrder = null;
    ToolSession.rotations = {};
    ToolSession.outputs = [];
    ToolSession.pageCount = 0;
    ToolSession.pdfDoc = null;

    const wrap = el(`
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <nav class="text-sm text-slate-500 mb-5">
          <a href="#/" class="hover:text-indigo-600">Home</a> <i class="fa-solid fa-chevron-right text-[10px] mx-1"></i>
          <a href="#/category/${cat.id}" class="hover:text-indigo-600">${esc(cat.name)}</a> <i class="fa-solid fa-chevron-right text-[10px] mx-1"></i>
          <span class="text-slate-700 font-medium">${esc(tool.name)}</span>
        </nav>

        <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div class="flex items-start gap-4">
              <span class="w-12 h-12 rounded-2xl bg-gradient-to-br ${cat.color} text-white grid place-items-center shadow-lg shrink-0"><i class="fa-solid ${tool.icon} text-lg"></i></span>
              <div>
                <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">${esc(tool.name)}</h1>
                <p class="text-slate-600 mt-1.5">${esc(tool.desc)}</p>
              </div>
            </div>

            <div id="dropzone" class="dropzone mt-7 bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 px-6 py-10 text-center cursor-pointer">
              <input id="fileInput" type="file" class="hidden" ${tool.multiple ? 'multiple' : ''} accept="${esc(tool.accept || '')}">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><i class="fa-solid fa-file-arrow-up text-xl"></i></div>
              <p class="mt-4 font-semibold text-slate-900">Select ${esc(tool.fileLabel || 'file')}${tool.multiple ? 's' : ''}</p>
              <p class="text-sm text-slate-500 mt-1">or drop ${tool.multiple ? 'them' : 'it'} here · ${tool.multiple ? (tool.minFiles > 1 ? 'at least ' + tool.minFiles + ' files' : 'one or more files') : 'one file'}</p>
              <span class="inline-block mt-4 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">Choose ${tool.multiple ? 'files' : 'file'}</span>
              <p class="text-xs text-slate-400 mt-3"><i class="fa-solid fa-lock mr-1"></i>Processed locally — never uploaded</p>
            </div>

            <div id="fileList" class="mt-5 space-y-3"></div>
            <div id="pagesPanel" class="mt-6 hidden"></div>
            <div id="optionsPanel" class="mt-6 hidden"></div>
            <div id="actionBar" class="mt-6 hidden"></div>
            <div id="resultsPanel" class="mt-6"></div>
          </div>

          <aside class="space-y-5">
            <div class="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 class="font-semibold text-slate-900 flex items-center gap-2"><i class="fa-solid fa-list-check text-indigo-500"></i> How to use</h3>
              <ol class="mt-3 space-y-2.5 text-sm text-slate-600"></ol>
            </div>
            <div class="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
              <i class="fa-solid fa-shield-halved text-lg"></i>
              <h3 class="font-semibold mt-2">Private by design</h3>
              <p class="text-sm text-indigo-100 mt-1.5 leading-relaxed">Your files are read and written locally in this tab. Nothing is uploaded, and there is no server that could keep a copy.</p>
            </div>
            <div class="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 class="font-semibold text-slate-900 flex items-center gap-2"><i class="fa-solid fa-circle-question text-indigo-500"></i> FAQ</h3>
              <div class="mt-3 space-y-2"></div>
            </div>
            <div class="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 class="font-semibold text-slate-900 flex items-center gap-2"><i class="fa-solid fa-grip text-indigo-500"></i> Related tools</h3>
              <div class="mt-3 flex flex-wrap gap-2"></div>
            </div>
          </aside>
        </div>
      </div>`);

    // sidebar: how-to
    const ol = $('ol', wrap);
    (tool.howTo || []).forEach(step => ol.appendChild(el(`<li class="flex gap-2.5"><span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold grid place-items-center shrink-0 mt-0.5"></span><span>${esc(step)}</span></li>`)));

    // sidebar: faq
    const faqBox = $$('.bg-white.rounded-2xl.border', wrap).find(x => x.textContent.includes('FAQ'));
    const faqList = $('.space-y-2', faqBox);
    (tool.faq || []).forEach(({ q, a }) => faqList.appendChild(el(`
      <details class="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <summary class="flex items-start justify-between gap-3 text-sm font-medium text-slate-800">
          <span>${esc(q)}</span><i class="fa-solid fa-chevron-down faq-chevron text-slate-400 text-[10px] mt-1"></i>
        </summary>
        <p class="text-xs text-slate-600 mt-2 leading-relaxed">${esc(a)}</p>
      </details>`)));

    // sidebar: related
    const relBox = $$('.bg-white.rounded-2xl.border', wrap).find(x => x.textContent.includes('Related tools'));
    const relList = $('.flex.flex-wrap', relBox);
    CFG.toolsByCategory(tool.category).filter(t => t.id !== tool.id).slice(0, 6)
      .forEach(t => relList.appendChild(el(`<a href="#/tool/${t.id}" class="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700">${esc(t.name)}</a>`)));

    // ---------------- behaviour ----------------
    const state = {
      tool,
      entries: ToolSession.files,
      options: {},
      selected: ToolSession.selectedPages
    };

    const dz = $('#dropzone', wrap);
    const input = $('#fileInput', wrap);
    dz.onclick = () => input.click();
    input.onchange = () => { addFiles([...input.files]); input.value = ''; };
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('is-dragover'); }));
    dz.addEventListener('drop', e => {
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) addFiles(files);
    });

    function acceptedByTool(file) {
      const accept = tool.accept || '';
      if (!accept) return true;
      const kind = FileEntry.kindOf(file);
      if (accept.includes('application/pdf') && kind === 'pdf') return true;
      if (accept.includes('image/*') && kind === 'image') return true;
      if (accept.includes('text/plain') && kind === 'text') return true;
      const exts = accept.split(',').map(s => s.trim()).filter(s => s.startsWith('.'));
      const name = file.name.toLowerCase();
      return exts.some(x => name.endsWith(x));
    }

    async function addFiles(files) {
      const accepted = [];
      for (const f of files) {
        if (!acceptedByTool(f)) { toast(`“${f.name}” is not supported by this tool.`, 'error'); continue; }
        accepted.push(new FileEntry(f));
      }
      if (!accepted.length) return;
      if (!tool.multiple && accepted.length > 1) {
        accepted.splice(1);
        toast('This tool accepts one file at a time.', 'info');
      }
      if (!tool.multiple && state.entries.length) state.entries.length = 0;
      state.entries.push(...accepted);

      await refreshFiles();
    }

    async function loadEntry(entry) {
      if (entry.bytes) return;
      entry.status = 'loading';
      renderFiles();
      try {
        entry.bytes = new Uint8Array(await U.readAsArrayBuffer(entry.file));
        if (entry.kind === 'pdf') {
          try {
            const doc = await window.PDFLib.PDFDocument.load(entry.bytes, { ignoreEncryption: true, updateMetadata: false });
            entry.pageCount = doc.getPageCount();
          } catch (e) { entry.pageCount = 0; }
          try {
            const pj = await U.openPdfjs(entry.bytes);
            entry.pageCount = pj.numPages;
            const page = await pj.getPage(1);
            const canvas = await U.renderPageToCanvas(page, 0.35);
            entry.thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
            pj.destroy();
          } catch (e) {
            entry.thumbUrl = null;
          }
        } else if (entry.kind === 'image') {
          entry.thumbUrl = URL.createObjectURL(entry.file);
        }
        entry.status = 'ready';
      } catch (e) {
        entry.status = 'error';
        entry.error = e.message;
      }
      renderFiles();
    }

    async function refreshFiles() {
      await window.PDFNest.deps.pdfLib();
      if (tool.multiple) {
        for (const e of state.entries) await loadEntry(e);
      } else if (state.entries[0]) {
        await loadEntry(state.entries[0]);
      }
      renderFiles();
      renderPages();
      renderOptions();
      renderAction();
    }

    /* ---------------------------------------------------- file list UI */
    const listEl = $('#fileList', wrap);
    function renderFiles() {
      listEl.innerHTML = '';
      if (!state.entries.length) return;

      if (tool.multiple && state.entries.length > 1) {
        const head = el(`
          <div class="flex items-center justify-between">
            <p class="text-sm text-slate-600"><strong>${state.entries.length}</strong> files · drag to reorder</p>
            <button data-clear class="text-sm font-medium text-rose-600 hover:text-rose-700"><i class="fa-solid fa-trash-can mr-1"></i>Clear all</button>
          </div>`);
        head.querySelector('[data-clear]').onclick = () => { state.entries.length = 0; refreshFiles(); };
        listEl.appendChild(head);
      }

      state.entries.forEach((entry, index) => {
        const card = el(`
          <div class="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 ${tool.multiple ? 'cursor-grab' : ''}" draggable="${tool.multiple ? 'true' : 'false'}">
            <div class="w-11 h-14 rounded-lg bg-slate-100 overflow-hidden grid place-items-center shrink-0 border border-slate-200">
              ${entry.thumbUrl
                ? `<img src="${entry.thumbUrl}" class="w-full h-full object-cover" alt="">`
                : `<i class="fa-solid ${entry.kind === 'pdf' ? 'fa-file-pdf text-rose-500' : entry.kind === 'image' ? 'fa-file-image text-sky-500' : entry.kind === 'text' ? 'fa-file-lines text-slate-500' : 'fa-file text-slate-400'}"></i>`}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-slate-900 text-sm truncate">${esc(entry.name)}</p>
              <p class="text-xs text-slate-500 mt-0.5">
                ${U.formatBytes(entry.size)}
                ${entry.pageCount ? ` · ${entry.pageCount} page${entry.pageCount > 1 ? 's' : ''}` : ''}
                ${entry.status === 'loading' ? ' · <span class="text-indigo-600"><span class="spinner spinner-dark inline-block align-middle !w-3 !h-3 !border-2"></span> reading…</span>' : ''}
                ${entry.status === 'error' ? ` · <span class="text-rose-600">${esc(entry.error || 'could not read')}</span>` : ''}
              </p>
            </div>
            ${tool.multiple ? '<i class="fa-solid fa-grip-vertical text-slate-300 drag-handle"></i>' : ''}
            <button data-remove class="w-9 h-9 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 grid place-items-center shrink-0" title="Remove"><i class="fa-solid fa-xmark"></i></button>
          </div>`);

        card.querySelector('[data-remove]').onclick = () => {
          state.entries.splice(index, 1);
          refreshFiles();
        };

        if (tool.multiple) {
          card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', String(index));
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('opacity-40');
          });
          card.addEventListener('dragend', () => card.classList.remove('opacity-40'));
          card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('ring-2', 'ring-indigo-400'); });
          card.addEventListener('dragleave', () => card.classList.remove('ring-2', 'ring-indigo-400'));
          card.addEventListener('drop', e => {
            e.preventDefault();
            card.classList.remove('ring-2', 'ring-indigo-400');
            const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (isNaN(from) || from === index) return;
            const [moved] = state.entries.splice(from, 1);
            state.entries.splice(index, 0, moved);
            renderFiles();
          });
        }

        listEl.appendChild(card);
      });
    }

    /* -------------------------------------------------- page thumbnails */
    const pagesPanel = $('#pagesPanel', wrap);
    async function renderPages() {
      const needsPages = tool.supportsPages || tool.pageMode === 'organize';
      const first = state.entries[0];
      if (!needsPages || !first || !first.bytes || first.kind !== 'pdf') {
        pagesPanel.classList.add('hidden');
        pagesPanel.innerHTML = '';
        return;
      }
      pagesPanel.classList.remove('hidden');
      pagesPanel.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold text-slate-900 flex items-center gap-2"><i class="fa-solid fa-images text-indigo-500"></i> Pages</h3>
              <p class="text-sm text-slate-500 mt-1">${esc(tool.pageSelectHint || 'Click to select pages')}</p>
            </div>
            <div class="flex items-center gap-2">
              <span id="selCount" class="text-sm text-slate-600"></span>
              <button id="selAll" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">Select all</button>
              <button id="selNone" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">Clear</button>
              ${tool.pageMode === 'organize' ? '<button id="revPages" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">Reverse</button>' : ''}
            </div>
          </div>
          <div id="pagesProgress" class="mt-4 hidden">
            <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5"><span id="pagesProgressText">Rendering pages…</span><span id="pagesProgressPct">0%</span></div>
            <div class="progress-track h-1.5"><div id="pagesProgressBar" class="progress-fill h-full" style="width:0%"></div></div>
          </div>
          <div id="pagesGrid" class="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5"></div>
        </div>`;

      const grid = $('#pagesGrid', pagesPanel);
      const prog = $('#pagesProgress', pagesPanel);
      const bar = $('#pagesProgressBar', pagesPanel);
      const pct = $('#pagesProgressPct', pagesPanel);
      const txt = $('#pagesProgressText', pagesPanel);
      const selCount = $('#selCount', pagesPanel);

      let doc;
      try {
        doc = await U.openPdfjs(first.bytes);
      } catch (e) {
        grid.appendChild(el(`<p class="text-sm text-rose-600 col-span-full">Could not render pages: ${esc(e.message)}</p>`));
        return;
      }
      ToolSession.pdfDoc = doc;
      ToolSession.pageCount = doc.numPages;
      if (!ToolSession.pageOrder) ToolSession.pageOrder = Array.from({ length: doc.numPages }, (_, i) => i);

      const updateSelCount = () => {
        selCount.textContent = state.selected.size ? `${state.selected.size} selected` : 'none selected';
      };
      updateSelCount();

      $('#selAll', pagesPanel).onclick = () => {
        for (let i = 0; i < doc.numPages; i++) state.selected.add(i);
        $$('.page-thumb', grid).forEach(x => x.classList.add('selected'));
        updateSelCount();
      };
      $('#selNone', pagesPanel).onclick = () => {
        state.selected.clear();
        $$('.page-thumb', grid).forEach(x => x.classList.remove('selected'));
        updateSelCount();
      };
      const revBtn = $('#revPages', pagesPanel);
      if (revBtn) revBtn.onclick = () => {
        ToolSession.pageOrder.reverse();
        drawGrid();
      };

      const order = ToolSession.pageOrder;
      const thumbCache = {};   // pageIndex -> data URL, so re-drawing the grid is instant
      prog.classList.remove('hidden');
      let done = 0;
      const CONCURRENCY = 3;
      let cursor = 0;

      async function worker() {
        while (cursor < order.length) {
          const myIndex = cursor++;
          const pageNum = order[myIndex] + 1;
          try {
            const page = await doc.getPage(pageNum);
            const canvas = await U.renderPageToCanvas(page, 0.45);
            thumbCache[order[myIndex]] = canvas.toDataURL('image/jpeg', 0.72);
            const holder = grid.querySelector(`[data-slot="${myIndex}"] [data-canvas]`);
            if (holder) {
              holder.innerHTML = '';
              canvas.className = 'rounded-md';
              holder.appendChild(canvas);
            }
            page.cleanup();
          } catch (e) { /* keep placeholder */ }
          done++;
          const p = Math.round(done / order.length * 100);
          bar.style.width = p + '%';
          pct.textContent = p + '%';
          txt.textContent = `Rendering page ${done} of ${order.length}…`;
          if (done === order.length) setTimeout(() => prog.classList.add('hidden'), 500);
          if (done % 6 === 0) await U.nextFrame();
        }
      }

      function drawGrid() {
        grid.innerHTML = '';
        order.forEach((pageIndex, slot) => {
          const card = el(`
            <div class="page-thumb relative rounded-xl border border-slate-200 bg-slate-50 p-1.5" data-slot="${slot}" data-page="${pageIndex}">
              <div data-canvas class="aspect-[3/4] grid place-items-center text-slate-400 text-xs overflow-hidden rounded-md bg-white">
                ${thumbCache[pageIndex]
                  ? `<img src="${thumbCache[pageIndex]}" class="rounded-md" style="transform:rotate(${ToolSession.rotations[pageIndex] || 0}deg)">`
                  : `<span>${pageIndex + 1}</span>`}
              </div>
              <div class="flex items-center justify-between mt-1.5 px-0.5">
                <span class="text-[11px] font-medium text-slate-500">p. ${pageIndex + 1}</span>
                <span class="flex items-center gap-0.5"></span>
              </div>
            </div>`);
          const tools = $('span.flex', card);

          if (tool.supportsPages) {
            card.classList.add('cursor-pointer');
            if (state.selected.has(pageIndex)) card.classList.add('selected');
            card.onclick = e => {
              if (e.shiftKey && ToolSession.lastClicked != null) {
                const [a, b] = [ToolSession.lastClicked, pageIndex].sort((x, y) => x - y);
                for (let i = a; i <= b; i++) state.selected.add(i);
              } else if (e.ctrlKey || e.metaKey) {
                state.selected.has(pageIndex) ? state.selected.delete(pageIndex) : state.selected.add(pageIndex);
              } else {
                state.selected.has(pageIndex) ? state.selected.delete(pageIndex) : state.selected.add(pageIndex);
              }
              ToolSession.lastClicked = pageIndex;
              $$('.page-thumb', grid).forEach(x => {
                x.classList.toggle('selected', state.selected.has(parseInt(x.dataset.page, 10)));
              });
              updateSelCount();
            };
          }

          if (tool.pageMode === 'organize') {
            card.setAttribute('draggable', 'true');
            card.classList.add('cursor-grab');
            tools.appendChild(el(`<button data-rot class="w-6 h-6 rounded text-slate-500 hover:bg-indigo-100 hover:text-indigo-700 grid place-items-center" title="Rotate 90°"><i class="fa-solid fa-rotate-right text-[10px]"></i></button>`));
            tools.appendChild(el(`<button data-del class="w-6 h-6 rounded text-slate-500 hover:bg-rose-100 hover:text-rose-700 grid place-items-center" title="Delete page"><i class="fa-solid fa-trash-can text-[10px]"></i></button>`));
            card.querySelector('[data-rot]').onclick = e => {
              e.stopPropagation();
              const rot = ((ToolSession.rotations[pageIndex] || 0) + 90) % 360;
              ToolSession.rotations[pageIndex] = rot;
              const c = card.querySelector('canvas, img');
              if (c) {
                // shrink 90°/270° turns so the rotated page still fits its frame
                const scale = rot % 180 === 90 ? 0.72 : 1;
                c.style.transform = `rotate(${rot}deg) scale(${scale})`;
              }
              card.dataset.rot = rot;
              card.classList.toggle('ring-2', rot !== 0);
              card.classList.toggle('ring-indigo-300', rot !== 0);
            };
            card.querySelector('[data-del]').onclick = e => {
              e.stopPropagation();
              const at = order.indexOf(pageIndex);
              order.splice(at, 1);
              drawGrid();   // re-draw with the cached thumbnails (instant)
            };
            card.addEventListener('dragstart', e => {
              e.dataTransfer.setData('text/plain', String(slot));
              card.classList.add('dragging');
            });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
            card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drop-target'); });
            card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
            card.addEventListener('drop', e => {
              e.preventDefault();
              card.classList.remove('drop-target');
              const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (isNaN(from) || from === slot) return;
              const [moved] = order.splice(from, 1);
              order.splice(slot, 0, moved);
              drawGrid();   // instant: thumbnails come from the cache
            });
          }
          grid.appendChild(card);
        });
      }

      drawGrid();
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, order.length) }, worker));
    }

    /* --------------------------------------------------------- options */
    const optionsPanel = $('#optionsPanel', wrap);
    function renderOptions() {
      const opts = tool.options || [];
      optionsPanel.classList.remove('hidden');
      if (!opts.length) { optionsPanel.innerHTML = ''; optionsPanel.classList.add('hidden'); return; }

      const box = el(`
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 class="font-semibold text-slate-900 flex items-center gap-2"><i class="fa-solid fa-sliders text-indigo-500"></i> Settings</h3>
          <div class="opts-grid mt-4 grid gap-5 sm:grid-cols-2"></div>
        </div>`);
      const grid = $('.opts-grid', box);

      const controls = {};
      const optByName = {};
      opts.forEach(o => { optByName[o.name] = o; });

      // An option is visible only when its own condition — and every condition
      // it depends on (transitively) — is satisfied.
      function isVisible(opt, seen) {
        if (!opt.showIf) return true;
        seen = seen || new Set();
        if (seen.has(opt.name)) return true;   // guard against circular rules
        seen.add(opt.name);
        if (!opt.showIf.in.includes(state.options[opt.showIf.name])) return false;
        const parent = optByName[opt.showIf.name];
        return parent ? isVisible(parent, seen) : true;
      }

      const refreshVisibility = () => {
        opts.forEach(o => {
          const holder = controls[o.name] && controls[o.name].holder;
          if (holder) holder.style.display = isVisible(o) ? '' : 'none';
        });
      };

      opts.forEach(opt => {
        const holder = el('<div class="sm:col-span-1"></div>');
        const label = el(`<label class="block text-sm font-medium text-slate-700 mb-1.5">${esc(opt.label || '')}${opt.required ? ' <span class="text-rose-500">*</span>' : ''}</label>`);
        let control;

        switch (opt.type) {
          case 'checkbox': {
            control = el(`<label class="flex items-start gap-2.5 cursor-pointer select-none"><input type="checkbox" class="mt-0.5 w-4 h-4 rounded"><span class="text-sm text-slate-700">${esc(opt.hint || opt.label || '')}</span></label>`);
            const cb = $('input', control);
            cb.checked = !!opt.default;
            cb.onchange = () => { state.options[opt.name] = cb.checked; refreshVisibility(); };
            state.options[opt.name] = cb.checked;
            holder.appendChild(control);
            break;
          }
          case 'radio': {
            const wrapR = el('<div class="space-y-1.5"></div>');
            opt.choices.forEach((c, i) => {
              const item = el(`<label class="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-300 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/50">
                <input type="radio" name="${opt.name}" class="w-4 h-4" ${(opt.default === c.v || (!opt.default && i === 0)) ? 'checked' : ''}>
                <span class="text-sm text-slate-700">${esc(c.label)}</span></label>`);
              const rb = $('input', item);
              rb.onchange = () => { state.options[opt.name] = c.v; refreshVisibility(); };
              if (rb.checked) state.options[opt.name] = c.v;
              wrapR.appendChild(item);
            });
            holder.appendChild(label); holder.appendChild(wrapR); control = wrapR;
            break;
          }
          case 'select': {
            control = el(`<select class="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"></select>`);
            opt.choices.forEach(c => control.appendChild(el(`<option value="${esc(c.v)}">${esc(c.label)}</option>`)));
            control.value = opt.default;
            control.onchange = () => { state.options[opt.name] = control.value; refreshVisibility(); };
            state.options[opt.name] = control.value;
            holder.appendChild(label); holder.appendChild(control);
            break;
          }
          case 'number': {
            const wrapN = el('<div class="flex items-center gap-2"></div>');
            control = el(`<input type="number" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" min="${opt.min ?? ''}" max="${opt.max ?? ''}" step="${opt.step ?? 1}">`);
            control.value = opt.default ?? 0;
            control.oninput = () => { state.options[opt.name] = parseFloat(control.value); };
            state.options[opt.name] = parseFloat(control.value);
            wrapN.appendChild(control);
            if (opt.unit) wrapN.appendChild(el(`<span class="text-sm text-slate-500 shrink-0">${esc(opt.unit)}</span>`));
            holder.appendChild(label); holder.appendChild(wrapN);
            break;
          }
          case 'range': {
            const wrapR = el('<div></div>');
            control = el(`<input type="range" class="w-full" min="${opt.min}" max="${opt.max}" step="${opt.step ?? 1}">`);
            control.value = opt.default;
            const out = el(`<span class="text-sm font-semibold text-indigo-600 tabular-nums">${opt.default}${opt.unit ? ' ' + esc(opt.unit) : ''}</span>`);
            control.oninput = () => {
              state.options[opt.name] = parseFloat(control.value);
              out.textContent = control.value + (opt.unit ? ' ' + opt.unit : '');
            };
            state.options[opt.name] = parseFloat(control.value);
            wrapR.appendChild(el('<div class="flex items-center justify-between gap-3"></div>')).appendChild(control);
            $('div', wrapR).appendChild(out);
            holder.appendChild(label); holder.appendChild(wrapR);
            break;
          }
          case 'color': {
            const wrapC = el('<div class="flex items-center gap-3"></div>');
            control = el(`<input type="color" class="w-12 h-10 rounded-lg border border-slate-300 cursor-pointer bg-white p-1">`);
            control.value = opt.default || '#000000';
            const txt = el(`<span class="text-sm text-slate-500 font-mono">${control.value}</span>`);
            control.oninput = () => { state.options[opt.name] = control.value; txt.textContent = control.value; };
            state.options[opt.name] = control.value;
            wrapC.appendChild(control); wrapC.appendChild(txt);
            holder.appendChild(label); holder.appendChild(wrapC);
            break;
          }
          case 'password': {
            control = el(`<input type="password" autocomplete="new-password" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="••••••••">`);
            control.oninput = () => { state.options[opt.name] = control.value; };
            state.options[opt.name] = control.value;
            holder.appendChild(label); holder.appendChild(control);
            if (opt.hint) holder.appendChild(el(`<p class="text-xs text-slate-500 mt-1.5">${esc(opt.hint)}</p>`));
            break;
          }
          case 'file': {
            const wrapF = el('<div></div>');
            control = el(`<input type="file" accept="${esc(opt.accept || '')}" class="w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-sm file:font-semibold hover:file:bg-indigo-100">`);
            control.onchange = () => { state.options[opt.name] = control.files[0] || null; };
            wrapF.appendChild(control);
            holder.appendChild(label); holder.appendChild(wrapF);
            break;
          }
          default: { // text
            control = el(`<input type="text" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none">`);
            control.value = opt.default ?? '';
            control.placeholder = opt.placeholder || '';
            control.oninput = () => { state.options[opt.name] = control.value; };
            state.options[opt.name] = control.value;
            holder.appendChild(label); holder.appendChild(control);
            if (opt.hint) holder.appendChild(el(`<p class="text-xs text-slate-500 mt-1.5">${esc(opt.hint)}</p>`));
          }
        }
        controls[opt.name] = { holder, control };
        grid.appendChild(holder);
      });

      refreshVisibility();
      optionsPanel.innerHTML = '';
      optionsPanel.appendChild(box);
    }

    /* ------------------------------------------------------- action bar */
    const actionBar = $('#actionBar', wrap);
    function renderAction() {
      actionBar.classList.remove('hidden');
      const ready = state.entries.length >= (tool.minFiles || 1) && state.entries.every(e => e.status === 'ready');
      actionBar.innerHTML = '';
      const bar = el(`
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex flex-wrap items-center gap-3">
            <button id="runBtn" class="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition">
              <i class="fa-solid ${tool.icon}"></i><span id="runLabel">${esc(runLabelFor(tool))}</span>
            </button>
            <button id="resetBtn" class="px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm">Start over</button>
            <p id="actionHint" class="text-sm text-slate-500 ml-auto"></p>
          </div>
          <div id="progressWrap" class="mt-5 hidden">
            <div class="flex items-center justify-between text-sm mb-2">
              <span id="progressText" class="text-slate-600 font-medium">Working…</span>
              <span id="progressPct" class="text-slate-500 tabular-nums">0%</span>
            </div>
            <div class="progress-track h-2"><div id="progressBar" class="progress-fill h-full" style="width:0%"></div></div>
          </div>
        </div>`);

      const runBtn = $('#runBtn', bar);
      const hint = $('#actionHint', bar);

      const need = tool.minFiles || 1;
      if (state.entries.length < need) {
        runBtn.disabled = true;
        hint.textContent = tool.multiple && need > 1
          ? `Add ${need - state.entries.length} more file${need - state.entries.length > 1 ? 's' : ''} to continue`
          : 'Add a file to continue';
      } else if (state.entries.some(e => e.status === 'loading')) {
        runBtn.disabled = true;
        hint.textContent = 'Reading files…';
      } else if (state.entries.some(e => e.status === 'error')) {
        runBtn.disabled = true;
        hint.textContent = 'Remove the unreadable file(s) to continue';
      } else {
        hint.textContent = '';
      }

      runBtn.onclick = () => runTool(tool, state, {
        progress: (pct, text) => {
          $('#progressWrap', bar).classList.remove('hidden');
          $('#progressBar', bar).style.width = pct + '%';
          $('#progressPct', bar).textContent = Math.round(pct) + '%';
          $('#progressText', bar).textContent = text || 'Working…';
        },
        done: () => {
          $('#progressWrap', bar).classList.add('hidden');
          $('#progressBar', bar).style.width = '0%';
        }
      });

      $('#resetBtn', bar).onclick = () => {
        state.entries.length = 0;
        state.selected.clear();
        ToolSession.pageOrder = null;
        ToolSession.rotations = {};
        $('#resultsPanel', wrap).innerHTML = '';
        refreshFiles();
      };

      actionBar.appendChild(bar);
    }

    function runLabelFor(t) {
      const map = {
        'merge-pdf': 'Merge PDFs', 'merge-pdf-image': 'Merge into PDF', 'split-pdf': 'Split PDF',
        'organize-pdf': 'Save PDF', 'remove-pages': 'Remove pages', 'extract-pages': 'Extract pages',
        'compress-pdf': 'Compress PDF', 'resize-pdf': 'Resize PDF', 'n-up-pdf': 'Create N-up PDF',
        'rotate-pdf': 'Rotate PDF', 'crop-pdf': 'Crop PDF', 'add-page-numbers': 'Add page numbers',
        'add-watermark': 'Add watermark', 'edit-metadata': 'Save metadata', 'flatten-pdf': 'Flatten PDF',
        'image-to-pdf': 'Convert to PDF', 'jpg-to-pdf': 'Convert to PDF', 'png-to-pdf': 'Convert to PDF',
        'webp-to-pdf': 'Convert to PDF', 'txt-to-pdf': 'Convert to PDF',
        'pdf-to-image': 'Convert to images', 'pdf-to-jpg': 'Convert to JPG', 'pdf-to-png': 'Convert to PNG',
        'pdf-to-text': 'Extract text', 'extract-images': 'Extract images',
        'protect-pdf': 'Protect PDF', 'unlock-pdf': 'Unlock PDF'
      };
      return map[t.id] || t.name;
    }

    /* --------------------------------------------------------- run tool */
    async function runTool(toolDef, state, hooks) {
      const resultsPanel = $('#resultsPanel', wrap);
      resultsPanel.innerHTML = '';
      const outputs = [];
      const session = {
        tool: toolDef,
        entries: state.entries,
        options: state.options,
        selectedPages: state.selected,
        pageOrder: ToolSession.pageOrder,
        rotations: ToolSession.rotations
      };

      try {
        await window.PDFNest.deps.pdfLib();
        const result = await window.PDFNest.engine.run(session, {
          progress: hooks.progress,
          log: () => {},
          addOutput: (name, data, mime) => outputs.push({ name, data, mime })
        });
        hooks.done();
        if (!outputs.length) { toast('Nothing to download — check your selection.', 'warn'); return; }
        showResults(outputs, toolDef, result && result.zipped);
      } catch (err) {
        hooks.done();
        console.error(err);
        if (err && err.name === 'PasswordRequired') {
          toast(err.message || 'That PDF is password protected — unlock it first.', 'error', 7000);
        } else {
          toast(err && err.message ? err.message : 'Something went wrong while processing.', 'error', 6000);
        }
        resultsPanel.appendChild(el(`
          <div class="bg-rose-50 border border-rose-100 rounded-2xl p-5">
            <h3 class="font-semibold text-rose-900 flex items-center gap-2"><i class="fa-solid fa-circle-exclamation"></i> Could not finish</h3>
            <p class="text-sm text-rose-800 mt-2">${esc(err && err.message ? err.message : 'Unknown error')}</p>
          </div>`));
      }
    }

    function showResults(outputs, toolDef, zipped) {
      const panel = $('#resultsPanel', wrap);
      panel.innerHTML = '';
      const box = el(`
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
          <div class="flex flex-wrap items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center"><i class="fa-solid fa-circle-check"></i></span>
            <div>
              <h3 class="font-semibold text-slate-900">Done — ${outputs.length} file${outputs.length > 1 ? 's' : ''} ready</h3>
              <p class="text-sm text-slate-500">${zipped ? 'Your ZIP archive download has started.' : 'Downloads start automatically, or use the buttons below.'}</p>
            </div>
            ${outputs.length > 1 ? '<button id="zipAll" class="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"><i class="fa-solid fa-file-zipper"></i> Download all (ZIP)</button>' : ''}
          </div>
          <div id="outputList" class="mt-4 space-y-3"></div>
        </div>`);
      const list = $('#outputList', box);

      outputs.forEach((o, i) => {
        const blob = new Blob([o.data], { type: o.mime || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const isImage = (o.mime || '').startsWith('image/');
        const card = el(`
          <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
            <div class="w-11 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden grid place-items-center shrink-0">
              ${isImage ? `<img src="${url}" class="w-full h-full object-cover" alt="">` : `<i class="fa-solid ${o.mime === 'text/plain' ? 'fa-file-lines text-slate-500' : 'fa-file-pdf text-rose-500'}"></i>`}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-slate-900 text-sm truncate">${esc(o.name)}</p>
              <p class="text-xs text-slate-500 mt-0.5">${U.formatBytes(blob.size)}</p>
            </div>
            <a href="${url}" download="${esc(o.name)}" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shrink-0">
              <i class="fa-solid fa-download"></i> Download
            </a>
          </div>`);
        list.appendChild(card);
      });

      const zipBtn = $('#zipAll', box);
      if (zipBtn) {
        zipBtn.onclick = async () => {
          const used = new Set();
          await U.downloadZip(outputs.map(o => ({
            name: U.uniqueName(o.name, used),
            data: o.data
          })), U.baseName(state.entries[0]?.name || 'pdfnest') + '-results.zip');
        };
      }

      panel.appendChild(box);
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // auto-download a single output (unless the ZIP already handled it)
      if (!zipped) {
        if (outputs.length === 1) {
          const o = outputs[0];
          U.downloadBlob(new Blob([o.data], { type: o.mime || 'application/pdf' }), o.name);
        } else {
          toast(`${outputs.length} files ready — download them individually or as a ZIP.`, 'success', 6000);
        }
      }
    }

    // if the user arrived from the home page with files already chosen
    if (ToolSession.pending && ToolSession.pending.toolId === tool.id) {
      const pendingFiles = ToolSession.pending.files;
      ToolSession.pending = null;
      addFiles(pendingFiles);
    }

    return wrap;
  }

  /* =====================================================================
     Boot
     ===================================================================== */
  render();
  window.PDFNest.app = { navigate, render, toolCard };
})();
