/* =========================================================================
   PDFNest — Tool registry
   Setiap tool = 1 objek konfigurasi. UI tool page di-render otomatis dari sini.
   ========================================================================= */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'organize',  name: 'Organize PDF',     icon: 'fa-layer-group',       color: 'from-indigo-500 to-blue-500' },
    { id: 'optimize',  name: 'Optimize PDF',     icon: 'fa-gauge-high',        color: 'from-emerald-500 to-teal-500' },
    { id: 'edit',      name: 'Edit PDF',         icon: 'fa-pen-to-square',     color: 'from-fuchsia-500 to-purple-500' },
    { id: 'to-pdf',    name: 'Convert to PDF',   icon: 'fa-file-import',       color: 'from-orange-500 to-amber-500' },
    { id: 'from-pdf',  name: 'Convert from PDF', icon: 'fa-file-export',       color: 'from-sky-500 to-cyan-500' },
    { id: 'security',  name: 'PDF Security',     icon: 'fa-shield-halved',     color: 'from-rose-500 to-red-500' }
  ];

  const POSITIONS = [
    { v: 'bottom-center', label: 'Bottom center' },
    { v: 'bottom-right',  label: 'Bottom right'  },
    { v: 'bottom-left',   label: 'Bottom left'   },
    { v: 'top-center',    label: 'Top center'    },
    { v: 'top-right',     label: 'Top right'     },
    { v: 'top-left',      label: 'Top left'      },
    { v: 'center',        label: 'Center'        }
  ];

  const PAGE_SIZES = [
    { v: 'a4',     label: 'A4 (210 × 297 mm)' },
    { v: 'a3',     label: 'A3 (297 × 420 mm)' },
    { v: 'a5',     label: 'A5 (148 × 210 mm)' },
    { v: 'letter', label: 'Letter (8.5 × 11 in)' },
    { v: 'legal',  label: 'Legal (8.5 × 14 in)' },
    { v: 'tabloid',label: 'Tabloid (11 × 17 in)' },
    { v: 'custom', label: 'Custom size…' }
  ];

  const FONTS = [
    { v: 'Helvetica',           label: 'Helvetica (sans)' },
    { v: 'Helvetica-Bold',      label: 'Helvetica Bold' },
    { v: 'Times-Roman',         label: 'Times (serif)' },
    { v: 'Times-Bold',          label: 'Times Bold' },
    { v: 'Courier',             label: 'Courier (mono)' },
    { v: 'Courier-Bold',        label: 'Courier Bold' }
  ];

  /* ---------------------------------------------------------------- tools */
  const TOOLS = [
    /* ============================== ORGANIZE ============================= */
    {
      id: 'merge-pdf',
      name: 'Merge PDF',
      desc: 'Combine multiple PDFs into a single file and rearrange them in any order.',
      icon: 'fa-object-group',
      category: 'organize',
      popular: true,
      accept: '.pdf,application/pdf',
      multiple: true,
      minFiles: 2,
      fileLabel: 'PDF files',
      options: [
        { type: 'checkbox', name: 'addBookmarks', label: 'Add a bookmark for each source file', default: true },
        { type: 'checkbox', name: 'tableOfContents', label: 'Add a table-of-contents page', default: false }
      ],
      howTo: [
        'Select two or more PDF files, or drop them into the upload box.',
        'Drag the file cards to set the order you want.',
        'Press “Merge PDF” and download the combined document.'
      ],
      faq: [
        { q: 'Is there a page limit?', a: 'No. Everything runs inside your browser, so the only limit is your device memory.' },
        { q: 'Are my files uploaded?', a: 'Never. The whole merge happens locally on your computer.' }
      ]
    },
    {
      id: 'merge-pdf-image',
      name: 'Merge PDF & Images',
      desc: 'Combine PDF documents and images (JPG, PNG, WebP) into one PDF file.',
      icon: 'fa-images',
      category: 'organize',
      accept: '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*',
      multiple: true,
      minFiles: 2,
      fileLabel: 'PDF or image files',
      options: [
        { type: 'select', name: 'imagePageSize', label: 'Page size for images', default: 'fit',
          choices: [{ v: 'fit', label: 'Fit image size' }, { v: 'a4', label: 'A4' }, { v: 'letter', label: 'Letter' }] },
        { type: 'select', name: 'imageFit', label: 'Image scaling', default: 'contain',
          choices: [{ v: 'contain', label: 'Contain (keep aspect ratio)' }, { v: 'cover', label: 'Cover (fill page)' }, { v: 'stretch', label: 'Stretch' }] },
        { type: 'number', name: 'margin', label: 'Page margin', default: 0, min: 0, max: 50, unit: 'mm' },
        { type: 'checkbox', name: 'addBookmarks', label: 'Add a bookmark for each source file', default: false }
      ],
      howTo: [
        'Add PDF files and/or images in any combination.',
        'Drag the cards to arrange the final order.',
        'Convert and download the merged PDF.'
      ],
      faq: [{ q: 'Which image formats work?', a: 'JPG, PNG and WebP are embedded directly. Other formats are re-encoded automatically.' }]
    },
    {
      id: 'split-pdf',
      name: 'Split PDF',
      desc: 'Split one PDF into several files by page ranges, fixed size or equal parts.',
      icon: 'fa-scissors',
      category: 'organize',
      popular: true,
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      supportsPages: false,
      options: [
        { type: 'radio', name: 'mode', label: 'Split mode', default: 'ranges',
          choices: [
            { v: 'ranges', label: 'Page ranges' },
            { v: 'every',  label: 'Every N pages' },
            { v: 'parts',  label: 'Equal parts' },
            { v: 'each',   label: 'Every page separately' }
          ] },
        { type: 'text', name: 'ranges', label: 'Ranges', default: '1-2,3-4',
          placeholder: 'e.g. 1-3, 4, 5-8', showIf: { name: 'mode', in: ['ranges'] },
          hint: 'Each comma-separated range becomes its own PDF file.' },
        { type: 'number', name: 'every', label: 'Pages per file', default: 2, min: 1, max: 5000, showIf: { name: 'mode', in: ['every'] } },
        { type: 'number', name: 'parts', label: 'Number of files', default: 2, min: 2, max: 500, showIf: { name: 'mode', in: ['parts'] } },
        { type: 'checkbox', name: 'zip', label: 'Always return a single ZIP archive', default: true }
      ],
      howTo: [
        'Select the PDF you want to split.',
        'Choose a split mode and configure the ranges.',
        'Download each part individually or as one ZIP archive.'
      ],
      faq: [{ q: 'Can I split password-protected PDFs?', a: 'Yes — unlock it first with the Unlock PDF tool, then split it.' }]
    },
    {
      id: 'organize-pdf',
      name: 'Organize PDF',
      desc: 'Reorder, rotate and delete pages visually with drag & drop thumbnails.',
      icon: 'fa-table-cells-large',
      category: 'organize',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      pageMode: 'organize',
      options: [
        { type: 'checkbox', name: 'reverse', label: 'Reverse page order', default: false }
      ],
      howTo: [
        'Upload a PDF to see every page as a thumbnail.',
        'Drag pages to rearrange them, rotate or delete with the buttons on each page.',
        'Save and download the reorganized document.'
      ],
      faq: [{ q: 'Does the quality change?', a: 'No. Pages are copied as-is, so text stays sharp and selectable.' }]
    },
    {
      id: 'remove-pages',
      name: 'Remove Pages',
      desc: 'Delete single or multiple pages from your PDF with one click.',
      icon: 'fa-trash-can',
      category: 'organize',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      supportsPages: true,
      pageSelectHint: 'Click the pages you want to DELETE',
      options: [
        { type: 'checkbox', name: 'removeBlank', label: 'Also auto-detect and remove blank pages', default: false }
      ],
      howTo: [
        'Upload your PDF and wait for the thumbnails.',
        'Select the pages to delete (shift-click selects a range).',
        'Delete the pages and download the cleaned PDF.'
      ],
      faq: [{ q: 'Can I undo?', a: 'Yes — nothing is written until you press the download button, just re-add the file to start over.' }]
    },
    {
      id: 'extract-pages',
      name: 'Extract Pages',
      desc: 'Pick pages from your PDF and save them as a brand new document.',
      icon: 'fa-file-circle-plus',
      category: 'organize',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      supportsPages: true,
      pageSelectHint: 'Click the pages you want to EXTRACT',
      options: [
        { type: 'checkbox', name: 'asSeparate', label: 'Save each page as a separate PDF', default: false },
        { type: 'checkbox', name: 'zip', label: 'Return a single ZIP archive', default: true, showIf: { name: 'asSeparate', in: [true] } }
      ],
      howTo: [
        'Upload the PDF and select the pages you need.',
        'Choose whether they should be merged into one file or kept separate.',
        'Download the extracted pages.'
      ],
      faq: [{ q: 'Can I extract pages from several PDFs at once?', a: 'Merge them first, then use Extract Pages on the result.' }]
    },

    /* ============================== OPTIMIZE ============================= */
    {
      id: 'compress-pdf',
      name: 'Compress PDF',
      desc: 'Shrink PDF file size with a quality slider — light or strong compression.',
      icon: 'fa-compress',
      category: 'optimize',
      popular: true,
      accept: '.pdf,application/pdf',
      multiple: true,
      minFiles: 1,
      fileLabel: 'PDF files',
      options: [
        { type: 'radio', name: 'mode', label: 'Compression mode', default: 'strong',
          choices: [
            { v: 'strong', label: 'Strong (rasterize pages)' },
            { v: 'light',  label: 'Light (keep text vector)' }
          ] },
        { type: 'range', name: 'quality', label: 'Image quality', min: 10, max: 100, step: 5, default: 65, unit: '%', showIf: { name: 'mode', in: ['strong'] } },
        { type: 'range', name: 'dpi', label: 'Resolution', min: 50, max: 300, step: 10, default: 110, unit: 'DPI', showIf: { name: 'mode', in: ['strong'] } },
        { type: 'checkbox', name: 'grayscale', label: 'Convert to grayscale', default: false, showIf: { name: 'mode', in: ['strong'] } },
        { type: 'checkbox', name: 'targetEnabled', label: 'Target a maximum file size', default: false,
          showIf: { name: 'mode', in: ['strong'] } },
        { type: 'number', name: 'targetKb', label: 'Target size', default: 500, min: 20, max: 200000, unit: 'KB',
          showIf: { name: 'targetEnabled', in: [true] } },
        { type: 'checkbox', name: 'stripMeta', label: 'Remove metadata & document info', default: false }
      ],
      howTo: [
        'Add one or more PDF files.',
        'Choose a mode, then move the quality slider (or set a target size).',
        'Compress and download — the original vs. new size is shown for every file.'
      ],
      faq: [
        { q: 'Which mode should I use?', a: 'Light keeps text selectable and only rewrites the file structure. Strong renders each page as a JPEG — best for scanned documents and photos, but text becomes part of the image.' },
        { q: 'Can I compress several files at once?', a: 'Yes, and you can download everything in one ZIP archive.' }
      ]
    },
    {
      id: 'resize-pdf',
      name: 'Resize PDF',
      desc: 'Rescale every page to A4, Letter, A3 or a custom size.',
      icon: 'fa-up-right-and-down-left-from-center',
      category: 'optimize',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'select', name: 'size', label: 'Target page size', default: 'a4', choices: PAGE_SIZES },
        { type: 'number', name: 'customW', label: 'Custom width', default: 210, min: 20, max: 2000, unit: 'mm', showIf: { name: 'size', in: ['custom'] } },
        { type: 'number', name: 'customH', label: 'Custom height', default: 297, min: 20, max: 2000, unit: 'mm', showIf: { name: 'size', in: ['custom'] } },
        { type: 'radio', name: 'orientation', label: 'Orientation', default: 'auto',
          choices: [{ v: 'auto', label: 'Auto' }, { v: 'portrait', label: 'Portrait' }, { v: 'landscape', label: 'Landscape' }] },
        { type: 'radio', name: 'fit', label: 'Content scaling', default: 'contain',
          choices: [
            { v: 'contain', label: 'Fit inside' },
            { v: 'stretch', label: 'Stretch to fill' }
          ] },
        { type: 'number', name: 'margin', label: 'Margin', default: 0, min: 0, max: 50, unit: 'mm' }
      ],
      howTo: [
        'Upload the PDF you want to resize.',
        'Pick a standard or custom page size and the scaling mode.',
        'Download the resized document.'
      ],
      faq: [{ q: 'Is the text still selectable?', a: 'Yes — pages are embedded as vectors, so text and links stay intact.' }]
    },
    {
      id: 'n-up-pdf',
      name: 'N-up / Multiple per Sheet',
      desc: 'Place 2, 4, 6 or 9 pages on a single sheet to save paper and ink.',
      icon: 'fa-border-all',
      category: 'optimize',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'radio', name: 'perSheet', label: 'Pages per sheet', default: '2',
          choices: [{ v: '2', label: '2' }, { v: '4', label: '4' }, { v: '6', label: '6' }, { v: '9', label: '9' }] },
        { type: 'select', name: 'size', label: 'Sheet size', default: 'a4', choices: PAGE_SIZES.filter(s => s.v !== 'custom') },
        { type: 'radio', name: 'orientation', label: 'Orientation', default: 'portrait',
          choices: [{ v: 'portrait', label: 'Portrait' }, { v: 'landscape', label: 'Landscape' }] },
        { type: 'number', name: 'gap', label: 'Gap between pages', default: 8, min: 0, max: 40, unit: 'pt' },
        { type: 'checkbox', name: 'border', label: 'Draw a thin border around each page', default: true }
      ],
      howTo: [
        'Upload the PDF you want to impose.',
        'Choose how many pages fit on one sheet.',
        'Download the imposed PDF — great for handouts.'
      ],
      faq: [{ q: 'Does it change the reading order?', a: 'No, pages are placed left-to-right, top-to-bottom.' }]
    },

    /* ================================ EDIT =============================== */
    {
      id: 'rotate-pdf',
      name: 'Rotate PDF',
      desc: 'Rotate all pages or only the ones you select, in 90° steps.',
      icon: 'fa-rotate-right',
      category: 'edit',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      supportsPages: true,
      pageSelectHint: 'Select pages to rotate (leave empty = all pages)',
      options: [
        { type: 'radio', name: 'angle', label: 'Rotation angle', default: '90',
          choices: [{ v: '90', label: '90° clockwise' }, { v: '180', label: '180°' }, { v: '270', label: '90° counter-clockwise' }] }
      ],
      howTo: [
        'Upload a PDF — thumbnails appear automatically.',
        'Select the pages you want to rotate, or leave the selection empty to rotate everything.',
        'Pick the angle and download the rotated PDF.'
      ],
      faq: [{ q: 'Is the rotation permanent?', a: 'It is stored in the PDF page dictionary, exactly like any other PDF editor does it.' }]
    },
    {
      id: 'crop-pdf',
      name: 'Crop PDF',
      desc: 'Trim margins on every page — manually or with automatic white-space detection.',
      icon: 'fa-crop-simple',
      category: 'edit',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'radio', name: 'mode', label: 'Crop mode', default: 'margins',
          choices: [{ v: 'margins', label: 'Margins' }, { v: 'auto', label: 'Auto (remove white space)' }] },
        { type: 'number', name: 'top', label: 'Top', default: 10, min: 0, max: 500, unit: 'mm', showIf: { name: 'mode', in: ['margins'] } },
        { type: 'number', name: 'right', label: 'Right', default: 10, min: 0, max: 500, unit: 'mm', showIf: { name: 'mode', in: ['margins'] } },
        { type: 'number', name: 'bottom', label: 'Bottom', default: 10, min: 0, max: 500, unit: 'mm', showIf: { name: 'mode', in: ['margins'] } },
        { type: 'number', name: 'left', label: 'Left', default: 10, min: 0, max: 500, unit: 'mm', showIf: { name: 'mode', in: ['margins'] } },
        { type: 'range', name: 'threshold', label: 'White detection threshold', min: 200, max: 254, step: 1, default: 245, showIf: { name: 'mode', in: ['auto'] } },
        { type: 'number', name: 'padding', label: 'Keep padding around content', default: 4, min: 0, max: 50, unit: 'mm', showIf: { name: 'mode', in: ['auto'] } }
      ],
      howTo: [
        'Upload the PDF you want to crop.',
        'Type the margins in millimetres or switch to automatic detection.',
        'Crop and download — the visible area is trimmed, content is never deleted.'
      ],
      faq: [{ q: 'Is the cropped content really removed?', a: 'Cropping sets the visible page box (CropBox), the standard way PDF editors do it. Nothing outside the box is visible or printed.' }]
    },
    {
      id: 'add-page-numbers',
      name: 'Add Page Numbers',
      desc: 'Stamp page numbers anywhere on the page with your own format and style.',
      icon: 'fa-list-ol',
      category: 'edit',
      popular: true,
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'select', name: 'position', label: 'Position', default: 'bottom-center', choices: POSITIONS },
        { type: 'text', name: 'format', label: 'Number format', default: '{n}',
          hint: 'Use {n} for the page number, {total} for the page count and {count} for numbered pages.' },
        { type: 'number', name: 'startAt', label: 'Start numbering at', default: 1, min: 0, max: 100000 },
        { type: 'number', name: 'skipFirst', label: 'Skip first N pages', default: 0, min: 0, max: 100 },
        { type: 'select', name: 'font', label: 'Font', default: 'Helvetica', choices: FONTS },
        { type: 'number', name: 'size', label: 'Font size', default: 12, min: 6, max: 72, unit: 'pt' },
        { type: 'color', name: 'color', label: 'Colour', default: '#111827' },
        { type: 'number', name: 'margin', label: 'Distance from edge', default: 24, min: 4, max: 200, unit: 'pt' },
        { type: 'checkbox', name: 'firstPageCover', label: 'Add a thin separator line', default: false }
      ],
      howTo: [
        'Upload the PDF you want to number.',
        'Choose a position, format and style — the preview badge shows how it looks.',
        'Apply and download the numbered PDF.'
      ],
      faq: [{ q: 'Can I skip the cover page?', a: 'Yes, set “Skip first N pages” to 1 or more.' }]
    },
    {
      id: 'add-watermark',
      name: 'Add Watermark',
      desc: 'Stamp text or an image over your pages to protect and brand them.',
      icon: 'fa-droplet',
      category: 'edit',
      popular: true,
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'radio', name: 'kind', label: 'Watermark type', default: 'text',
          choices: [{ v: 'text', label: 'Text' }, { v: 'image', label: 'Image' }] },
        { type: 'text', name: 'text', label: 'Watermark text', default: 'CONFIDENTIAL', showIf: { name: 'kind', in: ['text'] } },
        { type: 'select', name: 'font', label: 'Font', default: 'Helvetica-Bold', choices: FONTS, showIf: { name: 'kind', in: ['text'] } },
        { type: 'number', name: 'fontSize', label: 'Font size', default: 48, min: 8, max: 200, unit: 'pt', showIf: { name: 'kind', in: ['text'] } },
        { type: 'color', name: 'color', label: 'Colour', default: '#ef4444', showIf: { name: 'kind', in: ['text'] } },
        { type: 'range', name: 'opacity', label: 'Opacity', min: 5, max: 100, step: 5, default: 25, unit: '%' },
        { type: 'select', name: 'position', label: 'Position', default: 'center', choices: POSITIONS },
        { type: 'checkbox', name: 'tile', label: 'Repeat across the whole page', default: false },
        { type: 'number', name: 'rotation', label: 'Rotation', default: 45, min: -180, max: 180, unit: '°' },
        { type: 'number', name: 'scale', label: 'Image width (% of page)', default: 40, min: 5, max: 100, unit: '%', showIf: { name: 'kind', in: ['image'] } },
        { type: 'file', name: 'imageFile', label: 'Watermark image', accept: 'image/png,image/jpeg', showIf: { name: 'kind', in: ['image'] } },
        { type: 'text', name: 'pages', label: 'Pages', default: 'all', placeholder: 'all or e.g. 1-3,7', hint: 'Apply the watermark only to some pages.' }
      ],
      howTo: [
        'Upload your PDF.',
        'Type your watermark text (or upload a logo image) and tune size, colour and opacity.',
        'Apply and download the protected document.'
      ],
      faq: [{ q: 'Can I remove a watermark later?', a: 'The watermark is drawn into the page content, so keep an unwatermarked copy if you might need one.' }]
    },
    {
      id: 'edit-metadata',
      name: 'PDF Metadata',
      desc: 'View, edit or wipe the document title, author, subject and keywords.',
      icon: 'fa-circle-info',
      category: 'edit',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'text', name: 'title', label: 'Title', default: '' },
        { type: 'text', name: 'author', label: 'Author', default: '' },
        { type: 'text', name: 'subject', label: 'Subject', default: '' },
        { type: 'text', name: 'keywords', label: 'Keywords', default: '', hint: 'Separate with commas.' },
        { type: 'text', name: 'creator', label: 'Creator', default: '' },
        { type: 'text', name: 'producer', label: 'Producer', default: '' },
        { type: 'checkbox', name: 'setDates', label: 'Set creation / modification date to now', default: false },
        { type: 'checkbox', name: 'removeAll', label: 'Remove all metadata', default: false }
      ],
      howTo: [
        'Upload a PDF — the current metadata is loaded into the form automatically.',
        'Edit the fields you need, or tick “Remove all metadata”.',
        'Save and download the updated file.'
      ],
      faq: [{ q: 'Is the document content modified?', a: 'No, only the document information dictionary is touched.' }]
    },
    {
      id: 'flatten-pdf',
      name: 'Flatten PDF',
      desc: 'Burn form fields and annotations into the page so nothing can be edited.',
      icon: 'fa-layer-group',
      category: 'edit',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'checkbox', name: 'forms', label: 'Flatten form fields', default: true },
        { type: 'checkbox', name: 'annotations', label: 'Remove interactive annotations (links, comments)', default: false }
      ],
      howTo: [
        'Upload a PDF that contains forms or annotations.',
        'Choose what should be flattened.',
        'Download the flattened, non-editable document.'
      ],
      faq: [{ q: 'What happens to filled values?', a: 'They stay visible on the page but are no longer editable fields.' }]
    },

    /* ============================ TO PDF ================================= */
    {
      id: 'image-to-pdf',
      name: 'Image to PDF',
      desc: 'Turn JPG, PNG and WebP images into a single, well-laid-out PDF.',
      icon: 'fa-image',
      category: 'to-pdf',
      popular: true,
      accept: '.jpg,.jpeg,.png,.webp,.gif,.bmp,image/*',
      multiple: true,
      minFiles: 1,
      fileLabel: 'Image files',
      options: [
        { type: 'select', name: 'pageSize', label: 'Page size', default: 'fit',
          choices: [{ v: 'fit', label: 'Match image size' }, ...PAGE_SIZES] },
        { type: 'number', name: 'customW', label: 'Custom width', default: 210, min: 20, max: 2000, unit: 'mm', showIf: { name: 'pageSize', in: ['custom'] } },
        { type: 'number', name: 'customH', label: 'Custom height', default: 297, min: 20, max: 2000, unit: 'mm', showIf: { name: 'pageSize', in: ['custom'] } },
        { type: 'radio', name: 'orientation', label: 'Orientation', default: 'auto',
          choices: [{ v: 'auto', label: 'Auto' }, { v: 'portrait', label: 'Portrait' }, { v: 'landscape', label: 'Landscape' }] },
        { type: 'radio', name: 'fit', label: 'Image scaling', default: 'contain',
          choices: [{ v: 'contain', label: 'Contain' }, { v: 'cover', label: 'Cover' }, { v: 'stretch', label: 'Stretch' }] },
        { type: 'number', name: 'margin', label: 'Margin', default: 0, min: 0, max: 60, unit: 'mm' },
        { type: 'range', name: 'quality', label: 'Re-encode quality (shrinks photos)', min: 40, max: 100, step: 5, default: 92, unit: '%' }
      ],
      howTo: [
        'Add all the images you want in the PDF.',
        'Arrange them with drag & drop and pick a page size.',
        'Convert and download your PDF.'
      ],
      faq: [{ q: 'Can I use photos straight from my phone?', a: 'Yes — HEIC is not supported by browsers yet, so convert HEIC to JPG first.' }]
    },
    {
      id: 'jpg-to-pdf', name: 'JPG to PDF', desc: 'Convert JPG/JPEG photos into a PDF document.',
      icon: 'fa-file-image', category: 'to-pdf', accept: '.jpg,.jpeg,image/jpeg', multiple: true, minFiles: 1,
      fileLabel: 'JPG images', baseTool: 'image-to-pdf', defaults: { quality: 100 },
      options: [], howTo: ['Add your JPG files.', 'Adjust the page setup if needed.', 'Download the PDF.'],
      faq: [{ q: 'Does it reduce quality?', a: 'No — JPEG images are embedded untouched, pixel for pixel.' }]
    },
    {
      id: 'png-to-pdf', name: 'PNG to PDF', desc: 'Convert PNG images (with transparency) into a PDF.',
      icon: 'fa-file-image', category: 'to-pdf', accept: '.png,image/png', multiple: true, minFiles: 1,
      fileLabel: 'PNG images', baseTool: 'image-to-pdf',
      options: [], howTo: ['Add your PNG files.', 'Adjust the page setup if needed.', 'Download the PDF.'],
      faq: [{ q: 'Is transparency preserved?', a: 'Transparent areas become white on the PDF page.' }]
    },
    {
      id: 'webp-to-pdf', name: 'WebP to PDF', desc: 'Convert modern WebP images into a shareable PDF.',
      icon: 'fa-file-image', category: 'to-pdf', accept: '.webp,image/webp', multiple: true, minFiles: 1,
      fileLabel: 'WebP images', baseTool: 'image-to-pdf',
      options: [], howTo: ['Add your WebP files.', 'Adjust the page setup if needed.', 'Download the PDF.'],
      faq: [{ q: 'Are animations supported?', a: 'Only the first frame of an animated WebP is used.' }]
    },
    {
      id: 'txt-to-pdf',
      name: 'TXT to PDF',
      desc: 'Turn plain text files into a clean, paginated PDF document.',
      icon: 'fa-file-lines',
      category: 'to-pdf',
      accept: '.txt,.md,.csv,.log,text/plain',
      multiple: true,
      minFiles: 1,
      fileLabel: 'Text files',
      options: [
        { type: 'select', name: 'size', label: 'Page size', default: 'a4', choices: PAGE_SIZES.filter(s => s.v !== 'custom') },
        { type: 'select', name: 'font', label: 'Font', default: 'Courier', choices: FONTS },
        { type: 'number', name: 'fontSize', label: 'Font size', default: 11, min: 6, max: 36, unit: 'pt' },
        { type: 'number', name: 'margin', label: 'Margin', default: 20, min: 5, max: 60, unit: 'mm' },
        { type: 'range', name: 'lineHeight', label: 'Line spacing', min: 1, max: 2.5, step: 0.1, default: 1.4, unit: '×' },
        { type: 'checkbox', name: 'wrap', label: 'Wrap long lines automatically', default: true },
        { type: 'checkbox', name: 'numbers', label: 'Add page numbers', default: true }
      ],
      howTo: [
        'Add one or more text files.',
        'Choose the font, size and margins.',
        'Convert and download the PDF.'
      ],
      faq: [{ q: 'Are emojis supported?', a: 'Standard PDF fonts cover Latin, Greek and Cyrillic text. Emojis are replaced by a placeholder.' }]
    },

    /* =========================== FROM PDF ================================ */
    {
      id: 'pdf-to-image',
      name: 'PDF to Image',
      desc: 'Render every page as a high-quality PNG or JPG at any resolution.',
      icon: 'fa-images',
      category: 'from-pdf',
      popular: true,
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      supportsPages: true,
      pageSelectHint: 'Select the pages to export (empty = all pages)',
      options: [
        { type: 'radio', name: 'format', label: 'Image format', default: 'png',
          choices: [{ v: 'png', label: 'PNG (lossless)' }, { v: 'jpg', label: 'JPG (smaller)' }] },
        { type: 'range', name: 'dpi', label: 'Resolution', min: 72, max: 400, step: 8, default: 150, unit: 'DPI' },
        { type: 'range', name: 'quality', label: 'JPG quality', min: 40, max: 100, step: 5, default: 92, unit: '%', showIf: { name: 'format', in: ['jpg'] } },
        { type: 'checkbox', name: 'zip', label: 'Return a single ZIP archive', default: true },
        { type: 'checkbox', name: 'transparent', label: 'Transparent background (PNG only)', default: false, showIf: { name: 'format', in: ['png'] } }
      ],
      howTo: [
        'Upload a PDF and select the pages you need.',
        'Pick PNG or JPG and choose the resolution.',
        'Download the images individually or as one ZIP file.'
      ],
      faq: [{ q: 'What resolution should I use?', a: '150 DPI is great for screens and documents, 300 DPI for printing.' }]
    },
    {
      id: 'pdf-to-jpg', name: 'PDF to JPG', desc: 'Export PDF pages as JPG images, ready to share.',
      icon: 'fa-file-image', category: 'from-pdf', accept: '.pdf,application/pdf', multiple: false, minFiles: 1,
      fileLabel: 'PDF file', supportsPages: true, baseTool: 'pdf-to-image',
      options: [], howTo: ['Upload your PDF.', 'Select pages and quality.', 'Download the JPG images.'],
      faq: [{ q: 'Can I convert the whole document?', a: 'Yes, leave the page selection empty to export everything.' }]
    },
    {
      id: 'pdf-to-png', name: 'PDF to PNG', desc: 'Export PDF pages as lossless PNG images.',
      icon: 'fa-file-image', category: 'from-pdf', accept: '.pdf,application/pdf', multiple: false, minFiles: 1,
      fileLabel: 'PDF file', supportsPages: true, baseTool: 'pdf-to-image',
      options: [], howTo: ['Upload your PDF.', 'Select pages and resolution.', 'Download the PNG images.'],
      faq: [{ q: 'Is PNG better than JPG?', a: 'PNG is lossless (best for text and graphics) but files are larger.' }]
    },
    {
      id: 'pdf-to-text',
      name: 'PDF to Text',
      desc: 'Extract the selectable text from a PDF into a clean .txt file.',
      icon: 'fa-file-lines',
      category: 'from-pdf',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      supportsPages: true,
      pageSelectHint: 'Select the pages to extract (empty = all pages)',
      options: [
        { type: 'radio', name: 'layout', label: 'Text layout', default: 'lines',
          choices: [{ v: 'lines', label: 'Keep line breaks' }, { v: 'flow', label: 'Merge into paragraphs' }] },
        { type: 'checkbox', name: 'pageMarkers', label: 'Add “--- Page N ---” markers', default: true },
        { type: 'checkbox', name: 'oneFilePerPage', label: 'One .txt file per page', default: false }
      ],
      howTo: [
        'Upload the PDF you want to read as text.',
        'Choose the layout options.',
        'Download the .txt file (or a ZIP with one file per page).'
      ],
      faq: [{ q: 'Why is my scanned PDF empty?', a: 'Scanned pages are images without a text layer. Use an OCR tool first.' }]
    },
    {
      id: 'extract-images',
      name: 'Extract Images',
      desc: 'Pull every embedded picture out of a PDF as separate image files.',
      icon: 'fa-image-portrait',
      category: 'from-pdf',
      accept: '.pdf,application/pdf',
      multiple: false,
      minFiles: 1,
      fileLabel: 'PDF file',
      options: [
        { type: 'radio', name: 'format', label: 'Output format', default: 'png',
          choices: [{ v: 'png', label: 'PNG' }, { v: 'jpg', label: 'JPG' }] },
        { type: 'number', name: 'minSize', label: 'Ignore images smaller than', default: 32, min: 0, max: 1000, unit: 'px' },
        { type: 'checkbox', name: 'zip', label: 'Return a single ZIP archive', default: true }
      ],
      howTo: [
        'Upload a PDF that contains images.',
        'Choose the output format and the minimum image size.',
        'Download the images as a ZIP archive.'
      ],
      faq: [{ q: 'Will I get the original photos?', a: 'Images are re-encoded from the PDF page resources, so quality matches what is stored inside the document.' }]
    },

    /* ============================= SECURITY ============================== */
    {
      id: 'protect-pdf',
      name: 'Protect PDF',
      desc: 'Encrypt your PDF with AES-256, a password and print/copy restrictions.',
      icon: 'fa-lock',
      category: 'security',
      popular: true,
      accept: '.pdf,application/pdf',
      multiple: true,
      minFiles: 1,
      fileLabel: 'PDF files',
      options: [
        { type: 'password', name: 'userPassword', label: 'Password to open the document', required: true },
        { type: 'password', name: 'ownerPassword', label: 'Owner password (optional)', hint: 'Required to change permissions later. Defaults to the user password.' },
        { type: 'checkbox', name: 'allowPrint', label: 'Allow printing', default: true },
        { type: 'checkbox', name: 'allowCopy', label: 'Allow copying text & images', default: false },
        { type: 'checkbox', name: 'allowModify', label: 'Allow modifying the document', default: false },
        { type: 'checkbox', name: 'allowAnnotate', label: 'Allow comments & annotations', default: true },
        { type: 'checkbox', name: 'allowForms', label: 'Allow filling in forms', default: true },
        { type: 'checkbox', name: 'allowAssembly', label: 'Allow page assembly (insert, rotate, delete)', default: false },
        { type: 'checkbox', name: 'allowAccessibility', label: 'Allow screen-reader access', default: true },
        { type: 'checkbox', name: 'zip', label: 'Return a single ZIP archive', default: true }
      ],
      howTo: [
        'Add the PDF files you want to protect.',
        'Type the password and pick the permissions you want to allow.',
        'Encrypt and download the protected files.'
      ],
      faq: [
        { q: 'Which encryption is used?', a: 'AES-256 (PDF 2.0, revision 6) — the strongest standard supported by modern readers.' },
        { q: 'Can the password be recovered?', a: 'No. Store it somewhere safe, PDF encryption is not reversible.' }
      ]
    },
    {
      id: 'unlock-pdf',
      name: 'Unlock PDF',
      desc: 'Remove the password from a PDF you own so it opens without a prompt.',
      icon: 'fa-lock-open',
      category: 'security',
      accept: '.pdf,application/pdf',
      multiple: true,
      minFiles: 1,
      fileLabel: 'PDF files',
      options: [
        { type: 'password', name: 'password', label: 'Current password', required: true, hint: 'The password must be known — this tool does not crack encryption.' },
        { type: 'checkbox', name: 'zip', label: 'Return a single ZIP archive', default: true }
      ],
      howTo: [
        'Add the protected PDF files.',
        'Enter the password that currently opens them.',
        'Unlock and download copies without password protection.'
      ],
      faq: [{ q: 'I forgot the password — can you crack it?', a: 'No, and no honest tool can. Only documents whose password you know can be unlocked.' }]
    }
  ];

  /* ------------------------------------------------------------- helpers */
  const byId = {};
  TOOLS.forEach(t => { byId[t.id] = t; });

  function resolve(tool) {
    if (tool.baseTool && byId[tool.baseTool]) {
      const base = byId[tool.baseTool];
      let options = (tool.options && tool.options.length) ? tool.options : base.options;
      // allow a specialised tool to override the defaults of the base tool
      if (tool.defaults && options) {
        options = options.map(o =>
          tool.defaults[o.name] !== undefined ? Object.assign({}, o, { default: tool.defaults[o.name] }) : o);
      }
      return Object.assign({}, base, tool, {
        options,
        howTo: (tool.howTo && tool.howTo.length) ? tool.howTo : base.howTo,
        faq: (tool.faq && tool.faq.length) ? tool.faq : base.faq,
        baseTool: tool.baseTool
      });
    }
    return tool;
  }

  window.BigPDF = window.BigPDF || {};
  window.BigPDF.CATEGORIES = CATEGORIES;
  window.BigPDF.TOOLS = TOOLS;
  window.BigPDF.toolById = id => resolve(byId[id]);
  window.BigPDF.toolsByCategory = cat => TOOLS.filter(t => t.category === cat).map(resolve);
  window.BigPDF.resolveTool = resolve;
  window.BigPDF.PAGE_SIZES = PAGE_SIZES;
  window.BigPDF.FONTS = FONTS;
  window.BigPDF.POSITIONS = POSITIONS;
})();
