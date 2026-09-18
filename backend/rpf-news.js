// backend/rpf-news.js
// ======================================================
// RPF NEWS — CENTRAL AUTOMÁTICA DE FUTEBOL
// ======================================================

const CACHE_TIME = 10 * 60 * 1000;

let cache = {
  updatedAt: 0,
  data: null,
};

// ======================================================
// FONTES RSS
// ======================================================

const RSS_SOURCES = [
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
// RPF INTERIOR — FGF
// Fonte oficial para futebol gaúcho
// ======================================================

const FGF_SOURCE = {
  name: "FGF",
  category: "interior",
  url: "https://www.fgf.com.br/noticias/",
};

// ======================================================
// PALAVRAS — FUTEBOL
// Evita UFC, tênis, F1, basquete etc.
// ======================================================

const FOOTBALL_WORDS = [
  "futebol",
  "gol",
  "gols",
  "clube",
  "clubes",
  "time",
  "times",
  "jogo",
  "jogos",
  "partida",
  "campeonato",
  "copa",
  "liga",
  "seleção",
  "selecao",
  "técnico",
  "tecnico",
  "treinador",
  "atacante",
  "goleiro",
  "zagueiro",
  "lateral",
  "meia",
  "volante",
  "contratação",
  "contratacao",
  "transferência",
  "transferencia",
  "brasileirão",
  "brasileirao",
  "libertadores",
  "sul-americana",
  "premier league",
  "champions",
  "bundesliga",
  "la liga",
  "ligue 1",
  "serie a",
  "série a",
  "série b",
  "serie b",
  "série c",
  "serie c",
  "série d",
  "serie d",
  "gauchão",
  "gauchao",

  // clubes Brasil
  "flamengo",
  "fluminense",
  "vasco",
  "botafogo",
  "palmeiras",
  "corinthians",
  "são paulo",
  "sao paulo",
  "santos",
  "grêmio",
  "gremio",
  "internacional",
  "cruzeiro",
  "atlético-mg",
  "atletico-mg",
  "bahia",
  "vitória",
  "vitoria",
  "fortaleza",
  "ceará",
  "ceara",

  // Europa
  "chelsea",
  "arsenal",
  "liverpool",
  "manchester",
  "tottenham",
  "brentford",
  "newcastle",
  "aston villa",
  "real madrid",
  "barcelona",
  "bayern",
  "borussia",
  "psg",
  "juventus",
  "milan",
];

// ======================================================
// INTERIOR
// ======================================================

const INTERIOR_WORDS = [
  "divisão de acesso",
  "divisao de acesso",
  "gauchão série a2",
  "gauchao serie a2",
  "gauchão série b",
  "gauchao serie b",
  "série c",
  "serie c",
  "série d",
  "serie d",
  "estadual",
  "estaduais",
  "interior",
  "copa fgf",
  "copa dunga",

  "brasil-pel",
  "brasil de pelotas",
  "pelotas",
  "passo fundo",
  "lajeadense",
  "apafut",
  "veranópolis",
  "veranopolis",
  "santa cruz",
  "esportivo",
  "gramadense",
  "aimoré",
  "aimore",
  "guarani-va",
  "glória",
  "gloria",
  "gaúcho",
  "gaucho",
  "bagé",
  "bage",
  "união frederiquense",
  "uniao frederiquense",
  "panambi",
  "cruz alta",
  "farroupilha",
];

// ======================================================
// INTERNACIONAL
// ======================================================

const INTERNATIONAL_WORDS = [
  "premier league",
  "champions league",
  "europa league",
  "conference league",
  "bundesliga",
  "la liga",
  "ligue 1",
  "serie a italiana",

  "chelsea",
  "arsenal",
  "liverpool",
  "manchester city",
  "manchester united",
  "tottenham",
  "brentford",
  "newcastle",
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

  "seleção inglesa",
  "selecao inglesa",
  "seleção espanhola",
  "selecao espanhola",
  "seleção francesa",
  "selecao francesa",
  "seleção italiana",
  "selecao italiana",
  "seleção alemã",
  "selecao alema",
  "seleção portuguesa",
  "selecao portuguesa",
  "seleção holandesa",
  "selecao holandesa",
];

// ======================================================
// NORMALIZAÇÃO
// ======================================================

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// DECODIFICAR HTML
// ======================================================

function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"');
}

// ======================================================
// CORRIGIR UTF-8 MAL INTERPRETADO
// ======================================================

function repairEncoding(value = "") {
  let text = String(value);

  // Só tenta reparar quando existem sinais típicos
  // de UTF-8 interpretado incorretamente.
  if (
    /Ã.|Â.|â€|â€™|â€œ|â€/.test(text)
  ) {
    try {
      const repaired = Buffer
        .from(text, "latin1")
        .toString("utf8");

      if (
        !repaired.includes("�") ||
        text.includes("�")
      ) {
        text = repaired;
      }
    } catch {
      // mantém original
    }
  }

  return text;
}

// ======================================================
// LIMPAR TEXTO
// ======================================================

function cleanText(value = "") {
  let text = String(value);

  text = text
    .replace(/<!\[CDATA\[|\]\]>/g, "")

    // oGol:
    // {PLAYER_LINK|123|Nome}
    .replace(
      /\{[A-Z_]+_LINK\|[^|}]+\|([^}]+)\}/g,
      "$1"
    )

    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " "
    )

    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " "
    )

    .replace(/<[^>]*>/g, " ");

  text = decodeEntities(text);
  text = repairEncoding(text);

  return text
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUrl(value = "") {
  return String(value)
    .replace(/\s+/g, "")
    .trim();
}

// ======================================================
// XML
// ======================================================

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
// ID
// ======================================================

function createId(source, title, link) {
  const value =
    `${source}-${title}-${link}`;

  let hash = 0;

  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    hash =
      (hash << 5) -
      hash +
      value.charCodeAt(i);

    hash |= 0;
  }

  return `rpf-${Math.abs(hash)}`;
}

// ======================================================
// DATA
// ======================================================

function safeDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

// ======================================================
// É FUTEBOL?
// ======================================================

function isFootball(
  title,
  description
) {
  const text =
    normalize(
      `${title} ${description}`
    );

  return FOOTBALL_WORDS.some(
    (word) =>
      text.includes(
        normalize(word)
      )
  );
}

// ======================================================
// CLASSIFICAÇÃO
// ======================================================

function detectCategory(
  title,
  description,
  defaultCategory = "brasil"
) {
  const text =
    normalize(
      `${title} ${description}`
    );

  if (
    INTERIOR_WORDS.some(
      (word) =>
        text.includes(
          normalize(word)
        )
    )
  ) {
    return "interior";
  }

  if (
    INTERNATIONAL_WORDS.some(
      (word) =>
        text.includes(
          normalize(word)
        )
    )
  ) {
    return "internacional";
  }

  return defaultCategory;
}

// ======================================================
// RSS
// ======================================================

async function fetchFeed(source) {
  try {
    const response =
      await fetch(
        source.url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 RPF-Placar/1.0",

            Accept:
              "application/rss+xml, application/xml, text/xml, */*",
          },

          signal:
            AbortSignal.timeout(
              12000
            ),
        }
      );

    if (!response.ok) {
      console.error(
        `[RPF NEWS] ${source.name}: HTTP ${response.status}`
      );

      return [];
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    // Primeiro tenta UTF-8.
    let xml =
      buffer.toString("utf8");

    // Caso a fonte venha com charset antigo.
    if (
      xml.includes("�") &&
      !xml
        .slice(0, 300)
        .toLowerCase()
        .includes("utf-8")
    ) {
      xml =
        buffer.toString("latin1");
    }

    const items =
      xml.match(
        /<item\b[\s\S]*?<\/item>/gi
      ) || [];

    const news = [];

    for (
      const item of items
    ) {
      const title =
        cleanText(
          getXmlValue(
            item,
            "title"
          )
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
          getXmlValue(
            item,
            "link"
          )
        );

      const pubDate =
        getXmlValue(
          item,
          "pubDate"
        );

      if (
        !title ||
        !link
      ) {
        continue;
      }

      // RPF é futebol.
      if (
        !isFootball(
          title,
          description
        )
      ) {
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

        text:
          (
            description ||
            title
          ).slice(
            0,
            320
          ),

        source:
          source.name,

        url:
          link,

        publishedAt:
          safeDate(
            pubDate
          ),
      });
    }

    return news;
  } catch (error) {
    console.error(
      `[RPF NEWS] Erro em ${source.name}:`,
      error.message
    );

    return [];
  }
}

// ======================================================
// FGF — EXTRAÇÃO DO RPF INTERIOR
// ======================================================

function parseFgfDate(
  day,
  month,
  year,
  time
) {
  const months = {
    JAN: 0,
    FEV: 1,
    MAR: 2,
    ABR: 3,
    MAI: 4,
    JUN: 5,
    JUL: 6,
    AGO: 7,
    SET: 8,
    OUT: 9,
    NOV: 10,
    DEZ: 11,
  };

  const monthNumber =
    months[
      String(month)
        .toUpperCase()
    ];

  if (
    monthNumber ===
    undefined
  ) {
    return new Date()
      .toISOString();
  }

  const [
    hour = "12",
    minute = "00",
  ] =
    String(time || "")
      .split(":");

  // horário aproximado em UTC-3
  const date =
    new Date(
      Date.UTC(
        Number(year),
        monthNumber,
        Number(day),
        Number(hour) + 3,
        Number(minute),
        0
      )
    );

  return date.toISOString();
}

async function fetchFgfInterior() {
  try {
    const response =
      await fetch(
        FGF_SOURCE.url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 RPF-Placar/1.0",

            Accept:
              "text/html,application/xhtml+xml",
          },

          signal:
            AbortSignal.timeout(
              12000
            ),
        }
      );

    if (!response.ok) {
      console.error(
        `[RPF NEWS] FGF: HTTP ${response.status}`
      );

      return [];
    }

    const html =
      Buffer.from(
        await response.arrayBuffer()
      ).toString("utf8");

    // ==================================================
    // Captura links de notícias
    // ==================================================

    const linkRegex =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    const candidates = [];

    let match;

    while (
      (
        match =
          linkRegex.exec(html)
      ) !== null
    ) {
      let url =
        cleanUrl(
          match[1]
        );

      const title =
        cleanText(
          match[2]
        );

      if (
        !url ||
        !title ||
        title.length < 20
      ) {
        continue;
      }

      const normalizedTitle =
        normalize(title);

      const interior =
        INTERIOR_WORDS.some(
          (word) =>
            normalizedTitle.includes(
              normalize(word)
            )
        );

      if (!interior) {
        continue;
      }

      if (
        url.startsWith("/")
      ) {
        url =
          `https://www.fgf.com.br${url}`;
      }

      if (
        !/^https?:\/\//i.test(
          url
        )
      ) {
        continue;
      }

      candidates.push({
        title,
        url,
      });
    }

    // ==================================================
    // Captura datas disponíveis no HTML
    // ==================================================

    const dates = [];

    const dateRegex =
      /(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})\s*-\s*(\d{1,2}:\d{2})/gi;

    let dateMatch;

    while (
      (
        dateMatch =
          dateRegex.exec(html)
      ) !== null
    ) {
      dates.push(
        parseFgfDate(
          dateMatch[1],
          dateMatch[2],
          dateMatch[3],
          dateMatch[4]
        )
      );
    }

    // ==================================================
    // Remove repetidos
    // ==================================================

    const seen =
      new Set();

    const unique =
      candidates.filter(
        (item) => {
          const key =
            normalize(
              item.title
            );

          if (
            seen.has(key)
          ) {
            return false;
          }

          seen.add(key);

          return true;
        }
      );

    return unique
      .slice(0, 20)
      .map(
        (item, index) => ({
          id:
            createId(
              "FGF",
              item.title,
              item.url
            ),

          category:
            "interior",

          title:
            item.title,

          text:
            item.title,

          source:
            "FGF",

          url:
            item.url,

          publishedAt:
            dates[index] ||
            new Date()
              .toISOString(),
        })
      );
  } catch (error) {
    console.error(
      "[RPF NEWS] Erro FGF:",
      error.message
    );

    return [];
  }
}

// ======================================================
// DUPLICADAS
// ======================================================

function removeDuplicates(
  items = []
) {
  const used =
    new Set();

  return items.filter(
    (item) => {
      const key =
        normalize(
          item.title
        ).replace(
          /[^a-z0-9]/g,
          ""
        );

      if (!key) {
        return false;
      }

      if (
        used.has(key)
      ) {
        return false;
      }

      used.add(key);

      return true;
    }
  );
}

// ======================================================
// ORDENAR
// ======================================================

function sortNewest(
  items = []
) {
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
// CARREGAR CENTRAL
// ======================================================

async function loadRpfNews() {
  const now =
    Date.now();

  if (
    cache.data &&
    now -
      cache.updatedAt <
      CACHE_TIME
  ) {
    return cache.data;
  }

  const results =
    await Promise.allSettled([
      ...RSS_SOURCES.map(
        (source) =>
          fetchFeed(
            source
          )
      ),

      fetchFgfInterior(),
    ]);

  let allNews = [];

  for (
    const result
    of results
  ) {
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
    ]).slice(0, 30);

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

  // Se todas as fontes caírem,
  // mantém o último resultado bom.
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

  if (
    allNews.length > 0
  ) {
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
