const COMMONS_API =
  "https://commons.wikimedia.org/w/api.php";

const CACHE_MS =
  24 * 60 * 60 * 1000;

const cache = new Map();

/* =========================
   ALIASES DE CLUBES
========================= */

const TEAM_ALIASES = {
  "sampaio correa rj": [
    "sampaio correa rj",
    "sampaio correa futebol e esporte",
    "sampaio correa futebol e esporte rj"
  ],

  "portuguesa rj": [
    "portuguesa rj",
    "associacao atletica portuguesa",
    "aa portuguesa rj"
  ],

  "portuguesa sp": [
    "portuguesa sp",
    "associacao portuguesa de desportos",
    "portuguesa de desportos"
  ],

  "sao jose rs": [
    "sao jose rs",
    "esporte clube sao jose",
    "ec sao jose rs"
  ],

  "sao joseense": [
    "sao joseense",
    "independente futebol sao joseense"
  ],

  "america rn": [
    "america rn",
    "america futebol clube rn",
    "america de natal"
  ],

  "america rj": [
    "america rj",
    "america football club rio de janeiro"
  ],

  "america mg": [
    "america mg",
    "america futebol clube belo horizonte",
    "america mineiro"
  ],

  "treze": [
    "treze",
    "treze futebol clube"
  ],

  "abc": [
    "abc",
    "abc futebol clube"
  ],

  "asa": [
    "asa",
    "agremiacao sportiva arapiraquense"
  ],

  "csa": [
    "csa",
    "centro sportivo alagoano"
  ],

  "cse": [
    "cse",
    "clube sociedade esportiva"
  ],

  "iape": [
    "iape",
    "instituto de administracao de projetos educacionais"
  ]
};

/* =========================
   NORMALIZAÇÃO
========================= */

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/football club/g, "")
    .replace(/futebol clube/g, "")
    .replace(/esporte clube/g, "")
    .replace(/sport club/g, "")
    .replace(/associacao atletica/g, "")
    .replace(/associacao desportiva/g, "")
    .replace(/clube de regatas/g, "")
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

function metadataValue(
  metadata,
  key
) {
  return stripHtml(
    metadata?.[key]?.value || ""
  );
}

/* =========================
   LICENÇA
========================= */

function acceptedLicense(metadata) {
  const shortName =
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
        (license) =>
          shortName.includes(
            license
          )
      ) ||
      copyrighted ===
        "false",

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
   TERMOS DE BUSCA
========================= */

function getSearchTerms(teamName) {
  const original =
    String(teamName || "")
      .trim();

  const normalized =
    normalizeName(
      teamName
    );

  const terms =
    new Set();

  if (original) {
    terms.add(original);
  }

  if (normalized) {
    terms.add(normalized);
  }

  const aliases =
    TEAM_ALIASES[
      normalized
    ] || [];

  for (
    const alias of aliases
  ) {
    terms.add(alias);
  }

  return [
    ...terms
  ];
}

/* =========================
   DETECÇÃO DE CONFLITOS
========================= */

function hasStateConflict(
  teamName,
  text
) {
  const source =
    normalizeName(
      teamName
    );

  const target =
    normalizeName(
      text
    );

  const states = [
    "ac",
    "al",
    "ap",
    "am",
    "ba",
    "ce",
    "df",
    "es",
    "go",
    "ma",
    "mt",
    "ms",
    "mg",
    "pa",
    "pb",
    "pr",
    "pe",
    "pi",
    "rj",
    "rn",
    "rs",
    "ro",
    "rr",
    "sc",
    "sp",
    "se",
    "to"
  ];

  const sourceState =
    states.find(
      (state) =>
        source.endsWith(
          ` ${state}`
        )
    );

  if (!sourceState) {
    return false;
  }

  for (
    const state of states
  ) {
    if (
      state !== sourceState &&
      target.includes(
        ` ${state}`
      )
    ) {
      return true;
    }
  }

  return false;
}

/* =========================
   PONTUAÇÃO
========================= */

function matchScore(
  teamName,
  title,
  description,
  searchTerm
) {
  const team =
    normalizeName(
      teamName
    );

  const term =
    normalizeName(
      searchTerm
    );

  const titleNormalized =
    normalizeName(
      title
    );

  const descriptionNormalized =
    normalizeName(
      description
    );

  const haystack =
    `${titleNormalized} ${descriptionNormalized}`;

  if (
    !team ||
    !haystack
  ) {
    return 0;
  }

  if (
    hasStateConflict(
      teamName,
      haystack
    )
  ) {
    return 0;
  }

  let score = 0;

  if (
    titleNormalized ===
    team
  ) {
    score += 100;
  }

  if (
    titleNormalized.includes(
      team
    )
  ) {
    score += 70;
  }

  if (
    haystack.includes(
      team
    )
  ) {
    score += 50;
  }

  if (
    term &&
    titleNormalized.includes(
      term
    )
  ) {
    score += 35;
  }

  if (
    term &&
    haystack.includes(
      term
    )
  ) {
    score += 20;
  }

  if (
    titleNormalized.includes(
      "logo"
    ) ||
    titleNormalized.includes(
      "escudo"
    )
  ) {
    score += 10;
  }

  return score;
}

/* =========================
   WIKIMEDIA
========================= */

async function searchCommons(
  searchTerm
) {
  const params =
    new URLSearchParams({
      action:
        "query",

      generator:
        "search",

      gsrsearch:
        `${searchTerm} futebol clube logo`,

      gsrnamespace:
        "6",

      gsrlimit:
        "20",

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
      `Wikimedia Commons ${response.status}`
    );
  }

  const data =
    await response.json();

  return Object.values(
    data?.query?.pages ||
      {}
  );
}

/* =========================
   PROCURAR MELHOR CANDIDATO
========================= */

async function findBestCandidate(
  teamName
) {
  const terms =
    getSearchTerms(
      teamName
    );

  const candidates =
    [];

  for (
    const term of terms
  ) {
    let pages = [];

    try {
      pages =
        await searchCommons(
          term
        );
    } catch (error) {
      console.error(
        `[teamLogos] busca ${term}:`,
        error.message
      );

      continue;
    }

    for (
      const page of pages
    ) {
      const info =
        page?.imageinfo?.[0];

      if (!info) {
        continue;
      }

      const metadata =
        info.extmetadata ||
        {};

      const description =
        metadataValue(
          metadata,
          "ImageDescription"
        );

      const score =
        matchScore(
          teamName,
          page.title,
          description,
          term
        );

      if (
        score < 50
      ) {
        continue;
      }

      const license =
        acceptedLicense(
          metadata
        );

      if (!license.ok) {
        continue;
      }

      const logo =
        info.thumburl ||
        info.url ||
        null;

      if (!logo) {
        continue;
      }

      candidates.push({
        score,

        logo,

        title:
          page.title,

        source:
          "Wikimedia Commons",

        source_page:
          info.descriptionurl ||
          null,

        license:
          license.name,

        license_url:
          license.url,

        verified:
          true
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );

  if (
    candidates.length ===
    0
  ) {
    return null;
  }

  const best =
    candidates[0];

  /*
    Se houver empate entre
    resultados diferentes,
    não arriscamos escudo errado.
  */

  const sameScore =
    candidates.filter(
      (item) =>
        item.score ===
        best.score
    );

  const uniqueLogos =
    new Set(
      sameScore.map(
        (item) =>
          item.logo
      )
    );

  if (
    uniqueLogos.size >
    1
  ) {
    return null;
  }

  return best;
}

/* =========================
   API PRINCIPAL
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
    const result =
      await findBestCandidate(
        teamName
      );

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
      `[teamLogos] ${teamName}:`,
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
