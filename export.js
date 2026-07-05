/* =========================================================================
   export.js
   Phase 4 — Word export in the official GCMMF format, built with docx.js
   (window.docx, loaded via CDN in index.html).

   Layout decision: the original template achieves "2 Kaizens per page"
   using a native Word 2-column section (<w:cols w:num="2"/>) that lets
   content flow automatically from one column into the next. That works
   for a fixed blank form, but for a *generator* whose field lengths vary
   per Kaizen, automatic column-flow would risk column 2 spilling onto a
   different page than column 1 whenever a Kaizen's text runs long — which
   would break the "always 2 per page" guarantee that makes this printable
   as a physical register. So instead: each pair of Kaizens is laid out in
   an invisible (borderless) 2-cell layout table, with an explicit page
   break between pairs. This is the more common trick for exactly this
   kind of generated 2-up form and pins pagination to a hard guarantee
   regardless of content length, while keeping every visible border,
   table width, and heading identical to the source template (verified
   against /mnt/user-data/uploads/1783080552223_Blank_Kaizen.docx).
   ========================================================================= */

const Export = (function () {
  "use strict";

  const docxLib = window.docx;
  if (!docxLib) {
    console.error("export.js: the docx.js library (window.docx) was not found — check that the CDN script tag loaded (requires internet on first run).");
  }

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    BorderStyle, WidthType, AlignmentType, VerticalAlign, ShadingType, PageBreak,
  } = docxLib || {};

  const FONT = "Calibri";
  const BASE_SIZE = 19; // half-points = 9.5pt — compact enough to reliably fit 2 Kaizens on one page

  const WORK_AREAS = [
    "1. Facility Improvement",
    "2. System Improvement",
    "3. Process Improvement",
    "4. Customer Satisfaction",
    "5. User Improvement",
    "6. Cost saving",
    "7. Co-ordination",
  ];

  const TQM_AREAS = [
    "1. House Keeping (HK)",
    "2. Learning (L)",
    "3. Development",
    "4. Communication",
    "5. Computerization (Comp)",
    "6. Human Relations (HR)",
    "7. Quality improvement",
  ];

  const THIN_BORDER = BorderStyle ? { style: BorderStyle.SINGLE, size: 6, color: "000000" } : null;
  const CELL_BORDERS = THIN_BORDER ? { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER } : null;
  const NO_BORDER_SIDE = BorderStyle ? { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } : null;
  const NO_BORDERS = NO_BORDER_SIDE ? { top: NO_BORDER_SIDE, bottom: NO_BORDER_SIDE, left: NO_BORDER_SIDE, right: NO_BORDER_SIDE } : null;

  // Offline-mode drafting (ai.js) fills empty fields with bracketed instructions for
  // on-screen editing, e.g. "[Describe the situation before this improvement...]".
  // Those must never end up printed on the actual exported form — if a field still
  // holds one of these verbatim, treat it as blank instead.
  const PLACEHOLDER_TEXTS = [
    "[Describe the situation before this improvement — click here and type over this.]",
    "[Describe the specific problem this action addressed.]",
    "[Describe the result after this action was taken.]",
    "[Describe the benefits — time saved, cost reduced, quality improved, etc.]",
  ];
  function blankIfPlaceholder(text) {
    return PLACEHOLDER_TEXTS.includes(text) ? "" : text;
  }

  // ---------------------------- Small helpers ----------------------------

  function run(text, opts) {
    return new TextRun(Object.assign({ text: text || "", font: FONT, size: BASE_SIZE }, opts || {}));
  }

  /** Splits multi-line field text into one Paragraph per line (never returns empty array). */
  function bodyParagraphs(text) {
    const lines = (text || "").split("\n");
    return lines.map((line) => new Paragraph({ spacing: { after: 20 }, children: [run(line)] }));
  }

  function headingCell(text, width) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: CELL_BORDERS,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 30, bottom: 30, left: 80, right: 80 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(text, { bold: true })] })],
    });
  }

  function bodyCell(paragraphs, width, opts) {
    opts = opts || {};
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: CELL_BORDERS,
      columnSpan: opts.columnSpan,
      shading: opts.shaded ? { type: ShadingType.CLEAR, color: "auto", fill: "EAF2FB" } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: paragraphs.length ? paragraphs : [new Paragraph({ spacing: { after: 0 }, children: [run("")] })],
    });
  }

  // ---------------------------- One Kaizen block ----------------------------

  function buildKaizenBlock(k) {
    k = k || {};
    const els = [];

    els.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 10 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 2 } },
        children: [run("GCMMF Ltd., Anand", { bold: true, size: 24 })],
      })
    );

    els.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [run("KAIZEN RECORD")],
      })
    );

    const infoWidths = [2969, 2410, 2410];
    els.push(
      new Table({
        width: { size: 7789, type: WidthType.DXA },
        columnWidths: infoWidths,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              headingCell("Name(s)", infoWidths[0]),
              headingCell("Department", infoWidths[1]),
              headingCell("Depot: " + (k.depot || "HO"), infoWidths[2]),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              bodyCell(bodyParagraphs(k.name), infoWidths[0]),
              bodyCell(bodyParagraphs(k.department), infoWidths[1]),
              bodyCell(bodyParagraphs("Month: " + (k.month || "")), infoWidths[2]),
            ],
          }),
        ],
      })
    );

    els.push(new Paragraph({ spacing: { before: 20, after: 20 }, children: [run("", { size: 8 })] }));

    const bpWidths = [3961, 3827];
    els.push(
      new Table({
        width: { size: 7788, type: WidthType.DXA },
        columnWidths: bpWidths,
        rows: [
          new TableRow({ cantSplit: true, children: [headingCell("BEFORE", bpWidths[0]), headingCell("PROBLEM", bpWidths[1])] }),
          new TableRow({
            cantSplit: true,
            children: [
              bodyCell(bodyParagraphs(blankIfPlaceholder(k.before)), bpWidths[0]),
              bodyCell(bodyParagraphs(blankIfPlaceholder(k.problem)), bpWidths[1]),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              bodyCell(
                [
                  new Paragraph({
                    spacing: { after: 0 },
                    children: [run("ACTION TAKEN: ", { bold: true }), run((k.actionTaken || "").replace(/\n+/g, " "))],
                  }),
                ],
                bpWidths[0] + bpWidths[1],
                { columnSpan: 2 }
              ),
            ],
          }),
          new TableRow({ cantSplit: true, children: [headingCell("AFTER", bpWidths[0]), headingCell("BENEFITS", bpWidths[1])] }),
          new TableRow({
            cantSplit: true,
            children: [
              bodyCell(bodyParagraphs(blankIfPlaceholder(k.after)), bpWidths[0]),
              bodyCell(bodyParagraphs(blankIfPlaceholder(k.benefits)), bpWidths[1]),
            ],
          }),
        ],
      })
    );

    els.push(
      new Paragraph({
        spacing: { before: 40, after: 20 },
        alignment: AlignmentType.CENTER,
        children: [run("IMPROVEMENT ON", { bold: true })],
      })
    );

    const waWidths = [3961, 3828];
    const selectedWork = Array.isArray(k.workArea) ? k.workArea : k.workArea ? [k.workArea] : [];
    const selectedTqm = Array.isArray(k.tqmArea) ? k.tqmArea : k.tqmArea ? [k.tqmArea] : [];
    const rows = [new TableRow({ cantSplit: true, children: [headingCell("WORK AREAS", waWidths[0]), headingCell("TQM AREAS", waWidths[1])] })];
    for (let i = 0; i < 7; i++) {
      const workSelected = selectedWork.includes(WORK_AREAS[i]);
      const tqmSelected = selectedTqm.includes(TQM_AREAS[i]);
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            bodyCell(
              [new Paragraph({ spacing: { after: 0 }, children: [run((workSelected ? "✓ " : "") + WORK_AREAS[i], { bold: workSelected })] })],
              waWidths[0],
              { shaded: workSelected }
            ),
            bodyCell(
              [new Paragraph({ spacing: { after: 0 }, children: [run((tqmSelected ? "✓ " : "") + TQM_AREAS[i], { bold: tqmSelected })] })],
              waWidths[1],
              { shaded: tqmSelected }
            ),
          ],
        })
      );
    }
    els.push(new Table({ width: { size: 7789, type: WidthType.DXA }, columnWidths: waWidths, rows }));

    els.push(new Paragraph({ spacing: { before: 60 }, children: [run("Signature: " + "_".repeat(28))] }));

    return els;
  }

  // ---------------------------- Full document (N Kaizens, 2/page) ----------------------------

  function buildDocument(kaizens) {
    const PAGE_W = 16838, PAGE_H = 11906; // landscape A4, twips
    const MARGIN = { top: 400, right: 450, bottom: 400, left: 450 };
    const GUTTER = 300;
    const halfWidth = Math.floor((PAGE_W - MARGIN.left - MARGIN.right - GUTTER) / 2);

    const children = [];

    for (let i = 0; i < kaizens.length; i += 2) {
      const left = kaizens[i];
      const right = kaizens[i + 1];

      children.push(
        new Table({
          width: { size: PAGE_W - MARGIN.left - MARGIN.right, type: WidthType.DXA },
          columnWidths: [halfWidth, GUTTER, halfWidth],
          borders: NO_BORDERS,
          rows: [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: halfWidth, type: WidthType.DXA },
                  borders: NO_BORDERS,
                  verticalAlign: VerticalAlign.TOP,
                  children: buildKaizenBlock(left),
                }),
                new TableCell({
                  width: { size: GUTTER, type: WidthType.DXA },
                  borders: NO_BORDERS,
                  children: [new Paragraph({ children: [run("")] })],
                }),
                new TableCell({
                  width: { size: halfWidth, type: WidthType.DXA },
                  borders: NO_BORDERS,
                  verticalAlign: VerticalAlign.TOP,
                  children: right ? buildKaizenBlock(right) : [new Paragraph({ children: [run("")] })],
                }),
              ],
            }),
          ],
        })
      );

      if (i + 2 < kaizens.length) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
    }

    return new Document({
      sections: [
        {
          properties: {
            page: { size: { width: PAGE_W, height: PAGE_H, orientation: "landscape" }, margin: MARGIN },
          },
          children,
        },
      ],
    });
  }

  // ---------------------------- Download helper ----------------------------

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function safeFilenamePart(text) {
    return (text || "Kaizen").replace(/[^a-z0-9\- ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 60) || "Kaizen";
  }

  function todayStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  // ---------------------------- Public API ----------------------------

  function exportKaizensToWord(kaizenArray, filename) {
    if (!docxLib) {
      const msg = "The Word export library didn't load (needs internet on first run). Reload the page and try again.";
      window.showToast && window.showToast(msg, "danger");
      return Promise.reject(new Error(msg));
    }
    if (!kaizenArray || kaizenArray.length === 0) {
      window.showToast && window.showToast("There are no Kaizens to export yet.", "warning");
      return Promise.resolve();
    }
    const doc = buildDocument(kaizenArray);
    return Packer.toBlob(doc).then((blob) => {
      downloadBlob(blob, filename || "Kaizen_Register_" + todayStamp() + ".docx");
    });
  }

  function exportKaizenToWord(kaizen) {
    const filename = safeFilenamePart(kaizen.title) + "_" + todayStamp() + ".docx";
    return exportKaizensToWord([kaizen], filename);
  }

  return {
    exportKaizenToWord: exportKaizenToWord,
    exportKaizensToWord: exportKaizensToWord,
  };
})();
