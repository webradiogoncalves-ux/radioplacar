import { saveDarkGame } from "./darkGames.js";

/*
  RÁDIOPLACAR
  Fonte complementar para jogos fora da BSD.

  - Não interfere na BSD.
  - Não marca jogo como AO VIVO sozinho.
  - Não inventa placar.
*/

const RAW_BASE =
  "https://raw.githubusercontent.com/FerrerasRP/FootballData/main/database";

const SOURCES = {
  "serie-c": {
    competition: "Brasileirão Série C",
    file:
      "brasil-serie-c/brasil-serie-c%202026.json"
  },

  "serie-d": {
    competition: "Brasileirão Série D",
    file:
      "brasil-serie-d/brasil-serie-d%202026.json"
  }
};

/* =========================================================
   NORMALIZAR DATA
   05.04.2026 18:00
   ->
   2026-04-05T18:00:00
========================================================= */

function normalizeDate(value) {
  if (!value) return null;

  const text =
    String(value).trim();

  const match = text.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/
  );

  if (match) {
    const [
      ,
      day,
      month,
      year,
      hour = "00",
      minute = "00"
    ] = match;

    return (
      `${year}-${month}-${day}` +
      `T${hour}:${minute}:00`
    );
  }

  /*
    Caso futuramente a fonte
    já envie uma data ISO.
  */

  const parsed =
    new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

/* =========================================================
   ID ÚNICO
========================================================= */

function makeId(
  source,
  match,
  normalizedDate
) {
  const text = [
    source,
    normalizedDate ||
      match.match_date,
    match.home,
    match.away
  ]
    .join("-")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );

  return `dark-${text}`;
}

/* =========================================================
   NORMALIZAR PARTIDA
========================================================= */

function normalizeMatch(
  match,
  source
) {
  const config =
    SOURCES[source];

  if (
    !match?.match_date ||
    !match?.home ||
    !match?.away
  ) {
    return null;
  }

  const date =
    normalizeDate(
      match.match_date
    );

  if (!date) {
    return null;
  }

  const homeGoals =
    Number(
      match.goals_home
    );

  const awayGoals =
    Number(
      match.goals_away
    );

  const hasScore =
    Number.isInteger(
      homeGoals
    ) &&
    Number.isInteger(
      awayGoals
    );

  return {
    id: makeId(
      source,
      match,
      date
    ),

    source:
      "FootballData",

    competition: {
      id: source,
      name:
        config.competition,
      country:
        "Brazil"
    },

    home: {
      id: null,
      name:
        match.home,
      logo: null
    },

    away: {
      id: null,
      name:
        match.away,
      logo: null
    },

    date,

    /*
      FootballData não será usada
      para afirmar que está AO VIVO.
    */

    status:
      hasScore
        ? "finished"
        : "scheduled",

    score:
      hasScore
        ? {
            home:
              homeGoals,

            away:
              awayGoals
          }
        : undefined,

    score_source:
      hasScore
        ? "FootballData"
        : "waiting",

    score_confidence:
      hasScore
        ? 1
        : 0,

    score_verified:
      hasScore
  };
}

/* =========================================================
   BAIXAR FONTE
========================================================= */

async function downloadSource(
  source
) {
  const config =
    SOURCES[source];

  if (!config) {
    throw new Error(
      `Fonte não configurada: ${source}`
    );
  }

  const url =
    `${RAW_BASE}/${config.file}`;

  const response =
    await fetch(url, {
      headers: {
        Accept:
          "application/json",

        "User-Agent":
          "RadioPlacar"
      }
    });

  if (!response.ok) {
    throw new Error(
      `Erro FootballData ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "Formato inesperado da FootballData"
    );
  }

  return data;
}

/* =========================================================
   IMPORTAR COMPETIÇÃO
========================================================= */

export async function importDarkGames(
  source
) {
  const matches =
    await downloadSource(
      source
    );

  let imported = 0;
  let ignored = 0;

  for (
    const match of matches
  ) {
    const normalized =
      normalizeMatch(
        match,
        source
      );

    if (!normalized) {
      ignored += 1;
      continue;
    }

    saveDarkGame(
      normalized
    );

    imported += 1;
  }

  return {
    source,

    competition:
      SOURCES[source]
        .competition,

    imported,
    ignored
  };
}

/* =========================================================
   IMPORTAR TODAS
========================================================= */

export async function importAllDarkGames() {
  const results = [];

  for (
    const source of
    Object.keys(SOURCES)
  ) {
    results.push(
      await importDarkGames(
        source
      )
    );
  }

  return results;
}
