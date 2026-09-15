// backend/radio-collector.js
//
// RadioPlacar
// Coletor público de relações:
// PARTIDA -> RÁDIO
//
// Fonte atual:
// OuviRádios
//
// IMPORTANTE:
// - Não captura áudio.
// - Não extrai stream privado.
// - Não tenta contornar bloqueios.
// - Usa somente informações públicas de partidas e rádios.
//

const OUVIRADIOS_BASE =
  "https://ouviradios.com.br";

const FOOTBALL_URL =
  `${OUVIRADIOS_BASE}/futebol-ao-vivo`;

const FETCH_TIMEOUT = 15000;


// ======================================================
// CABEÇALHOS
// ======================================================

const HEADERS = {
  Accept:
    "text/html,application/xhtml+xml",

  "Accept-Language":
    "pt-BR,pt;q=0.9,en;q=0.8",

  "User-Agent":
    "RadioPlacar/1.0",
};


// ======================================================
// NORMALIZAÇÃO
// ======================================================

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(/&amp;/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ======================================================
// DECODIFICAR HTML
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


// ======================================================
// REMOVER TAGS
// ======================================================

function stripTags(value) {
  return decodeHtml(
    String(value || "")
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
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
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT
    );

  try {
    const response =
      await fetch(url, {
        headers: HEADERS,
        signal:
          controller.signal,
        redirect:
          "follow",
      });

    if (!response.ok) {
      throw new Error(
        `OuviRádios respondeu ${response.status}`
      );
    }

    return await response.text();

  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Tempo limite ao consultar OuviRádios"
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}


// ======================================================
// REGRAS DAS NOSSAS RÁDIOS
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
    id: "gaucha-serra",
    aliases: [
      "radio gaucha serra",
      "gaucha serra",
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
// IDENTIFICAR UMA DAS NOSSAS RÁDIOS
// ======================================================

export function identifyRadio(
  radioName,
  city = "",
  state = ""
) {
  const name =
    normalize(radioName);

  const location =
    normalize(
      `${city} ${state}`
    );

  if (!name) {
    return null;
  }

  // ----------------------------------
  // Evita confundir Gaúcha Serra
  // com Rádio Gaúcha normal.
  // ----------------------------------

  if (
    name.includes(
      "gaucha serra"
    )
  ) {
    return "gaucha-serra";
  }

  // ----------------------------------
  // CBN
  // ----------------------------------

  if (
    name.includes("cbn")
  ) {
    if (
      name.includes(
        "sao paulo"
      ) ||
      name.includes("cbn sp") ||
      location.includes(
        "sao paulo"
      )
    ) {
      return "cbn-sp";
    }

    if (
      name.includes("rio") ||
      location.includes(
        "rio de janeiro"
      )
    ) {
      return "cbn-rio";
    }
  }

  // ----------------------------------
  // Bandeirantes
  // ----------------------------------

  if (
    name.includes(
      "bandeirantes"
    )
  ) {
    if (
      location.includes(
        "porto alegre"
      )
    ) {
      return null;
    }

    return "bandeirantes-sp";
  }

  // ----------------------------------
  // TMC continua sem mapeamento
  // automático por ambiguidade.
  // ----------------------------------

  if (
    name.includes("tmc")
  ) {
    return null;
  }

  for (
    const rule
    of RADIO_RULES
  ) {
    for (
      const alias
      of rule.aliases
    ) {
      const normalizedAlias =
        normalize(alias);

      if (
        name ===
          normalizedAlias ||
        name.includes(
          normalizedAlias
        )
      ) {
        return rule.id;
      }
    }
  }

  return null;
}


// ======================================================
// EXTRAIR LINKS DAS PARTIDAS
//
// Estrutura pública:
// /jogos-futebol/time-a-x-time-b
// ======================================================

export function extractMatchLinks(
  html
) {
  const links =
    new Set();

  const regex =
    /href\s*=\s*["']([^"']*\/jogos-futebol\/[^"'?#]+[^"']*)["']/gi;

  let match;

  while (
    (
      match =
        regex.exec(html)
    ) !== null
  ) {
    let href =
      decodeHtml(
        match[1]
      ).trim();

    if (!href) {
      continue;
    }

    try {
      const url =
        new URL(
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
      // Ignora link inválido.
    }
  }

  return [
    ...links,
  ];
}


// ======================================================
// TIMES PELO SLUG
//
// Exemplo:
// fluminense-x-platense
// ======================================================

export function splitMatchTitle(
  value
) {
  let text =
    String(value || "")
      .trim();

  try {
    if (
      text.startsWith(
        "http"
      )
    ) {
      const url =
        new URL(text);

      text =
        url.pathname
          .split("/")
          .filter(Boolean)
          .pop() ||
        "";
    }
  } catch {
    // Continua com texto.
  }

  text =
    decodeURIComponent(text)
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  /*
   * O slug usa "-x-".
   * Depois da conversão vira " x ".
   */

  const parts =
    text.split(
      /\s+x\s+/i
    );

  if (
    parts.length !== 2
  ) {
    return null;
  }

  const home =
    parts[0].trim();

  const away =
    parts[1].trim();

  if (
    !home ||
    !away
  ) {
    return null;
  }

  return {
    home_team:
      home,

    away_team:
      away,
  };
}


// ======================================================
// EXTRAIR TIMES PELO HTML
//
// Prioriza o título:
// "Fluminense x Platense ao vivo"
// ======================================================

function extractTeamsFromPage(
  html,
  url
) {
  const titleMatch =
    html.match(
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

  if (titleMatch) {
    const title =
      stripTags(
        titleMatch[1]
      )
        .replace(
          /\s+ao vivo[\s\S]*$/i,
          ""
        )
        .trim();

    const parts =
      title.split(
        /\s+x\s+/i
      );

    if (
      parts.length >= 2
    ) {
      const home =
        parts[0].trim();

      const away =
        parts[1]
          .replace(
            /\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]*$/i,
            ""
          )
          .trim();

      if (
        home &&
        away
      ) {
        return {
          home_team:
            home,

          away_team:
            away,
        };
      }
    }
  }

  return splitMatchTitle(
    url
  );
}


// ======================================================
// PEGAR BLOCO "TRANSMISSÕES AO VIVO"
//
// Isso impede que rádios do rodapé ou de
// "outros jogos" sejam confundidas com
// rádios desta partida.
// ======================================================

function getTransmissionSection(
  html
) {
  const startRegex =
    /Transmiss(?:ões|&otilde;es)\s+ao\s+Vivo/i;

  const start =
    html.search(
      startRegex
    );

  if (start < 0) {
    return "";
  }

  const rest =
    html.slice(start);

  const endPatterns = [
    /<h2[^>]*>\s*Outros\s+Jogos/i,
    /<h3[^>]*>\s*Outros\s+Jogos/i,
    />\s*Outros\s+Jogos\s*</i,
    /id=["'][^"']*outros[^"']*["']/i,
  ];

  let end =
    rest.length;

  for (
    const pattern
    of endPatterns
  ) {
    const found =
      rest.search(pattern);

    if (
      found > 0 &&
      found < end
    ) {
      end = found;
    }
  }

  return rest.slice(
    0,
    end
  );
}


// ======================================================
// EXTRAIR RÁDIOS DA PÁGINA DA PARTIDA
// ======================================================

export function extractRadiosFromMatchPage(
  html,
  sourceUrl
) {
  const section =
    getTransmissionSection(
      html
    );

  if (!section) {
    return [];
  }

  const found =
    new Map();

  /*
   * Primeiro tentamos ALT das imagens.
   *
   * O site publica nomes como:
   * alt="Rádio Globo RJ"
   */

  const altRegex =
    /<img\b[^>]*\balt\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match;

  while (
    (
      match =
        altRegex.exec(section)
    ) !== null
  ) {
    let radioName =
      decodeHtml(
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

    const radioId =
      identifyRadio(
        radioName
      );

    if (!radioId) {
      continue;
    }

    if (
      !found.has(
        radioId
      )
    ) {
      found.set(
        radioId,
        {
          radio_id:
            radioId,

          radio_name:
            radioName,

          source:
            "OuviRádios",

          source_url:
            sourceUrl,
        }
      );
    }
  }

  /*
   * Segunda tentativa:
   * procura os aliases diretamente
   * no texto da seção.
   *
   * Isso ajuda se o HTML mudar e o
   * nome não estiver mais no ALT.
   */

  const text =
    stripTags(
      section
    );

  const normalizedText =
    normalize(
      text
    );

  for (
    const rule
    of RADIO_RULES
  ) {
    if (
      found.has(
        rule.id
      )
    ) {
      continue;
    }

    const aliasFound =
      rule.aliases.find(
        (alias) =>
          normalizedText.includes(
            normalize(alias)
          )
      );

    if (!aliasFound) {
      continue;
    }

    found.set(
      rule.id,
      {
        radio_id:
          rule.id,

        radio_name:
          aliasFound,

        source:
          "OuviRádios",

        source_url:
          sourceUrl,
      }
    );
  }

  return [
    ...found.values(),
  ];
}


// ======================================================
// COLETAR UMA PÁGINA DE PARTIDA
// ======================================================

export async function collectMatchPage(
  url
) {
  const parsed =
    new URL(
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
      "URL de partida inválida"
    );
  }

  const safeUrl =
    `${parsed.origin}${parsed.pathname}`;

  const html =
    await fetchHtml(
      safeUrl
    );

  const teams =
    extractTeamsFromPage(
      html,
      safeUrl
    );

  if (!teams) {
    return {
      ok: false,

      source:
        "OuviRádios",

      source_url:
        safeUrl,

      error:
        "Não foi possível identificar os times",

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

    source:
      "OuviRádios",

    source_url:
      safeUrl,

    home_team:
      teams.home_team,

    away_team:
      teams.away_team,

    radios,

    radios_found:
      radios.length,
  };
}


// ======================================================
// COLETAR A AGENDA DE FUTEBOL
// ======================================================

export async function collectFootballPage(
  date = null
) {
  let url =
    FOOTBALL_URL;

  if (date) {
    url +=
      `?data=${encodeURIComponent(date)}`;
  }

  const html =
    await fetchHtml(
      url
    );

  const matchLinks =
    extractMatchLinks(
      html
    );

  return {
    ok: true,

    source:
      "OuviRádios",

    source_url:
      url,

    match_links:
      matchLinks,

    match_pages_found:
      matchLinks.length,
  };
}


// ======================================================
// PAUSA EDUCADA ENTRE REQUISIÇÕES
// ======================================================

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


// ======================================================
// COLETAR TRANSMISSÕES
// ======================================================

export async function collectTransmissions(
  options = {}
) {
  const maxMatchesRaw =
    Number(
      options.maxMatches ??
      40
    );

  const maxMatches =
    Number.isFinite(
      maxMatchesRaw
    )
      ? Math.max(
          1,
          Math.min(
            Math.trunc(
              maxMatchesRaw
            ),
            100
          )
        )
      : 40;

  const date =
    options.date ||
    null;

  const football =
    await collectFootballPage(
      date
    );

  const links =
    football.match_links.slice(
      0,
      maxMatches
    );

  const matches = [];

  const transmissions = [];

  const ignoredRadios =
    new Set();

  const errors = [];

  const transmissionKeys =
    new Set();

  for (
    const url
    of links
  ) {
    try {
      const page =
        await collectMatchPage(
          url
        );

      if (!page.ok) {
        errors.push({
          url,

          error:
            page.error,
        });

        continue;
      }

      matches.push({
        home_team:
          page.home_team,

        away_team:
          page.away_team,

        source_url:
          page.source_url,

        radios_found:
          page.radios_found,
      });

      for (
        const radio
        of page.radios
      ) {
        if (
          !radio.radio_id
        ) {
          if (
            radio.radio_name
          ) {
            ignoredRadios.add(
              radio.radio_name
            );
          }

          continue;
        }

        const key =
          [
            radio.radio_id,
            normalize(
              page.home_team
            ),
            normalize(
              page.away_team
            ),
          ].join("|");

        if (
          transmissionKeys.has(
            key
          )
        ) {
          continue;
        }

        transmissionKeys.add(
          key
        );

        transmissions.push({
          radio_id:
            radio.radio_id,

          home_team:
            page.home_team,

          away_team:
            page.away_team,

          source:
            "OuviRádios",

          source_url:
            page.source_url,

          priority:
            1,
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

    /*
     * Pequena pausa entre páginas.
     * Não fazemos disparos simultâneos.
     */

    await sleep(200);
  }

  return {
    ok: true,

    source:
      "OuviRádios",

    source_url:
      football.source_url,

    match_pages_found:
      football.match_pages_found,

    match_pages_checked:
      links.length,

    matches,

    transmissions,

    transmissions_found:
      transmissions.length,

    ignored_radios:
      [
        ...ignoredRadios,
      ],

    errors,
  };
}


// ======================================================
// TESTAR UMA PÁGINA
// ======================================================

export async function testRadioCollector(
  url = null
) {
  if (url) {
    return collectMatchPage(
      url
    );
  }

  const football =
    await collectFootballPage();

  const first =
    football.match_links[0];

  if (!first) {
    return {
      ok: true,

      source:
        "OuviRádios",

      message:
        "Nenhuma partida encontrada",

      match_pages_found:
        0,
    };
  }

  return collectMatchPage(
    first
  );
}


// ======================================================
// INFO
// ======================================================

export function getRadioCollectorInfo() {
  return {
    name:
      "RadioPlacar Radio Collector",

    version:
      "2.0.0",

    source:
      "OuviRádios",

    source_url:
      FOOTBALL_URL,

    purpose:
      "Identificar rádios relacionadas a partidas de futebol",

    captures_audio:
      false,

    captures_stream:
      false,

    registered_radio_rules:
      RADIO_RULES.length,
  };
}
