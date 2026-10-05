/* =========================================================================
   PDFNest — processing engine
   Semua operasi PDF dijalankan di browser (pdf-lib + pdf.js + canvas).
   ========================================================================= */
(function (NS) {
  'use strict';

  const U = NS.util;
  const MM_TO_PT = U.MM_TO_PT;
  const mm = U.mmToPt;

  const L = () => window.PDFLib;
  const J = () => window.pdfjsLib;

  /* ------------------------------------------------------------- helpers */
  async function loadPdf(bytes, opts) {
    opts = opts || {};
    const { PDFDocument } = L();
    if (opts.password) {
      try {
        return await PDFDocument.load(bytes, { password: opts.password, updateMetadata: false });
      } catch (e) {
        if (/incorrect/i.test(String(e.message || ''))) throw new Error('Incorrect password. Please check it and try again.');
        throw new Error('Could not open the PDF: ' + (e.message || e));
      }
    }
    try {
      return await PDFDocument.load(bytes, { updateMetadata: false });
    } catch (e) {
      const m = String(e.message || '');
      if (/encrypt/i.test(m)) {
        const err = new Error(`“${opts.name || 'This PDF'}” is password protected. Unlock it first (Unlock PDF) or provide the password.`);
        err.name = 'PasswordRequired';
        throw err;
      }
      throw new Error('Could not read the PDF: ' + m);
    }
  }

  async function newDoc() {
    const { PDFDocument } = L();
    const doc = await PDFDocument.create();
    doc.setProducer('PDFNest');
    doc.setCreator('PDFNest — browser PDF toolkit');
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    return doc;
  }

  function stdFont(doc, name) {
    const { StandardFonts } = L();
    const key = String(name || 'Helvetica').replace(/[-_\s]/g, '').toLowerCase();
    const map = {
      helvetica: StandardFonts.Helvetica,
      helveticabold: StandardFonts.HelveticaBold,
      helveticaoblique: StandardFonts.HelveticaOblique,
      timesroman: StandardFonts.TimesRoman,
      timesbold: StandardFonts.TimesRomanBold,
      timesitalic: StandardFonts.TimesRomanItalic,
      courier: StandardFonts.Courier,
      courierbold: StandardFonts.CourierBold,
      courieroblique: StandardFonts.CourierOblique
    };
    return doc.embedFont(map[key] || StandardFonts.Helvetica);
  }

  async function copyPagesInto(outDoc, srcDoc, indices) {
    if (!indices.length) return [];
    const pages = await outDoc.copyPages(srcDoc, indices);
    pages.forEach(p => outDoc.addPage(p));
    return pages;
  }

  function pageSizeFromName(name, customW, customH) {
    if (name === 'custom') return [mm(customW || 210), mm(customH || 297)];
    return U.pageSizePt(name) || U.pageSizePt('a4');
  }

  function sanitizeWinAnsi(text) {
    // Standard PDF fonts use WinAnsi — replace unsupported glyphs so nothing crashes
    return String(text == null ? '' : text)
      .replace(/[\u2018\u2019\u201A]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u00A0\u2007\u202F]/g, ' ')
      .replace(/[^\u0000-\u00FF\u20AC\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2030\u2039\u203A]/g, '?');
  }

  function zipOutputs(outputs, baseName) {
    const used = new Set();
    return U.downloadZip(outputs.map(o => ({ name: U.uniqueName(o.name, used), data: o.data })), baseName + '.zip');
  }

  /* =====================================================================
     Operation registry — satu fungsi per tool id
     ===================================================================== */
  const OPS = {};

  /* --------------------------------------------------------------- merge */
  OPS['merge-pdf'] = async function (s, api) {
    const out = await newDoc();
    const total = s.entries.length;
    let pages = 0;
    for (let i = 0; i < total; i++) {
      const e = s.entries[i];
      api.progress((i / total) * 90, `Merging “${e.name}”…`);
      const src = await loadPdf(e.bytes, { name: e.name });
      const copied = await copyPagesInto(out, src, src.getPageIndices());
      pages += copied.length;
      await U.nextFrame();
    }
    api.progress(95, 'Writing the merged document…');
    const bytes = await out.save({ useObjectStreams: true });
    api.addOutput('merged.pdf', bytes, 'application/pdf');
    api.log(`Merged ${total} files (${pages} pages).`);
  };

  /* ------------------------------------------------- merge pdf + images */
  OPS['merge-pdf-image'] = async function (s, api) {
    const out = await newDoc();
    const opts = s.options;
    const total = s.entries.length;

    for (let i = 0; i < total; i++) {
      const e = s.entries[i];
      api.progress((i / total) * 90, `Adding “${e.name}”…`);

      if (e.kind === 'pdf') {
        const src = await loadPdf(e.bytes, { name: e.name });
        await copyPagesInto(out, src, src.getPageIndices());
      } else if (e.kind === 'image') {
        await addImagePages(out, e, opts);
      }
      await U.nextFrame();
    }

    api.progress(95, 'Writing the merged document…');
    const bytes = await out.save({ useObjectStreams: true });
    api.addOutput('merged.pdf', bytes, 'application/pdf');
  };

  async function addImagePages(doc, entry, opts) {
    const quality = (opts.quality == null ? 92 : opts.quality) / 100;
    const isJpeg = /\.jpe?g$/i.test(entry.name) || entry.file.type === 'image/jpeg';
    let embedded, w, h;
    if (isJpeg && quality >= 1) {
      embedded = await doc.embedJpg(entry.bytes);   // untouched, pixel for pixel
      w = embedded.width; h = embedded.height;
    } else {
      const converted = await U.imageFileToPng(entry.file);
      embedded = await doc.embedPng(converted.bytes);
      w = converted.width; h = converted.height;
    }

    let pageW, pageH;
    const sizeName = opts.imagePageSize || opts.pageSize || 'fit';
    if (sizeName === 'fit') {
      pageW = w; pageH = h;
    } else {
      [pageW, pageH] = pageSizeFromName(sizeName, opts.customW, opts.customH);
      const orient = opts.orientation || 'auto';
      const wantLandscape = orient === 'landscape' || (orient === 'auto' && w > h);
      if (wantLandscape && pageH > pageW) [pageW, pageH] = [pageH, pageW];
      if (orient === 'portrait' && pageW > pageH) [pageW, pageH] = [pageH, pageW];
    }

    const m = mm(opts.margin || 0);
    const availW = Math.max(1, pageW - m * 2);
    const availH = Math.max(1, pageH - m * 2);
    const page = doc.addPage([pageW, pageH]);
    const fit = opts.imageFit || opts.fit || 'contain';

    let dw, dh;
    if (fit === 'stretch') { dw = availW; dh = availH; }
    else {
      const scale = fit === 'cover' ? Math.max(availW / w, availH / h) : Math.min(availW / w, availH / h);
      dw = w * scale; dh = h * scale;
    }
    page.drawImage(embedded, { x: (pageW - dw) / 2, y: (pageH - dh) / 2, width: dw, height: dh });
    return page;
  }

  /* --------------------------------------------------------------- split */
  OPS['split-pdf'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const src = await loadPdf(entry.bytes, { name: entry.name });
    const n = src.getPageCount();
    const base = U.baseName(entry.name);
    const groups = [];

    if (opts.mode === 'ranges') {
      const raw = String(opts.ranges || '').trim();
      if (!raw) throw new Error('Enter at least one page range, e.g. 1-3, 4, 5-8.');
      raw.split(',').map(x => x.trim()).filter(Boolean).forEach(part => {
        const idx = U.parsePageRanges(part, n);
        if (idx.length) groups.push({ label: part.replace(/[^\w]+/g, '_'), indices: idx });
      });
      if (!groups.length) throw new Error('No valid page range found for this document (' + n + ' pages).');
    } else if (opts.mode === 'every') {
      const step = Math.max(1, parseInt(opts.every, 10) || 1);
      for (let i = 0; i < n; i += step) {
        groups.push({ label: `${i + 1}-${Math.min(i + step, n)}`, indices: Array.from({ length: Math.min(step, n - i) }, (_, k) => i + k) });
      }
    } else if (opts.mode === 'parts') {
      const parts = Math.max(2, parseInt(opts.parts, 10) || 2);
      const per = Math.ceil(n / parts);
      for (let i = 0; i < n; i += per) {
        groups.push({ label: `${i + 1}-${Math.min(i + per, n)}`, indices: Array.from({ length: Math.min(per, n - i) }, (_, k) => i + k) });
      }
    } else {
      for (let i = 0; i < n; i++) groups.push({ label: String(i + 1), indices: [i] });
    }

    for (let i = 0; i < groups.length; i++) {
      api.progress((i / groups.length) * 92, `Creating part ${i + 1} of ${groups.length}…`);
      const out = await newDoc();
      await copyPagesInto(out, src, groups[i].indices);
      const bytes = await out.save({ useObjectStreams: true });
      api.addOutput(`${base}-part${i + 1}-pages-${groups[i].label}.pdf`, bytes, 'application/pdf');
      await U.nextFrame();
    }
    api.log(`Split into ${groups.length} documents.`);
  };

  /* ------------------------------------------------------------ organize */
  OPS['organize-pdf'] = async function (s, api) {
    const entry = s.entries[0];
    const src = await loadPdf(entry.bytes, { name: entry.name });
    let order = (s.pageOrder && s.pageOrder.length) ? s.pageOrder.slice() : src.getPageIndices();
    if (s.options.reverse) order = order.slice().reverse();
    if (!order.length) throw new Error('Every page was removed — keep at least one page.');

    api.progress(30, 'Reordering pages…');
    const out = await newDoc();
    const copied = await copyPagesInto(out, src, order);
    copied.forEach((page, i) => {
      const srcIndex = order[i];
      const extra = s.rotations[srcIndex] || 0;
      if (extra) {
        const current = page.getRotation().angle || 0;
        const { degrees } = L();
        page.setRotation(degrees((current + extra) % 360));
      }
    });
    api.progress(85, 'Writing the document…');
    const bytes = await out.save({ useObjectStreams: true });
    api.addOutput(`${U.baseName(entry.name)}-organized.pdf`, bytes, 'application/pdf');
  };

  /* -------------------------------------------------------- remove pages */
  OPS['remove-pages'] = async function (s, api) {
    const entry = s.entries[0];
    const src = await loadPdf(entry.bytes, { name: entry.name });
    const n = src.getPageCount();
    const remove = new Set(s.selectedPages);

    if (s.options.removeBlank) {
      api.progress(5, 'Looking for blank pages…');
      const pj = await U.openPdfjs(entry.bytes);
      for (let p = 1; p <= pj.numPages; p++) {
        const page = await pj.getPage(p);
        const canvas = await U.renderPageToCanvas(page, 0.4, { background: '#ffffff' });
        if (U.isBlankCanvas(canvas, 245, 0.0012)) remove.add(p - 1);
        page.cleanup();
        if (p % 5 === 0) { api.progress(5 + (p / pj.numPages) * 45, `Scanning page ${p} of ${pj.numPages}…`); await U.nextFrame(); }
      }
      pj.destroy();
    }

    if (!remove.size) throw new Error('Select at least one page to remove (or enable blank-page detection).');
    const keep = Array.from({ length: n }, (_, i) => i).filter(i => !remove.has(i));
    if (!keep.length) throw new Error('You cannot remove every page of the document.');

    api.progress(70, 'Building the new document…');
    const out = await newDoc();
    await copyPagesInto(out, src, keep);
    const bytes = await out.save({ useObjectStreams: true });
    api.addOutput(`${U.baseName(entry.name)}-pages-removed.pdf`, bytes, 'application/pdf');
    api.log(`Removed ${remove.size} of ${n} pages.`);
  };

  /* ------------------------------------------------------- extract pages */
  OPS['extract-pages'] = async function (s, api) {
    const entry = s.entries[0];
    const src = await loadPdf(entry.bytes, { name: entry.name });
    const n = src.getPageCount();
    const indices = [...s.selectedPages].sort((a, b) => a - b);
    if (!indices.length) throw new Error('Select the pages you want to extract.');
    const base = U.baseName(entry.name);

    if (s.options.asSeparate) {
      for (let i = 0; i < indices.length; i++) {
        api.progress((i / indices.length) * 92, `Extracting page ${indices[i] + 1}…`);
        const out = await newDoc();
        await copyPagesInto(out, src, [indices[i]]);
        api.addOutput(`${base}-page-${indices[i] + 1}.pdf`, await out.save({ useObjectStreams: true }), 'application/pdf');
        await U.nextFrame();
      }
    } else {
      api.progress(40, 'Extracting pages…');
      const out = await newDoc();
      await copyPagesInto(out, src, indices);
      const rangeLabel = indices.length === n ? 'all' : indices.map(i => i + 1).join('-');
      api.addOutput(`${base}-extracted-${rangeLabel}.pdf`, await out.save({ useObjectStreams: true }), 'application/pdf');
    }
    api.log(`Extracted ${indices.length} page(s).`);
  };

  /* ------------------------------------------------------------ compress */
  OPS['compress-pdf'] = async function (s, api) {
    const opts = s.options;
    const entries = s.entries;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const share = (pct, text) => api.progress(((i + pct / 100) / entries.length) * 95, text);
      if (e.kind !== 'pdf') { api.log(`Skipped “${e.name}” (not a PDF).`); continue; }

      if (opts.mode === 'light') {
        await compressLight(e, opts, share, api);
      } else {
        await compressStrong(e, opts, share, api);
      }
      await U.nextFrame();
    }
  };

  async function compressLight(entry, opts, report, api) {
    report(20, `Repacking “${entry.name}”…`);
    const doc = await loadPdf(entry.bytes, { name: entry.name });
    if (opts.stripMeta) stripMetadata(doc);
    const bytes = await doc.save({ useObjectStreams: true });
    report(90, 'Done');
    const out = bytes.length < entry.size ? bytes : entry.bytes;
    api.addOutput(`${U.baseName(entry.name)}-compressed.pdf`, out, 'application/pdf');
    api.log(`${entry.name}: ${U.formatBytes(entry.size)} → ${U.formatBytes(out.length)}${out === entry.bytes ? ' (already optimal)' : ''}`);
  }

  async function compressStrong(entry, opts, report, api) {
    const dpi = opts.dpi || 110;
    const grayscale = !!opts.grayscale;
    const target = opts.targetEnabled && opts.targetKb ? opts.targetKb * 1024 : 0;

    report(5, `Rendering “${entry.name}”…`);
    const pj = await U.openPdfjs(entry.bytes);
    const sizes = [];
    for (let p = 1; p <= pj.numPages; p++) {
      const page = await pj.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      sizes.push([vp.width, vp.height]);
      page.cleanup();
    }

    let renderedScale = 0;
    let canvases = [];

    // Render (or re-render) every page at the given DPI, reusing the open document
    async function renderAll(atDpi) {
      const scale = atDpi / 72;
      if (Math.abs(scale - renderedScale) < 0.001 && canvases.length) return;
      renderedScale = scale;
      canvases = [];
      for (let p = 1; p <= pj.numPages; p++) {
        const page = await pj.getPage(p);
        canvases.push(await U.renderPageToCanvas(page, scale, { background: '#ffffff' }));
        page.cleanup();
        report(5 + (p / pj.numPages) * 55, `Rendering page ${p} of ${pj.numPages} at ${Math.round(atDpi)} DPI…`);
        if (p % 3 === 0) await U.nextFrame();
      }
    }

    await renderAll(dpi);

    async function buildAt(quality) {
      const { PDFDocument } = L();
      const out = await PDFDocument.create();
      for (let i = 0; i < canvases.length; i++) {
        let canvas = canvases[i];
        if (grayscale) canvas = toGrayCanvas(canvas);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
        const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const [w, h] = sizes[i];
        const page = out.addPage([w, h]);
        page.drawImage(img, { x: 0, y: 0, width: w, height: h });
      }
      if (opts.stripMeta) stripMetadata(out);
      return out.save({ useObjectStreams: true });
    }

    let quality = (opts.quality || 65) / 100;
    report(68, 'Encoding pages…');
    let bytes = await buildAt(quality);
    let usedDpi = dpi;

    // Chase the requested file size by lowering quality first, then resolution
    if (target && bytes.length > target) {
      const attempts = [];
      [0.5, 0.34, 0.22, 0.14, 0.09].forEach(q => attempts.push({ q, dpiFactor: 1 }));
      [0.85, 0.7, 0.55, 0.45, 0.35, 0.25].forEach(f => attempts.push({ q: 0.45, dpiFactor: f }));

      for (let i = 0; i < attempts.length && bytes.length > target; i++) {
        const a = attempts[i];
        const nextDpi = Math.max(40, Math.round(dpi * a.dpiFactor));
        await renderAll(nextDpi);
        usedDpi = nextDpi;
        report(72 + (i / attempts.length) * 20,
          `Trying quality ${Math.round(a.q * 100)}% at ${nextDpi} DPI to reach ${U.formatBytes(target)}…`);
        bytes = await buildAt(a.q);
        await U.nextFrame();
      }
      if (bytes.length <= target) api.log(`Target reached at ${usedDpi} DPI.`);
      else api.log(`Closest achievable size is ${U.formatBytes(bytes.length)} — the source images cannot shrink further without becoming unreadable.`);
    }

    pj.destroy();

    report(95, 'Finishing…');
    if (bytes.length >= entry.size) {
      api.log(`${entry.name}: ${U.formatBytes(entry.size)} → ${U.formatBytes(bytes.length)} — strong compression did not help, returning the original file.`);
      api.addOutput(entry.name, entry.bytes, 'application/pdf');
      return;
    }
    api.addOutput(`${U.baseName(entry.name)}-compressed.pdf`, bytes, 'application/pdf');
    api.log(`${entry.name}: ${U.formatBytes(entry.size)} → ${U.formatBytes(bytes.length)} (${Math.max(1, Math.round(100 - bytes.length / entry.size * 100))}% smaller)`);
  }

  function toGrayCanvas(canvas) {
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  function stripMetadata(doc) {
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject('');
    doc.setKeywords([]); doc.setProducer(''); doc.setCreator('');
  }

  /* -------------------------------------------------------------- resize */
  OPS['resize-pdf'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const src = await loadPdf(entry.bytes, { name: entry.name });
    const n = src.getPageCount();
    const out = await newDoc();

    // drawPage() needs an embedded copy of every page first
    const embedded = [];
    for (let i = 0; i < n; i++) embedded.push(await out.embedPage(src.getPage(i)));

    for (let i = 0; i < n; i++) {
      const mb = src.getPage(i).getMediaBox();
      const srcW = mb.width, srcH = mb.height;
      let [tw, th] = pageSizeFromName(opts.size, opts.customW, opts.customH);
      const orient = opts.orientation || 'auto';
      const landscape = orient === 'landscape' || (orient === 'auto' && srcW > srcH);
      if (landscape && th > tw) [tw, th] = [th, tw];
      if (orient === 'portrait' && tw > th) [tw, th] = [th, tw];

      const m = mm(opts.margin || 0);
      const availW = Math.max(1, tw - m * 2);
      const availH = Math.max(1, th - m * 2);
      const stretch = opts.fit === 'stretch';
      const scale = stretch ? null : Math.min(availW / srcW, availH / srcH);
      const dw = stretch ? availW : srcW * scale;
      const dh = stretch ? availH : srcH * scale;

      const page = out.addPage([tw, th]);
      page.drawPage(embedded[i], { x: (tw - dw) / 2, y: (th - dh) / 2, width: dw, height: dh });
      api.progress((i / n) * 88, `Scaling page ${i + 1} of ${n}…`);
      if (i % 5 === 0) await U.nextFrame();
    }
    api.progress(96, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-${opts.size === 'custom' ? 'resized' : opts.size}.pdf`, await out.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* ---------------------------------------------------------------- n-up */
  OPS['n-up-pdf'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const src = await loadPdf(entry.bytes, { name: entry.name });
    const n = src.getPageCount();
    const per = parseInt(opts.perSheet, 10) || 2;
    const [sheetW0, sheetH0] = U.pageSizePt(opts.size || 'a4');
    let sheetW = sheetW0, sheetH = sheetH0;
    if (opts.orientation === 'landscape' && sheetH > sheetW) [sheetW, sheetH] = [sheetH, sheetW];

    const cols = per <= 2 ? 2 : per <= 4 ? 2 : 3;
    const rows = Math.ceil(per / cols);
    const gap = opts.gap || 0;
    const cellW = (sheetW - gap * (cols + 1)) / cols;
    const cellH = (sheetH - gap * (rows + 1)) / rows;

    const out = await newDoc();
    const embedded = [];
    for (let i = 0; i < n; i++) embedded.push(await out.embedPage(src.getPage(i)));

    const sheets = Math.ceil(n / per);
    for (let sIdx = 0; sIdx < sheets; sIdx++) {
      api.progress((sIdx / sheets) * 90, `Building sheet ${sIdx + 1} of ${sheets}…`);
      const page = out.addPage([sheetW, sheetH]);
      for (let k = 0; k < per; k++) {
        const idx = sIdx * per + k;
        if (idx >= n) break;
        const col = k % cols, row = Math.floor(k / cols);
        const x = gap + col * (cellW + gap);
        const y = sheetH - gap - (row + 1) * cellH - row * gap;
        const emb = embedded[idx];
        const scale = Math.min(cellW / emb.width, cellH / emb.height);
        const dw = emb.width * scale, dh = emb.height * scale;
        page.drawPage(emb, { x: x + (cellW - dw) / 2, y: y + (cellH - dh) / 2, width: dw, height: dh });
        if (opts.border) {
          const { rgb } = L();
          page.drawRectangle({ x, y, width: cellW, height: cellH, borderColor: rgb(0.78, 0.8, 0.85), borderWidth: 0.6 });
        }
      }
      await U.nextFrame();
    }
    api.progress(96, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-${per}up.pdf`, await out.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* -------------------------------------------------------------- rotate */
  OPS['rotate-pdf'] = async function (s, api) {
    const entry = s.entries[0];
    const src = await loadPdf(entry.bytes, { name: entry.name });
    const { degrees } = L();
    const angle = parseInt(s.options.angle, 10) || 90;
    const targets = s.selectedPages.size
      ? [...s.selectedPages]
      : src.getPageIndices();

    targets.forEach((idx, i) => {
      const page = src.getPage(idx);
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees((current + angle) % 360));
      api.progress((i / targets.length) * 85, `Rotating page ${idx + 1}…`);
    });
    api.progress(92, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-rotated.pdf`, await src.save({ useObjectStreams: true }), 'application/pdf');
    api.log(`Rotated ${targets.length} page(s) by ${angle}°.`);
  };

  /* ---------------------------------------------------------------- crop */
  OPS['crop-pdf'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const doc = await loadPdf(entry.bytes, { name: entry.name });
    const pages = doc.getPages();

    if (opts.mode === 'auto') {
      const pj = await U.openPdfjs(entry.bytes);
      const threshold = opts.threshold || 245;
      const pad = mm(opts.padding || 0);
      for (let i = 0; i < pages.length; i++) {
        api.progress((i / pages.length) * 88, `Detecting content on page ${i + 1} of ${pages.length}…`);
        try {
          const page = await pj.getPage(i + 1);
          const scale = 1.4;
          const canvas = await U.renderPageToCanvas(page, scale, { background: '#ffffff' });
          const bbox = U.contentBBox(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height), threshold);
          const view = page.getViewport({ scale: 1 });
          if (bbox) {
            const pt = doc.getPage(i);
            const mb = pt.getMediaBox();
            const sx = mb.width / view.width, sy = mb.height / view.height;
            const x = mb.x + (bbox.minX / scale) * sx - pad;
            const y = mb.y + mb.height - (bbox.maxY / scale) * sy - pad;
            const w = ((bbox.maxX - bbox.minX) / scale) * sx + pad * 2;
            const h = ((bbox.maxY - bbox.minY) / scale) * sy + pad * 2;
            const cx = Math.max(mb.x, x);
            const cy = Math.max(mb.y, y);
            const cw = Math.min(mb.width - (cx - mb.x), w);
            const ch = Math.min(mb.height - (cy - mb.y), h);
            if (cw > 20 && ch > 20) pt.setCropBox(cx, cy, cw, ch);
          }
          page.cleanup();
        } catch (e) { api.log(`Page ${i + 1} skipped: ${e.message}`); }
        if (i % 4 === 0) await U.nextFrame();
      }
      pj.destroy();
    } else {
      const t = mm(opts.top || 0), r = mm(opts.right || 0), b = mm(opts.bottom || 0), l = mm(opts.left || 0);
      pages.forEach((page, i) => {
        api.progress((i / pages.length) * 85, `Cropping page ${i + 1}…`);
        const mb = page.getMediaBox();
        const w = mb.width - l - r;
        const h = mb.height - b - t;
        if (w <= 20 || h <= 20) throw new Error('The margins are too large — the page would be empty.');
        page.setCropBox(mb.x + l, mb.y + b, w, h);
      });
    }
    api.progress(93, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-cropped.pdf`, await doc.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* -------------------------------------------------------- page numbers */
  OPS['add-page-numbers'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const doc = await loadPdf(entry.bytes, { name: entry.name });
    const font = await stdFont(doc, opts.font);
    const pages = doc.getPages();
    const total = pages.length;
    const { rgb } = L();
    const color = U.hexToRgb01(opts.color || '#111827');
    const size = opts.size || 12;
    const margin = opts.margin || 24;
    const skip = opts.skipFirst || 0;
    const startAt = opts.startAt != null ? opts.startAt : 1;

    pages.forEach((page, i) => {
      api.progress((i / total) * 85, `Numbering page ${i + 1} of ${total}…`);
      if (i < skip) return;
      const label = sanitizeWinAnsi(String(opts.format || '{n}')
        .replace(/\{n\}/g, String(startAt + (i - skip)))
        .replace(/\{total\}/g, String(total))
        .replace(/\{count\}/g, String(total - skip)));
      const { width, height } = page.getSize();
      const textW = font.widthOfTextAtSize(label, size);
      const pos = positionToXY(opts.position || 'bottom-center', width, height, textW, size, margin);
      page.drawText(label, { x: pos.x, y: pos.y, size, font, color: rgb(color.r, color.g, color.b) });
      if (opts.firstPageCover) {
        const y = opts.position && opts.position.startsWith('top') ? pos.y - 6 : pos.y + size + 6;
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.85) });
      }
    });
    api.progress(93, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-numbered.pdf`, await doc.save({ useObjectStreams: true }), 'application/pdf');
  };

  function positionToXY(position, pageW, pageH, itemW, itemH, margin) {
    const m = margin;
    switch (position) {
      case 'top-left': return { x: m, y: pageH - m - itemH };
      case 'top-center': return { x: (pageW - itemW) / 2, y: pageH - m - itemH };
      case 'top-right': return { x: pageW - m - itemW, y: pageH - m - itemH };
      case 'bottom-left': return { x: m, y: m };
      case 'bottom-right': return { x: pageW - m - itemW, y: m };
      case 'center': return { x: (pageW - itemW) / 2, y: (pageH - itemH) / 2 };
      default: return { x: (pageW - itemW) / 2, y: m };
    }
  }

  /* ----------------------------------------------------------- watermark */
  OPS['add-watermark'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const doc = await loadPdf(entry.bytes, { name: entry.name });
    const pages = doc.getPages();
    const total = pages.length;
    const { rgb, degrees } = L();
    const opacity = Math.max(0.05, (opts.opacity || 25) / 100);
    const rot = opts.rotation || 0;

    let targetSet = null;
    const spec = String(opts.pages || 'all').trim();
    if (spec && spec.toLowerCase() !== 'all') {
      targetSet = new Set(U.parsePageRanges(spec, total));
      if (!targetSet.size) throw new Error('No pages match “' + spec + '”. Use “all” or ranges like 1-3,7.');
    }

    let image = null, imgW = 0, imgH = 0, font = null;
    if (opts.kind === 'image') {
      if (!opts.imageFile) throw new Error('Choose a PNG or JPG image for the watermark.');
      const conv = await U.imageFileToPng(opts.imageFile);
      image = await doc.embedPng(conv.bytes);
      imgW = conv.width; imgH = conv.height;
    } else {
      font = await stdFont(doc, opts.font);
    }

    pages.forEach((page, i) => {
      api.progress((i / total) * 85, `Watermarking page ${i + 1} of ${total}…`);
      if (targetSet && !targetSet.has(i)) return;
      const { width, height } = page.getSize();
      const color = U.hexToRgb01(opts.color || '#ef4444');
      const drawOne = (cx, cy, scale) => {
        if (opts.kind === 'image') {
          const w = width * ((opts.scale || 40) / 100) * scale;
          const h = w * (imgH / imgW);
          page.drawImage(image, { x: cx - w / 2, y: cy - h / 2, width: w, height: h, opacity, rotate: degrees(rot) });
        } else {
          const text = sanitizeWinAnsi(opts.text || 'CONFIDENTIAL');
          const size = (opts.fontSize || 48) * scale;
          const tw = font.widthOfTextAtSize(text, size);
          page.drawText(text, {
            x: cx - tw / 2, y: cy - size * 0.36, size, font,
            color: rgb(color.r, color.g, color.b), opacity, rotate: degrees(rot)
          });
        }
      };

      if (opts.tile) {
        const stepX = width / 3, stepY = height / 4;
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) drawOne(stepX * (c + 0.5), stepY * (r + 0.5), 0.5);
      } else {
        const m = 60;
        const pos = opts.position || 'center';
        const cx = pos.endsWith('left') ? m + width * 0.18 : pos.endsWith('right') ? width - m - width * 0.18 : width / 2;
        const cy = pos.startsWith('top') ? height - m - height * 0.12 : pos.startsWith('bottom') ? m + height * 0.12 : height / 2;
        drawOne(cx, cy, 1);
      }
    });
    api.progress(93, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-watermarked.pdf`, await doc.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* ------------------------------------------------------------ metadata */
  OPS['edit-metadata'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const doc = await loadPdf(entry.bytes, { name: entry.name });
    api.progress(40, 'Updating metadata…');

    if (opts.removeAll) {
      stripMetadata(doc);
    } else {
      doc.setTitle(opts.title || '');
      doc.setAuthor(opts.author || '');
      doc.setSubject(opts.subject || '');
      doc.setKeywords(String(opts.keywords || '').split(',').map(k => k.trim()).filter(Boolean));
      doc.setCreator(opts.creator || '');
      doc.setProducer(opts.producer || '');
    }
    if (opts.setDates) {
      doc.setCreationDate(new Date());
      doc.setModificationDate(new Date());
    }
    api.progress(88, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-metadata.pdf`, await doc.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* ------------------------------------------------------------- flatten */
  OPS['flatten-pdf'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const doc = await loadPdf(entry.bytes, { name: entry.name });
    api.progress(30, 'Flattening…');

    if (opts.forms) {
      try { doc.getForm().flatten(); } catch (e) { api.log('No form fields found.'); }
    }
    if (opts.annotations) {
      const { PDFName } = L();
      doc.getPages().forEach(page => {
        try { page.node.delete(PDFName.of('Annots')); } catch (e) { /* nothing to remove */ }
      });
    }
    api.progress(88, 'Writing the document…');
    api.addOutput(`${U.baseName(entry.name)}-flattened.pdf`, await doc.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* -------------------------------------------------------- image -> pdf */
  OPS['image-to-pdf'] = async function (s, api) {
    const opts = s.options;
    const out = await newDoc();
    const total = s.entries.length;
    const quality = (opts.quality || 92) / 100;

    for (let i = 0; i < total; i++) {
      const e = s.entries[i];
      api.progress((i / total) * 90, `Adding “${e.name}” (${i + 1} of ${total})…`);
      if (e.kind === 'pdf') { const src = await loadPdf(e.bytes, { name: e.name }); await copyPagesInto(out, src, src.getPageIndices()); }
      else if (e.kind === 'image') await addImagePages(out, e, Object.assign({}, opts, { imagePageSize: opts.pageSize, imageFit: opts.fit, margin: opts.margin }));
      else api.log(`Skipped “${e.name}” — not an image or PDF.`);
      await U.nextFrame();
    }
    api.progress(94, 'Writing the PDF…');
    api.addOutput(`${U.baseName(s.entries[0].name)}${total > 1 ? '-and-' + (total - 1) + '-more' : ''}.pdf`, await out.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* ---------------------------------------------------------- txt -> pdf */
  OPS['txt-to-pdf'] = async function (s, api) {
    const opts = s.options;
    const { PDFDocument } = L();
    const out = await PDFDocument.create();
    out.setProducer('PDFNest');
    const font = await stdFont(out, opts.font);
    const size = opts.fontSize || 11;
    const [pw, ph] = pageSizeFromName(opts.size || 'a4');
    const m = mm(opts.margin || 20);
    const lineH = size * (opts.lineHeight || 1.4);
    const maxW = pw - m * 2;
    const baseName = s.entries.length === 1 ? U.baseName(s.entries[0].name) : 'text-files';

    let page = out.addPage([pw, ph]);
    let y = ph - m;

    const newPage = () => { page = out.addPage([pw, ph]); y = ph - m; };
    const drawLine = (line) => {
      if (y < m + lineH) newPage();
      page.drawText(line, { x: m, y: y - size, size, font, lineHeight: lineH });
      y -= lineH;
    };

    for (let i = 0; i < s.entries.length; i++) {
      const e = s.entries[i];
      api.progress((i / s.entries.length) * 85, `Converting “${e.name}”…`);
      const text = await U.readAsText(e.file);
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      for (const rawLine of lines) {
        let line = sanitizeWinAnsi(rawLine);
        if (opts.wrap !== false) {
          while (font.widthOfTextAtSize(line, size) > maxW && line.length > 1) {
            let cut = line.length;
            while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxW) cut--;
            drawLine(line.slice(0, cut));
            line = line.slice(cut);
          }
        }
        drawLine(line);
      }
      if (i < s.entries.length - 1) newPage();
      await U.nextFrame();
    }

    if (opts.numbers) {
      const pages = out.getPages();
      const { rgb } = L();
      pages.forEach((p, i) => {
        const label = `${i + 1} / ${pages.length}`;
        const w = font.widthOfTextAtSize(label, 9);
        p.drawText(label, { x: (pw - w) / 2, y: m / 2, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
      });
    }

    api.progress(94, 'Writing the PDF…');
    api.addOutput(`${baseName}.pdf`, await out.save({ useObjectStreams: true }), 'application/pdf');
  };

  /* -------------------------------------------------------- pdf -> image */
  OPS['pdf-to-image'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const pj = await U.openPdfjs(entry.bytes);
    const all = Array.from({ length: pj.numPages }, (_, i) => i);
    const targets = s.selectedPages.size ? [...s.selectedPages].sort((a, b) => a - b) : all;
    const scale = (opts.dpi || 150) / 72;
    const fmt = opts.format || 'png';
    const base = U.baseName(entry.name);
    const pad = String(targets.length).length;

    for (let k = 0; k < targets.length; k++) {
      const pageIndex = targets[k];
      api.progress((k / targets.length) * 92, `Rendering page ${pageIndex + 1} (${k + 1} of ${targets.length})…`);
      const page = await pj.getPage(pageIndex + 1);
      const canvas = await U.renderPageToCanvas(page, scale, { alpha: fmt === 'png' && opts.transparent, background: fmt === 'png' && opts.transparent ? undefined : '#ffffff' });
      const blob = await new Promise(r => canvas.toBlob(r, fmt === 'png' ? 'image/png' : 'image/jpeg', fmt === 'png' ? undefined : (opts.quality || 92) / 100));
      const name = `${base}-page-${String(pageIndex + 1).padStart(pad, '0')}.${fmt}`;
      api.addOutput(name, new Uint8Array(await blob.arrayBuffer()), fmt === 'png' ? 'image/png' : 'image/jpeg');
      page.cleanup();
      if (k % 3 === 0) await U.nextFrame();
    }
    pj.destroy();
    if (s.options.zip && false) { /* ZIP is offered by the results panel */ }
  };

  /* --------------------------------------------------------- pdf -> text */
  OPS['pdf-to-text'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const pj = await U.openPdfjs(entry.bytes);
    const all = Array.from({ length: pj.numPages }, (_, i) => i);
    const targets = s.selectedPages.size ? [...s.selectedPages].sort((a, b) => a - b) : all;
    const base = U.baseName(entry.name);

    const perPage = [];
    for (let k = 0; k < targets.length; k++) {
      const pageIndex = targets[k];
      api.progress((k / targets.length) * 90, `Extracting text from page ${pageIndex + 1} (${k + 1} of ${targets.length})…`);
      const page = await pj.getPage(pageIndex + 1);
      const content = await page.getTextContent();
      perPage.push({ pageIndex, text: itemsToText(content.items, opts.layout === 'flow') });
      page.cleanup();
      if (k % 3 === 0) await U.nextFrame();
    }
    pj.destroy();

    if (opts.oneFilePerPage) {
      perPage.forEach(({ pageIndex, text }, i) => {
        api.progress(92 + (i / perPage.length) * 6, `Writing file ${i + 1}…`);
        api.addOutput(`${base}-page-${pageIndex + 1}.txt`, text, 'text/plain');
      });
      return;
    }

    let out = '';
    perPage.forEach(({ pageIndex, text }) => {
      if (opts.pageMarkers !== false) out += `--- Page ${pageIndex + 1} ---\n`;
      out += text.trimEnd() + '\n\n';
    });
    api.progress(95, 'Writing the text file…');
    api.addOutput(`${base}.txt`, out, 'text/plain');
  };

  function itemsToText(items, flow) {
    if (!items.length) return '';
    const lines = [];
    let current = '';
    let lastY = null;
    items.forEach(item => {
      const str = item.str;
      if (str === undefined) return;
      const y = item.transform ? Math.round(item.transform[5] * 2) / 2 : lastY;
      if (flow) {
        current += (current && !/\s$/.test(current) ? ' ' : '') + str;
        return;
      }
      if (lastY !== null && Math.abs((y ?? 0) - lastY) > 2) {
        lines.push(current.replace(/\s+$/, ''));
        current = str;
      } else {
        current += str;
      }
      lastY = y;
      if (item.hasEOL) {
        lines.push(current.replace(/\s+$/, ''));
        current = '';
        lastY = null;
      }
    });
    if (current.trim()) lines.push(current.replace(/\s+$/, ''));
    return lines.join('\n') + '\n';
  }

  /* ------------------------------------------------------ extract images */
  OPS['extract-images'] = async function (s, api) {
    const entry = s.entries[0];
    const opts = s.options;
    const pj = await U.openPdfjs(entry.bytes);
    const minSize = opts.minSize || 0;
    const fmt = opts.format || 'png';
    const base = U.baseName(entry.name);
    let count = 0;

    for (let p = 1; p <= pj.numPages; p++) {
      api.progress(((p - 1) / pj.numPages) * 90, `Scanning page ${p} of ${pj.numPages} for images…`);
      const page = await pj.getPage(p);
      let ops;
      try { ops = await page.getOperatorList(); } catch (e) { continue; }

      const names = new Set();
      const OPS = J().OPS;
      const imageOps = [OPS.paintImageXObject, OPS.paintJpegXObject, OPS.paintImageMaskXObject, OPS.paintInlineImageXObject];
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (imageOps.includes(ops.fnArray[i])) {
          const arg = ops.argsArray[i] && ops.argsArray[i][0];
          if (typeof arg === 'string') names.add(arg);
          else if (arg && typeof arg === 'object') names.add('__inline_' + i);
        }
      }

      let idx = 0;
      for (const name of names) {
        let obj = null;
        if (name.startsWith('__inline_')) {
          const i = parseInt(name.replace('__inline_', ''), 10);
          obj = ops.argsArray[i][0];
        } else {
          obj = await getPdfjsObject(page, name);
        }
        if (!obj || !obj.width || !obj.height) continue;
        if (Math.max(obj.width, obj.height) < minSize) continue;

        const canvas = pdfjsImageToCanvas(obj);
        if (!canvas) continue;
        idx++; count++;
        const blob = await new Promise(r => canvas.toBlob(r, fmt === 'png' ? 'image/png' : 'image/jpeg', fmt === 'png' ? undefined : 0.92));
        api.addOutput(`${base}-p${p}-img${idx}.${fmt}`, new Uint8Array(await blob.arrayBuffer()), fmt === 'png' ? 'image/png' : 'image/jpeg');
      }
      page.cleanup();
      await U.nextFrame();
    }
    pj.destroy();
    if (!count) throw new Error('No embedded images were found in this PDF (pages may be vector-only or a single scanned image — try PDF to Image instead).');
    api.log(`Found ${count} image(s).`);
  };

  function getPdfjsObject(page, name) {
    return new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 4000);
      try {
        page.objs.get(name, obj => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(obj);
        });
      } catch (e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  function pdfjsImageToCanvas(obj) {
    const width = obj.width, height = obj.height;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const src = obj.data;
    const kind = obj.kind;
    const K = J().ImageKind;

    // Modern pdf.js decodes images into an ImageBitmap and drops the raw buffer
    if (obj.bitmap && typeof ImageBitmap !== 'undefined' && obj.bitmap instanceof ImageBitmap) {
      ctx.drawImage(obj.bitmap, 0, 0, width, height);
      return canvas;
    }
    if (!src) return null;

    const imgData = ctx.createImageData(width, height);
    const dest = imgData.data;

    if (kind === K.RGBA_32BPP || src.length === width * height * 4) {
      dest.set(src.subarray ? src.subarray(0, dest.length) : src);
    } else if (kind === K.RGB_24BPP || src.length === width * height * 3) {
      for (let i = 0, j = 0; i < width * height; i++, j += 3) {
        dest[i * 4] = src[j]; dest[i * 4 + 1] = src[j + 1]; dest[i * 4 + 2] = src[j + 2]; dest[i * 4 + 3] = 255;
      }
    } else if (kind === K.GRAYSCALE_1BPP || src.length === Math.ceil(width / 8) * height) {
      const rowBytes = Math.ceil(width / 8);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const byte = src[y * rowBytes + (x >> 3)];
          const bit = (byte >> (7 - (x & 7))) & 1;
          const v = bit ? 255 : 0;
          const i = (y * width + x) * 4;
          dest[i] = dest[i + 1] = dest[i + 2] = v; dest[i + 3] = 255;
        }
      }
    } else {
      return null;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /* ------------------------------------------------------------ protect */
  OPS['protect-pdf'] = async function (s, api) {
    const opts = s.options;
    if (!opts.userPassword) throw new Error('Enter a password to protect the document.');
    const entries = s.entries;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      api.progress(((i + 0.2) / entries.length) * 90, `Encrypting “${e.name}”…`);
      const doc = await loadPdf(e.bytes, { name: e.name });
      doc.encrypt({
        userPassword: opts.userPassword,
        ownerPassword: opts.ownerPassword || opts.userPassword,
        permissions: {
          printing: opts.allowPrint === false ? false : 'highResolution',
          modifying: !!opts.allowModify,
          copying: !!opts.allowCopy,
          annotating: opts.allowAnnotate !== false,
          fillingForms: opts.allowForms !== false,
          contentAccessibility: opts.allowAccessibility !== false,
          documentAssembly: !!opts.allowAssembly
        }
      });
      const bytes = await doc.save({ useObjectStreams: false });
      api.addOutput(`${U.baseName(e.name)}-protected.pdf`, bytes, 'application/pdf');
      await U.nextFrame();
    }
    api.log('Documents encrypted with AES-256 (revision 6).');
  };

  /* ------------------------------------------------------------- unlock */
  OPS['unlock-pdf'] = async function (s, api) {
    const password = s.options.password;
    if (!password) throw new Error('Enter the password that currently protects the file.');
    const entries = s.entries;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      api.progress(((i + 0.2) / entries.length) * 90, `Unlocking “${e.name}”…`);
      let doc;
      try {
        doc = await loadPdf(e.bytes, { password, name: e.name });
      } catch (err) {
        if (/incorrect/i.test(err.message)) throw new Error(`Incorrect password for “${e.name}”.`);
        throw err;
      }
      doc.setProducer('PDFNest');
      const bytes = await doc.save({ useObjectStreams: true });
      api.addOutput(`${U.baseName(e.name)}-unlocked.pdf`, bytes, 'application/pdf');
      await U.nextFrame();
    }
    api.log('Password protection removed.');
  };

  /* =====================================================================
     Public API
     ===================================================================== */
  async function run(session, hooks) {
    const op = OPS[session.tool.id] || (session.tool.baseTool && OPS[session.tool.baseTool]);
    if (!op) throw new Error('This tool is not available yet.');

    const outputs = [];
    const api = {
      progress: (pct, text) => hooks.progress && hooks.progress(U.clamp(pct, 0, 100), text),
      log: (msg) => hooks.log && hooks.log(msg),
      addOutput: (name, data, mime) => outputs.push({
        name,
        // normalise text output to bytes so downloads, ZIPs and previews all behave the same
        data: typeof data === 'string' ? new TextEncoder().encode(data) : data,
        mime: mime || 'application/pdf'
      })
    };

    await op(session, api);
    api.progress(100, 'Finished');

    // Some tools offer "return a single ZIP archive"
    let zipped = false;
    const wantsZip = session.options && session.options.zip && outputs.length > 1;
    if (wantsZip) {
      const used = new Set();
      await U.downloadZip(outputs.map(o => ({ name: U.uniqueName(o.name, used), data: o.data })),
        U.baseName(session.entries[0] ? session.entries[0].name : 'pdfnest') + '.zip');
      zipped = true;
    }

    outputs.forEach(o => hooks.addOutput && hooks.addOutput(o.name, o.data, o.mime));
    return { outputs, zipped };
  }

  NS.engine = { run, OPS, loadPdf, newDoc, copyPagesInto, stdFont, sanitizeWinAnsi };
})(window.PDFNest);
