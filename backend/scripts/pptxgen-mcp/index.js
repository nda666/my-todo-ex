// backend/scripts/pptxgen-mcp/index.js
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const PptxGenJS = require("pptxgenjs");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const { LAYOUT_BUILDERS, DEFAULT_THEME } = require("./layouts");

const server = new McpServer({ name: "pptxgen-mcp", version: "2.1.0" });
const presentations = new Map();

function getPresentation(id) {
  const p = presentations.get(id);
  if (!p) {
    throw new Error(
      `presentationId '${id}' tidak ditemukan. Panggil create_presentation dulu.`,
    );
  }
  return p;
}

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error(`terlalu banyak redirect (>5): ${url}`));
      return;
    }
    const lib = url.startsWith("https") ? https : http;
    console.error(`[pptxgen-mcp] GET ${url} (redirect #${redirectCount})`);

    const req = lib.get(
      url,
      { headers: { "User-Agent": "pptxgen-mcp/2.1" }, timeout: 10000 },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          let nextUrl;
          try {
            nextUrl = new URL(res.headers.location, url).href;
          } catch (err) {
            res.resume();
            reject(
              new Error(
                `Location header tidak valid: "${res.headers.location}" (dari ${url})`,
              ),
            );
            return;
          }
          console.error(
            `[pptxgen-mcp] redirect ${res.statusCode} -> ${nextUrl}`,
          );
          res.resume();
          fetchUrl(nextUrl, redirectCount + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            reject(
              new Error(
                `HTTP ${res.statusCode} saat GET ${url} - body: ${Buffer.concat(chunks).toString("utf-8").slice(0, 300)}`,
              ),
            );
          });
          return;
        }
        const contentType =
          res.headers["content-type"] || "application/octet-stream";
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          console.error(
            `[pptxgen-mcp] sukses GET ${url} — ${contentType}, ${Buffer.concat(chunks).length} bytes`,
          );
          resolve({ buffer: Buffer.concat(chunks), contentType });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout 10s GET ${url}`)));
    req.on("error", (err) => {
      console.error(`[pptxgen-mcp] fetchUrl gagal: ${url} -> ${err.message}`);
      reject(err);
    });
  });
}

async function fetchAsDataUri(url, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { buffer, contentType } = await fetchUrl(url);
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch (err) {
      lastErr = err;
      console.error(
        `[pptxgen-mcp] percobaan ${attempt + 1}/${retries + 1} gagal untuk ${url}: ${err.message}`,
      );
    }
  }
  throw lastErr;
}

server.tool(
  "create_presentation",
  "Membuat presentasi PowerPoint baru + set palet warna (theme) yang WAJIB dipakai konsisten di " +
    "SEMUA slide berikutnya (parameter 'theme'). Background slide TIDAK berubah-ubah antar slide - " +
    "hanya 2 mode: 'primary' (dipakai title_cover/section_header/closing) dan 'background' (dipakai " +
    "stat_cards/chart_focus/content_columns/table_slide/image_slide) - keduanya sudah otomatis dijamin kontras dengan teks di atasnya. " +
    "WAJIB dipanggil pertama kali.",
  {
    title: z.string(),
    author: z.string().optional(),
    theme: z
      .object({
        primary: z
          .string()
          .optional()
          .describe(
            "hex tanpa # - warna solid untuk slide judul/divider/penutup",
          ),
        accent: z
          .string()
          .optional()
          .describe("hex tanpa # - warna aksen kontras untuk garis/highlight"),
        background: z
          .string()
          .optional()
          .describe("hex tanpa # - warna latar slide konten"),
        textColor: z
          .string()
          .optional()
          .describe("hex tanpa # - warna teks di atas background terang"),
        mutedColor: z
          .string()
          .optional()
          .describe("hex tanpa # - warna teks sekunder"),
        fontFace: z.string().optional().describe("default 'Calibri'"),
      })
      .optional()
      .describe("Palet warna konsisten untuk seluruh presentasi"),
  },
  async ({ title, author, theme }) => {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDESCREEN", width: 10, height: 5.63 });
    pptx.layout = "WIDESCREEN";
    pptx.title = title;
    pptx.author = author || "Dora - Doran Todo Assistant";

    const mergedTheme = { ...DEFAULT_THEME, ...(theme || {}) };
    const id = crypto.randomUUID();
    presentations.set(id, { pptx, slideCount: 0, theme: mergedTheme });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ presentationId: id, theme: mergedTheme }),
        },
      ],
    };
  },
);

const iconSchema = z.object({ set: z.string(), name: z.string() }).optional();

const layoutSchemas = {
  title_cover: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    eyebrow: z.string().optional(),
    imageSeed: z
      .string()
      .optional()
      .describe("kata kunci untuk foto background/frame, mis. 'business-team'"),
  }),
  section_header: z.object({
    title: z.string(),
    eyebrow: z.string().optional(),
    icon: iconSchema,
  }),
  stat_cards: z.object({
    title: z.string(),
    cards: z
      .array(
        z.object({
          value: z.string().describe("angka besar, mis. '90%' atau '12'"),
          label: z.string(),
          detail: z.string().optional(),
          icon: iconSchema,
          accentColor: z
            .string()
            .optional()
            .describe("hex tanpa #, default theme.primary"),
        }),
      )
      .min(1)
      .max(4),
  }),
  chart_focus: z.object({
    title: z.string(),
    chartType: z.enum(["bar", "pie", "doughnut", "line"]).optional(),
    labels: z.array(z.string()),
    values: z.array(z.number()),
    seriesName: z.string().optional(),
    colors: z.array(z.string()).optional(),
    sidePoints: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .optional(),
  }),
  content_columns: z.object({
    title: z.string(),
    columns: z
      .array(
        z.object({
          heading: z.string(),
          items: z.array(z.string()),
          icon: iconSchema,
          accentColor: z.string().optional(),
        }),
      )
      .min(1)
      .max(3),
  }),
  table_slide: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    headers: z.array(z.string()).describe("Daftar nama kolom tabel"),
    rows: z.array(z.array(z.string())).describe("Baris data sel-sel tabel"),
    footnote: z.string().optional(),
  }),
  image_slide: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    imageUrl: z.string().optional(),
    imageSeed: z.string().optional(),
    description: z.string().optional(),
    points: z.array(z.string()).optional(),
  }),
  quote_callout: z.object({
    title: z.string().optional(),
    quote: z.string().describe("Teks kutipan/callout"),
    author: z.string().optional().describe("Nama pembuat kutipan"),
    role: z.string().optional().describe("Jabatan / peran"),
  }),
  closing: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }),
};

const layoutNames = Object.keys(layoutSchemas);

server.tool(
  "build_slide_from_layout",
  "Membuat SATU slide memakai TEMPLATE LAYOUT siap pakai (posisi/grid/spacing sudah didesain profesional, " +
    "kamu HANYA mengisi konten). Pilih 'layout' paling cocok:\n" +
    "- title_cover: slide judul/cover dengan foto accent/frame\n" +
    "- section_header: divider antar-bagian, panel warna solid + ikon besar\n" +
    "- stat_cards: 1-4 kartu statistik sejajar (angka besar + label + ikon)\n" +
    "- chart_focus: chart besar di kiri + ringkasan poin di kanan\n" +
    "- content_columns: 1-3 kolom teks berjudul (untuk daftar task/kendala/rencana)\n" +
    "- table_slide: tabel data dengan header & baris zebra-stripe\n" +
    "- image_slide: gambar/foto di kiri + deskripsi/poin di kanan\n" +
    "- quote_callout: kartu kutipan/takeaway dengan bingkai aksen\n" +
    "- closing: slide penutup\n" +
    "JANGAN PERNAH mengirim x/y/w/h manual - layout ini yang mengatur semua posisi otomatis.",
  {
    presentationId: z.string(),
    layout: z.enum(layoutNames),
    props: z
      .record(z.any())
      .describe(
        "Isi konten sesuai skema layout yang dipilih (lihat deskripsi tiap layout)",
      ),
  },
  async ({ presentationId, layout, props }) => {
    const p = getPresentation(presentationId);
    const schema = layoutSchemas[layout];
    const parsed = schema.safeParse(props);
    if (!parsed.success) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `props tidak valid untuk layout '${layout}': ${JSON.stringify(parsed.error.issues)}`,
          },
        ],
      };
    }

    const slide = p.pptx.addSlide();
    const builder = LAYOUT_BUILDERS[layout];
    const slideNumber = p.slideCount + 1;

    try {
      await builder(
        slide,
        p.pptx,
        { fetchAsDataUri },
        {
          ...parsed.data,
          theme: p.theme,
          slideNumber,
          totalSlides: p.slideCount,
          presentationTitle: p.pptx.title,
        },
      );
    } catch (err) {
      console.error(
        `[pptxgen-mcp] layout '${layout}' gagal sebagian: ${err.message}`,
      );
    }

    const slideIndex = p.slideCount;
    p.slideCount += 1;
    return {
      content: [{ type: "text", text: JSON.stringify({ slideIndex, layout }) }],
    };
  },
);

server.tool(
  "save_presentation",
  "Menyimpan presentasi ke file .pptx di disk dan mengembalikan outputPath. WAJIB dipanggil terakhir setelah semua slide dibuat.",
  {
    presentationId: z.string(),
    outputPath: z.string(),
  },
  async ({ presentationId, outputPath }) => {
    const p = getPresentation(presentationId);
    await p.pptx.writeFile({ fileName: outputPath });
    presentations.delete(presentationId);
    return {
      content: [{ type: "text", text: JSON.stringify({ outputPath }) }],
    };
  },
);

const transport = new StdioServerTransport();
server.connect(transport);
