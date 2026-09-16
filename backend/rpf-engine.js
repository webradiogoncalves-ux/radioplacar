// backend/rpf-engine.js
// ============================================================
// MOTOR RPF
// RPF PLACAR
//
// Prioridade A:
//   Grêmio
//   Internacional
//   Chelsea
//
// Prioridade B:
//   Brasil de Pelotas
//   Pelotas
//   Gramadense
//   Veranópolis
//
// IMPORTANTE:
// - Compatível com o formato REAL retornado pela BSD:
//     home_team: "Botafogo"
//     away_team: "Grêmio"
// - Não inventa lances.
// - Não inventa placares.
// - Não ativa Jornada automaticamente.
// ============================================================

const journeys = new Map();
const states = new Map();

const DEFAULT_CONFIG = {
  pregameMinutes: 60,
  timeAndScoreMinutes: 15,
  postgameMinutes: 30,
};

const RPF_PRIORITY_A = [
  "gremio",
  "gremio fb porto alegrense",
  "gremio fb porto alegrense rs",
  "gremio foot-ball porto alegrense",

  "internacional",
  "sport club internacional",
  "sc internacional",

  "chelsea",
  "chelsea fc",
];

const RPF_PRIORITY_B = [
  "brasil de pelotas",
  "brasil-pel",
  "gremio esportivo brasil",
  "ge brasil",
  "brasil saf",

  "pelotas",
  "esporte clube pelotas",
  "ec pelotas",

  "gramadense",
  "ce gramadense",

  "veranopolis",
  "veranopolis ecrc",
];

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRpfName(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’`´]/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// LEITURA DE TIMES
// ============================================================
//
// Esta é a correção principal.
//
// BSD REAL:
// {
//   home_team: "Botafogo",
//   away_team: "Grêmio"
// }
//
// Também mantemos compatibilidade com outros formatos.
// ============================================================

function teamName(match, side) {
  if (!match) return "";

  if (side === "home") {
    const value =
      match.home_team ??
      match.home_team_name ??
      match.homeTeam?.name ??
      match.home?.name ??
      match.teams?.home?.name ??
      match.mandante?.name ??
      match.mandante?.nome ??
      match.time_casa?.name ??
      match.time_casa?.nome ??
      "";

    if (typeof value === "string") {
      return clean(value);
    }

    if (value && typeof value === "object") {
      return clean(
        value.name ??
        value.nome ??
        value.team_name ??
        ""
      );
    }

    return "";
  }

  const value =
    match.away_team ??
    match.away_team_name ??
    match.awayTeam?.name ??
    match.away?.name ??
    match.teams?.away?.name ??
    match.visitante?.name ??
    match.visitante?.nome ??
    match.time_visitante?.name ??
    match.time_visitante?.nome ??
    "";

  if (typeof value === "string") {
    return clean(value);
  }

  if (value && typeof value === "object") {
    return clean(
      value.name ??
      value.nome ??
      value.team_name ??
      ""
    );
  }

  return "";
}

function idOf(match) {
  return (
    match?.id ??
    match?.fixture_id ??
    match?.fixture?.id ??
    match?.event_id ??
    null
  );
}

function leagueName(match) {
  return clean(
    match?.league_name ??
    match?.league?.name ??
    match?.competition_name ??
    match?.competition?.name ??
    match?.campeonato?.nome ??
    match?.stage_name ??
    ""
  );
}

function scoreOf(match, side) {
  if (side === "home") {
    return num(
      match?.home_score ??
      match?.goals?.home ??
      match?.score?.home ??
      match?.placar?.mandante,
      0
    );
  }

  return num(
    match?.away_score ??
    match?.goals?.away ??
    match?.score?.away ??
    match?.placar?.visitante,
    0
  );
}

function statusOf(match) {
  return normalizeRpfName(
    match?.status?.short ??
    match?.status?.long ??
    match?.status ??
    match?.fixture?.status?.short ??
    ""
  );
}

function minuteOf(match) {
  return num(
    match?.current_minute ??
    match?.elapsed ??
    match?.minute ??
    match?.fixture?.status?.elapsed,
    0
  );
}

function kickoffOf(match) {
  const raw =
    match?.event_date ??
    match?.date ??
    match?.fixture?.date ??
    match?.kickoff ??
    null;

  if (!raw) return null;

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isLive(match) {
  const status = statusOf(match);

  return [
    "live",
    "inprogress",
    "in progress",
    "first half",
    "1st half",
    "second half",
    "2nd half",
    "halftime",
    "half time",
    "ht",
    "1h",
    "2h",
  ].some((item) => status.includes(item));
}

function isHalftime(match) {
  const status = statusOf(match);

  return [
    "halftime",
    "half time",
    "interval",
    "intervalo",
    "ht",
  ].some((item) => status.includes(item));
}

function isFinished(match) {
  const status = statusOf(match);

  return [
    "finished",
    "fulltime",
    "full time",
    "ft",
    "ended",
    "encerrado",
  ].some((item) => status.includes(item));
}

// ============================================================
// PRIORIDADES RPF
// ============================================================

function matchesRpfTeam(team, aliases) {
  const normalized = normalizeRpfName(team);

  if (!normalized) return false;

  return aliases.some((alias) => {
    const wanted = normalizeRpfName(alias);

    return (
      normalized === wanted ||
      normalized.startsWith(`${wanted} `) ||
      normalized.endsWith(` ${wanted}`)
    );
  });
}

export function getRpfPriority(match) {
  const home = teamName(match, "home");
  const away = teamName(match, "away");

  if (
    matchesRpfTeam(home, RPF_PRIORITY_A) ||
    matchesRpfTeam(away, RPF_PRIORITY_A)
  ) {
    return "A";
  }

  if (
    matchesRpfTeam(home, RPF_PRIORITY_B) ||
    matchesRpfTeam(away, RPF_PRIORITY_B)
  ) {
    return "B";
  }

  return null;
}

export function findRpfJourneyCandidates(matches = []) {
  if (!Array.isArray(matches)) {
    return [];
  }

  return matches
    .map((match) => {
      const priority = getRpfPriority(match);

      if (!priority) {
        return null;
      }

      return {
        fixtureId: idOf(match),
        priority,

        homeTeam: teamName(match, "home"),
        awayTeam: teamName(match, "away"),

        home_team: teamName(match, "home"),
        away_team: teamName(match, "away"),

        league: leagueName(match),

        leagueId:
          match?.league_id ??
          match?.league?.id ??
          null,

        kickoff:
          match?.event_date ??
          match?.date ??
          match?.fixture?.date ??
          null,

        status:
          match?.status ??
          match?.fixture?.status?.short ??
          null,

        match,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.priority === "A" && b.priority !== "A") return -1;
      if (a.priority !== "A" && b.priority === "A") return 1;

      const dateA = a.kickoff
        ? new Date(a.kickoff).getTime()
        : Number.MAX_SAFE_INTEGER;

      const dateB = b.kickoff
        ? new Date(b.kickoff).getTime()
        : Number.MAX_SAFE_INTEGER;

      return dateA - dateB;
    });
}

// ============================================================
// JORNADA
// ============================================================

export function createRpfJourney({
  fixtureId,
  priority = "NORMAL",
  enabled = true,
  pregameMinutes = DEFAULT_CONFIG.pregameMinutes,
  timeAndScoreMinutes = DEFAULT_CONFIG.timeAndScoreMinutes,
  postgameMinutes = DEFAULT_CONFIG.postgameMinutes,
} = {}) {
  if (fixtureId === null || fixtureId === undefined) {
    throw new Error("fixtureId é obrigatório.");
  }

  const id = String(fixtureId);

  const journey = {
    fixtureId: id,
    enabled: Boolean(enabled),
    priority,
    pregameMinutes,
    timeAndScoreMinutes,
    postgameMinutes,
    createdAt: new Date().toISOString(),
  };

  journeys.set(id, journey);

  if (!states.has(id)) {
    states.set(id, {
      fixtureId: id,
      phase: "scheduled",
      events: [],
      eventCounter: 0,

      openingPlayed: false,
      crowdStarted: false,
      halftimePlayed: false,
      fulltimePlayed: false,

      lastMainScore: null,
      lastScoreboardAt: null,

      otherScores: new Map(),

      updatedAt: new Date().toISOString(),
    });
  }

  return journey;
}

export function autoRegisterPriorityJourneys(matches = []) {
  const candidates = findRpfJourneyCandidates(matches);
  const registered = [];

  for (const candidate of candidates) {
    if (!candidate.fixtureId) continue;

    const id = String(candidate.fixtureId);

    if (journeys.has(id)) {
      continue;
    }

    const journey = createRpfJourney({
      fixtureId: id,
      priority: candidate.priority,
    });

    registered.push({
      ...journey,
      homeTeam: candidate.homeTeam,
      awayTeam: candidate.awayTeam,
    });
  }

  return registered;
}

export function removeRpfJourney(fixtureId) {
  const id = String(fixtureId);

  const existed = journeys.delete(id);

  states.delete(id);

  return existed;
}

export function listRpfJourneys() {
  return Array.from(journeys.values());
}

export function getRpfJourneyState(fixtureId) {
  const id = String(fixtureId);

  const journey = journeys.get(id);
  const state = states.get(id);

  if (!journey) {
    return null;
  }

  return {
    journey,
    state: publicState(state),
  };
}

// ============================================================
// EVENTOS
// ============================================================

function pushEvent(state, type, data = {}) {
  state.eventCounter += 1;

  const event = {
    id: state.eventCounter,
    type,
    createdAt: new Date().toISOString(),
    ...data,
  };

  state.events.push(event);

  if (state.events.length > 500) {
    state.events = state.events.slice(-500);
  }

  return event;
}

function audioEvent({
  type,
  audio = null,
  text = null,
  data = {},
}) {
  return {
    type,
    audio,
    text,
    ...data,
  };
}

function publicState(state) {
  if (!state) return null;

  return {
    fixtureId: state.fixtureId,
    phase: state.phase,

    openingPlayed: state.openingPlayed,
    crowdStarted: state.crowdStarted,
    halftimePlayed: state.halftimePlayed,
    fulltimePlayed: state.fulltimePlayed,

    lastMainScore: state.lastMainScore,
    lastScoreboardAt: state.lastScoreboardAt,

    updatedAt: state.updatedAt,

    events: state.events,
  };
}

function scoreKey(match) {
  return `${scoreOf(match, "home")}-${scoreOf(match, "away")}`;
}

function spokenScore(match) {
  const home = teamName(match, "home");
  const away = teamName(match, "away");

  const homeScore = scoreOf(match, "home");
  const awayScore = scoreOf(match, "away");

  return `${home} ${homeScore}, ${away} ${awayScore}`;
}

function publicMatch(match) {
  if (!match) return null;

  return {
    id: idOf(match),

    homeTeam: teamName(match, "home"),
    awayTeam: teamName(match, "away"),

    homeScore: scoreOf(match, "home"),
    awayScore: scoreOf(match, "away"),

    status:
      match?.status ??
      match?.fixture?.status?.short ??
      null,

    minute: minuteOf(match),

    league: leagueName(match),

    kickoff:
      match?.event_date ??
      match?.date ??
      match?.fixture?.date ??
      null,
  };
}

function buildScoreboardText(matches = []) {
  const live = matches.filter(isLive);

  if (!live.length) {
    return "Nenhuma outra partida ao vivo neste momento.";
  }

  return live
    .slice(0, 10)
    .map((match) => spokenScore(match))
    .join(". ");
}

function phaseFor(mainMatch, journey, now) {
  if (!mainMatch) {
    return "waiting_source";
  }

  if (isFinished(mainMatch)) {
    return "postgame";
  }

  if (isHalftime(mainMatch)) {
    return "halftime";
  }

  if (isLive(mainMatch)) {
    return "live";
  }

  const kickoff = kickoffOf(mainMatch);

  if (!kickoff) {
    return "scheduled";
  }

  const pregameStart = new Date(
    kickoff.getTime() -
      journey.pregameMinutes * 60 * 1000
  );

  if (now >= pregameStart && now < kickoff) {
    return "pregame";
  }

  if (now < pregameStart) {
    return "scheduled";
  }

  return "waiting_source";
}

// ============================================================
// MOTOR PRINCIPAL
// ============================================================

export function updateRpfEngine({
  mainMatch,
  allMatches = [],
  now = new Date(),
} = {}) {
  const fixtureId = idOf(mainMatch);

  if (fixtureId === null || fixtureId === undefined) {
    return {
      ok: false,
      reason: "fixture_not_found",
      events: [],
    };
  }

  const id = String(fixtureId);

  const journey = journeys.get(id);

  if (!journey || !journey.enabled) {
    return {
      ok: false,
      reason: "journey_not_active",
      fixtureId: id,
      priority: getRpfPriority(mainMatch),
      events: [],
    };
  }

  let state = states.get(id);

  if (!state) {
    createRpfJourney({
      fixtureId: id,
      priority: journey.priority,
    });

    state = states.get(id);
  }

  const generated = [];

  const newPhase = phaseFor(
    mainMatch,
    journey,
    now
  );

  state.phase = newPhase;
  state.updatedAt = now.toISOString();

  // ----------------------------------------------------------
  // ABERTURA DA JORNADA - T-60
  // ----------------------------------------------------------

  if (
    newPhase === "pregame" &&
    !state.openingPlayed
  ) {
    state.openingPlayed = true;

    generated.push(
      pushEvent(
        state,
        "JOURNEY_OPEN",
        audioEvent({
          type: "JOURNEY_OPEN",
          audio:
            "/audio/rpf/rpf_vinheta_2_chamada_jornada.wav",

          text:
            `RPF Jornada Esportiva. ` +
            `${teamName(mainMatch, "home")} e ` +
            `${teamName(mainMatch, "away")}.`,
        })
      )
    );
  }

  // ----------------------------------------------------------
  // TORCIDA RPF
  // ----------------------------------------------------------

  if (
    newPhase === "live" &&
    !state.crowdStarted
  ) {
    state.crowdStarted = true;

    generated.push(
      pushEvent(
        state,
        "CROWD_START",
        audioEvent({
          type: "CROWD_START",
          audio:
            "/audio/rpf/torcida_rpf_loop.mp3",

          text: null,
        })
      )
    );
  }

  // ----------------------------------------------------------
  // GOL DO JOGO PRINCIPAL
  // ----------------------------------------------------------

  const currentMainScore = scoreKey(mainMatch);

  if (state.lastMainScore === null) {
    state.lastMainScore = currentMainScore;
  } else if (
    isLive(mainMatch) &&
    state.lastMainScore !== currentMainScore
  ) {
    const oldScore = state.lastMainScore
      .split("-")
      .map(Number);

    const newHome = scoreOf(mainMatch, "home");
    const newAway = scoreOf(mainMatch, "away");

    const oldHome = oldScore[0] ?? 0;
    const oldAway = oldScore[1] ?? 0;

    let scoringTeam = null;

    if (newHome > oldHome) {
      scoringTeam = teamName(mainMatch, "home");
    }

    if (newAway > oldAway) {
      scoringTeam = teamName(mainMatch, "away");
    }

    state.lastMainScore = currentMainScore;

    generated.push(
      pushEvent(state, "GOAL", {
        match: publicMatch(mainMatch),
        scoringTeam,
        minute: minuteOf(mainMatch),

        text:
          scoringTeam
            ? `Gol do ${scoringTeam}! ${spokenScore(mainMatch)}.`
            : `Mudança no placar. ${spokenScore(mainMatch)}.`,
      })
    );
  }

  // ----------------------------------------------------------
  // INTERVALO
  // ----------------------------------------------------------

  if (
    newPhase === "halftime" &&
    !state.halftimePlayed
  ) {
    state.halftimePlayed = true;

    generated.push(
      pushEvent(state, "HALFTIME", {
        match: publicMatch(mainMatch),

        text:
          `Intervalo de jogo na RPF Jornada Esportiva. ` +
          `${spokenScore(mainMatch)}.`,
      })
    );
  }

  // ----------------------------------------------------------
  // FIM DE JOGO
  // ----------------------------------------------------------

  if (
    newPhase === "postgame" &&
    !state.fulltimePlayed
  ) {
    state.fulltimePlayed = true;

    generated.push(
      pushEvent(state, "FULLTIME", {
        match: publicMatch(mainMatch),

        text:
          `Fim de jogo na RPF Jornada Esportiva. ` +
          `${spokenScore(mainMatch)}.`,
      })
    );
  }

  // ----------------------------------------------------------
  // TEMPO E PLACAR RPF
  // ----------------------------------------------------------

  if (newPhase === "live") {
    const intervalMs =
      journey.timeAndScoreMinutes *
      60 *
      1000;

    const last =
      state.lastScoreboardAt
        ? new Date(
            state.lastScoreboardAt
          ).getTime()
        : 0;

    if (
      !last ||
      now.getTime() - last >= intervalMs
    ) {
      state.lastScoreboardAt =
        now.toISOString();

      generated.push(
        pushEvent(
          state,
          "TIME_AND_SCORE",
          audioEvent({
            type: "TIME_AND_SCORE",

            audio:
              "/audio/rpf/rpf_vinheta_1_tempo_placar.wav",

            text:
              `Tempo e Placar RPF. ` +
              `${spokenScore(mainMatch)}. ` +
              buildScoreboardText(allMatches),

            data: {
              mainMatch:
                publicMatch(mainMatch),
            },
          })
        )
      );
    }
  }

  // ----------------------------------------------------------
  // PLANTÃO RPF
  // Outros jogos ao vivo
  // ----------------------------------------------------------

  for (const match of allMatches) {
    const otherId = idOf(match);

    if (
      otherId === null ||
      otherId === undefined
    ) {
      continue;
    }

    if (
      String(otherId) === id
    ) {
      continue;
    }

    if (!isLive(match)) {
      continue;
    }

    const otherKey = String(otherId);
    const currentScore = scoreKey(match);

    if (
      !state.otherScores.has(otherKey)
    ) {
      state.otherScores.set(
        otherKey,
        currentScore
      );

      continue;
    }

    const previousScore =
      state.otherScores.get(otherKey);

    if (
      previousScore !== currentScore
    ) {
      state.otherScores.set(
        otherKey,
        currentScore
      );

      generated.push(
        pushEvent(
          state,
          "RPF_BREAKING",
          audioEvent({
            type: "RPF_BREAKING",

            text:
              `Plantão RPF! Mudança no placar. ` +
              `${spokenScore(match)}.`,

            data: {
              match:
                publicMatch(match),
            },
          })
        )
      );
    }
  }

  return {
    ok: true,

    fixtureId: id,

    priority:
      journey.priority ??
      getRpfPriority(mainMatch),

    phase: state.phase,

    match:
      publicMatch(mainMatch),

    generatedEvents: generated,

    state: publicState(state),
  };
}

// ============================================================
// CONSUMIR EVENTOS
// ============================================================

export function consumeRpfEvents(
  fixtureId,
  afterId = null
) {
  const id = String(fixtureId);
  const state = states.get(id);

  if (!state) {
    return [];
  }

  if (
    afterId === null ||
    afterId === undefined
  ) {
    return [...state.events];
  }

  const parsed = Number(afterId);

  return state.events.filter(
    (event) =>
      Number(event.id) > parsed
  );
}

// ============================================================
// INFORMAÇÕES PÚBLICAS DO MOTOR
// ============================================================

export const RPF_ENGINE_INFO = {
  name: "Motor RPF",
  version: "1.1.0",

  priorities: {
    A: "Grêmio / Internacional / Chelsea",
    B: "RPF Interior / jogos especiais",
    normal: "Demais jogos no RPF Placar",
  },

  priorityTeams: {
    A: [
      "Grêmio",
      "Internacional",
      "Chelsea",
    ],

    B: [
      "Brasil de Pelotas",
      "Pelotas",
      "Gramadense",
      "Veranópolis",
    ],
  },

  modes: [
    "RPF Jornada Esportiva",
    "Tempo e Placar RPF",
    "Plantão RPF",
    "Torcida RPF",
    "Momentos do Jogo",
  ],

  narration: false,

  automaticActivation: false,

  rule:
    "O motor somente reage a dados reais recebidos das fontes esportivas.",
};
