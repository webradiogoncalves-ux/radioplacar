// backend/rpf-news.js
// ======================================================
// RPF NEWS — CENTRAL AUTOMÁTICA DE NOTÍCIAS ESPORTIVAS
// ======================================================

const CACHE_TIME = 10 * 60 * 1000; // 10 minutos

let cache = {
  updatedAt: 0,
  data: null,
};

// ======================================================
// FONTES RSS
// ======================================================

const SOURCES = [
  {
    name: "UOL Esporte",
    category: "brasil",
    url: "https://rss.uol.com.br/feed/esporte.xml",
  },

  {
    name: "oGol",
    category: "internacional",
    url: "https://www.ogol.com.br/rss/noticias.php",
  },
];

// ======================================================
// UTILIDADES
// ======================================================

function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
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

function createId(source, title, link) {
  const value =
    `${source}-${title}-${link}`;

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
// CLASSIFICAÇÃO DAS NOTÍCIAS
// ======================================================

const INTERIOR_WORDS = [
  "série c",
  "serie c",
  "série d",
  "serie d",
  "gaúcho",
  "gaucho",
  "gauchão",
  "gauchao",
  "interior",
  "estadual",
  "acesso",
  "divisão de acesso",
  "divisao de acesso",
  "brasil de pelotas",
  "pelotas",
  "ypiranga",
  "caxias",
  "juventude",
  "avenida",
  "são josé",
  "sao jose",
  "novo hamburgo",
  "veranópolis",
  "veranopolis",
  "gramadense",
];

const INTERNATIONAL_WORDS = [
  "premier league",
  "chelsea",
  "arsenal",
  "liverpool",
  "manchester city",
  "manchester united",
  "tottenham",
  "newcastle",
  "brentford",
  "champions league",
  "europa league",
  "conference league",
  "real madrid",
  "barcelona",
  "bayern",
  "bundesliga",
  "la liga",
  "ligue 1",
  "serie a italiana",
  "inter de milão",
  "inter de milao",
  "milan",
  "juventus",
  "psg",
];

function detectCategory(title, description, defaultCategory) {
  const text =
    `${title} ${description}`.toLowerCase();

  if (
    INTERIOR_WORDS.some(
      (word) => text.includes(word)
    )
  ) {
    return "interior";
  }

  if (
    INTERNATIONAL_WORDS.some(
      (word) => text.includes(word)
    )
  ) {
    return "internacional";
  }

  return defaultCategory || "brasil";
}

// ======================================================
// LEITURA DE RSS
// ======================================================

async function fetchFeed(source) {
  try {
    const response = await fetch(
      source.url,
      {
        headers: {
          "User-Agent":
            "RPF-Placar/1.0",
          Accept:
            "application/rss+xml, application/xml, text/xml",
        },
      }
    );

    if (!response.ok) {
      console.error(
        `[RPF NEWS] ${source.name}: HTTP ${response.status}`
      );

      return [];
    }

    const xml =
      await response.text();

    const items =
      xml.match(
        /<item\b[\s\S]*?<\/item>/gi
      ) || [];

    return items
      .map((item) => {
        const title =
          getXmlValue(
            item,
            "title"
          );

        const description =
          getXmlValue(
            item,
            "description"
          );

        const link =
          getXmlValue(
            item,
            "link"
          );

        const pubDate =
          getXmlValue(
            item,
            "pubDate"
          );

        if (!title || !link) {
          return null;
        }

        const category =
          detectCategory(
            title,
            description,
            source.category
          );

        return {
          id:
            createId(
              source.name,
              title,
              link
            ),

          category,

          title,

          text:
            description ||
            title,

          source:
            source.name,

          url:
            link,

          publishedAt:
            pubDate
              ? new Date(
                  pubDate
                ).toISOString()
              : new Date()
                  .toISOString(),
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error(
      `[RPF NEWS] Erro em ${source.name}:`,
      error.message
    );

    return [];
  }
}

// ======================================================
// REMOVER DUPLICADAS
// ======================================================

function removeDuplicates(news) {
  const used =
    new Set();

  return news.filter(
    (item) => {
      const key =
        item.title
          .toLowerCase()
          .replace(
            /[^a-z0-9áéíóúãõâêôç]/gi,
            ""
          );

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
// CARREGAR NOTÍCIAS
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
    await Promise.allSettled(
      SOURCES.map(
        (source) =>
          fetchFeed(source)
      )
    );

  let allNews = [];

  for (
    const result of results
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
    removeDuplicates(
      allNews
    );

  allNews.sort(
    (a, b) =>
      new Date(
        b.publishedAt
      ).getTime() -
      new Date(
        a.publishedAt
      ).getTime()
  );

  const brasil =
    allNews
      .filter(
        (item) =>
          item.category ===
          "brasil"
      )
      .slice(0, 10);

  const internacional =
    allNews
      .filter(
        (item) =>
          item.category ===
          "internacional"
      )
      .slice(0, 10);

  const interior =
    allNews
      .filter(
        (item) =>
          item.category ===
          "interior"
      )
      .slice(0, 10);

  const ticker =
    [
      ...brasil,
      ...internacional,
      ...interior,
    ]
      .sort(
        (a, b) =>
          new Date(
            b.publishedAt
          ).getTime() -
          new Date(
            a.publishedAt
          ).getTime()
      )
      .slice(0, 20);

  const data = {
    ok: true,

    updatedAt:
      new Date()
        .toISOString(),

    noticias: {
      brasil,
      internacional,
      interior,
    },

    ticker,
  };

  // Só substitui cache bom
  // quando recebemos notícias reais.
  if (allNews.length > 0) {
    cache = {
      updatedAt: now,
      data,
    };
  }

  return data;
}

// ======================================================
// EXPORTS
// ======================================================

export {
  loadRpfNews,
};
