/*
  RÁDIOPLACAR
  Jogos do Escuro
  Escudos externos - v4

  ORDEM:
  1. JoseArroyave/football-logos
  2. Wikimedia Commons via Wikidata

  NÃO USA BSD.
*/

const GITHUB_API =
  "https://api.github.com/repos/JoseArroyave/football-logos/contents/logos/brazil";

const RAW_BASE =
  "https://raw.githubusercontent.com/JoseArroyave/football-logos/main/logos/brazil";

const WIKIDATA_API =
  "https://www.wikidata.org/w/api.php";

const COMMONS_API =
  "https://commons.wikimedia.org/w/api.php";

const CACHE_MS =
  24 * 60 * 60 * 1000;

const cache = new Map();

let brazilFilesCache = {
  time: 0,
  files: null
};

/* =========================================================
   ALIASES SEGUROS

   Usamos somente quando sabemos
   qual clube o nome representa.
========================================================= */

const TEAM_ALIASES = {
  "altos pi": [
    "associacao atletica de altos",
    "altos"
  ],

  "america rn": [
    "america de natal",
    "america futebol clube natal"
  ],

  "america rj": [
    "america football club rio de janeiro",
    "america rio de janeiro"
  ],

  "aparecidense": [
    "associacao atletica aparecidense"
  ],

  "iguatu": [
    "associacao desportiva iguatu"
  ],

  "maguary": [
    "associacao atletica maguary"
  ],

  "atletico ce": [
    "atletico cearense",
    "floresta atletico clube"
  ],

  "atletico de alagoinhas": [
    "alagoainhas atletico clube",
    "atletico de alagoinhas"
  ],

  "brasil de pelotas": [
    "gremio esportivo brasil",
    "brasil de pelotas"
  ],

  "botafogo pb": [
    "botafogo futebol clube paraiba",
    "botafogo paraiba"
  ],

  "capital df": [
    "capital clube de futebol",
    "capital df"
  ],

  "caxias": [
    "sociedade esportiva e recreativa caxias do sul",
    "caxias do sul"
  ],

  "confianca": [
    "associacao desportiva confianca"
  ],

  "ferroviaria": [
    "associacao ferroviaria de esportes"
  ],

  "ferroviario": [
    "ferroviario atletico clube ceara"
  ],

  "fluminense pi": [
    "fluminense esporte clube piaui",
    "fluminense piaui"
  ],

  "gama": [
    "sociedade esportiva do gama"
  ],

  "guarani": [
    "guarani futebol clube"
  ],

  "guarany de bage": [
    "guarany futebol clube bage",
    "guarany de bage"
  ],

  "internacional de limeira": [
    "associacao atletica internacional limeira",
    "inter de limeira"
  ],

  "jacuipense": [
    "esporte clube jacuipense"
  ],

  "juazeirense": [
    "sociedade desportiva juazeirense"
  ],

  "manaus": [
    "manaus futebol clube"
  ],

  "maranhao": [
    "maranhao atletico clube"
  ],

  "marcilio dias": [
    "clube nautico marcilio dias"
  ],

  "moto club": [
    "moto club de sao luis"
  ],

  "nacional am": [
    "nacional futebol clube amazonas",
    "nacional amazonas"
  ],

  "operario ms": [
    "operario futebol clube mato grosso do sul",
    "operario campo grande"
  ],

  "operario vg": [
    "clube esportivo operario varzea grandense",
    "operario varzea grande"
  ],

  "parnahyba": [
    "parnahyba sport club"
  ],

  "portuguesa rj": [
    "associacao atletica portuguesa rio de janeiro",
    "portuguesa carioca"
  ],

  "portuguesa": [
    "associacao portuguesa de desportos",
    "portuguesa de desportos"
  ],

  "real noroeste": [
    "real noroeste capixaba futebol clube"
  ],

  "rio branco es": [
    "rio branco atletico clube espirito santo",
    "rio branco es"
  ],

  "sampaio correa": [
    "sampaio correa futebol clube maranhao",
    "sampaio correa"
  ],

  "sampaio correa rj": [
    "sampaio correa futebol e esporte rio de janeiro",
    "sampaio correa rj"
  ],

  "santa cruz": [
    "santa cruz futebol clube pernambuco",
    "santa cruz recife"
  ],

  "sao jose": [
    "esporte clube sao jose porto alegre",
    "sao jose rs"
  ],

  "sao joseense": [
    "independente futebol sao joseense",
    "sao joseense"
  ],

  "sao luiz": [
    "esporte clube sao luiz ijui",
    "sao luiz ijui"
  ],

  "sao raimundo rr": [
    "sao raimundo esporte clube roraima",
    "sao raimundo roraima"
  ],

  "trem": [
    "trem desportivo clube"
  ],

  "treze": [
    "treze futebol clube"
  ],

  "tuna luso": [
    "tuna luso brasileira"
  ],

  "uniao rondonopolis": [
    "uniao esporte clube rondonopolis"
  ],

  "xv de piracicaba": [
    "esporte clube xv de novembro piracicaba",
    "xv de novembro piracicaba"
  ],

  "ypiranga": [
    "ypiranga futebol clube erechim",
    "ypiranga rs"
  ]
};

/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.svg$/i, "")
    .replace(/_/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripClubWords(value) {
  return normalizeName(value)
    .replace(
      /\b(associacao|atletica|atletico|desportiva|desportivo|esporte|esportiva|sport|football|futebol|clube|club|sociedade|gremio|nautico)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function metadataValue(
  metadata,
  key
) {
  return stripHtml(
    metadata?.[key]?.value ||
    ""
  );
}

/* =========================================================
   NOMES PARA BUSCA
========================================================= */

function getSearchNames(teamName) {
  const normalized =
    normalizeName(teamName);

  const names =
    new Set([
      normalized
    ]);

  const aliases =
    TEAM_ALIASES[
      normalized
    ] || [];

  for (
    const alias of aliases
  ) {
    names.add(
      normalizeName(alias)
    );
  }

  return [
    ...names
  ].filter(Boolean);
}

/* =========================================================
   CARREGAR LISTA BRASIL
========================================================= */

async function loadBrazilFiles() {
  if (
    brazilFilesCache.files &&
    Date.now() -
      brazilFilesCache.time <
      CACHE_MS
  ) {
    return brazilFilesCache.files;
  }

  const response =
    await fetch(
      GITHUB_API,
      {
        headers: {
          Accept:
            "application/vnd.github+json",

          "User-Agent":
            "RadioPlacar"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `football-logos GitHub ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "Lista de escudos do Brasil inválida"
    );
  }

  const files =
    data
      .filter(
        item =>
          item?.type === "file" &&
          /\.svg$/i.test(
            item?.name || ""
          )
      )
      .map(
        item => ({
          name:
            item.name,

          normalized:
            normalizeName(
              item.name
            ),

          simplified:
            stripClubWords(
              item.name
            ),

          download_url:
            item.download_url ||
            null,

          html_url:
            item.html_url ||
            null
        })
      );

  brazilFilesCache = {
    time:
      Date.now(),

    files
  };

  return files;
}

/* =========================================================
   PONTUAÇÃO DO ARQUIVO

   Quanto maior, mais segura
   a correspondência.
========================================================= */

function fileScore(
  teamName,
  searchNames,
  file
) {
  const requested =
    normalizeName(teamName);

  const requestedSimple =
    stripClubWords(teamName);

  let score = 0;

  for (
    const searchName of
    searchNames
  ) {
    const simpleSearch =
      stripClubWords(
        searchName
      );

    if (
      file.normalized ===
      searchName
    ) {
      score =
        Math.max(
          score,
          200
        );
    }

    if (
      simpleSearch &&
      file.simplified ===
        simpleSearch
    ) {
      score =
        Math.max(
          score,
          180
        );
    }

    if (
      searchName.length >= 6 &&
      (
        file.normalized.includes(
          searchName
        ) ||
        searchName.includes(
          file.normalized
        )
      )
    ) {
      score =
        Math.max(
          score,
          130
        );
    }

    if (
      simpleSearch.length >= 5 &&
      (
        file.simplified.includes(
          simpleSearch
        ) ||
        simpleSearch.includes(
          file.simplified
        )
      )
    ) {
      score =
        Math.max(
          score,
          110
        );
    }
  }

  if (
    file.normalized ===
    requested
  ) {
    score += 20;
  }

  if (
    requestedSimple &&
    file.simplified ===
      requestedSimple
  ) {
    score += 10;
  }

  return score;
}

/* =========================================================
   PROTEÇÃO CONTRA NOMES AMBÍGUOS
========================================================= */

function ambiguousTeam(
  teamName
) {
  const name =
    normalizeName(teamName);

  return [
    "america",
    "atletico",
    "botafogo",
    "nacional",
    "operario",
    "portuguesa",
    "rio branco",
    "sampaio correa",
    "sao jose",
    "sao raimundo",
    "vitoria",
    "ypiranga"
  ].includes(name);
}

/* =========================================================
   BUSCAR NA FONTE PRINCIPAL
========================================================= */

async function findRepositoryLogo(
  teamName
) {
  const files =
    await loadBrazilFiles();

  const searchNames =
    getSearchNames(
      teamName
    );

  const candidates =
    files
      .map(
        file => ({
          file,

          score:
            fileScore(
              teamName,
              searchNames,
              file
            )
        })
      )
      .filter(
        candidate =>
          candidate.score >=
          110
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (!candidates.length) {
    return null;
  }

  const best =
    candidates[0];

  const tied =
    candidates.filter(
      candidate =>
        candidate.score ===
        best.score
    );

  /*
    Se houver empate entre
    arquivos diferentes,
    não arriscamos.
  */

  if (
    tied.length > 1
  ) {
    return null;
  }

  /*
    Nome muito ambíguo só entra
    com correspondência forte.
  */

  if (
    ambiguousTeam(
      teamName
    ) &&
    best.score < 180
  ) {
    return null;
  }

  const filename =
    best.file.name;

  const encodedFilename =
    filename
      .split("/")
      .map(
        encodeURIComponent
      )
      .join("/");

  return {
    logo:
      best.file.download_url ||
      `${RAW_BASE}/${encodedFilename}`,

    source:
      "JoseArroyave/football-logos",

    source_page:
      best.file.html_url ||
      null,

    license:
      "Repository MIT; club marks may have separate trademark/copyright rights",

    license_url:
      "https://github.com/JoseArroyave/football-logos/blob/main/LICENSE",

    verified:
      true,

    match_score:
      best.score,

    matched_file:
      filename
  };
}

/* =========================================================
   WIKIDATA - FALLBACK
========================================================= */

async function searchWikidata(
  teamName
) {
  const params =
    new URLSearchParams({
      action:
        "wbsearchentities",

      search:
        teamName,

      language:
        "pt",

      uselang:
        "pt",

      type:
        "item",

      limit:
        "10",

      format:
        "json",

      origin:
        "*"
    });

  const response =
    await fetch(
      `${WIKIDATA_API}?${params}`
    );

  if (!response.ok) {
    throw new Error(
      `Wikidata ${response.status}`
    );
  }

  const data =
    await response.json();

  return Array.isArray(
    data?.search
  )
    ? data.search
    : [];
}

async function getWikidataEntities(
  ids
) {
  if (!ids.length) {
    return {};
  }

  const params =
    new URLSearchParams({
      action:
        "wbgetentities",

      ids:
        ids.join("|"),

      props:
        "claims|labels|descriptions|aliases",

      languages:
        "pt|en",

      format:
        "json",

      origin:
        "*"
    });

  const response =
    await fetch(
      `${WIKIDATA_API}?${params}`
    );

  if (!response.ok) {
    throw new Error(
      `Wikidata item ${response.status}`
    );
  }

  const data =
    await response.json();

  return (
    data?.entities ||
    {}
  );
}

function claimEntityIds(
  entity,
  property
) {
  return (
    entity?.claims?.[
      property
    ] || []
  )
    .map(
      claim =>
        claim?.mainsnak
          ?.datavalue
          ?.value
          ?.id
    )
    .filter(Boolean);
}

function claimFilename(
  entity,
  property
) {
  const claims =
    entity?.claims?.[
      property
    ] || [];

  for (
    const claim of claims
  ) {
    const value =
      claim?.mainsnak
        ?.datavalue
        ?.value;

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function isBrazilian(
  entity
) {
  /*
    P17 = país
    Q155 = Brasil
  */

  const countries =
    claimEntityIds(
      entity,
      "P17"
    );

  return countries.includes(
    "Q155"
  );
}

function wikidataNames(
  entity
) {
  const names = [];

  const pt =
    entity?.labels?.pt?.value;

  const en =
    entity?.labels?.en?.value;

  if (pt) {
    names.push(pt);
  }

  if (en) {
    names.push(en);
  }

  for (
    const alias of
    entity?.aliases?.pt ||
    []
  ) {
    if (alias?.value) {
      names.push(
        alias.value
      );
    }
  }

  for (
    const alias of
    entity?.aliases?.en ||
    []
  ) {
    if (alias?.value) {
      names.push(
        alias.value
      );
    }
  }

  return [
    ...new Set(names)
  ];
}

function wikidataScore(
  teamName,
  entity
) {
  if (
    !isBrazilian(entity)
  ) {
    return 0;
  }

  const searchNames =
    getSearchNames(
      teamName
    );

  const entityNames =
    wikidataNames(entity)
      .map(normalizeName)
      .filter(Boolean);

  let score = 40;

  for (
    const wanted of
    searchNames
  ) {
    if (
      entityNames.includes(
        wanted
      )
    ) {
      score =
        Math.max(
          score,
          160
        );
    }

    const wantedSimple =
      stripClubWords(
        wanted
      );

    for (
      const entityName of
      entityNames
    ) {
      const entitySimple =
        stripClubWords(
          entityName
        );

      if (
        wantedSimple &&
        entitySimple &&
        wantedSimple ===
          entitySimple
      ) {
        score =
          Math.max(
            score,
            150
          );
      }
    }
  }

  if (
    claimFilename(
      entity,
      "P154"
    )
  ) {
    score += 30;
  }

  return score;
}

async function findWikidataTeam(
  teamName
) {
  const searches =
    getSearchNames(
      teamName
    );

  const searchResults = [];

  for (
    const searchName of
    searches.slice(0, 3)
  ) {
    const results =
      await searchWikidata(
        searchName
      );

    for (
      const result of results
    ) {
      if (
        result?.id &&
        !searchResults.some(
          existing =>
            existing.id ===
            result.id
        )
      ) {
        searchResults.push(
          result
        );
      }
    }
  }

  if (!searchResults.length) {
    return null;
  }

  const ids =
    searchResults
      .map(
        item => item.id
      )
      .filter(Boolean);

  const entities =
    await getWikidataEntities(
      ids
    );

  const candidates = [];

  for (
    const result of
    searchResults
  ) {
    const entity =
      entities[result.id];

    if (!entity) {
      continue;
    }

    const logoFile =
      claimFilename(
        entity,
        "P154"
      );

    if (!logoFile) {
      continue;
    }

    const score =
      wikidataScore(
        teamName,
        entity
      );

    if (score < 150) {
      continue;
    }

    candidates.push({
      id:
        result.id,

      logoFile,

      score
    });
  }

  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );

  if (!candidates.length) {
    return null;
  }

  const best =
    candidates[0];

  const tied =
    candidates.filter(
      item =>
        item.score ===
        best.score
    );

  if (
    tied.length > 1
  ) {
    return null;
  }

  return best;
}

/* =========================================================
   LICENÇA COMMONS

   Aqui corrigimos também o
   problema da versão anterior:
   só aceitamos licença explícita.
========================================================= */

function acceptedCommonsLicense(
  metadata
) {
  const original =
    metadataValue(
      metadata,
      "LicenseShortName"
    );

  const license =
    original.toLowerCase();

  if (!license) {
    return {
      ok: false,
      name: null,
      url: null
    };
  }

  const allowed =
    license === "cc0" ||
    license.includes(
      "public domain"
    ) ||
    license === "pd" ||
    license.startsWith(
      "cc by "
    ) ||
    license.startsWith(
      "cc-by-"
    ) ||
    license.includes(
      "cc by-sa"
    ) ||
    license.includes(
      "cc-by-sa"
    );

  return {
    ok:
      allowed,

    name:
      original || null,

    url:
      metadataValue(
        metadata,
        "LicenseUrl"
      ) || null
  };
}

async function getCommonsLogo(
  filename
) {
  const title =
    filename.startsWith(
      "File:"
    )
      ? filename
      : `File:${filename}`;

  const params =
    new URLSearchParams({
      action:
        "query",

      titles:
        title,

      prop:
        "imageinfo",

      iiprop:
        "url|extmetadata",

      iiurlwidth:
        "256",

      format:
        "json",

      origin:
        "*"
    });

  const response =
    await fetch(
      `${COMMONS_API}?${params}`
    );

  if (!response.ok) {
    throw new Error(
      `Commons ${response.status}`
    );
  }

  const data =
    await response.json();

  const pages =
    Object.values(
      data?.query?.pages ||
      {}
    );

  const page =
    pages[0];

  if (
    !page ||
    page.missing !==
      undefined
  ) {
    return null;
  }

  const info =
    page?.imageinfo?.[0];

  if (!info) {
    return null;
  }

  const license =
    acceptedCommonsLicense(
      info.extmetadata || {}
    );

  if (!license.ok) {
    return null;
  }

  const logo =
    info.thumburl ||
    info.url ||
    null;

  if (!logo) {
    return null;
  }

  return {
    logo,

    source:
      "Wikidata / Wikimedia Commons",

    source_page:
      info.descriptionurl ||
      null,

    license:
      license.name,

    license_url:
      license.url,

    verified:
      true
  };
}

async function findCommonsFallback(
  teamName
) {
  const team =
    await findWikidataTeam(
      teamName
    );

  if (!team) {
    return null;
  }

  const logo =
    await getCommonsLogo(
      team.logoFile
    );

  if (!logo) {
    return null;
  }

  return {
    ...logo,

    wikidata_id:
      team.id,

    wikidata_url:
      `https://www.wikidata.org/wiki/${team.id}`,

    match_score:
      team.score
  };
}

/* =========================================================
   FUNÇÃO PRINCIPAL
========================================================= */

export async function findExternalTeamLogo(
  teamName
) {
  const key =
    normalizeName(
      teamName
    );

  if (!key) {
    return null;
  }

  const cached =
    cache.get(key);

  if (
    cached &&
    Date.now() -
      cached.time <
      CACHE_MS
  ) {
    return cached.value;
  }

  let result = null;

  /*
    1 - Repositório especializado
  */

  try {
    result =
      await findRepositoryLogo(
        teamName
      );
  } catch (error) {
    console.error(
      `[teamLogos v4 repository] ${teamName}:`,
      error.message
    );
  }

  /*
    2 - Wikidata / Commons
  */

  if (!result) {
    try {
      result =
        await findCommonsFallback(
          teamName
        );
    } catch (error) {
      console.error(
        `[teamLogos v4 commons] ${teamName}:`,
        error.message
      );
    }
  }

  /*
    Nada seguro encontrado:
    deixa sem escudo.
  */

  cache.set(
    key,
    {
      time:
        Date.now(),

      value:
        result || null
    }
  );

  return result || null;
}

/* =========================================================
   LIMPAR CACHE
========================================================= */

export function clearTeamLogoCache() {
  cache.clear();

  brazilFilesCache = {
    time: 0,
    files: null
  };
}
