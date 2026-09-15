// backend/radio-mapper.js

import {
  getRadio,
  attachRadioToMatch,
  clearMatchRadios,
} from "./radios.js";

/**
 * Normaliza texto para comparação.
 * Exemplos:
 *   São Paulo -> sao paulo
 *   Atlético Mineiro -> atletico mineiro
 *   Club Atlético Platense -> club atletico platense
 */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/[-_/.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Apelidos/equivalências de nomes.
 *
 * IMPORTANTE:
 * Isso serve somente para identificar que a partida da fonte
 * de rádios corresponde à partida da BSD.
 *
 * NÃO muda o nome nem a ordem mandada pela BSD para o frontend.
 */
const TEAM_ALIASES = new Map([
  // Platense
  ["platense", "platense"],
  ["atletico platense", "platense"],
  ["club atletico platense", "platense"],
  ["ca platense", "platense"],

  // Fluminense
  ["fluminense", "fluminense"],
  ["fluminense fc", "fluminense"],
  ["fluminense football club", "fluminense"],

  // Vasco
  ["vasco", "vasco da gama"],
  ["vasco da gama", "vasco da gama"],
  ["cr vasco da gama", "vasco da gama"],
  ["club de regatas vasco da gama", "vasco da gama"],

  // Santa Fe
  ["santa fe", "independiente santa fe"],
  ["independiente santa fe", "independiente santa fe"],
  ["independiente de santa fe", "independiente santa fe"],

  // São Paulo
  ["sao paulo", "sao paulo"],
  ["sao paulo fc", "sao paulo"],
  ["sao paulo futebol clube", "sao paulo"],

  // Boca Juniors
  ["boca", "boca juniors"],
  ["boca juniors", "boca juniors"],
  ["club atletico boca juniors", "boca juniors"],
  ["ca boca juniors", "boca juniors"],

  // Palmeiras
  ["palmeiras", "palmeiras"],
  ["se palmeiras", "palmeiras"],
  ["sociedade esportiva palmeiras", "palmeiras"],

  // LDU Quito
  ["ldu", "ldu quito"],
  ["ldu quito", "ldu quito"],
  ["liga de quito", "ldu quito"],
  ["liga deportiva universitaria", "ldu quito"],
  ["liga deportiva universitaria de quito", "ldu quito"],

  // Santos
  ["santos", "santos"],
  ["santos fc", "santos"],
  ["santos futebol clube", "santos"],

  // Atlético Mineiro
  ["atletico mineiro", "atletico mineiro"],
  ["clube atletico mineiro", "atletico mineiro"],
  ["ca mineiro", "atletico mineiro"],

  // Corinthians
  ["corinthians", "corinthians"],
  ["sc corinthians paulista", "corinthians"],
  ["sport club corinthians paulista", "corinthians"],

  // Estudiantes
  ["estudiantes", "estudiantes de la plata"],
  ["estudiantes lp", "estudiantes de la plata"],
  ["estudiantes de la plata", "estudiantes de la plata"],
  ["club estudiantes de la plata", "estudiantes de la plata"],

  // Flamengo
  ["flamengo", "flamengo"],
  ["cr flamengo", "flamengo"],
  ["clube de regatas do flamengo", "flamengo"],

  // Independiente del Valle
  ["independiente del valle", "independiente del valle"],
  ["ind del valle", "independiente del valle"],
  ["independiente valle", "independiente del valle"],

  // Botafogo
  ["botafogo", "botafogo"],
  ["botafogo rj", "botafogo"],
  ["botafogo de futebol e regatas", "botafogo"],

  // Grêmio
  ["gremio", "gremio"],
  ["gremio fbpa", "gremio"],
  ["gremio foot ball porto alegrense", "gremio"],

  // Internacional
  ["internacional", "internacional"],
  ["internacional rs", "internacional"],
  ["sc internacional", "internacional"],
  ["sport club internacional", "internacional"],

  // Cruzeiro
  ["cruzeiro", "cruzeiro"],
  ["cruzeiro ec", "cruzeiro"],
  ["cruzeiro esporte clube", "cruzeiro"],

  // Bahia
  ["bahia", "bahia"],
  ["ec bahia", "bahia"],
  ["esporte clube bahia", "bahia"],

  // Vitória
  ["vitoria", "vitoria"],
  ["ec vitoria", "vitoria"],
  ["esporte clube vitoria", "vitoria"],

  // Fortaleza
  ["fortaleza", "fortaleza"],
  ["fortaleza ec", "fortaleza"],
  ["fortaleza esporte clube", "fortaleza"],

  // Ceará
  ["ceara", "ceara"],
  ["ceara sc", "ceara"],
  ["ceara sporting club", "ceara"],

  // Sport Recife
  ["sport", "sport recife"],
  ["sport recife", "sport recife"],
  ["sport club do recife", "sport recife"],

  // Athletico Paranaense
  ["athletico paranaense", "athletico paranaense"],
  ["athletico pr", "athletico paranaense"],
  ["cap", "athletico paranaense"],

  // Coritiba
  ["coritiba", "coritiba"],
  ["coritiba fc", "coritiba"],
  ["coritiba foot ball club", "coritiba"],

  // Bragantino
  ["bragantino", "red bull bragantino"],
  ["rb bragantino", "red bull bragantino"],
  ["red bull bragantino", "red bull bragantino"],

  // Juventude
  ["juventude", "juventude"],
  ["ec juventude", "juventude"],
  ["esporte clube juventude", "juventude"],
]);

/**
 * Retorna o nome canônico usado somente para comparação.
 */
export function canonicalTeamName(name) {
  const normalized = normalizeText(name);

  if (!normalized) {
    return "";
  }

  return TEAM_ALIASES.get(normalized) || normalized;
}

/**
 * Verifica se dois nomes representam o mesmo time.
 */
export function sameTeam(a, b) {
  const teamA = canonicalTeamName(a);
  const teamB = canonicalTeamName(b);

  if (!teamA || !teamB) {
    return false;
  }

  return teamA === teamB;
}

/**
 * Obtém ID da partida BSD.
 */
export function getMatchId(match) {
  if (!match || typeof match !== "object") {
    return null;
  }

  return (
    match.id ??
    match?.fixture?.id ??
    match.event_id ??
    match.match_id ??
    null
  );
}

/**
 * Obtém mandante.
 *
 * BSD atualmente retorna:
 *   home_team: "Vasco da Gama"
 *
 * Mas mantemos suporte aos outros formatos para segurança.
 */
export function getHomeTeamName(match) {
  if (!match || typeof match !== "object") {
    return "";
  }

  if (typeof match.home_team === "string") {
    return match.home_team;
  }

  if (typeof match.home_team?.name === "string") {
    return match.home_team.name;
  }

  if (typeof match.homeTeam === "string") {
    return match.homeTeam;
  }

  if (typeof match.homeTeam?.name === "string") {
    return match.homeTeam.name;
  }

  if (typeof match.teams?.home === "string") {
    return match.teams.home;
  }

  if (typeof match.teams?.home?.name === "string") {
    return match.teams.home.name;
  }

  if (typeof match.home === "string") {
    return match.home;
  }

  if (typeof match.home?.name === "string") {
    return match.home.name;
  }

  return "";
}

/**
 * Obtém visitante.
 *
 * BSD atualmente retorna:
 *   away_team: "Independiente Santa Fe"
 */
export function getAwayTeamName(match) {
  if (!match || typeof match !== "object") {
    return "";
  }

  if (typeof match.away_team === "string") {
    return match.away_team;
  }

  if (typeof match.away_team?.name === "string") {
    return match.away_team.name;
  }

  if (typeof match.awayTeam === "string") {
    return match.awayTeam;
  }

  if (typeof match.awayTeam?.name === "string") {
    return match.awayTeam.name;
  }

  if (typeof match.teams?.away === "string") {
    return match.teams.away;
  }

  if (typeof match.teams?.away?.name === "string") {
    return match.teams.away.name;
  }

  if (typeof match.away === "string") {
    return match.away;
  }

  if (typeof match.away?.name === "string") {
    return match.away.name;
  }

  return "";
}

/**
 * Procura a partida BSD correspondente.
 *
 * Primeiro procura:
 *   CASA x FORA
 *
 * Depois aceita:
 *   FORA x CASA
 *
 * Isso é necessário porque a fonte usada para identificar
 * as rádios pode escrever a partida em ordem diferente.
 *
 * IMPORTANTE:
 * a inversão é SOMENTE para localizar a mesma partida.
 * O objeto BSD nunca é modificado.
 */
export function findMatchingMatch(matches, homeName, awayName) {
  if (!Array.isArray(matches)) {
    return null;
  }

  const wantedHome = canonicalTeamName(homeName);
  const wantedAway = canonicalTeamName(awayName);

  if (!wantedHome || !wantedAway) {
    return null;
  }

  // 1. Ordem normal
  for (const match of matches) {
    const bsdHome = canonicalTeamName(getHomeTeamName(match));
    const bsdAway = canonicalTeamName(getAwayTeamName(match));

    if (!bsdHome || !bsdAway) {
      continue;
    }

    if (bsdHome === wantedHome && bsdAway === wantedAway) {
      return match;
    }
  }

  // 2. Ordem invertida somente para identificar a partida
  for (const match of matches) {
    const bsdHome = canonicalTeamName(getHomeTeamName(match));
    const bsdAway = canonicalTeamName(getAwayTeamName(match));

    if (!bsdHome || !bsdAway) {
      continue;
    }

    if (bsdHome === wantedAway && bsdAway === wantedHome) {
      return match;
    }
  }

  return null;
}

/**
 * Valida uma transmissão coletada.
 */
export function validateTransmission(transmission) {
  if (!transmission || typeof transmission !== "object") {
    return {
      ok: false,
      reason: "Transmissão inválida",
    };
  }

  if (!transmission.radio_id) {
    return {
      ok: false,
      reason: "radio_id não informado",
    };
  }

  if (!transmission.home_team) {
    return {
      ok: false,
      reason: "home_team não informado",
    };
  }

  if (!transmission.away_team) {
    return {
      ok: false,
      reason: "away_team não informado",
    };
  }

  const radio = getRadio(transmission.radio_id);

  if (!radio) {
    return {
      ok: false,
      reason: `Rádio não cadastrada: ${transmission.radio_id}`,
    };
  }

  return {
    ok: true,
    radio,
  };
}

/**
 * Mapeia UMA transmissão para uma partida BSD.
 */
export function mapTransmission(matches, transmission) {
  const validation = validateTransmission(transmission);

  if (!validation.ok) {
    return {
      mapped: false,
      radio_id: transmission?.radio_id ?? null,
      home_team: transmission?.home_team ?? null,
      away_team: transmission?.away_team ?? null,
      match_id: null,
      reason: validation.reason,
    };
  }

  const match = findMatchingMatch(
    matches,
    transmission.home_team,
    transmission.away_team
  );

  if (!match) {
    return {
      mapped: false,
      radio_id: transmission.radio_id,
      home_team: transmission.home_team,
      away_team: transmission.away_team,
      match_id: null,
      reason: "Partida correspondente não encontrada na BSD",
    };
  }

  const matchId = getMatchId(match);

  if (matchId === null || matchId === undefined) {
    return {
      mapped: false,
      radio_id: transmission.radio_id,
      home_team: transmission.home_team,
      away_team: transmission.away_team,
      match_id: null,
      reason: "Partida BSD encontrada, mas sem ID",
    };
  }

  try {
    attachRadioToMatch(String(matchId), transmission.radio_id, {
      match_confirmed: true,
      source: transmission.source || "OuviRadios",
      source_url: transmission.source_url || null,
      priority: Number.isInteger(transmission.priority)
        ? transmission.priority
        : 99,
    });

    return {
      mapped: true,
      radio_id: transmission.radio_id,
      radio_name: validation.radio.name || null,

      // Nomes informados pela fonte de rádios
      home_team: transmission.home_team,
      away_team: transmission.away_team,

      // Partida oficial encontrada na BSD
      match_id: String(matchId),
      bsd_home_team: getHomeTeamName(match),
      bsd_away_team: getAwayTeamName(match),

      source: transmission.source || "OuviRadios",
      source_url: transmission.source_url || null,
    };
  } catch (error) {
    return {
      mapped: false,
      radio_id: transmission.radio_id,
      home_team: transmission.home_team,
      away_team: transmission.away_team,
      match_id: String(matchId),
      reason: error?.message || "Erro ao associar rádio à partida",
    };
  }
}

/**
 * Mapeia uma lista completa de transmissões.
 */
export function mapTransmissions(
  matches,
  transmissions,
  options = {}
) {
  const matchList = Array.isArray(matches) ? matches : [];
  const transmissionList = Array.isArray(transmissions)
    ? transmissions
    : [];

  const clearExisting = options.clearExisting === true;

  /**
   * Usado somente quando explicitamente solicitado.
   *
   * No server.js automático estamos usando clearExisting:false
   * para NÃO apagar associações manuais.
   */
  if (clearExisting) {
    for (const match of matchList) {
      const matchId = getMatchId(match);

      if (matchId !== null && matchId !== undefined) {
        clearMatchRadios(String(matchId));
      }
    }
  }

  const results = [];

  for (const transmission of transmissionList) {
    const result = mapTransmission(
      matchList,
      transmission
    );

    results.push(result);
  }

  const mapped = results.filter(
    (item) => item.mapped === true
  ).length;

  const notMapped = results.filter(
    (item) => item.mapped !== true
  ).length;

  return {
    ok: true,
    total: results.length,
    mapped,
    not_mapped: notMapped,
    results,
  };
}

export default {
  normalizeText,
  canonicalTeamName,
  sameTeam,
  getMatchId,
  getHomeTeamName,
  getAwayTeamName,
  findMatchingMatch,
  validateTransmission,
  mapTransmission,
  mapTransmissions,
};
