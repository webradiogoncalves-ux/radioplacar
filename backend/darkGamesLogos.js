import {
  getDarkGames,
  saveDarkGame
} from "./darkGames.js";

import {
  findExternalTeamLogo
} from "./teamLogos.js";

const resolvedTeams = new Map();

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveTeam(teamName) {
  const key =
    normalizeName(teamName);

  if (!key) {
    return null;
  }

  if (
    resolvedTeams.has(key)
  ) {
    return resolvedTeams.get(
      key
    );
  }

  const result =
    await findExternalTeamLogo(
      teamName
    );

  resolvedTeams.set(
    key,
    result
  );

  return result;
}

function mergeTeam(
  team,
  logoData
) {
  if (!logoData?.logo) {
    return team;
  }

  return {
    ...team,

    logo:
      logoData.logo,

    logo_source:
      logoData.source ||
      null,

    logo_source_page:
      logoData.source_page ||
      null,

    logo_license:
      logoData.license ||
      null,

    logo_license_url:
      logoData.license_url ||
      null,

    logo_verified:
      logoData.verified ===
      true,

    wikidata_id:
      logoData.wikidata_id ||
      null,

    wikidata_url:
      logoData.wikidata_url ||
      null
  };
}

/* =========================
   TIMES ÚNICOS
========================= */

function getUniqueTeams(
  games
) {
  const teams =
    new Map();

  for (
    const game of games
  ) {
    const home =
      game?.home?.name;

    const away =
      game?.away?.name;

    if (home) {
      const key =
        normalizeName(home);

      if (
        key &&
        !teams.has(key)
      ) {
        teams.set(
          key,
          home
        );
      }
    }

    if (away) {
      const key =
        normalizeName(away);

      if (
        key &&
        !teams.has(key)
      ) {
        teams.set(
          key,
          away
        );
      }
    }
  }

  return [
    ...teams.values()
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        "pt-BR"
      )
  );
}

/* =========================
   ENRIQUECER ESCUDOS
========================= */

export async function enrichDarkGameLogos() {
  const games =
    getDarkGames();

  const uniqueTeams =
    getUniqueTeams(
      games
    );

  /*
    Primeiro resolvemos cada
    clube somente UMA vez.

    Isso também deixa o
    diagnóstico muito mais
    claro.
  */

  const teamResults =
    new Map();

  const foundTeams = [];
  const missingTeams = [];

  for (
    const teamName of
    uniqueTeams
  ) {
    let logoData =
      null;

    try {
      logoData =
        await resolveTeam(
          teamName
        );
    } catch (error) {
      console.error(
        `[darkGamesLogos] ${teamName}:`,
        error.message
      );
    }

    const key =
      normalizeName(
        teamName
      );

    teamResults.set(
      key,
      logoData
    );

    if (
      logoData?.logo
    ) {
      foundTeams.push({
        name:
          teamName,

        logo:
          logoData.logo,

        source:
          logoData.source ||
          null,

        wikidata_id:
          logoData.wikidata_id ||
          null,

        license:
          logoData.license ||
          null
      });

    } else {
      missingTeams.push(
        teamName
      );
    }
  }

  /* =========================
     APLICAR NOS JOGOS
  ========================= */

  let updatedGames = 0;
  let homeLogos = 0;
  let awayLogos = 0;
  let notFoundOccurrences = 0;

  for (
    const game of games
  ) {
    const homeKey =
      normalizeName(
        game?.home?.name
      );

    const awayKey =
      normalizeName(
        game?.away?.name
      );

    const homeLogo =
      teamResults.get(
        homeKey
      ) || null;

    const awayLogo =
      teamResults.get(
        awayKey
      ) || null;

    if (
      homeLogo?.logo
    ) {
      homeLogos += 1;
    } else {
      notFoundOccurrences += 1;
    }

    if (
      awayLogo?.logo
    ) {
      awayLogos += 1;
    } else {
      notFoundOccurrences += 1;
    }

    if (
      !homeLogo?.logo &&
      !awayLogo?.logo
    ) {
      continue;
    }

    saveDarkGame({
      ...game,

      home:
        mergeTeam(
          game.home,
          homeLogo
        ),

      away:
        mergeTeam(
          game.away,
          awayLogo
        )
    });

    updatedGames += 1;
  }

  /* =========================
     RESULTADO / DIAGNÓSTICO
  ========================= */

  return {
    games:
      games.length,

    unique_teams:
      uniqueTeams.length,

    found_teams:
      foundTeams.length,

    missing_teams_count:
      missingTeams.length,

    updated_games:
      updatedGames,

    home_logos:
      homeLogos,

    away_logos:
      awayLogos,

    not_found_occurrences:
      notFoundOccurrences,

    source:
      "Wikidata / Wikimedia Commons",

    found_team_names:
      foundTeams.map(
        team => team.name
      ),

    missing_teams:
      missingTeams
  };
}

/* =========================
   LIMPAR CACHE
========================= */

export function clearResolvedTeamCache() {
  resolvedTeams.clear();
}
