const WIKIDATA_API =
  "https://www.wikidata.org/w/api.php";

const COMMONS_API =
  "https://commons.wikimedia.org/w/api.php";

const CACHE_MS =
  24 * 60 * 60 * 1000;

const cache = new Map();

/* =========================
   NORMALIZAÇÃO
========================= */

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
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

function metadataValue(metadata, key) {
  return stripHtml(
    metadata?.[key]?.value || ""
  );
}

/* =========================
   LICENÇA
========================= */

function acceptedLicense(metadata) {
  const license =
    metadataValue(
      metadata,
      "LicenseShortName"
    ).toLowerCase();

  const copyrighted =
    metadataValue(
      metadata,
      "Copyrighted"
    ).toLowerCase();

  const allowed = [
    "cc0",
    "public domain",
    "cc by",
    "cc-by",
    "cc by-sa",
    "cc-by-sa"
  ];

  return {
    ok:
      allowed.some(
        item =>
          license.includes(item)
      ) ||
      copyrighted === "false",

    name:
      metadataValue(
        metadata,
        "LicenseShortName"
      ) || null,

    url:
      metadataValue(
        metadata,
        "LicenseUrl"
      ) || null
  };
}

/* =========================
   BUSCAR NO WIKIDATA
========================= */

async function searchWikidata(teamName) {
  const params =
    new URLSearchParams({
      action: "wbsearchentities",
      search: teamName,
      language: "pt",
      uselang: "pt",
      type: "item",
      limit: "10",
      format: "json",
      origin: "*"
    });

  const response =
    await fetch(
      `${WIKIDATA_API}?${params}`
    );

  if (!response.ok) {
    throw new Error(
      `Wikidata busca ${response.status}`
    );
  }

  const data =
    await response.json();

  return Array.isArray(data?.search)
    ? data.search
    : [];
}

/* =========================
   DADOS DO ITEM WIKIDATA
========================= */

async function getWikidataEntities(ids) {
  if (!ids.length) {
    return {};
  }

  const params =
    new URLSearchParams({
      action: "wbgetentities",
      ids: ids.join("|"),
      props: "claims|labels|descriptions|aliases|sitelinks",
      languages: "pt|en",
      sitefilter: "ptwiki|enwiki",
      format: "json",
      origin: "*"
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

  return data?.entities || {};
}

/* =========================
   CLAIMS
========================= */

function claimEntityIds(entity, property) {
  const claims =
    entity?.claims?.[property] || [];

  return claims
    .map(
      claim =>
        claim?.mainsnak
          ?.datavalue
          ?.value
          ?.id
    )
    .filter(Boolean);
}

function claimCommonsFilename(
  entity,
  property
) {
  const claims =
    entity?.claims?.[property] || [];

  for (const claim of claims) {
    const value =
      claim?.mainsnak
        ?.datavalue
        ?.value;

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

/* =========================
   VALIDAR BRASIL
========================= */

/*
  Q155 = Brasil

  P17 = país

  Alguns clubes podem não ter
  P17 preenchido. Nesse caso
  também olhamos descrição e
  página da Wikipédia.
*/

function looksBrazilian(entity) {
  const countries =
    claimEntityIds(
      entity,
      "P17"
    );

  if (countries.includes("Q155")) {
    return true;
  }

  const description =
    normalizeName(
      entity?.descriptions?.pt?.value ||
      entity?.descriptions?.en?.value ||
      ""
    );

  if (
    description.includes("brasil") ||
    description.includes("brazil")
  ) {
    return true;
  }

  const ptTitle =
    normalizeName(
      entity?.sitelinks
        ?.ptwiki
        ?.title || ""
    );

  if (
    ptTitle.includes("futebol") ||
    ptTitle.includes("esporte clube") ||
    ptTitle.includes("futebol clube")
  ) {
    return true;
  }

  return false;
}

/* =========================
   NOMES DO ITEM
========================= */

function entityNames(entity) {
  const names = [];

  const pt =
    entity?.labels?.pt?.value;

  const en =
    entity?.labels?.en?.value;

  if (pt) names.push(pt);
  if (en) names.push(en);

  for (
    const alias of
    entity?.aliases?.pt || []
  ) {
    if (alias?.value) {
      names.push(alias.value);
    }
  }

  for (
    const alias of
    entity?.aliases?.en || []
  ) {
    if (alias?.value) {
      names.push(alias.value);
    }
  }

  return [
    ...new Set(names)
  ];
}

/* =========================
   PONTUAÇÃO DO CLUBE
========================= */

function entityScore(
  requestedName,
  searchResult,
  entity
) {
  const requested =
    normalizeName(requestedName);

  if (!requested) {
    return 0;
  }

  let score = 0;

  const searchLabel =
    normalizeName(
      searchResult?.label || ""
    );

  const names =
    entityNames(entity)
      .map(normalizeName)
      .filter(Boolean);

  if (
    names.includes(requested)
  ) {
    score += 100;
  }

  if (
    searchLabel === requested
  ) {
    score += 80;
  }

  for (const name of names) {
    if (
      name.includes(requested) ||
      requested.includes(name)
    ) {
      score += 30;
      break;
    }
  }

  const description =
    normalizeName(
      searchResult?.description ||
      entity?.descriptions?.pt?.value ||
      entity?.descriptions?.en?.value ||
      ""
    );

  if (
    description.includes("futebol") ||
    description.includes("football")
  ) {
    score += 25;
  }

  if (looksBrazilian(entity)) {
    score += 40;
  } else {
    /*
      Para os Jogos do Escuro
      brasileiros atuais, não
      aceitamos item sem evidência
      de ligação com o Brasil.
    */
    return 0;
  }

  /*
    P154 = logotipo
  */

  if (
    claimCommonsFilename(
      entity,
      "P154"
    )
  ) {
    score += 30;
  }

  return score;
}

/* =========================
   ESCOLHER ITEM WIKIDATA
========================= */

async function findWikidataTeam(
  teamName
) {
  const searchResults =
    await searchWikidata(
      teamName
    );

  if (!searchResults.length) {
    return null;
  }

  const ids =
    searchResults
      .map(item => item.id)
      .filter(Boolean);

  const entities =
    await getWikidataEntities(
      ids
    );

  const candidates = [];

  for (
    const searchResult of
    searchResults
  ) {
    const entity =
      entities[
        searchResult.id
      ];

    if (!entity) continue;

    const score =
      entityScore(
        teamName,
        searchResult,
        entity
      );

    if (score < 90) {
      continue;
    }

    const logoFile =
      claimCommonsFilename(
        entity,
        "P154"
      );

    if (!logoFile) {
      continue;
    }

    candidates.push({
      id:
        searchResult.id,

      score,

      entity,

      logoFile
    });
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score
  );

  if (!candidates.length) {
    return null;
  }

  const best =
    candidates[0];

  /*
    Se dois clubes diferentes
    empatarem na pontuação,
    não arriscamos.
  */

  const tied =
    candidates.filter(
      candidate =>
        candidate.score ===
        best.score
    );

  if (tied.length > 1) {
    return null;
  }

  return best;
}

/* =========================
   PEGAR ARQUIVO NO COMMONS
========================= */

async function getCommonsLogo(
  filename
) {
  const title =
    filename.startsWith("File:")
      ? filename
      : `File:${filename}`;

  const params =
    new URLSearchParams({
      action: "query",
      titles: title,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "256",
      format: "json",
      origin: "*"
    });

  const response =
    await fetch(
      `${COMMONS_API}?${params}`
    );

  if (!response.ok) {
    throw new Error(
      `Commons imagem ${response.status}`
    );
  }

  const data =
    await response.json();

  const pages =
    Object.values(
      data?.query?.pages || {}
    );

  const page =
    pages[0];

  if (
    !page ||
    page.missing !== undefined
  ) {
    return null;
  }

  const info =
    page?.imageinfo?.[0];

  if (!info) {
    return null;
  }

  const metadata =
    info.extmetadata || {};

  const license =
    acceptedLicense(
      metadata
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

/* =========================
   FUNÇÃO PRINCIPAL
========================= */

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

  try {
    const team =
      await findWikidataTeam(
        teamName
      );

    if (!team) {
      cache.set(
        key,
        {
          time:
            Date.now(),

          value:
            null
        }
      );

      return null;
    }

    const logo =
      await getCommonsLogo(
        team.logoFile
      );

    if (!logo) {
      cache.set(
        key,
        {
          time:
            Date.now(),

          value:
            null
        }
      );

      return null;
    }

    const result = {
      ...logo,

      wikidata_id:
        team.id,

      wikidata_url:
        `https://www.wikidata.org/wiki/${team.id}`,

      match_score:
        team.score
    };

    cache.set(
      key,
      {
        time:
          Date.now(),

        value:
          result
      }
    );

    return result;

  } catch (error) {
    console.error(
      `[teamLogos v3] ${teamName}:`,
      error.message
    );

    cache.set(
      key,
      {
        time:
          Date.now(),

        value:
          null
      }
    );

    return null;
  }
}

/* =========================
   LIMPAR CACHE
========================= */

export function clearTeamLogoCache() {
  cache.clear();
}
