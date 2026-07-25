// backend/mcp/pptxgen-mcp/layouts.js
const CANVAS = { w: 10, h: 5.63 };
const MARGIN = 0.55;
const CONTENT_W = CANVAS.w - MARGIN * 2;

function hexOrDefault(v, fallback) {
  return (v || fallback).replace(/^#/, "");
}

// --- Util kontras warna ---------------------------------------------------
// INI KUNCI FIX UTAMA: sebelumnya warna teks diambil langsung dari theme.textColor
// tanpa cek apakah background di elemen itu terang/gelap - kalau kombinasinya
// tidak cocok (mis. background gelap tapi textColor juga gelap), hasilnya teks
// tidak terbaca. Sekarang SEMUA pemilihan warna teks/ikon di atas suatu warna
// latar WAJIB lewat readableTextColor(bg, theme), bukan asumsi manual.
function relativeLuminance(hex) {
  const h = hex.replace(/^#/, "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const lin = (c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function isDark(hex) {
  return relativeLuminance(hexOrDefault(hex, "FFFFFF")) < 0.5;
}

// Mengembalikan warna teks yang PASTI terbaca di atas warna latar `bgHex`.
// Kalau latar gelap -> pakai putih/abu terang. Kalau latar terang -> pakai
// theme.textColor (gelap) apa adanya.
function readableTextColor(bgHex, theme, lightVariant, darkVariant) {
  if (isDark(bgHex)) return hexOrDefault(darkVariant, "F8FAFC");
  return hexOrDefault(lightVariant || theme.textColor, "0F172A");
}

// Warna muted (label sekunder) yang tetap kebaca di kedua mode.
function readableMutedColor(bgHex, theme) {
  if (isDark(bgHex)) return "CBD5E1";
  return hexOrDefault(theme.mutedColor, "64748B");
}

const CARD_SHADOW = {
  type: "outer",
  color: "1E293B",
  opacity: 0.12,
  blur: 8,
  offset: 3,
  angle: 90,
};
const TEXT_SHADOW = {
  type: "outer",
  color: "000000",
  opacity: 0.4,
  blur: 4,
  offset: 2,
  angle: 45,
};

async function iconDataUri(fetchAsDataUri, iconSet, iconName, colorHex) {
  const url = `https://api.iconify.design/${iconSet}/${iconName}.svg?color=%23${colorHex}`;
  return fetchAsDataUri(url, 1);
}

// ---------------------------------------------------------------------------
// LAYOUT 1: title_cover — foto HANYA sebagai aksen kecil (opsional), background
// utama tetap warna solid theme.primary supaya konsisten dengan slide lain -
// bukan lagi wajib foto full-bleed (foto sering bikin kontras teks tidak terjamin).
// ---------------------------------------------------------------------------
async function buildTitleCover(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme;
  const bgColor = hexOrDefault(theme.primary, "1E293B");
  slide.background = { color: bgColor };

  // Foto dipakai sebagai panel dekoratif kecil di sisi kanan (BUKAN background penuh),
  // supaya kontras teks di kiri selalu terjamin karena tetap di atas theme.primary solid.
  if (props.imageSeed) {
    try {
      const bgUrl = `https://picsum.photos/seed/${encodeURIComponent(props.imageSeed)}/900/1200`;
      const dataUri = await fetchAsDataUri(bgUrl, 1);
      slide.addImage({ data: dataUri, x: 6.6, y: 0, w: 3.4, h: CANVAS.h });
      slide.addShape(pptx.ShapeType.rect, {
        x: 6.6,
        y: 0,
        w: 3.4,
        h: CANVAS.h,
        fill: { color: bgColor, transparency: 55 },
      });
    } catch (err) {
      /* skip kalau gagal, tidak mempengaruhi kontras teks */
    }
  }

  const textColor = readableTextColor(bgColor, theme, null, "FFFFFF");
  const mutedColor = readableMutedColor(bgColor, theme);
  const accent = hexOrDefault(theme.accent, "38BDF8");

  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 3.55,
    w: 0.9,
    h: 0.06,
    fill: { color: accent },
  });

  slide.addText(props.eyebrow || "LAPORAN PROGRES TIM", {
    x: MARGIN,
    y: 3.75,
    w: 5.7,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: accent,
    fontFace: theme.fontFace || "Calibri",
    charSpacing: 2,
  });
  slide.addText(props.title, {
    x: MARGIN,
    y: 4.1,
    w: 5.7,
    h: 1.0,
    fontSize: 34,
    bold: true,
    color: textColor,
    fontFace: theme.fontFace || "Calibri",
    shadow: TEXT_SHADOW,
  });
  if (props.subtitle) {
    slide.addText(props.subtitle, {
      x: MARGIN,
      y: 5.05,
      w: 5.7,
      h: 0.4,
      fontSize: 14,
      color: mutedColor,
      fontFace: theme.fontFace || "Calibri",
    });
  }
}

// ---------------------------------------------------------------------------
// LAYOUT 2: section_header
// ---------------------------------------------------------------------------
async function buildSectionHeader(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme;
  const bgColor = hexOrDefault(theme.primary, "1E293B");
  slide.background = { color: bgColor };

  const textColor = readableTextColor(bgColor, theme, null, "FFFFFF");
  const mutedColor = readableMutedColor(bgColor, theme);
  const accent = hexOrDefault(theme.accent, "38BDF8");

  if (props.icon) {
    try {
      const dataUri = await iconDataUri(
        fetchAsDataUri,
        props.icon.set,
        props.icon.name,
        textColor,
      );
      slide.addImage({ data: dataUri, x: MARGIN, y: 1.6, w: 1.1, h: 1.1 });
    } catch (err) {
      /* skip */
    }
  }

  slide.addText(props.eyebrow || "", {
    x: MARGIN,
    y: 2.85,
    w: CONTENT_W,
    h: 0.3,
    fontSize: 12,
    bold: true,
    color: mutedColor,
    fontFace: theme.fontFace || "Calibri",
    charSpacing: 2,
  });
  slide.addText(props.title, {
    x: MARGIN,
    y: 3.15,
    w: CONTENT_W,
    h: 0.9,
    fontSize: 32,
    bold: true,
    color: textColor,
    fontFace: theme.fontFace || "Calibri",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 4.05,
    w: 0.8,
    h: 0.05,
    fill: { color: accent },
  });
}

// ---------------------------------------------------------------------------
// LAYOUT 3: stat_cards — background slide = theme.background (konsisten,
// SELALU warna terang netral), card putih di atasnya.
// ---------------------------------------------------------------------------
async function buildStatCards(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme;
  const bgColor = hexOrDefault(theme.background, "F8FAFC");
  slide.background = { color: bgColor };
  const titleColor = readableTextColor(bgColor, theme);

  slide.addText(props.title, {
    x: MARGIN,
    y: 0.45,
    w: CONTENT_W,
    h: 0.5,
    fontSize: 24,
    bold: true,
    color: titleColor,
    fontFace: theme.fontFace || "Calibri",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 1.05,
    w: 0.7,
    h: 0.05,
    fill: { color: hexOrDefault(theme.primary, "2563EB") },
  });

  const cards = props.cards.slice(0, 4);
  const gap = 0.25;
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const cardY = 1.5,
    cardH = 3.4;
  const cardBg = "FFFFFF"; // card SELALU putih, terlepas dari theme.background, supaya kontras teks di dalamnya selalu terjamin

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const cardX = MARGIN + i * (cardW + gap);
    const accent = hexOrDefault(c.accentColor || theme.primary, "2563EB");
    const cardText = readableTextColor(cardBg, theme);
    const cardMuted = readableMutedColor(cardBg, theme);

    slide.addShape(pptx.ShapeType.roundRect, {
      x: cardX,
      y: cardY,
      w: cardW,
      h: cardH,
      rectRadius: 0.08,
      fill: { color: cardBg },
      shadow: CARD_SHADOW,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: cardX,
      y: cardY,
      w: cardW,
      h: 0.08,
      fill: { color: accent },
    });

    if (c.icon) {
      try {
        const dataUri = await iconDataUri(
          fetchAsDataUri,
          c.icon.set,
          c.icon.name,
          accent,
        );
        slide.addImage({
          data: dataUri,
          x: cardX + 0.3,
          y: cardY + 0.35,
          w: 0.5,
          h: 0.5,
        });
      } catch (err) {
        /* skip */
      }
    }

    slide.addText(c.value, {
      x: cardX + 0.25,
      y: cardY + 1.0,
      w: cardW - 0.5,
      h: 0.7,
      fontSize: 30,
      bold: true,
      color: cardText,
      fontFace: theme.fontFace || "Calibri",
    });
    slide.addText(c.label, {
      x: cardX + 0.25,
      y: cardY + 1.75,
      w: cardW - 0.5,
      h: 0.6,
      fontSize: 12,
      color: cardMuted,
      fontFace: theme.fontFace || "Calibri",
      valign: "top",
    });
    if (c.detail) {
      slide.addText(c.detail, {
        x: cardX + 0.25,
        y: cardY + cardH - 0.55,
        w: cardW - 0.5,
        h: 0.4,
        fontSize: 10,
        italic: true,
        color: accent,
        fontFace: theme.fontFace || "Calibri",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// LAYOUT 4: chart_focus
// ---------------------------------------------------------------------------
function buildChartFocus(slide, pptx, ctx, props) {
  const theme = props.theme;
  const bgColor = hexOrDefault(theme.background, "FFFFFF");
  slide.background = { color: bgColor };
  const titleColor = readableTextColor(bgColor, theme);
  const mutedColor = readableMutedColor(bgColor, theme);

  slide.addText(props.title, {
    x: MARGIN,
    y: 0.4,
    w: CONTENT_W,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: titleColor,
    fontFace: theme.fontFace || "Calibri",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 0.95,
    w: 0.7,
    h: 0.05,
    fill: { color: hexOrDefault(theme.primary, "2563EB") },
  });

  const chartW = 5.5,
    chartH = 3.9;
  const chartTypeMap = {
    bar: pptx.ChartType.bar,
    pie: pptx.ChartType.pie,
    doughnut: pptx.ChartType.doughnut,
    line: pptx.ChartType.line,
  };
  slide.addChart(
    chartTypeMap[props.chartType || "bar"],
    [
      {
        name: props.seriesName || "Progres",
        labels: props.labels,
        values: props.values,
      },
    ],
    {
      x: MARGIN,
      y: 1.35,
      w: chartW,
      h: chartH,
      showLegend: props.chartType === "pie" || props.chartType === "doughnut",
      showValue: true,
      chartColors:
        props.colors && props.colors.length ? props.colors : undefined,
      legendPos: "b",
      dataLabelColor: titleColor,
      catAxisLabelColor: mutedColor,
      valAxisLabelColor: mutedColor,
      legendColor: mutedColor,
    },
  );

  const sideX = MARGIN + chartW + 0.4;
  const sideW = CANVAS.w - MARGIN - sideX;
  const sideCardBg = isDark(bgColor) ? "1E293B" : "F1F5F9"; // beda tipis dari background utama, tapi tetap 1 mode (terang/gelap) konsisten
  let y = 1.4;
  for (const point of (props.sidePoints || []).slice(0, 4)) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: sideX,
      y,
      w: sideW,
      h: 0.85,
      rectRadius: 0.06,
      fill: { color: sideCardBg },
    });
    slide.addText(point.label, {
      x: sideX + 0.15,
      y: y + 0.08,
      w: sideW - 0.3,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: readableTextColor(sideCardBg, theme),
      fontFace: theme.fontFace || "Calibri",
    });
    slide.addText(point.value, {
      x: sideX + 0.15,
      y: y + 0.36,
      w: sideW - 0.3,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: hexOrDefault(theme.primary, "2563EB"),
      fontFace: theme.fontFace || "Calibri",
    });
    y += 1.0;
  }
}

// ---------------------------------------------------------------------------
// LAYOUT 5: content_columns
// ---------------------------------------------------------------------------
async function buildContentColumns(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme;
  const bgColor = hexOrDefault(theme.background, "FFFFFF");
  slide.background = { color: bgColor };
  const titleColor = readableTextColor(bgColor, theme);
  const mutedColor = readableMutedColor(bgColor, theme);

  slide.addText(props.title, {
    x: MARGIN,
    y: 0.4,
    w: CONTENT_W,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: titleColor,
    fontFace: theme.fontFace || "Calibri",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 0.95,
    w: 0.7,
    h: 0.05,
    fill: { color: hexOrDefault(theme.primary, "2563EB") },
  });

  const cols = props.columns.slice(0, 3);
  const gap = 0.35;
  const colW = (CONTENT_W - gap * (cols.length - 1)) / cols.length;
  const colY = 1.35,
    colH = 3.9;

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const colX = MARGIN + i * (colW + gap);
    const accent = hexOrDefault(col.accentColor || theme.primary, "2563EB");

    if (col.icon) {
      try {
        const dataUri = await iconDataUri(
          fetchAsDataUri,
          col.icon.set,
          col.icon.name,
          accent,
        );
        slide.addImage({ data: dataUri, x: colX, y: colY, w: 0.35, h: 0.35 });
      } catch (err) {
        /* skip */
      }
    }
    slide.addText(col.heading, {
      x: colX + (col.icon ? 0.45 : 0),
      y: colY + 0.02,
      w: colW - (col.icon ? 0.45 : 0),
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: titleColor,
      fontFace: theme.fontFace || "Calibri",
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: colX,
      y: colY + 0.45,
      w: colW,
      h: 0.02,
      fill: { color: accent },
    });

    const bulletText = (
      col.items && col.items.length ? col.items : ["Tidak ada item."]
    ).join("\n");
    slide.addText(bulletText, {
      x: colX,
      y: colY + 0.6,
      w: colW,
      h: colH - 0.6,
      fontSize: 10.5,
      color: mutedColor,
      fontFace: theme.fontFace || "Calibri",
      bullet: { code: "2022" },
      valign: "top",
      lineSpacing: 15,
    });
  }
}

// ---------------------------------------------------------------------------
// LAYOUT 6: closing
// ---------------------------------------------------------------------------
function buildClosing(slide, pptx, ctx, props) {
  const theme = props.theme;
  const bgColor = hexOrDefault(theme.primary, "1E293B");
  slide.background = { color: bgColor };
  const textColor = readableTextColor(bgColor, theme, null, "FFFFFF");
  const mutedColor = readableMutedColor(bgColor, theme);
  const accent = hexOrDefault(theme.accent, "38BDF8");

  slide.addText(props.title || "Terima Kasih", {
    x: 0,
    y: 2.1,
    w: CANVAS.w,
    h: 1.0,
    fontSize: 34,
    bold: true,
    color: textColor,
    align: "center",
    fontFace: theme.fontFace || "Calibri",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: CANVAS.w / 2 - 0.4,
    y: 3.05,
    w: 0.8,
    h: 0.05,
    fill: { color: accent },
  });
  if (props.subtitle) {
    slide.addText(props.subtitle, {
      x: 0,
      y: 3.25,
      w: CANVAS.w,
      h: 0.4,
      fontSize: 13,
      color: mutedColor,
      align: "center",
      fontFace: theme.fontFace || "Calibri",
    });
  }
}

const LAYOUT_BUILDERS = {
  title_cover: buildTitleCover,
  section_header: buildSectionHeader,
  stat_cards: buildStatCards,
  chart_focus: buildChartFocus,
  content_columns: buildContentColumns,
  closing: buildClosing,
};

module.exports = { LAYOUT_BUILDERS, CANVAS, MARGIN, CONTENT_W };
