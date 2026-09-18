// backend/rpf-news.js
// ======================================================
// RPF NEWS — CENTRAL AUTOMÁTICA DE NOTÍCIAS ESPORTIVAS
// ======================================================

const CACHE_TIME = 10 * 60 * 1000;

let cache = {
  updatedAt: 0,
  data: null,
};

// ======================================================
// FONTES
// ======================================================

const SOURCES = [
  {
    name: "UOL Esporte",
    category: "brasil",
    url: "https://rss.uol.com.br/feed/esporte.xml",
  },
  {
    name: "oGol",
    category: "brasil",
    url: "https://www.ogol.com.br/rss/noticias.php",
  },
];

// ======================================================
// PALAVRAS PARA CLASSIFICAÇÃO
// ======================================================

const INTERIOR_WORDS = [
  "série c",
  "serie c",
  "série d",
  "serie d",
  "estadual",
  "estaduais",
  "interior",
  "acesso",
  "divisão de acesso",
  "divisao de acesso",
  "gauchão",
  "gauchao",
  "gaúcho",
  "gaucho",
  "paulista a2",
  "paulista a3",
  "copa fgp",
  "copa fgf",
  "recopa gaúcha",
  "recopa gaucha",

  "brasil de pelotas",
  "pelotas",
  "ypiranga",
  "caxias",
  "são josé",
  "sao jose",
  "avenida",
  "novo hamburgo",
  "veranópolis",
  "veranopolis",
  "gramadense",
];

const INTERNATIONAL_WORDS = [
  "premier league",
  "champions league",
  "europa league",
  "conference league",
  "la liga",
  "bundesliga",
  "ligue 1",
  "serie a italiana",

  "chelsea",
  "arsenal",
  "liverpool",
  "manchester city",
  "manchester united",
  "tottenham",
  "newcastle",
  "brentford",
  "aston villa",

  "real madrid",
  "barcelona",
  "atlético de madrid",
  "atletico de madrid",

  "bayern",
  "borussia dortmund",

  "psg",
  "paris saint-germain",

  "inter de milão",
  "inter de milao",
  "milan",
  "juventus",

  "inglaterra",
  "espanha",
  "frança",
  "franca",
  "alemanha",
  "itália",
  "italia",
  "portugal",
  "holanda",
  "bélgica",
  "belgica",
];

// ======================================================
// LIMPEZA
// ======================================================

function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value = "") {
  return decodeEntities(
    String(value)
      .replace(/<!\[CDATA\[|\]\]>/g, "")

      // códigos internos do oGol
      // {PLAYER_LINK|123|Nome}
      // {TEAM_LINK|123|Nome}
      // {COACH_LINK|123|Nome}
      // {COMPETITION_LINK|123|Nome}
      .replace(
        /\{[A-Z_]+_LINK\|[^|}]+\|([^}]+)\}/g,
        "$1"
      )

      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUrl(value = "") {
  return String(value)
    .replace(/\s+/g, "")
    .trim();
}

function getXmlValue(xml, tag) {
  const regex = new RegExp(
    `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );

  const result = xml.match(regex);

  return result
    ? cleanText(result[1])
    : "";
}

// ======================================================
// ID ESTÁVEL
// ======================================================

function createId(source, title, link) {
  const value = `${source}-${title}-${link}`;

  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash =
      (hash << 5) -
      hash +
      value.charCodeAt(i);

    hash |= 0;
  }

  return `rpf-${Math.abs(hash)}`;
}

// ======================================================
// NORMALIZAÇÃO PARA COMPARAÇÃO
// ======================================================

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ======================================================
// CLASSIFICAR NOTÍCIA
// ======================================================

function detectCategory(
  title,
  description,
  defaultCategory = "brasil"
) {
  const text = normalize(
    `${title} ${description}`
  );

  const interior =
    INTERIOR_WORDS.some((word) =>
      text.includes(normalize(word))
    );

  if (interior) {
    return "interior";
  }

  const international =
    INTERNATIONAL_WORDS.some((word) =>
      text.includes(normalize(word))
    );

  if (international) {
    return "internacional";
  }

  return defaultCategory;
}

// ======================================================
// DATA
// ======================================================

function safeDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

// ======================================================
// RSS
// ======================================================

async function fetchFeed(source) {
  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 RPF-Placar/1.0",

        Accept:
          "application/rss+xml, application/xml, text/xml, */*",
      },

      signal:
        AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      console.error(
        `[RPF NEWS] ${source.name}: HTTP ${response.status}`
      );

      return [];
    }

    const xml = await response.text();

    const items =
      xml.match(
        /<item\b[\s\S]*?<\/item>/gi
      ) || [];

    const news = [];

    for (const item of items) {
      const title =
        cleanText(
          getXmlValue(item, "title")
        );

      const description =
        cleanText(
          getXmlValue(
            item,
            "description"
          )
        );

      const link =
        cleanUrl(
          getXmlValue(item, "link")
        );

      const pubDate =
        getXmlValue(
          item,
          "pubDate"
        );

      if (!title || !link) {
        continue;
      }

      const category =
        detectCategory(
          title,
          description,
          source.category
        );

      news.push({
        id:
          createId(
            source.name,
            title,
            link
          ),

        category,

        title,

        // resumo curto para não jogar matéria inteira
        // dentro do RPF
        text:
          description
            ? description.slice(0, 320)
            : title,

        source:
          source.name,

        url:
          link,

        publishedAt:
          safeDate(pubDate),
      });
    }

    return news;
  } catch (error) {
    console.error(
      `[RPF NEWS] Falha em ${source.name}:`,
      error.message
    );

    return [];
  }
}

// ======================================================
// DUPLICADAS
// ======================================================

function removeDuplicates(items = []) {
  const used = new Set();

  return items.filter((item) => {
    const key =
      normalize(item.title)
        .replace(/[^a-z0-9]/g, "");

    if (!key) {
      return false;
    }

    if (used.has(key)) {
      return false;
    }

    used.add(key);

    return true;
  });
}

// ======================================================
// ORDENAR
// ======================================================

function sortNewest(items = []) {
  return [...items].sort(
    (a, b) =>
      new Date(
        b.publishedAt
      ).getTime() -
      new Date(
        a.publishedAt
      ).getTime()
  );
}

// ======================================================
// CARREGAR CENTRAL RPF
// ======================================================

async function loadRpfNews() {
  const now = Date.now();

  if (
    cache.data &&
    now - cache.updatedAt <
      CACHE_TIME
  ) {
    return cache.data;
  }

  const results =
    await Promise.allSettled(
      SOURCES.map(
        (source) =>
          fetchFeed(source)
      )
    );

  let allNews = [];

  for (const result of results) {
    if (
      result.status ===
      "fulfilled"
    ) {
      allNews.push(
        ...result.value
      );
    }
  }

  allNews =
    sortNewest(
      removeDuplicates(
        allNews
      )
    );

  const brasil =
    allNews
      .filter(
        (item) =>
          item.category ===
          "brasil"
      )
      .slice(0, 12);

  const internacional =
    allNews
      .filter(
        (item) =>
          item.category ===
          "internacional"
      )
      .slice(0, 12);

  const interior =
    allNews
      .filter(
        (item) =>
          item.category ===
          "interior"
      )
      .slice(0, 12);

  const ticker =
    sortNewest([
      ...brasil,
      ...internacional,
      ...interior,
    ]).slice(0, 24);

  const data = {
    ok: true,

    service:
      "RPF News",

    updatedAt:
      new Date()
        .toISOString(),

    total:
      allNews.length,

    noticias: {
      brasil,
      internacional,
      interior,
    },

    ticker,
  };

  // Se as fontes falharem temporariamente,
  // preserva o último cache válido.
  if (
    allNews.length === 0 &&
    cache.data
  ) {
    return {
      ...cache.data,

      cached: true,

      warning:
        "Fontes temporariamente indisponíveis.",
    };
  }

  if (allNews.length > 0) {
    cache = {
      updatedAt: now,
      data,
    };
  }

  return data;
}

// ======================================================
// EXPORT
// ======================================================

export {
  loadRpfNews,
};
