/* =========================================================================
   PDFNest — core helpers (no build step, plain browser JavaScript)
   Exposes: PDFNest.util, PDFNest.pdfjs, PDFNest.toast, PDFNest.confirm
   ========================================================================= */
window.PDFNest = window.PDFNest || {};
(function (NS) {
  'use strict';

  // Resolve the vendor folder from this script's own URL so the app works from
  // any page depth (index.html, /test/harness.html, a local file, …)
  const selfUrl = (document.currentScript && document.currentScript.src) || '';
  const VENDOR = selfUrl ? selfUrl.replace(/js\/core\.js.*$/, '') + 'vendor/' : 'vendor/';

  /* --------------------------------------------------------- dependencies */
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  const deps = {
    pdfLib: () => window.PDFLib ? Promise.resolve() : loadScript(VENDOR + 'pdf-lib.min.js'),
    pdfjs: () => window.pdfjsLib ? Promise.resolve() : loadScript(VENDOR + 'pdf.min.js'),
    jszip: () => window.JSZip ? Promise.resolve() : loadScript(VENDOR + 'jszip.min.js')
  };

  // pdf.js needs to know where its worker lives
  const pdfjsReady = deps.pdfjs().then(() => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.min.js';
  });

  /* ------------------------------------------------------------- numbers */
  const PAGE_MM = {
    a4: [210, 297], a3: [297, 420], a5: [148, 210],
    letter: [215.9, 279.4], legal: [215.9, 355.6], tabloid: [279.4, 431.8]
  };
  const MM_TO_PT = 72 / 25.4;

  function mmToPt(mm) { return mm * MM_TO_PT; }
  function ptToMm(pt) { return pt / MM_TO_PT; }
  function pageSizePt(name) {
    const mm = PAGE_MM[name];
    if (!mm) return null;
    return [mmToPt(mm[0]), mmToPt(mm[1])];
  }

  function formatBytes(bytes) {
    if (bytes === 0 || bytes == null) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const v = bytes / Math.pow(1024, i);
    return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)) + ' ' + units[i];
  }

  function hexToRgb01(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
    if (!m) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(m[1], 16) / 255,
      g: parseInt(m[2], 16) / 255,
      b: parseInt(m[3], 16) / 255
    };
  }

  /* --------------------------------------------------------------- files */
  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('Could not read ' + file.name));
      fr.readAsArrayBuffer(file);
    });
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('Could not read ' + file.name));
      fr.readAsDataURL(file);
    });
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('Could not read ' + file.name));
      fr.readAsText(file);
    });
  }

  function baseName(name) {
    return String(name || 'document').replace(/\.[^.]+$/, '');
  }

  /* ---------------------------------------------------------- downloads */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function downloadBytes(bytes, filename, mime) {
    downloadBlob(new Blob([bytes], { type: mime || 'application/pdf' }), filename);
  }

  function downloadText(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename);
  }

  async function buildZip(entries) {
    await deps.jszip();
    const zip = new JSZip();
    entries.forEach(e => zip.file(e.name, e.data));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  async function downloadZip(entries, zipName) {
    const blob = await buildZip(entries);
    downloadBlob(blob, zipName);
    return blob;
  }

  function uniqueName(name, used) {
    if (!used.has(name)) { used.add(name); return name; }
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 2;
    while (used.has(`${stem} (${i})${ext}`)) i++;
    const out = `${stem} (${i})${ext}`;
    used.add(out);
    return out;
  }

  /* ------------------------------------------------------- page ranges */
  // "1-3, 5, 8-" -> [0,1,2,4,7] (0-based, sorted, de-duplicated)
  function parsePageRanges(text, pageCount) {
    const out = new Set();
    String(text || '').split(',').forEach(chunk => {
      const part = chunk.trim();
      if (!part) return;
      const m = /^(\d+)?\s*(?:-|–|to)\s*(\d+)?$/i.exec(part);
      if (m) {
        let a = m[1] ? parseInt(m[1], 10) : 1;
        let b = m[2] ? parseInt(m[2], 10) : pageCount;
        if (a > b) [a, b] = [b, a];
        for (let p = a; p <= b; p++) if (p >= 1 && p <= pageCount) out.add(p - 1);
      } else if (/^\d+$/.test(part)) {
        const p = parseInt(part, 10);
        if (p >= 1 && p <= pageCount) out.add(p - 1);
      }
    });
    return [...out].sort((a, b) => a - b);
  }

  function rangesFromSelection(selected, pageCount) {
    if (!selected || !selected.length) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }
    return [...selected].sort((a, b) => a - b);
  }

  /* ------------------------------------------------------ pdf.js bridge */
  async function openPdfjs(bytes, password) {
    await pdfjsReady;
    // pdf.js consumes/detaches the buffer, so always hand it a private copy
    const data = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
    const params = { data, useSystemFonts: true, isEvalSupported: false };
    if (password) params.password = password;
    try {
      return await window.pdfjsLib.getDocument(params).promise;
    } catch (err) {
      const name = err && err.name;
      if (name === 'PasswordException') {
        const e = new Error('This PDF is password protected. Unlock it first with the “Unlock PDF” tool, then try again.');
        e.name = 'PasswordRequired';
        throw e;
      }
      if (name === 'InvalidPDFException') {
        throw new Error('This file is not a valid PDF (it may be damaged or in a different format).');
      }
      throw err;
    }
  }

  async function renderPageToCanvas(page, scale, opts) {
    opts = opts || {};
    const viewport = page.getViewport({ scale });
    const canvas = opts.canvas || document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: !!opts.alpha });
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    if (opts.background && !opts.alpha) {
      ctx.save();
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    await page.render({ canvasContext: ctx, viewport, background: opts.background || undefined }).promise;
    return canvas;
  }

  // Render a page and return a JPEG blob (used by the compressor)
  async function renderPageToJpeg(page, scale, quality, grayscale) {
    const canvas = await renderPageToCanvas(page, scale, { background: '#ffffff' });
    if (grayscale) {
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
        d[i] = d[i + 1] = d[i + 2] = g;
      }
      ctx.putImageData(img, 0, 0);
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not encode the page')), 'image/jpeg', quality);
    });
  }

  // Finds the bounding box of non-white content (used by auto-crop)
  function contentBBox(imageData, threshold) {
    const { data, width, height } = imageData;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        const i = row + x * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        const isContent = a > 12 && (r < threshold || g < threshold || b < threshold);
        if (isContent) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // blank page
    return { minX, minY, maxX, maxY, width, height };
  }

  /* -------------------------------------------------------- misc helpers */
  function isBlankCanvas(canvas, threshold, ratioLimit) {
    threshold = threshold || 245;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    if (!width || !height) return true;
    const img = ctx.getImageData(0, 0, width, height).data;
    let content = 0;
    const total = width * height;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i + 3] > 12 && (img[i] < threshold || img[i + 1] < threshold || img[i + 2] < threshold)) content++;
    }
    return content / total < (ratioLimit || 0.001);
  }

  async function imageFileToPng(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function imageFileToJpeg(file, quality) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality || 0.92));
      return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.src = src;
    });
  }

  // Mix in the right case for smart-title
  function titleCase(str) {
    return String(str).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1));
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Yield to the browser so progress UI can repaint between heavy steps
  async function nextFrame() {
    return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  }

  /* --------------------------------------------------------------- toast */
  function toast(message, type, timeout) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const styles = {
      success: ['bg-emerald-600', 'fa-circle-check'],
      error: ['bg-rose-600', 'fa-circle-exclamation'],
      info: ['bg-slate-800', 'fa-circle-info'],
      warn: ['bg-amber-500', 'fa-triangle-exclamation']
    };
    const [bg, icon] = styles[type] || styles.info;
    const el = document.createElement('div');
    el.className = `toast ${bg} text-white shadow-lg rounded-xl px-4 py-3 flex items-start gap-3 max-w-sm pointer-events-auto`;
    el.innerHTML = `<i class="fa-solid ${icon} mt-0.5"></i><span class="text-sm leading-snug"></span>`;
    el.querySelector('span').textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 260);
    }, timeout || 4200);
  }

  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4';
      back.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div class="flex items-start gap-4">
            <div class="w-11 h-11 rounded-full bg-amber-100 text-amber-600 grid place-items-center shrink-0">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h3 class="font-semibold text-slate-900 text-lg"></h3>
              <p class="text-slate-600 text-sm mt-1 leading-relaxed"></p>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button data-no class="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-sm">Cancel</button>
            <button data-yes class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm"></button>
          </div>
        </div>`;
      back.querySelector('h3').textContent = opts.title || 'Are you sure?';
      back.querySelector('p').textContent = message;
      back.querySelector('[data-no]').textContent = opts.cancelText || 'Cancel';
      back.querySelector('[data-yes]').textContent = opts.confirmText || 'Continue';
      document.body.appendChild(back);
      const done = v => { back.remove(); resolve(v); };
      back.querySelector('[data-yes]').onclick = () => done(true);
      back.querySelector('[data-no]').onclick = () => done(false);
      back.onclick = e => { if (e.target === back) done(false); };
    });
  }

  function passwordDialog(message, label) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4';
      back.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div class="flex items-start gap-4">
            <div class="w-11 h-11 rounded-full bg-indigo-100 text-indigo-600 grid place-items-center shrink-0">
              <i class="fa-solid fa-key"></i>
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-slate-900 text-lg">Password required</h3>
              <p class="text-slate-600 text-sm mt-1 leading-relaxed"></p>
              <input type="password" autocomplete="off" class="mt-4 w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Password">
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button data-no class="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-sm">Cancel</button>
            <button data-yes class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm">Unlock</button>
          </div>
        </div>`;
      back.querySelector('p').textContent = message || 'This document is encrypted.';
      const input = back.querySelector('input');
      input.placeholder = label || 'Password';
      document.body.appendChild(back);
      setTimeout(() => input.focus(), 30);
      const done = v => { back.remove(); resolve(v); };
      back.querySelector('[data-yes]').onclick = () => done(input.value);
      back.querySelector('[data-no]').onclick = () => done(null);
      input.onkeydown = e => { if (e.key === 'Enter') done(input.value); };
      back.onclick = e => { if (e.target === back) done(null); };
    });
  }

  /* ------------------------------------------------------------ exports */
  NS.deps = deps;
  NS.pdfjsReady = pdfjsReady;
  NS.util = {
    mmToPt, ptToMm, pageSizePt, PAGE_MM, MM_TO_PT,
    formatBytes, hexToRgb01, readAsArrayBuffer, readAsDataURL, readAsText,
    baseName, downloadBlob, downloadBytes, downloadText, downloadZip, buildZip, uniqueName,
    parsePageRanges, rangesFromSelection, openPdfjs, renderPageToCanvas, renderPageToJpeg,
    contentBBox, isBlankCanvas, imageFileToPng, imageFileToJpeg, loadImage,
    titleCase, clamp, escapeHtml, sleep, nextFrame
  };
  NS.toast = toast;
  NS.confirm = confirmDialog;
  NS.askPassword = passwordDialog;
})(window.PDFNest);
