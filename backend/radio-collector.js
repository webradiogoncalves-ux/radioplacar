// backend/radio-collector.js

// ========================================================
// RADIOPLACAR - COLETOR DE TRANSMISSÕES
// ========================================================
//
// Função deste arquivo:
//
// RadiosNet / Radios.com.br
//          ↓
// encontra páginas de partidas
//          ↓
// lê as rádios relacionadas à partida
//          ↓
// converte nomes conhecidos para IDs do RadioPlacar
//          ↓
// entrega:
// {
//   radio_id,
//   home_team,
//   away_team,
//   source,
//   source_url,
//   priority
// }
//
// IMPORTANTE:
//
// - NÃO captura áudio.
// - NÃO captura stream.
// - NÃO inventa transmissão.
// - Rádio só é retornada quando aparece na página
//   específica daquela partida.
// ========================================================


const RADIOSNET_BASE = "https://www.radios.com.br";

const FETCH_TIMEOUT = 12000;


// ========================================================
// CABEÇALHOS
// ========================================================

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; RadioPlacar/1.0; +https://github.com/)",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language":
    "pt-BR,pt;q=0.9,en;q=0.7",
};


// ========================================================
// NORMALIZAÇÃO
// ========================================================

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ========================================================
// DECODIFICAR HTML
// ========================================================

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&acirc;/gi, "â")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&ocirc;/gi, "ô");
}


// ========================================================
// REMOVER TAGS
// ========================================================

function stripTags(value) {
  return decodeHtml(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}


// ========================================================
// FETCH COM TIMEOUT
// ========================================================

async function fetchHtml(url) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT);

  try {
    const response =
      await fetch(url, {
        headers: HEADERS,
        signal: controller.signal,
        redirect: "follow",
      });

    if (!response.ok) {
      throw new Error(
        `RadiosNet respondeu ${response.status}`
      );
    }

    return await response.text();

  } finally {
    clearTimeout(timer);
  }
}


// ========================================================
// CATÁLOGO DE ALIASES
// ========================================================
//
// Aqui transformamos o nome exibido pela RadiosNet
// no ID existente no nosso radios.js.
//
// Cidade/UF é usada quando existe risco de confundir
// emissoras com nomes parecidos.
// ========================================================

const RADIO_RULES = [

  // ------------------------------------------------------
  // RIO GRANDE DO SUL
  // ------------------------------------------------------

  {
    id: "grenal",
    names: [
      "radio grenal",
      "radio grenal 95 9 fm",
    ],
    city: "porto alegre",
    state: "rs",
  },

  {
    id: "gaucha",
    names: [
      "radio gaucha",
      "radio gaucha 93 7 fm",
    ],
    city: "porto alegre",
    state: "rs",
  },

  {
    id: "guaiba",
    names: [
      "radio guaiba",
      "radio guaiba 101 3 fm",
    ],
    city: "porto alegre",
    state: "rs",
  },

  {
    id: "caxias",
    names: [
      "radio caxias",
      "radio caxias 93 5 fm",
    ],
    city: "caxias do sul",
    state: "rs",
  },

  {
    id: "gaucha-serra",
    names: [
      "radio gaucha serra",
      "gaucha serra",
    ],
    city: "caxias do sul",
    state: "rs",
  },


  // ------------------------------------------------------
  // RIO DE JANEIRO
  // ------------------------------------------------------

  {
    id: "tupi",
    names: [
      "super radio tupi",
      "super radio tupi 96 5 fm",
      "radio tupi",
    ],
    city: "rio de janeiro",
    state: "rj",
  },

  {
    id: "cbn-rio",
    names: [
      "radio cbn rio",
      "radio cbn rio 92 5 fm",
      "cbn rio",
    ],
    city: "rio de janeiro",
    state: "rj",
  },

  {
    id: "radio-globo-rj",
    names: [
      "radio globo",
      "radio globo 98 1 fm",
    ],
    city: "rio de janeiro",
    state: "rj",
  },


  // ------------------------------------------------------
  // MINAS GERAIS
  // ------------------------------------------------------

  {
    id: "itatiaia",
    names: [
      "radio itatiaia",
      "radio itatiaia 610 am 95 7 fm",
      "itatiaia",
    ],
    city: "belo horizonte",
    state: "mg",
  },

  {
    id: "inconfidencia",
    names: [
      "radio inconfidencia",
      "radio inconfidencia 880 am",
    ],
    city: "belo horizonte",
    state: "mg",
  },


  // ------------------------------------------------------
  // SÃO PAULO
  // ------------------------------------------------------

  {
    id: "bandeirantes-sp",
    names: [
      "radio bandeirantes",
      "radio bandeirantes 107 3 fm",
    ],
    city: "sao paulo",
    state: "sp",
  },

  {
    id: "jovem-pan",
    names: [
      "radio jovem pan news",
      "jovem pan news",
      "jovem pan",
    ],
    city: "sao paulo",
    state: "sp",
  },

  {
    id: "cbn-sp",
    names: [
      "radio cbn sao paulo",
      "radio cbn sao paulo 90 5 fm",
      "cbn sao paulo",
    ],
    city: "sao paulo",
    state: "sp",
  },

  {
    id: "energia97",
    names: [
      "radio energia 97 7 fm",
      "energia 97",
      "radio energia 97",
    ],
    city: "sao paulo",
    state: "sp",
  },


  // ------------------------------------------------------
  // BAHIA
  // ------------------------------------------------------

  {
    id: "sociedade-ba",
    names: [
      "radio sociedade",
      "radio sociedade da bahia",
    ],
    city: "salvador",
    state: "ba",
  },
];


// ========================================================
// IDENTIFICAR RÁDIO
// ========================================================

export function identifyRadio(
  radioName,
  city = "",
  state = ""
) {
  const name =
    normalize(radioName);

  const normalizedCity =
    normalize(city);

  const normalizedState =
    normalize(state);

  if (!name) {
    return null;
  }

  for (const rule of RADIO_RULES) {

    const nameMatches =
      rule.names.some((alias) => {
        const normalizedAlias =
          normalize(alias);

        return (
          name === normalizedAlias ||
          name.includes(normalizedAlias) ||
          normalizedAlias.includes(name)
        );
      });

    if (!nameMatches) {
      continue;
    }

    // Se temos cidade na página,
    // usamos para evitar emissora errada.

    if (
      rule.city &&
      normalizedCity &&
      normalize(rule.city) !== normalizedCity
    ) {
      continue;
    }

    if (
      rule.state &&
      normalizedState &&
      normalize(rule.state) !== normalizedState
    ) {
      continue;
    }

    return rule.id;
  }

  return null;
}


// ========================================================
// EXTRAIR LINKS DE PARTIDAS
// ========================================================

export function extractMatchLinks(html) {

  const links =
    new Set();

  const regex =
    /href=["']([^"']*\/radio\/futebol\/[^"']+)["']/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {
    let url =
      decodeHtml(match[1]);

    if (!url) {
      continue;
    }

    if (
      url.startsWith("/")
    ) {
      url =
        `${RADIOSNET_BASE}${url}`;
    }

    if (
      url.startsWith(
        `${RADIOSNET_BASE}/radio/futebol/`
      )
    ) {
      links.add(url);
    }
  }

  return [...links];
}


// ========================================================
// EXTRAIR TÍTULO DA PARTIDA
// ========================================================

function extractPageTitle(html) {

  let match =
    html.match(
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

  if (match) {
    return stripTags(match[1]);
  }

  match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  if (match) {
    return stripTags(match[1])
      .replace(
        /\s+ao vivo.*$/i,
        ""
      )
      .trim();
  }

  return "";
}


// ========================================================
// SEPARAR TIMES
// ========================================================

export function splitMatchTitle(title) {

  let clean =
    String(title || "")
      .replace(
        /^futebol ao vivo:\s*/i,
        ""
      )
      .replace(
        /\s*\|\s*radios.*$/i,
        ""
      )
      .trim();

  // Formato principal:
  // Internacional x Grêmio

  let parts =
    clean.split(/\s+x\s+/i);

  if (parts.length === 2) {
    return {
      home_team:
        parts[0].trim(),

      away_team:
        parts[1].trim(),
    };
  }

  // Algumas páginas podem usar "vs"

  parts =
    clean.split(/\s+vs\.?\s+/i);

  if (parts.length === 2) {
    return {
      home_team:
        parts[0].trim(),

      away_team:
        parts[1].trim(),
    };
  }

  return null;
}


// ========================================================
// EXTRAIR BLOCOS DE RÁDIOS
// ========================================================

function extractRadioBlocks(html) {

  const results = [];

  // A página possui nomes de rádio normalmente
  // dentro de títulos h3.

  const regex =
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {

    const radioName =
      stripTags(match[1]);

    if (!radioName) {
      continue;
    }

    // Pegamos trecho depois do h3 para tentar
    // descobrir cidade / estado.

    const start =
      match.index;

    const block =
      html.slice(
        start,
        start + 1800
      );

    const plain =
      stripTags(block);

    results.push({
      radio_name:
        radioName,

      context:
        plain,
    });
  }

  return results;
}


// ========================================================
// EXTRAIR CIDADE / UF
// ========================================================

function extractLocation(context) {

  const text =
    String(context || "");

  // Exemplos:
  //
  // Porto Alegre / RS - Brasil
  // Rio de Janeiro / RJ - Brasil
  // Belo Horizonte / MG - Brasil

  const match =
    text.match(
      /([A-Za-zÀ-ÿ0-9 .'-]+)\s*\/\s*([A-Z]{2})\s*-\s*Brasil/i
    );

  if (!match) {
    return {
      city: "",
      state: "",
    };
  }

  let city =
    match[1]
      .replace(/\s+/g, " ")
      .trim();

  // Como o contexto começa pelo nome da rádio,
  // pode haver texto sobrando antes da cidade.
  // Pegamos a última parte razoável.

  const pieces =
    city.split(/\s{2,}/);

  if (pieces.length > 1) {
    city =
      pieces[
        pieces.length - 1
      ];
  }

  return {
    city,
    state:
      match[2]
        .toUpperCase(),
  };
}


// ========================================================
// EXTRAIR RÁDIOS DE UMA PARTIDA
// ========================================================

export function extractRadiosFromMatchPage(
  html,
  sourceUrl
) {

  const title =
    extractPageTitle(html);

  const teams =
    splitMatchTitle(title);

  if (!teams) {
    return {
      ok: false,
      source_url:
        sourceUrl,

      title,

      transmissions: [],
      ignored: [],

      error:
        "Não foi possível identificar os times",
    };
  }

  const blocks =
    extractRadioBlocks(html);

  const transmissions = [];
  const ignored = [];

  let priority = 1;

  for (const block of blocks) {

    const location =
      extractLocation(
        block.context
      );

    const radioId =
      identifyRadio(
        block.radio_name,
        location.city,
        location.state
      );

    if (!radioId) {

      ignored.push({
        radio_name:
          block.radio_name,

        city:
          location.city,

        state:
          location.state,
      });

      continue;
    }

    transmissions.push({

      radio_id:
        radioId,

      radio_name:
        block.radio_name,

      home_team:
        teams.home_team,

      away_team:
        teams.away_team,

      source:
        "RadiosNet",

      source_url:
        sourceUrl,

      priority,

      location,
    });

    priority++;
  }

  return {
    ok: true,

    title,

    home_team:
      teams.home_team,

    away_team:
      teams.away_team,

    source_url:
      sourceUrl,

    transmissions,

    ignored,
  };
}


// ========================================================
// COLETAR UMA PÁGINA DE PARTIDA
// ========================================================

export async function collectMatchPage(
  url
) {

  if (
    !String(url).startsWith(
      `${RADIOSNET_BASE}/radio/futebol/`
    )
  ) {
    throw new Error(
      "URL de partida inválida"
    );
  }

  const html =
    await fetchHtml(url);

  return extractRadiosFromMatchPage(
    html,
    url
  );
}


// ========================================================
// COLETAR PÁGINA PRINCIPAL DE FUTEBOL
// ========================================================

export async function collectFootballPage() {

  const url =
    `${RADIOSNET_BASE}/futebol`;

  const html =
    await fetchHtml(url);

  const matchLinks =
    extractMatchLinks(html);

  return {
    ok: true,
    source:
      "RadiosNet",

    source_url:
      url,

    matches_found:
      matchLinks.length,

    match_links:
      matchLinks,
  };
}


// ========================================================
// COLETAR TODAS AS PARTIDAS DISPONÍVEIS
// ========================================================

export async function collectTransmissions(
  options = {}
) {

  const maxMatches =
    Number.isInteger(
      options.maxMatches
    )
      ? Math.max(
          1,
          Math.min(
            options.maxMatches,
            100
          )
        )
      : 40;

  const football =
    await collectFootballPage();

  const links =
    football.match_links.slice(
      0,
      maxMatches
    );

  const transmissions = [];
  const matches = [];
  const errors = [];
  const ignoredRadios = [];

  for (const url of links) {

    try {

      const result =
        await collectMatchPage(
          url
        );

      matches.push({
        title:
          result.title,

        home_team:
          result.home_team,

        away_team:
          result.away_team,

        source_url:
          result.source_url,

        radios:
          result.transmissions.length,
      });

      transmissions.push(
        ...result.transmissions
      );

      ignoredRadios.push(
        ...result.ignored.map(
          (radio) => ({
            ...radio,
            match:
              result.title,

            source_url:
              result.source_url,
          })
        )
      );

      // Pequena pausa entre páginas.
      // Evita fazer várias requisições simultâneas.

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            150
          )
      );

    } catch (error) {

      errors.push({
        url,

        error:
          error?.message ||
          String(error),
      });
    }
  }

  // Remove duplicações.

  const unique = [];

  const seen =
    new Set();

  for (
    const transmission
    of transmissions
  ) {

    const key =
      [
        transmission.radio_id,
        normalize(
          transmission.home_team
        ),
        normalize(
          transmission.away_team
        ),
      ].join("|");

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    unique.push(
      transmission
    );
  }

  return {
    ok: true,

    source:
      "RadiosNet",

    source_url:
      football.source_url,

    match_pages_found:
      football.matches_found,

    match_pages_checked:
      links.length,

    matches,

    transmissions:
      unique,

    transmissions_found:
      unique.length,

    ignored_radios:
      ignoredRadios,

    errors,
  };
}


// ========================================================
// TESTE DE UMA URL ESPECÍFICA
// ========================================================

export async function testRadioCollector(
  url
) {

  if (url) {
    return await collectMatchPage(
      url
    );
  }

  return await collectTransmissions({
    maxMatches: 10,
  });
}


// ========================================================
// INFORMAÇÕES DO COLETOR
// ========================================================

export function getRadioCollectorInfo() {

  return {
    name:
      "RadioPlacar Radio Collector",

    version:
      "1.0.0",

    source:
      "RadiosNet",

    source_url:
      `${RADIOSNET_BASE}/futebol`,

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
