import {
  saveDarkGame
} from "./darkGames.js";

/*
  RÁDIOPLACAR
  Jogos do Escuro

  Fonte complementar:
  FootballData

  - NÃO usa BSD.
  - NÃO interfere nos jogos BSD.
  - NÃO inventa placar.
  - Limpa nomes defeituosos da fonte.
*/

const RAW_BASE =
  "https://raw.githubusercontent.com/FerrerasRP/FootballData/main/database";

const SOURCES = {
  "serie-c": {
    competition:
      "Brasileirão Série C",

    file:
      "brasil-serie-c/brasil-serie-c%202026.json"
  },

  "serie-d": {
    competition:
      "Brasileirão Série D",

    file:
      "brasil-serie-d/brasil-serie-d%202026.json"
  }
};

/* =========================================================
   LIMPAR NOME DE CLUBE
========================================================= */

function cleanTeamName(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  let text =
    String(value)
      .replace(/\r/g, "\n")
      .trim();

  /*
    A fonte possui casos como:

    Azuriz
    2

    Paysandu
    2

    CRAC
    4

    Esses números são resíduos
    da origem dos dados.
  */

  text =
    text.replace(
      /\n+\s*\d+\s*$/g,
      ""
    );

  /*
    Também protege contra:

    "Azuriz  \n  2"
  */

  text =
    text.replace(
      /\s+\d+\s*$/g,
      match => {
        /*
          Não removemos número
          quando o nome inteiro
          for numérico.

          Para os clubes atuais,
          esse caso não ocorre,
          mas evita limpeza cega.
        */
        return "";
      }
    );

  /*
    Troca quebras restantes
    por espaço.
  */

  text =
    text
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (!text) {
    return null;
  }

  return text;
}

/* =========================================================
   NORMALIZAR DATA
========================================================= */

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  const match =
    text.match(
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

  const parsed =
    new Date(text);

  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {
    return parsed.toISOString();
  }

  return null;
}

/* =========================================================
   VALIDAR PLACAR
========================================================= */

function parseGoals(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  const number =
    Number(text);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

/* =========================================================
   NORMALIZAR PARA ID
========================================================= */

function normalizeIdPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

/* =========================================================
   CRIAR ID
========================================================= */

function makeId(
  source,
  date,
  home,
  away
) {
  const parts = [
    source,
    date,
    home,
    away
  ]
    .map(
      normalizeIdPart
    )
    .filter(Boolean);

  return (
    "dark-" +
    parts.join("-")
  );
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

  if (!config) {
    return null;
  }

  const homeName =
    cleanTeamName(
      match?.home
    );

  const awayName =
    cleanTeamName(
      match?.away
    );

  const date =
    normalizeDate(
      match?.match_date
    );

  if (
    !homeName ||
    !awayName ||
    !date
  ) {
    return null;
  }

  const homeGoals =
    parseGoals(
      match?.goals_home
    );

  const awayGoals =
    parseGoals(
      match?.goals_away
    );

  const hasScore =
    homeGoals !== null &&
    awayGoals !== null;

  return {
    id:
      makeId(
        source,
        date,
        homeName,
        awayName
      ),

    source:
      "FootballData",

    competition: {
      id:
        source,

      name:
        config.competition,

      country:
        "Brazil"
    },

    home: {
      id:
        null,

      name:
        homeName,

      logo:
        null
    },

    away: {
      id:
        null,

      name:
        awayName,

      logo:
        null
    },

    date,

    /*
      FootballData não define
      jogo AO VIVO no RádioPlacar.

      Se existe placar final na
      fonte, usamos como histórico.
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
      hasScore,

    radio:
      null
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
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "RadioPlacar"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `Erro FootballData ${response.status}`
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(data)
  ) {
    throw new Error(
      "Formato inesperado da FootballData"
    );
  }

  return data;
}

/* =========================================================
   IMPORTAR UMA COMPETIÇÃO
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
