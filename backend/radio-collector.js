// backend/radio-collector.js
//
// RadioPlacar
// Coletor: PARTIDA -> RADIO
//
// Fonte publica: OuviRadios
//
// Nao captura audio.
// Nao extrai stream privado.
// Nao tenta contornar bloqueios.

const OUVIRADIOS_BASE = "https://ouviradios.com.br";
const FOOTBALL_URL = `${OUVIRADIOS_BASE}/futebol-ao-vivo`;

const FETCH_TIMEOUT = 15000;

const HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent": "RadioPlacar/1.0",
};


// ======================================================
// NORMALIZACAO
// ======================================================

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ======================================================
// HTML
// ======================================================

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}


function stripTags(value) {
  return decodeHtml(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<\/div>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}


// ======================================================
// FETCH
// ======================================================

async function fetchHtml(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `OuviRadios respondeu ${response.status}`
      );
    }

    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "Tempo limite ao consultar OuviRadios"
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


// ======================================================
// REGRAS DAS RADIOS
// ======================================================

const RADIO_RULES = [
  {
    id: "grenal",
    aliases: [
      "radio grenal",
      "grenal",
    ],
  },
  {
    id: "gaucha-serra",
    aliases: [
      "radio gaucha serra",
      "gaucha serra",
    ],
  },
  {
    id: "gaucha",
    aliases: [
      "radio gaucha",
      "gaucha",
    ],
  },
  {
    id: "guaiba",
    aliases: [
      "radio guaiba",
      "guaiba",
    ],
  },
  {
    id: "caxias",
    aliases: [
      "radio caxias",
      "caxias",
    ],
  },
  {
    id: "tupi",
    aliases: [
      "super radio tupi",
      "radio tupi",
      "tupi",
    ],
  },
  {
    id: "cbn-rio",
    aliases: [
      "cbn rio",
      "radio cbn rio",
    ],
  },
  {
    id: "radio-globo-rj",
    aliases: [
      "radio globo rj",
      "radio globo rio",
      "globo rj",
    ],
  },
  {
    id: "itatiaia",
    aliases: [
      "radio itatiaia",
      "itatiaia",
    ],
  },
  {
    id: "inconfidencia",
    aliases: [
      "radio inconfidencia",
      "inconfidencia",
    ],
  },
  {
    id: "bandeirantes-sp",
    aliases: [
      "radio bandeirantes",
      "bandeirantes sp",
      "bandeirantes sao paulo",
    ],
  },
  {
    id: "jovem-pan",
    aliases: [
      "radio jovem pan news",
      "jovem pan news",
      "radio jovem pan",
      "jovem pan",
    ],
  },
  {
    id: "cbn-sp",
    aliases: [
      "cbn sao paulo",
      "cbn sp",
      "radio cbn sao paulo",
    ],
  },
  {
    id: "energia97",
    aliases: [
      "energia 97 fm",
      "energia 97",
    ],
  },
  {
    id: "sociedade-ba",
    aliases: [
      "radio sociedade",
      "sociedade da bahia",
      "sociedade ba",
    ],
  },
];


// ======================================================
// IDENTIFICAR RADIO
// ======================================================

export function identifyRadio(
  radioName,
  city = "",
  state = ""
) {
  const name = normalize(radioName);
  const location = normalize(`${city} ${state}`);

  if (!name) {
    return null;
  }

  // Gaucha Serra antes da Gaucha normal.
  if (name.includes("gaucha serra")) {
    return "gaucha-serra";
  }

  // CBN SP / CBN Rio.
  if (name.includes("cbn")) {
    if (
      name.includes("sao paulo") ||
      name.includes("cbn sp") ||
      location.includes("sao paulo")
    ) {
      return "cbn-sp";
    }

    if (
      name.includes("rio") ||
      location.includes("rio de janeiro")
    ) {
      return "cbn-rio";
    }
  }

  // Bandeirantes.
  if (name.includes("bandeirantes")) {
    if (
      name.includes("porto alegre") ||
      location.includes("porto alegre")
    ) {
      return null;
    }

    return "bandeirantes-sp";
  }

  // TMC fica fora do automatico por ambiguidade.
  if (name.includes("tmc")) {
    return null;
  }

  for (const rule of RADIO_RULES) {
    for (const alias of rule.aliases) {
      const normalizedAlias = normalize(alias);

      if (
        name === normalizedAlias ||
        name.includes(normalizedAlias)
      ) {
        return rule.id;
      }
    }
  }

  return null;
}


// ======================================================
// SLUG -> NOME DO TIME
// ======================================================

function slugToTeamName(slug) {
  const smallWords = new Set([
    "da",
    "de",
    "do",
    "das",
    "dos",
    "del",
    "la",
    "las",
    "los",
    "e",
  ]);

  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();

      if (
        index > 0 &&
        smallWords.has(lower)
      ) {
        return lower;
      }

      return (
        lower.charAt(0).toUpperCase() +
        lower.slice(1)
      );
    })
    .join(" ")
    .trim();
}


// ======================================================
// EXTRAIR TIMES DO URL
//
// Exemplo:
//
// /jogos-futebol/fluminense-x-platense
//
// Resultado:
// Fluminense
// Platense
//
// Essa e a correcao importante.
// Nao usa o "live" nem o nome do campeonato.
// ======================================================

function extractTeamsFromUrl(value) {
  try {
    const url = new URL(
      value,
      OUVIRADIOS_BASE
    );

    const parts = url.pathname
      .split("/")
      .filter(Boolean);

    const index = parts.indexOf(
      "jogos-futebol"
    );

    if (
      index < 0 ||
      !parts[index + 1]
    ) {
      return null;
    }

    const slug = decodeURIComponent(
      parts[index + 1]
    );

    const separatorIndex =
      slug.indexOf("-x-");

    if (separatorIndex < 1) {
      return null;
    }

    const homeSlug = slug
      .slice(0, separatorIndex)
      .trim();

    const awaySlug = slug
      .slice(separatorIndex + 3)
      .trim();

    if (!homeSlug || !awaySlug) {
      return null;
    }

    const home = slugToTeamName(
      homeSlug
    );

    const away = slugToTeamName(
      awaySlug
    );

    if (!home || !away) {
      return null;
    }

    return {
      home_team: home,
      away_team: away,
    };
  } catch {
    return null;
  }
}


// ======================================================
// LINKS DAS PARTIDAS
// ======================================================

export function extractMatchLinks(html) {
  const links = new Set();

  const regex =
    /href\s*=\s*["']([^"']*\/jogos-futebol\/[^"'?#]+[^"']*)["']/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const href = decodeHtml(
      match[1]
    ).trim();

    if (!href) {
      continue;
    }

    try {
      const url = new URL(
        href,
        OUVIRADIOS_BASE
      );

      if (
        url.hostname !==
        "ouviradios.com.br"
      ) {
        continue;
      }

      if (
        !url.pathname.startsWith(
          "/jogos-futebol/"
        )
      ) {
        continue;
      }

      links.add(
        `${url.origin}${url.pathname}`
      );
    } catch {
      // Ignora URL invalida.
    }
  }

  return [...links];
}


// ======================================================
// DIVIDIR NOME DE PARTIDA
// ======================================================

export function splitMatchTitle(value) {
  const fromUrl = extractTeamsFromUrl(
    value
  );

  if (fromUrl) {
    return fromUrl;
  }

  let text = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  text = text
    .replace(/\s+live\b[\s\S]*$/i, "")
    .replace(/\s+ao vivo\b[\s\S]*$/i, "")
    .trim();

  const parts = text.split(
    /\s+x\s+/i
  );

  if (parts.length !== 2) {
    return null;
  }

  const home = parts[0].trim();
  const away = parts[1].trim();

  if (!home || !away) {
    return null;
  }

  return {
    home_team: home,
    away_team: away,
  };
}


// ======================================================
// FALLBACK PELO HTML
// ======================================================

function extractTeamsFromHtml(html) {
  const titleMatch = html.match(
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  );

  if (!titleMatch) {
    return null;
  }

  let title = stripTags(
    titleMatch[1]
  );

  title = title
    .replace(/\s+live\b[\s\S]*$/i, "")
    .replace(/\s+ao vivo\b[\s\S]*$/i, "")
    .replace(/\s+liga\s+manual[\s\S]*$/i, "")
    .trim();

  const parts = title.split(
    /\s+x\s+/i
  );

  if (parts.length < 2) {
    return null;
  }

  const home = parts[0].trim();

  const away = parts[1]
    .replace(/\s+live\b[\s\S]*$/i, "")
    .replace(/\s+ao vivo\b[\s\S]*$/i, "")
    .replace(/\s+liga\s+manual[\s\S]*$/i, "")
    .trim();

  if (!home || !away) {
    return null;
  }

  return {
    home_team: home,
    away_team: away,
  };
}


// ======================================================
// TIMES DA PAGINA
//
// URL primeiro.
// HTML somente como fallback.
// ======================================================

function extractTeamsFromPage(
  html,
  url
) {
  const fromUrl = extractTeamsFromUrl(
    url
  );

  if (fromUrl) {
    return fromUrl;
  }

  return extractTeamsFromHtml(html);
}


// ======================================================
// SECAO DE TRANSMISSOES
// ======================================================

function getTransmissionSection(html) {
  const startRegex =
    /Transmiss(?:ões|&otilde;es)\s+ao\s+Vivo/i;

  const start = html.search(
    startRegex
  );

  if (start < 0) {
    return "";
  }

  const rest = html.slice(start);

  const endPatterns = [
    /<h2[^>]*>\s*Outros\s+Jogos/i,
    /<h3[^>]*>\s*Outros\s+Jogos/i,
    />\s*Outros\s+Jogos\s*</i,
    /id=["'][^"']*outros[^"']*["']/i,
  ];

  let end = rest.length;

  for (const pattern of endPatterns) {
    const found = rest.search(pattern);

    if (
      found > 0 &&
      found < end
    ) {
      end = found;
    }
  }

  return rest.slice(0, end);
}


// ======================================================
// RADIOS DA PAGINA
// ======================================================

export function extractRadiosFromMatchPage(
  html,
  sourceUrl
) {
  const section = getTransmissionSection(
    html
  );

  if (!section) {
    return [];
  }

  const found = new Map();

  const altRegex =
    /<img\b[^>]*\balt\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match;

  while (
    (match = altRegex.exec(section)) !== null
  ) {
    const radioName = decodeHtml(
      match[1]
    )
      .replace(
        /^\s*(?:logo|imagem)\s+(?:da\s+)?/i,
        ""
      )
      .trim();

    if (!radioName) {
      continue;
    }

    const radioId = identifyRadio(
      radioName
    );

    if (!radioId) {
      continue;
    }

    if (!found.has(radioId)) {
      found.set(radioId, {
        radio_id: radioId,
        radio_name: radioName,
        source: "OuviRadios",
        source_url: sourceUrl,
      });
    }
  }

  const text = stripTags(section);
  const normalizedText = normalize(text);

  for (const rule of RADIO_RULES) {
    if (found.has(rule.id)) {
      continue;
    }

    const aliasFound = rule.aliases.find(
      (alias) =>
        normalizedText.includes(
          normalize(alias)
        )
    );

    if (!aliasFound) {
      continue;
    }

    found.set(rule.id, {
      radio_id: rule.id,
      radio_name: aliasFound,
      source: "OuviRadios",
      source_url: sourceUrl,
    });
  }

  return [...found.values()];
}


// ======================================================
// COLETAR UMA PARTIDA
// ======================================================

export async function collectMatchPage(
  url
) {
  const parsed = new URL(
    url,
    OUVIRADIOS_BASE
  );

  if (
    parsed.hostname !==
      "ouviradios.com.br" ||
    !parsed.pathname.startsWith(
      "/jogos-futebol/"
    )
  ) {
    throw new Error(
      "URL de partida invalida"
    );
  }

  const safeUrl =
    `${parsed.origin}${parsed.pathname}`;

  const html = await fetchHtml(
    safeUrl
  );

  const teams = extractTeamsFromPage(
    html,
    safeUrl
  );

  if (!teams) {
    return {
      ok: false,
      source: "OuviRadios",
      source_url: safeUrl,
      error:
        "Nao foi possivel identificar os times",
      radios: [],
    };
  }

  const radios =
    extractRadiosFromMatchPage(
      html,
      safeUrl
    );

  return {
    ok: true,
    source: "OuviRadios",
    source_url: safeUrl,

    home_team: teams.home_team,
    away_team: teams.away_team,

    radios,
    radios_found: radios.length,
  };
}


// ======================================================
// PAGINA DE FUTEBOL
// ======================================================

export async function collectFootballPage(
  date = null
) {
  let url = FOOTBALL_URL;

  if (date) {
    url +=
      `?data=${encodeURIComponent(date)}`;
  }

  const html = await fetchHtml(url);

  const matchLinks =
    extractMatchLinks(html);

  return {
    ok: true,
    source: "OuviRadios",
    source_url: url,
    match_links: matchLinks,
    match_pages_found: matchLinks.length,
  };
}


// ======================================================
// PAUSA
// ======================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


// ======================================================
// COLETAR TRANSMISSOES
// ======================================================

export async function collectTransmissions(
  options = {}
) {
  const maxMatchesRaw = Number(
    options.maxMatches ?? 40
  );

  const maxMatches =
    Number.isFinite(maxMatchesRaw)
      ? Math.max(
          1,
          Math.min(
            Math.trunc(maxMatchesRaw),
            100
          )
        )
      : 40;

  const date = options.date || null;

  const football =
    await collectFootballPage(date);

  const links = football.match_links.slice(
    0,
    maxMatches
  );

  const matches = [];
  const transmissions = [];
  const ignoredRadios = new Set();
  const errors = [];
  const transmissionKeys = new Set();

  for (const url of links) {
    try {
      const page =
        await collectMatchPage(url);

      if (!page.ok) {
        errors.push({
          url,
          error: page.error,
        });

        continue;
      }

      matches.push({
        home_team: page.home_team,
        away_team: page.away_team,
        source_url: page.source_url,
        radios_found: page.radios_found,
      });

      for (const radio of page.radios) {
        if (!radio.radio_id) {
          if (radio.radio_name) {
            ignoredRadios.add(
              radio.radio_name
            );
          }

          continue;
        }

        const key = [
          radio.radio_id,
          normalize(page.home_team),
          normalize(page.away_team),
        ].join("|");

        if (transmissionKeys.has(key)) {
          continue;
        }

        transmissionKeys.add(key);

        transmissions.push({
          radio_id: radio.radio_id,
          home_team: page.home_team,
          away_team: page.away_team,
          source: "OuviRadios",
          source_url: page.source_url,
          priority: 1,
        });
      }
    } catch (error) {
      errors.push({
        url,
        error:
          error?.message ||
          String(error),
      });
    }

    await sleep(200);
  }

  return {
    ok: true,

    source: "OuviRadios",
    source_url: football.source_url,

    match_pages_found:
      football.match_pages_found,

    match_pages_checked:
      links.length,

    matches,
    transmissions,

    transmissions_found:
      transmissions.length,

    ignored_radios:
      [...ignoredRadios],

    errors,
  };
}


// ======================================================
// TESTE
// ======================================================

export async function testRadioCollector(
  url = null
) {
  if (url) {
    return collectMatchPage(url);
  }

  const football =
    await collectFootballPage();

  const first = football.match_links[0];

  if (!first) {
    return {
      ok: true,
      source: "OuviRadios",
      message:
        "Nenhuma partida encontrada",
      match_pages_found: 0,
    };
  }

  return collectMatchPage(first);
}


// ======================================================
// INFO
// ======================================================

export function getRadioCollectorInfo() {
  return {
    name:
      "RadioPlacar Radio Collector",

    version: "2.1.1",

    source: "OuviRadios",

    source_url: FOOTBALL_URL,

    purpose:
      "Identificar radios relacionadas a partidas de futebol",

    captures_audio: false,
    captures_stream: false,

    registered_radio_rules:
      RADIO_RULES.length,

    team_source:
      "URL slug first, HTML fallback",
  };
}
