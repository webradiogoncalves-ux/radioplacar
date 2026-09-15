// backend/radio-mapper.js

import {
  getRadio,
  attachRadioToMatch,
  clearMatchRadios,
} from "./radios.js";


// ========================================================
// RADIOPLACAR - MAPEADOR DE TRANSMISSÕES
// ========================================================
//
// Objetivo:
//
// transmissão confirmada
//        ↓
// identificar mandante/visitante
//        ↓
// localizar partida correspondente da BSD
//        ↓
// associar rádio à fixture correta
//
// IMPORTANTE:
// Nunca associamos rádio somente por clube, estado
// ou campeonato.
// ========================================================


// ========================================================
// NORMALIZAR TEXTO
// ========================================================

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(futebol clube|football club|futebol|fc|ec|sc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ========================================================
// APELIDOS / VARIAÇÕES DE NOMES
// ========================================================

const TEAM_ALIASES = new Map([
  ["internacional", "internacional"],
  ["internacional rs", "internacional"],

  ["gremio", "gremio"],
  ["gremio rs", "gremio"],

  ["atletico mineiro", "atletico mg"],
  ["atletico mg", "atletico mg"],

  ["america mineiro", "america mg"],
  ["america mg", "america mg"],

  ["athletico paranaense", "athletico pr"],
  ["athletico pr", "athletico pr"],

  ["atletico paranaense", "athletico pr"],

  ["bragantino", "red bull bragantino"],
  ["rb bragantino", "red bull bragantino"],
  ["red bull bragantino", "red bull bragantino"],

  ["vasco", "vasco da gama"],
  ["vasco da gama", "vasco da gama"],

  ["botafogo", "botafogo"],
  ["botafogo rj", "botafogo"],

  ["flamengo", "flamengo"],
  ["fluminense", "fluminense"],

  ["corinthians", "corinthians"],
  ["palmeiras", "palmeiras"],
  ["sao paulo", "sao paulo"],
  ["santos", "santos"],

  ["cruzeiro", "cruzeiro"],

  ["bahia", "bahia"],
  ["vitoria", "vitoria"],

  ["fortaleza", "fortaleza"],
  ["ceara", "ceara"],

  ["sport recife", "sport"],
  ["sport", "sport"],

  ["juventude", "juventude"],

  ["cuiaba", "cuiaba"],

  ["goias", "goias"],

  ["atletico goianiense", "atletico go"],
  ["atletico go", "atletico go"],
]);


// ========================================================
// NOME CANÔNICO DO TIME
// ========================================================

export function canonicalTeamName(name) {
  const normalized = normalizeText(name);

  return (
    TEAM_ALIASES.get(normalized) ||
    normalized
  );
}


// ========================================================
// COMPARAR DOIS TIMES
// ========================================================

export function sameTeam(a, b) {
  const teamA = canonicalTeamName(a);
  const teamB = canonicalTeamName(b);

  if (!teamA || !teamB) {
    return false;
  }

  if (teamA === teamB) {
    return true;
  }

  // Aceita pequenas diferenças de cadastro
  // sem fazer associação completamente solta.

  if (
    teamA.length >= 5 &&
    teamB.length >= 5
  ) {
    if (
      teamA.includes(teamB) ||
      teamB.includes(teamA)
    ) {
      return true;
    }
  }

  return false;
}


// ========================================================
// PEGAR ID DA PARTIDA BSD
// ========================================================

export function getMatchId(match) {
  return (
    match?.id ??
    match?.fixture?.id ??
    match?.event_id ??
    null
  );
}


// ========================================================
// PEGAR NOME DO MANDANTE
// ========================================================

export function getHomeTeamName(match) {
  return (
    match?.home_team?.name ??
    match?.homeTeam?.name ??
    match?.teams?.home?.name ??
    match?.home?.name ??
    ""
  );
}


// ========================================================
// PEGAR NOME DO VISITANTE
// ========================================================

export function getAwayTeamName(match) {
  return (
    match?.away_team?.name ??
    match?.awayTeam?.name ??
    match?.teams?.away?.name ??
    match?.away?.name ??
    ""
  );
}


// ========================================================
// LOCALIZAR PARTIDA BSD
// ========================================================

export function findMatchingMatch(
  matches,
  homeName,
  awayName
) {
  if (!Array.isArray(matches)) {
    return null;
  }

  const exact = matches.find((match) => {
    const home =
      getHomeTeamName(match);

    const away =
      getAwayTeamName(match);

    return (
      sameTeam(home, homeName) &&
      sameTeam(away, awayName)
    );
  });

  if (exact) {
    return exact;
  }

  // Algumas fontes podem inverter a ordem.
  // Mantemos isso separado para diagnóstico.

  const inverted = matches.find((match) => {
    const home =
      getHomeTeamName(match);

    const away =
      getAwayTeamName(match);

    return (
      sameTeam(home, awayName) &&
      sameTeam(away, homeName)
    );
  });

  return inverted || null;
}


// ========================================================
// VALIDAR TRANSMISSÃO
// ========================================================

export function validateTransmission(item) {
  if (!item) {
    return {
      ok: false,
      error: "Transmissão vazia",
    };
  }

  if (!item.radio_id) {
    return {
      ok: false,
      error: "radio_id ausente",
    };
  }

  const radio =
    getRadio(item.radio_id);

  if (!radio) {
    return {
      ok: false,
      error:
        `Rádio não cadastrada: ${item.radio_id}`,
    };
  }

  if (!item.home_team) {
    return {
      ok: false,
      error: "home_team ausente",
    };
  }

  if (!item.away_team) {
    return {
      ok: false,
      error: "away_team ausente",
    };
  }

  // A transmissão precisa vir de alguma
  // fonte de confirmação.

  if (!item.source) {
    return {
      ok: false,
      error: "source ausente",
    };
  }

  return {
    ok: true,
    radio,
  };
}


// ========================================================
// MAPEAR UMA TRANSMISSÃO
// ========================================================

export function mapTransmission(
  matches,
  transmission
) {
  const validation =
    validateTransmission(transmission);

  if (!validation.ok) {
    return {
      ok: false,
      mapped: false,
      reason: validation.error,
      transmission,
    };
  }

  const match =
    findMatchingMatch(
      matches,
      transmission.home_team,
      transmission.away_team
    );

  if (!match) {
    return {
      ok: true,
      mapped: false,

      reason:
        "Partida correspondente não encontrada na BSD",

      transmission,
    };
  }

  const matchId =
    getMatchId(match);

  if (!matchId) {
    return {
      ok: false,
      mapped: false,

      reason:
        "Partida BSD sem ID",

      transmission,
    };
  }

  const association =
    attachRadioToMatch(
      matchId,
      transmission.radio_id,
      {
        match_confirmed: true,

        source:
          transmission.source,

        source_url:
          transmission.source_url ||
          null,

        priority:
          Number.isInteger(
            transmission.priority
          )
            ? transmission.priority
            : 99,
      }
    );

  return {
    ok: true,
    mapped: true,

    match_id:
      String(matchId),

    home_team:
      getHomeTeamName(match),

    away_team:
      getAwayTeamName(match),

    radio:
      validation.radio,

    association,
  };
}


// ========================================================
// MAPEAR VÁRIAS TRANSMISSÕES
// ========================================================

export function mapTransmissions(
  matches,
  transmissions,
  options = {}
) {
  if (!Array.isArray(matches)) {
    throw new Error(
      "Lista de partidas inválida"
    );
  }

  if (!Array.isArray(transmissions)) {
    throw new Error(
      "Lista de transmissões inválida"
    );
  }

  // Podemos limpar as associações das partidas
  // antes de reconstruir o mapa.

  if (options.clearExisting === true) {
    for (const match of matches) {
      const matchId =
        getMatchId(match);

      if (matchId) {
        clearMatchRadios(matchId);
      }
    }
  }

  const results = [];

  for (const transmission of transmissions) {
    results.push(
      mapTransmission(
        matches,
        transmission
      )
    );
  }

  const mapped =
    results.filter(
      (item) => item.mapped
    );

  const notMapped =
    results.filter(
      (item) => !item.mapped
    );

  return {
    ok: true,

    matches:
      matches.length,

    transmissions:
      transmissions.length,

    mapped:
      mapped.length,

    not_mapped:
      notMapped.length,

    results,
  };
}


// ========================================================
// MODELO DE TRANSMISSÃO
// ========================================================
//
// O coletor que vamos ligar depois deverá entregar:
//
// {
//   radio_id: "grenal",
//   home_team: "Internacional",
//   away_team: "Grêmio",
//   source: "fonte-da-confirmacao",
//   source_url: "pagina-da-partida",
//   priority: 1
// }
//
// Outro exemplo:
//
// {
//   radio_id: "gaucha",
//   home_team: "Internacional",
//   away_team: "Grêmio",
//   source: "fonte-da-confirmacao",
//   source_url: "pagina-da-partida",
//   priority: 2
// }
//
// Assim Grenal e Gaúcha podem aparecer NA MESMA
// partida quando as duas transmissões estiverem
// realmente confirmadas.
// ========================================================
