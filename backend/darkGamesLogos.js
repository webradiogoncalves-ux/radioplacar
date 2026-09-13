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
  const key = normalizeName(teamName);

  if (!key) return null;

  if (resolvedTeams.has(key)) {
    return resolvedTeams.get(key);
  }

  const result =
    await findExternalTeamLogo(teamName);

  resolvedTeams.set(key, result);

  return result;
}

function mergeTeam(team, logoData) {
  if (!logoData?.logo) {
    return team;
  }

  return {
    ...team,
    logo: logoData.logo,

    logo_source:
      logoData.source || null,

    logo_source_page:
      logoData.source_page || null,

    logo_license:
      logoData.license || null,

    logo_license_url:
      logoData.license_url || null,

    logo_verified:
      logoData.verified === true
  };
}

export async function enrichDarkGameLogos() {
  const games = getDarkGames();

  let updatedGames = 0;
  let homeLogos = 0;
  let awayLogos = 0;
  let notFound = 0;

  for (const game of games) {
    let homeLogo = null;
    let awayLogo = null;

    try {
      homeLogo =
        await resolveTeam(game.home?.name);
    } catch (error) {
      console.error(
        `[darkGamesLogos] casa ${game.home?.name}:`,
        error.message
      );
    }

    try {
      awayLogo =
        await resolveTeam(game.away?.name);
    } catch (error) {
      console.error(
        `[darkGamesLogos] fora ${game.away?.name}:`,
        error.message
      );
    }

    if (homeLogo?.logo) {
      homeLogos += 1;
    } else {
      notFound += 1;
    }

    if (awayLogo?.logo) {
      awayLogos += 1;
    } else {
      notFound += 1;
    }

    if (!homeLogo?.logo && !awayLogo?.logo) {
      continue;
    }

    saveDarkGame({
      ...game,

      home: mergeTeam(
        game.home,
        homeLogo
      ),

      away: mergeTeam(
        game.away,
        awayLogo
      )
    });

    updatedGames += 1;
  }

  return {
    games: games.length,
    updated_games: updatedGames,
    home_logos: homeLogos,
    away_logos: awayLogos,
    not_found: notFound,
    source: "Wikimedia Commons"
  };
}

export function clearResolvedTeamCache() {
  resolvedTeams.clear();
}
