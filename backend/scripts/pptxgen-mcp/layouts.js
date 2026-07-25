// backend/scripts/pptxgen-mcp/layouts.js
// Executive-Grade Presentation Layout Engine for PptxGenJS.
// Designed with ultra-premium McKinsey / Google / Apple aesthetic standards:
// - Dynamic layout composition & responsive typography scaling
// - Geometric accent layers & glassmorphic surface cards
// - Metric badges, trend indicators, and index watermarks
// - Auto-contrast color math & strict grid alignments

// ============================================================================
// 1. DESIGN SYSTEM CONSTANTS & THEMES
// ============================================================================

const CANVAS = { w: 10, h: 5.63 }; // 16:9 Widescreen dimensions in inches

const GRID = {
  marginLeft: 0.6,
  marginRight: 0.6,
  marginTop: 0.45,
  marginBottom: 0.45,
  contentW: 8.8, // 10 - (2 * 0.6)
  contentTop: 1.3, // Y start for body content
  contentH: 3.8, // Body content height available
  footerY: 5.25, // Y position for footer rule & page numbers
};

const DEFAULT_THEME = {
  primary: "0F172A", // Executive Deep Navy / Slate
  accent: "0284C7", // Vivid Sky Blue / Brand Accent
  background: "F8FAFC", // Off-white clean background
  surface: "FFFFFF", // High-contrast surface card
  surfaceAlt: "F1F5F9", // Soft slate surface
  textColor: "0F172A", // High-contrast primary text
  mutedColor: "64748B", // Muted slate secondary text
  border: "E2E8F0", // Subtle stroke border
  fontFace: "Calibri",
};

const SHADOWS = {
  card: {
    type: "outer",
    color: "0F172A",
    opacity: 0.08,
    blur: 12,
    offset: 3,
    angle: 90,
  },
  subtle: {
    type: "outer",
    color: "0F172A",
    opacity: 0.04,
    blur: 6,
    offset: 2,
    angle: 90,
  },
  textCover: {
    type: "outer",
    color: "000000",
    opacity: 0.35,
    blur: 8,
    offset: 2,
    angle: 45,
  },
};

// ============================================================================
// 2. COLOR & CONTRAST HELPERS
// ============================================================================

function hexOrDefault(v, fallback) {
  if (!v) return fallback.replace(/^#/, "").toUpperCase();
  return String(v).trim().replace(/^#/, "").toUpperCase();
}

function relativeLuminance(hex) {
  const h = hexOrDefault(hex, "FFFFFF");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const lin = (c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function isDark(hex) {
  return relativeLuminance(hexOrDefault(hex, "FFFFFF")) < 0.45;
}

function readableTextColor(bgHex, theme, lightVariant, darkVariant) {
  const bg = hexOrDefault(bgHex, "FFFFFF");
  if (isDark(bg)) return hexOrDefault(darkVariant, "F8FAFC");
  return hexOrDefault(lightVariant || (theme && theme.textColor), "0F172A");
}

function readableMutedColor(bgHex, theme) {
  const bg = hexOrDefault(bgHex, "FFFFFF");
  if (isDark(bg)) return "CBD5E1";
  return hexOrDefault(theme && theme.mutedColor, "64748B");
}

// ============================================================================
// 3. TYPOGRAPHY & DYNAMIC FIT HELPERS
// ============================================================================

function calculateFontSize(
  text,
  maxWInches,
  maxHInches,
  baseFontSize,
  minFontSize = 10,
  lineRatio = 1.25,
) {
  if (!text) return baseFontSize;
  const str = Array.isArray(text) ? text.join("\n") : String(text);
  if (!str.trim()) return baseFontSize;

  const lines = str.split("\n");
  let totalLineCount = 0;

  for (const line of lines) {
    const avgCharWidthInches = (baseFontSize * 0.5) / 72;
    const charsPerLine = Math.max(
      1,
      Math.floor(maxWInches / avgCharWidthInches),
    );
    const wrappedLines = Math.ceil((line.length || 1) / charsPerLine);
    totalLineCount += Math.max(1, wrappedLines);
  }

  const estimatedHeightInches =
    (totalLineCount * baseFontSize * lineRatio) / 72;
  if (estimatedHeightInches > maxHInches) {
    const scaleFactor = maxHInches / estimatedHeightInches;
    const adjustedSize = Math.floor(baseFontSize * scaleFactor);
    return Math.max(minFontSize, adjustedSize);
  }

  return baseFontSize;
}

function computeBulletLayout(
  items,
  containerHInches,
  baseFontSize = 11,
  minFontSize = 9,
) {
  const count = (items && items.length) || 1;
  let fontSize = baseFontSize;

  if (count > 6) fontSize = Math.max(minFontSize, baseFontSize - 2);
  else if (count > 4) fontSize = Math.max(minFontSize, baseFontSize - 1);

  const lineSpacing = Math.round(fontSize * 1.35);
  return { fontSize, lineSpacing };
}

async function iconDataUri(fetchAsDataUri, iconSet, iconName, colorHex) {
  if (!iconSet || !iconName) return null;
  const cleanColor = hexOrDefault(colorHex, "0284C7");
  const url = `https://api.iconify.design/${iconSet}/${iconName}.svg?color=%23${cleanColor}`;
  try {
    return await fetchAsDataUri(url, 1);
  } catch (err) {
    console.error(
      `[pptxgen-mcp] Gagal memuat ikon ${iconSet}:${iconName}: ${err.message}`,
    );
    return null;
  }
}

// ============================================================================
// 4. REUSABLE UI DECORATION COMPONENTS
// ============================================================================

function renderSlideHeader(slide, pptx, theme, title, eyebrow, subtitle) {
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  const titleColor = readableTextColor(bgColor, theme);
  const mutedColor = readableMutedColor(bgColor, theme);
  const accentColor = hexOrDefault(
    theme.accent || theme.primary,
    DEFAULT_THEME.accent,
  );

  let currentY = GRID.marginTop;

  // Eyebrow Tag / Pill Badge
  if (eyebrow) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: GRID.marginLeft,
      y: currentY,
      w: Math.min(3.2, eyebrow.length * 0.11 + 0.4),
      h: 0.26,
      rectRadius: 0.05,
      fill: { color: accentColor, transparency: 88 },
      line: { color: accentColor, width: 1 },
    });
    slide.addText(eyebrow.toUpperCase(), {
      x: GRID.marginLeft,
      y: currentY,
      w: Math.min(3.2, eyebrow.length * 0.11 + 0.4),
      h: 0.26,
      fontSize: 9,
      bold: true,
      align: "center",
      valign: "middle",
      color: accentColor,
      fontFace,
      charSpacing: 1.5,
    });
    currentY += 0.32;
  }

  // Slide Title
  if (title) {
    const titleFontSize = calculateFontSize(title, GRID.contentW, 0.55, 22, 16);
    slide.addText(title, {
      x: GRID.marginLeft,
      y: currentY,
      w: GRID.contentW,
      h: 0.55,
      fontSize: titleFontSize,
      bold: true,
      color: titleColor,
      fontFace,
      valign: "middle",
    });
    currentY += 0.58;
  }

  // Underline Accent Ruler
  slide.addShape(pptx.ShapeType.rect, {
    x: GRID.marginLeft,
    y: currentY,
    w: 0.85,
    h: 0.04,
    fill: { color: accentColor },
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: GRID.marginLeft + 1.0,
      y: currentY - 0.08,
      w: GRID.contentW - 1.0,
      h: 0.3,
      fontSize: 11,
      color: mutedColor,
      fontFace,
    });
  }
}

function renderSlideFooter(
  slide,
  pptx,
  theme,
  slideNumber,
  totalSlides,
  presentationTitle,
) {
  if (!slideNumber) return;

  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  const mutedColor = readableMutedColor(bgColor, theme);
  const borderColor = hexOrDefault(theme.border, DEFAULT_THEME.border);

  // Separator rule
  slide.addShape(pptx.ShapeType.rect, {
    x: GRID.marginLeft,
    y: GRID.footerY,
    w: GRID.contentW,
    h: 0.01,
    fill: { color: borderColor },
  });

  // Left watermark
  const footerTitle = presentationTitle || "Doran Workspace";
  slide.addText(footerTitle, {
    x: GRID.marginLeft,
    y: GRID.footerY + 0.06,
    w: 5.0,
    h: 0.22,
    fontSize: 8.5,
    color: mutedColor,
    fontFace,
  });

  // Right slide counter pill
  slide.addShape(pptx.ShapeType.roundRect, {
    x: CANVAS.w - GRID.marginRight - 1.1,
    y: GRID.footerY + 0.05,
    w: 1.1,
    h: 0.24,
    rectRadius: 0.12,
    fill: { color: hexOrDefault(theme.surfaceAlt, DEFAULT_THEME.surfaceAlt) },
  });
  slide.addText(`SLIDE ${slideNumber}`, {
    x: CANVAS.w - GRID.marginRight - 1.1,
    y: GRID.footerY + 0.05,
    w: 1.1,
    h: 0.24,
    fontSize: 8,
    bold: true,
    align: "center",
    valign: "middle",
    color: mutedColor,
    fontFace,
  });
}

// ============================================================================
// 5. ULTRA-PREMIUM LAYOUT BUILDERS
// ============================================================================

// ---------------------------------------------------------------------------
// LAYOUT 1: title_cover
// ---------------------------------------------------------------------------
async function buildTitleCover(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.primary, DEFAULT_THEME.primary);
  slide.background = { color: bgColor };

  const textColor = readableTextColor(bgColor, theme, null, "FFFFFF");
  const mutedColor = readableMutedColor(bgColor, theme);
  const accentColor = hexOrDefault(theme.accent, DEFAULT_THEME.accent);

  // Decorative Geometric Background Panels (Glass & Layers)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.2,
    h: CANVAS.h,
    fill: { color: accentColor },
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.8,
    y: -1.0,
    w: 4.5,
    h: 7.5,
    rectRadius: 0.2,
    fill: { color: "FFFFFF", transparency: 95 },
    line: { color: accentColor, width: 1 },
  });

  const leftX = 0.8;
  const leftW = props.imageSeed ? 5.2 : 8.2;

  // Eyebrow Tag Pill
  if (props.eyebrow) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: leftX,
      y: 1.0,
      w: 2.4,
      h: 0.35,
      rectRadius: 0.08,
      fill: { color: accentColor },
      shadow: SHADOWS.subtle,
    });
    slide.addText(props.eyebrow.toUpperCase(), {
      x: leftX,
      y: 1.0,
      w: 2.4,
      h: 0.35,
      fontSize: 10,
      bold: true,
      align: "center",
      valign: "middle",
      color: readableTextColor(accentColor, theme, null, "FFFFFF"),
      fontFace,
      charSpacing: 1.5,
    });
  }

  // Hero Title
  const titleY = props.eyebrow ? 1.55 : 1.2;
  const titleFontSize = calculateFontSize(props.title, leftW, 1.8, 36, 24);
  slide.addText(props.title, {
    x: leftX,
    y: titleY,
    w: leftW,
    h: 1.8,
    fontSize: titleFontSize,
    bold: true,
    color: textColor,
    fontFace,
    shadow: SHADOWS.textCover,
  });

  // Accent Line
  const ruleY = titleY + 1.85;
  slide.addShape(pptx.ShapeType.rect, {
    x: leftX,
    y: ruleY,
    w: 1.2,
    h: 0.05,
    fill: { color: accentColor },
  });

  // Subtitle
  if (props.subtitle) {
    slide.addText(props.subtitle, {
      x: leftX,
      y: ruleY + 0.2,
      w: leftW,
      h: 0.8,
      fontSize: 14,
      color: mutedColor,
      fontFace,
    });
  }

  // Footer Metadata Badge Card
  const authorText = props.author || "Doran Workspace";
  slide.addShape(pptx.ShapeType.roundRect, {
    x: leftX,
    y: 4.65,
    w: leftW,
    h: 0.45,
    rectRadius: 0.06,
    fill: { color: "FFFFFF", transparency: 92 },
    line: { color: "FFFFFF", width: 0.5 },
  });
  slide.addText(`PRESENTATION BY: ${authorText.toUpperCase()}`, {
    x: leftX + 0.2,
    y: 4.65,
    w: leftW - 0.4,
    h: 0.45,
    fontSize: 9,
    bold: true,
    valign: "middle",
    color: textColor,
    fontFace,
    charSpacing: 1,
  });

  // Right Frame Image
  if (props.imageSeed) {
    try {
      const imgUrl = `https://picsum.photos/seed/${encodeURIComponent(props.imageSeed)}/800/1000`;
      const dataUri = await fetchAsDataUri(imgUrl, 1);

      slide.addImage({
        data: dataUri,
        x: 6.4,
        y: 0.6,
        w: 3.0,
        h: 4.43,
        rounding: true,
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 6.4,
        y: 0.6,
        w: 3.0,
        h: 4.43,
        rectRadius: 0.05,
        fill: { color: bgColor, transparency: 80 },
        line: { color: accentColor, width: 1.5 },
        shadow: SHADOWS.card,
      });
    } catch (err) {
      /* fallback empty frame */
    }
  }
}

// ---------------------------------------------------------------------------
// LAYOUT 2: section_header
// ---------------------------------------------------------------------------
async function buildSectionHeader(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.primary, DEFAULT_THEME.primary);
  slide.background = { color: bgColor };

  const textColor = readableTextColor(bgColor, theme, null, "FFFFFF");
  const mutedColor = readableMutedColor(bgColor, theme);
  const accentColor = hexOrDefault(theme.accent, DEFAULT_THEME.accent);

  // Big Watermark Section Number in Background
  const sectionIndex = String(props.slideNumber || "01").padStart(2, "0");
  slide.addText(sectionIndex, {
    x: 6.0,
    y: 0.5,
    w: 3.8,
    h: 3.8,
    fontSize: 160,
    bold: true,
    color: "FFFFFF",
    align: "right",
    fontFace,
  });

  let currentY = 1.3;

  if (props.icon) {
    try {
      const dataUri = await iconDataUri(
        fetchAsDataUri,
        props.icon.set,
        props.icon.name,
        accentColor,
      );
      if (dataUri) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: GRID.marginLeft,
          y: currentY,
          w: 0.9,
          h: 0.9,
          rectRadius: 0.1,
          fill: { color: "FFFFFF", transparency: 90 },
          line: { color: accentColor, width: 1 },
          shadow: SHADOWS.subtle,
        });
        slide.addImage({
          data: dataUri,
          x: GRID.marginLeft + 0.18,
          y: currentY + 0.18,
          w: 0.54,
          h: 0.54,
        });
        currentY += 1.1;
      }
    } catch (err) {
      /* skip */
    }
  }

  if (props.eyebrow) {
    slide.addText(props.eyebrow.toUpperCase(), {
      x: GRID.marginLeft,
      y: currentY,
      w: GRID.contentW,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: accentColor,
      fontFace,
      charSpacing: 2,
    });
    currentY += 0.35;
  }

  const titleFontSize = calculateFontSize(props.title, 7.5, 1.2, 34, 22);
  slide.addText(props.title, {
    x: GRID.marginLeft,
    y: currentY,
    w: 7.5,
    h: 1.2,
    fontSize: titleFontSize,
    bold: true,
    color: textColor,
    fontFace,
    valign: "top",
    shadow: SHADOWS.textCover,
  });
  currentY += 1.25;

  slide.addShape(pptx.ShapeType.rect, {
    x: GRID.marginLeft,
    y: currentY,
    w: 1.2,
    h: 0.05,
    fill: { color: accentColor },
  });
}

// ---------------------------------------------------------------------------
// LAYOUT 3: stat_cards
// ---------------------------------------------------------------------------
async function buildStatCards(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  slide.background = { color: bgColor };

  renderSlideHeader(slide, pptx, theme, props.title, "METRICS & PERFORMANCE");

  const cards = (props.cards || []).slice(0, 4);
  const cardCount = cards.length || 1;
  const gap = 0.25;
  const cardW = (GRID.contentW - gap * (cardCount - 1)) / cardCount;
  const cardY = GRID.contentTop;
  const cardH = GRID.contentH - 0.2;
  const cardBg = DEFAULT_THEME.surface;

  const cardTextColor = readableTextColor(cardBg, theme);
  const cardMutedColor = readableMutedColor(cardBg, theme);

  for (let i = 0; i < cardCount; i++) {
    const c = cards[i];
    const cardX = GRID.marginLeft + i * (cardW + gap);
    const accent = hexOrDefault(
      c.accentColor || theme.primary,
      DEFAULT_THEME.accent,
    );

    // Glass Card Container
    slide.addShape(pptx.ShapeType.roundRect, {
      x: cardX,
      y: cardY,
      w: cardW,
      h: cardH,
      rectRadius: 0.08,
      fill: { color: cardBg },
      line: {
        color: hexOrDefault(theme.border, DEFAULT_THEME.border),
        width: 1,
      },
      shadow: SHADOWS.card,
    });

    // Accent Top Banner Strip
    slide.addShape(pptx.ShapeType.rect, {
      x: cardX,
      y: cardY,
      w: cardW,
      h: 0.08,
      fill: { color: accent },
    });

    // Icon Container Badge
    if (c.icon) {
      try {
        const dataUri = await iconDataUri(
          fetchAsDataUri,
          c.icon.set,
          c.icon.name,
          accent,
        );
        if (dataUri) {
          slide.addShape(pptx.ShapeType.roundRect, {
            x: cardX + 0.2,
            y: cardY + 0.3,
            w: 0.55,
            h: 0.55,
            rectRadius: 0.06,
            fill: { color: accent, transparency: 88 },
          });
          slide.addImage({
            data: dataUri,
            x: cardX + 0.28,
            y: cardY + 0.38,
            w: 0.39,
            h: 0.39,
          });
        }
      } catch (err) {
        /* skip icon */
      }
    }

    const valY = c.icon ? cardY + 1.0 : cardY + 0.5;
    const valFontSize = calculateFontSize(c.value, cardW - 0.4, 0.75, 32, 20);
    slide.addText(c.value, {
      x: cardX + 0.2,
      y: valY,
      w: cardW - 0.4,
      h: 0.75,
      fontSize: valFontSize,
      bold: true,
      color: cardTextColor,
      fontFace,
    });

    slide.addText(c.label, {
      x: cardX + 0.2,
      y: valY + 0.8,
      w: cardW - 0.4,
      h: 0.8,
      fontSize: 11.5,
      color: cardMutedColor,
      fontFace,
      valign: "top",
    });

    if (c.detail) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: cardX + 0.2,
        y: cardY + cardH - 0.6,
        w: cardW - 0.4,
        h: 0.35,
        rectRadius: 0.05,
        fill: {
          color: hexOrDefault(theme.surfaceAlt, DEFAULT_THEME.surfaceAlt),
        },
      });
      slide.addText(c.detail, {
        x: cardX + 0.2,
        y: cardY + cardH - 0.6,
        w: cardW - 0.4,
        h: 0.35,
        fontSize: 9.5,
        bold: true,
        align: "center",
        valign: "middle",
        color: accent,
        fontFace,
      });
    }
  }

  renderSlideFooter(
    slide,
    pptx,
    theme,
    props.slideNumber,
    props.totalSlides,
    props.presentationTitle,
  );
}

// ---------------------------------------------------------------------------
// LAYOUT 4: chart_focus
// ---------------------------------------------------------------------------
function buildChartFocus(slide, pptx, ctx, props) {
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  slide.background = { color: bgColor };

  renderSlideHeader(
    slide,
    pptx,
    theme,
    props.title,
    "DATA & GRAPHICAL ANALYSIS",
  );

  const titleColor = readableTextColor(bgColor, theme);
  const mutedColor = readableMutedColor(bgColor, theme);
  const primaryColor = hexOrDefault(theme.primary, DEFAULT_THEME.primary);
  const accentColor = hexOrDefault(theme.accent, DEFAULT_THEME.accent);

  const hasSidePoints = props.sidePoints && props.sidePoints.length > 0;
  const chartW = hasSidePoints ? 5.3 : GRID.contentW;
  const chartH = GRID.contentH - 0.2;

  const chartTypeMap = {
    bar: pptx.ChartType.bar,
    pie: pptx.ChartType.pie,
    doughnut: pptx.ChartType.doughnut,
    line: pptx.ChartType.line,
  };

  const chartColors =
    props.colors && props.colors.length
      ? props.colors.map((c) => hexOrDefault(c, primaryColor))
      : [primaryColor, accentColor, "6366F1", "10B981", "F59E0B"];

  // Chart Container Outer Card Frame
  slide.addShape(pptx.ShapeType.roundRect, {
    x: GRID.marginLeft,
    y: GRID.contentTop,
    w: chartW,
    h: chartH,
    rectRadius: 0.08,
    fill: { color: DEFAULT_THEME.surface },
    line: { color: hexOrDefault(theme.border, DEFAULT_THEME.border), width: 1 },
    shadow: SHADOWS.subtle,
  });

  slide.addChart(
    chartTypeMap[props.chartType || "bar"],
    [
      {
        name: props.seriesName || "Data",
        labels: props.labels || [],
        values: props.values || [],
      },
    ],
    {
      x: GRID.marginLeft + 0.15,
      y: GRID.contentTop + 0.15,
      w: chartW - 0.3,
      h: chartH - 0.3,
      showLegend: props.chartType === "pie" || props.chartType === "doughnut",
      showValue: true,
      chartColors,
      legendPos: "b",
      dataLabelColor: titleColor,
      catAxisLabelColor: mutedColor,
      valAxisLabelColor: mutedColor,
      legendColor: mutedColor,
    },
  );

  if (hasSidePoints) {
    const sideX = GRID.marginLeft + chartW + 0.35;
    const sideW = GRID.contentW - chartW - 0.35;
    const points = props.sidePoints.slice(0, 4);
    const sideCardH = 0.85;
    const pointGap = 0.12;

    let y = GRID.contentTop;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const cardBg = DEFAULT_THEME.surface;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: sideX,
        y,
        w: sideW,
        h: sideCardH,
        rectRadius: 0.06,
        fill: { color: cardBg },
        line: {
          color: hexOrDefault(theme.border, DEFAULT_THEME.border),
          width: 1,
        },
        shadow: SHADOWS.subtle,
      });

      slide.addShape(pptx.ShapeType.rect, {
        x: sideX,
        y,
        w: 0.08,
        h: sideCardH,
        fill: { color: accentColor },
      });

      slide.addText(pt.label, {
        x: sideX + 0.2,
        y: y + 0.08,
        w: sideW - 0.3,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: readableMutedColor(cardBg, theme),
        fontFace,
      });

      slide.addText(pt.value, {
        x: sideX + 0.2,
        y: y + 0.36,
        w: sideW - 0.3,
        h: 0.4,
        fontSize: 15,
        bold: true,
        color: readableTextColor(cardBg, theme),
        fontFace,
      });

      y += sideCardH + pointGap;
    }
  }

  renderSlideFooter(
    slide,
    pptx,
    theme,
    props.slideNumber,
    props.totalSlides,
    props.presentationTitle,
  );
}

// ---------------------------------------------------------------------------
// LAYOUT 5: content_columns
// ---------------------------------------------------------------------------
async function buildContentColumns(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  slide.background = { color: bgColor };

  renderSlideHeader(slide, pptx, theme, props.title, "KEY STRATEGY & PILLARS");

  const cols = (props.columns || []).slice(0, 3);
  const colCount = cols.length || 1;
  const gap = 0.3;
  const colW = (GRID.contentW - gap * (colCount - 1)) / colCount;
  const colY = GRID.contentTop;
  const colH = GRID.contentH - 0.2;
  const cardBg = DEFAULT_THEME.surface;

  const cardTitleColor = readableTextColor(cardBg, theme);
  const cardMutedColor = readableMutedColor(cardBg, theme);

  for (let i = 0; i < colCount; i++) {
    const col = cols[i];
    const colX = GRID.marginLeft + i * (colW + gap);
    const accent = hexOrDefault(
      col.accentColor || theme.primary,
      DEFAULT_THEME.accent,
    );

    // Card Container
    slide.addShape(pptx.ShapeType.roundRect, {
      x: colX,
      y: colY,
      w: colW,
      h: colH,
      rectRadius: 0.08,
      fill: { color: cardBg },
      line: {
        color: hexOrDefault(theme.border, DEFAULT_THEME.border),
        width: 1,
      },
      shadow: SHADOWS.subtle,
    });

    // Step Number Badge (01, 02, 03)
    const stepNum = String(i + 1).padStart(2, "0");
    slide.addShape(pptx.ShapeType.roundRect, {
      x: colX + 0.2,
      y: colY + 0.2,
      w: 0.45,
      h: 0.35,
      rectRadius: 0.05,
      fill: { color: accent, transparency: 88 },
    });
    slide.addText(stepNum, {
      x: colX + 0.2,
      y: colY + 0.2,
      w: 0.45,
      h: 0.35,
      fontSize: 10,
      bold: true,
      align: "center",
      valign: "middle",
      color: accent,
      fontFace,
    });

    let headerTextX = colX + 0.75;
    let headerTextW = colW - 0.95;

    if (col.icon) {
      try {
        const dataUri = await iconDataUri(
          fetchAsDataUri,
          col.icon.set,
          col.icon.name,
          accent,
        );
        if (dataUri) {
          slide.addImage({
            data: dataUri,
            x: colX + colW - 0.5,
            y: colY + 0.2,
            w: 0.32,
            h: 0.32,
          });
          headerTextW -= 0.4;
        }
      } catch (err) {
        /* skip icon */
      }
    }

    slide.addText(col.heading, {
      x: headerTextX,
      y: colY + 0.2,
      w: headerTextW,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: cardTitleColor,
      fontFace,
      valign: "middle",
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: colX + 0.2,
      y: colY + 0.65,
      w: colW - 0.4,
      h: 0.02,
      fill: { color: accent },
    });

    const items =
      col.items && col.items.length ? col.items : ["Tidak ada item."];
    const { fontSize, lineSpacing } = computeBulletLayout(
      items,
      colH - 0.8,
      11,
      9,
    );
    const bulletText = items.join("\n");

    slide.addText(bulletText, {
      x: colX + 0.2,
      y: colY + 0.8,
      w: colW - 0.4,
      h: colH - 0.9,
      fontSize,
      color: cardMutedColor,
      fontFace,
      bullet: { code: "2022" },
      valign: "top",
      lineSpacing,
    });
  }

  renderSlideFooter(
    slide,
    pptx,
    theme,
    props.slideNumber,
    props.totalSlides,
    props.presentationTitle,
  );
}

// ---------------------------------------------------------------------------
// LAYOUT 6: table_slide
// ---------------------------------------------------------------------------
function buildTableSlide(slide, pptx, ctx, props) {
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  slide.background = { color: bgColor };

  renderSlideHeader(
    slide,
    pptx,
    theme,
    props.title,
    "STRUCTURED DATA TABLE",
    props.subtitle,
  );

  const headers = props.headers || [];
  const rows = props.rows || [];
  const primaryColor = hexOrDefault(theme.primary, DEFAULT_THEME.primary);
  const borderColor = hexOrDefault(theme.border, DEFAULT_THEME.border);

  const tableRows = [];

  if (headers.length > 0) {
    const headerCells = headers.map((h) => ({
      text: h.toUpperCase(),
      options: {
        bold: true,
        fill: primaryColor,
        color: "FFFFFF",
        align: "center",
        valign: "middle",
        fontFace,
        fontSize: 10,
      },
    }));
    tableRows.push(headerCells);
  }

  for (let i = 0; i < rows.length; i++) {
    const rowData = rows[i];
    const rowFill = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const cellOptions = {
      fill: rowFill,
      color: readableTextColor(rowFill, theme),
      fontFace,
      fontSize: 9.5,
      valign: "middle",
    };

    const rowCells = rowData.map((val) => ({
      text: String(val),
      options: cellOptions,
    }));
    tableRows.push(rowCells);
  }

  if (tableRows.length > 0) {
    slide.addTable(tableRows, {
      x: GRID.marginLeft,
      y: GRID.contentTop,
      w: GRID.contentW,
      h: GRID.contentH - 0.5,
      border: { type: "solid", color: borderColor, pt: 1 },
      autoPage: true,
    });
  }

  if (props.footnote) {
    slide.addText(props.footnote, {
      x: GRID.marginLeft,
      y: GRID.contentTop + GRID.contentH - 0.4,
      w: GRID.contentW,
      h: 0.3,
      fontSize: 8.5,
      italic: true,
      color: readableMutedColor(bgColor, theme),
      fontFace,
    });
  }

  renderSlideFooter(
    slide,
    pptx,
    theme,
    props.slideNumber,
    props.totalSlides,
    props.presentationTitle,
  );
}

// ---------------------------------------------------------------------------
// LAYOUT 7: image_slide
// ---------------------------------------------------------------------------
async function buildImageSlide(slide, pptx, ctx, props) {
  const { fetchAsDataUri } = ctx;
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  slide.background = { color: bgColor };

  renderSlideHeader(
    slide,
    pptx,
    theme,
    props.title,
    "VISUAL HIGHLIGHT",
    props.subtitle,
  );

  const leftW = 4.0;
  const rightX = GRID.marginLeft + leftW + 0.4;
  const rightW = GRID.contentW - leftW - 0.4;
  const contentY = GRID.contentTop;
  const contentH = GRID.contentH - 0.2;

  const imageSource =
    props.imageUrl ||
    (props.imageSeed
      ? `https://picsum.photos/seed/${encodeURIComponent(props.imageSeed)}/800/600`
      : null);

  if (imageSource) {
    try {
      const dataUri = await fetchAsDataUri(imageSource, 1);
      slide.addImage({
        data: dataUri,
        x: GRID.marginLeft,
        y: contentY,
        w: leftW,
        h: contentH,
        rounding: true,
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: GRID.marginLeft,
        y: contentY,
        w: leftW,
        h: contentH,
        rectRadius: 0.06,
        line: {
          color: hexOrDefault(theme.accent, DEFAULT_THEME.accent),
          width: 1.5,
        },
        shadow: SHADOWS.card,
      });
    } catch (err) {
      /* fallback frame */
    }
  }

  slide.addShape(pptx.ShapeType.roundRect, {
    x: rightX,
    y: contentY,
    w: rightW,
    h: contentH,
    rectRadius: 0.08,
    fill: { color: DEFAULT_THEME.surface },
    line: { color: hexOrDefault(theme.border, DEFAULT_THEME.border), width: 1 },
    shadow: SHADOWS.subtle,
  });

  let currentY = contentY + 0.25;

  if (props.description) {
    slide.addText(props.description, {
      x: rightX + 0.25,
      y: currentY,
      w: rightW - 0.5,
      h: 0.8,
      fontSize: 12,
      color: readableTextColor(DEFAULT_THEME.surface, theme),
      fontFace,
    });
    currentY += 0.85;
  }

  if (props.points && props.points.length) {
    const { fontSize, lineSpacing } = computeBulletLayout(
      props.points,
      contentH - (currentY - contentY) - 0.2,
      11,
      9,
    );
    slide.addText(props.points.join("\n"), {
      x: rightX + 0.25,
      y: currentY,
      w: rightW - 0.5,
      h: contentH - (currentY - contentY) - 0.3,
      fontSize,
      color: readableMutedColor(DEFAULT_THEME.surface, theme),
      fontFace,
      bullet: { code: "2022" },
      valign: "top",
      lineSpacing,
    });
  }

  renderSlideFooter(
    slide,
    pptx,
    theme,
    props.slideNumber,
    props.totalSlides,
    props.presentationTitle,
  );
}

// ---------------------------------------------------------------------------
// LAYOUT 8: quote_callout
// ---------------------------------------------------------------------------
function buildQuoteCallout(slide, pptx, ctx, props) {
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.background, DEFAULT_THEME.background);
  slide.background = { color: bgColor };

  if (props.title) {
    renderSlideHeader(slide, pptx, theme, props.title, "EXECUTIVE TAKEAWAY");
  }

  const cardW = 8.0;
  const cardX = (CANVAS.w - cardW) / 2;
  const cardY = props.title ? GRID.contentTop + 0.1 : 1.1;
  const cardH = 3.3;
  const cardBg = DEFAULT_THEME.surface;
  const accentColor = hexOrDefault(
    theme.accent || theme.primary,
    DEFAULT_THEME.accent,
  );

  slide.addShape(pptx.ShapeType.roundRect, {
    x: cardX,
    y: cardY,
    w: cardW,
    h: cardH,
    rectRadius: 0.08,
    fill: { color: cardBg },
    line: { color: hexOrDefault(theme.border, DEFAULT_THEME.border), width: 1 },
    shadow: SHADOWS.card,
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: cardX,
    y: cardY,
    w: 0.12,
    h: cardH,
    fill: { color: accentColor },
  });

  slide.addText("“", {
    x: cardX + 0.3,
    y: cardY + 0.2,
    w: 0.8,
    h: 0.8,
    fontSize: 54,
    bold: true,
    color: accentColor,
    fontFace: "Georgia",
  });

  const quoteFontSize = calculateFontSize(
    props.quote,
    cardW - 1.2,
    1.5,
    18,
    13,
  );
  slide.addText(props.quote, {
    x: cardX + 0.8,
    y: cardY + 0.5,
    w: cardW - 1.2,
    h: 1.5,
    fontSize: quoteFontSize,
    italic: true,
    color: readableTextColor(cardBg, theme),
    fontFace,
    valign: "middle",
  });

  if (props.author) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: cardX + 0.8,
      y: cardY + 2.3,
      w: Math.min(
        6.5,
        (props.author.length + (props.role ? props.role.length : 0)) * 0.11 +
          0.6,
      ),
      h: 0.4,
      rectRadius: 0.05,
      fill: { color: hexOrDefault(theme.surfaceAlt, DEFAULT_THEME.surfaceAlt) },
    });
    slide.addText(`— ${props.author}${props.role ? `, ${props.role}` : ""}`, {
      x: cardX + 0.9,
      y: cardY + 2.3,
      w: 6.3,
      h: 0.4,
      fontSize: 11,
      bold: true,
      valign: "middle",
      color: accentColor,
      fontFace,
    });
  }

  renderSlideFooter(
    slide,
    pptx,
    theme,
    props.slideNumber,
    props.totalSlides,
    props.presentationTitle,
  );
}

// ---------------------------------------------------------------------------
// LAYOUT 9: closing
// ---------------------------------------------------------------------------
function buildClosing(slide, pptx, ctx, props) {
  const theme = props.theme || {};
  const fontFace = theme.fontFace || DEFAULT_THEME.fontFace;
  const bgColor = hexOrDefault(theme.primary, DEFAULT_THEME.primary);
  slide.background = { color: bgColor };

  const textColor = readableTextColor(bgColor, theme, null, "FFFFFF");
  const mutedColor = readableMutedColor(bgColor, theme);
  const accentColor = hexOrDefault(theme.accent, DEFAULT_THEME.accent);

  // Background Accent Geometry
  slide.addShape(pptx.ShapeType.roundRect, {
    x: CANVAS.w / 2 - 2.5,
    y: 1.2,
    w: 5.0,
    h: 3.2,
    rectRadius: 0.15,
    fill: { color: "FFFFFF", transparency: 95 },
    line: { color: accentColor, width: 1 },
  });

  slide.addText(props.title || "Terima Kasih", {
    x: 0,
    y: 1.8,
    w: CANVAS.w,
    h: 0.9,
    fontSize: 36,
    bold: true,
    color: textColor,
    align: "center",
    fontFace,
    shadow: SHADOWS.textCover,
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: CANVAS.w / 2 - 0.6,
    y: 2.8,
    w: 1.2,
    h: 0.05,
    fill: { color: accentColor },
  });

  if (props.subtitle) {
    slide.addText(props.subtitle, {
      x: 0,
      y: 3.0,
      w: CANVAS.w,
      h: 0.5,
      fontSize: 14,
      color: mutedColor,
      align: "center",
      fontFace,
    });
  }
}

const LAYOUT_BUILDERS = {
  title_cover: buildTitleCover,
  section_header: buildSectionHeader,
  stat_cards: buildStatCards,
  chart_focus: buildChartFocus,
  content_columns: buildContentColumns,
  table_slide: buildTableSlide,
  image_slide: buildImageSlide,
  quote_callout: buildQuoteCallout,
  closing: buildClosing,
};

module.exports = { LAYOUT_BUILDERS, CANVAS, GRID, DEFAULT_THEME };
