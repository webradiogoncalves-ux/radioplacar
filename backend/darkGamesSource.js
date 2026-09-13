import { saveDarkGame } from "./darkGames.js";

/*
  RÁDIOPLACAR
  Fonte complementar para jogos fora da BSD.

  IMPORTANTE:
  - Não marca jogo como AO VIVO.
  - Não inventa placar.
  - Só importa o que realmente existir na fonte.
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

function makeId(source, match) {
  const text = [
    source,
    match.match_date,
    match.home,
    match.away
  ]
    .join("-")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `dark-${text}`;
}

function normalizeMatch(match, source) {
  const config = SOURCES[source];

  if (
    !match?.match_date ||
    !match?.home ||
    !match?.away
  ) {
    return null;
  }

  const homeGoals = Number(match.goals_home);
  const awayGoals = Number(match.goals_away);

  const hasScore =
    Number.isInteger(homeGoals) &&
    Number.isInteger(awayGoals);

  return {
    id: makeId(source, match),

    source: "FootballData",

    competition: {
      id: source,
      name: config.competition,
      country: "Brazil"
    },

    home: {
      name: match.home,
      logo: null
    },

    away: {
      name: match.away,
      logo: null
    },

    date: match.match_date,

    /*
      Essa fonte não será usada para afirmar
      que uma partida está AO VIVO.
    */
    status: hasScore
      ? "finished"
      : "scheduled",

    score: hasScore
      ? {
          home: homeGoals,
          away: awayGoals
        }
      : undefined,

    score_source: hasScore
      ? "FootballData"
      : "waiting",

    score_confidence: hasScore ? 1 : 0,

    score_verified: hasScore
  };
}

async function downloadSource(source) {
  const config = SOURCES[source];

  if (!config) {
    throw new Error(
      `Fonte não configurada: ${source}`
    );
  }

  const url =
    `${RAW_BASE}/${config.file}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RadioPlacar"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Erro FootballData ${response.status}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "Formato inesperado da FootballData"
    );
  }

  return data;
}

export async function importDarkGames(source) {
  const matches =
    await downloadSource(source);

  let imported = 0;
  let ignored = 0;

  for (const match of matches) {
    const normalized =
      normalizeMatch(match, source);

    if (!normalized) {
      ignored += 1;
      continue;
    }

    saveDarkGame(normalized);

    imported += 1;
  }

  return {
    source,
    competition:
      SOURCES[source].competition,
    imported,
    ignored
  };
}

export async function importAllDarkGames() {
  const results = [];

  for (const source of Object.keys(SOURCES)) {
    results.push(
      await importDarkGames(source)
    );
  }

  return results;
}
