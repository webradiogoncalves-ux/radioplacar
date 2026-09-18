// backend/rpf-engine.js
// RPF PLACAR — Motor da RPF Jornada Esportiva
//
// Versão 1.2 — Jornada Padrão RPF
// - Jornada começa T-30
// - Esquentando o Jogo
// - Pré-jogo e boletim padrão
// - Tempo e Placar
// - Plantão com jogos AO VIVO + ENCERRADOS
// - Intervalo / Segundo Tempo / Fim / Pós-jogo
// - somente dados reais recebidos pelo backend

const journeys = new Map();
const states = new Map();

const BRAZIL_TZ = "America/Sao_Paulo";

const DEFAULT_CONFIG = {
  pregameMinutes: 30,
  postgameMinutes: 30,
  scoreboardEveryMinutes: 15,
};

function clean(v = "") {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function idOf(match) {
  return String(
    match?.id ??
      match?.fixture_id ??
      match?.event_id ??
      match?.evento_id ??
      ""
  );
}

function teamName(match, side) {
  if (side === "home") {
    return clean(
      match?.home_team_name ??
        match?.mandante?.name ??
        match?.time_casa?.nome ??
        match?.home_team?.name ??
        match?.home?.name
    );
  }

  return clean(
    match?.away_team_name ??
      match?.visitante?.name ??
      match?.time_visitante?.nome ??
      match?.away_team?.name ??
      match?.away?.name
  );
}

function leagueName(match) {
  return clean(
    match?.league_name ??
      match?.league?.name ??
      match?.campeonato?.nome ??
      match?.competition?.name ??
      "Futebol"
  );
}

function scoreOf(match) {
  return {
    home: num(
      match?.placar_casa ??
        match?.home_score ??
        match?.goals?.home ??
        match?.score?.home
    ),

    away: num(
      match?.placar_visitante ??
        match?.away_score ??
        match?.goals?.away ??
        match?.score?.away
    ),
  };
}

function statusOf(match) {
  return clean(
    match?.status?.short ??
      match?.status ??
      match?.situacao ??
      match?.state
  ).toLowerCase();
}

function minuteOf(match) {
  const raw =
    match?.minuto_atual ??
    match?.minute ??
    match?.elapsed ??
    match?.status?.elapsed;

  const n = num(raw);

  return n === null ? null : Math.max(0, n);
}

function kickoffOf(match) {
  const raw =
    match?.event_date ??
    match?.date ??
    match?.fixture?.date ??
    match?.datetime;

  if (!raw) return null;

  const d = new Date(raw);

  return Number.isNaN(d.getTime()) ? null : d;
}

function isLive(match) {
  const s = statusOf(match);

  return [
    "live",
    "inprogress",
    "in_progress",
    "1h",
    "2h",
    "first_half",
    "second_half",
    "playing",
  ].includes(s);
}

function isHalftime(match) {
  const s = statusOf(match);

  return [
    "ht",
    "halftime",
    "half_time",
    "interval",
    "intervalo",
  ].includes(s);
}

function isFinished(match) {
  const s = statusOf(match);

  return [
    "ft",
    "finished",
    "final",
    "ended",
    "encerrado",
  ].includes(s);
}

function phaseFor(match, journey, now = new Date()) {
  const kickoff = kickoffOf(match);

  if (!kickoff) return "scheduled";

  if (isFinished(match)) {
    return "postgame";
  }

  if (isHalftime(match)) {
    return "halftime";
  }

  if (isLive(match)) {
    const s = statusOf(match);

    if (
      s === "2h" ||
      s === "second_half"
    ) {
      return "second_half";
    }

    return "live";
  }

  const start = new Date(
    kickoff.getTime() -
      journey.config.pregameMinutes * 60000
  );

  if (now >= start && now < kickoff) {
    return "pregame";
  }

  if (now < start) {
    return "scheduled";
  }

  // Horário chegou, mas a fonte ainda não confirmou
  // que a partida começou.
  return "waiting_source";
}

function audioEvent(type, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`,

    type,

    created_at: new Date().toISOString(),

    ...extra,
  };
}

function pushEvent(state, event) {
  state.events.push(event);

  if (state.events.length > 100) {
    state.events =
      state.events.slice(-100);
  }
}

function spokenScore(match) {
  const score = scoreOf(match);

  const home =
    teamName(match, "home") ||
    "Mandante";

  const away =
    teamName(match, "away") ||
    "Visitante";

  if (
    score.home === null ||
    score.away === null
  ) {
    return (
      `${home} e ${away}, ` +
      `partida sem placar disponível.`
    );
  }

  return (
    `${home}, ${score.home}. ` +
    `${away}, ${score.away}.`
  );
}

function brazilTime(date = new Date()) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone: BRAZIL_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

function scoreKey(match) {
  const score = scoreOf(match);

  return (
    `${score.home ?? "x"}:` +
    `${score.away ?? "x"}:` +
    `${statusOf(match)}`
  );
}

function publicMatch(match) {
  const score = scoreOf(match);

  return {
    id: idOf(match),

    league:
      leagueName(match),

    home:
      teamName(match, "home"),

    away:
      teamName(match, "away"),

    home_score:
      score.home,

    away_score:
      score.away,

    status:
      statusOf(match),

    minute:
      minuteOf(match),

    event_date:
      kickoffOf(match)?.toISOString() ??
      null,
  };
}

// =====================================================
// TEMPO E PLACAR
// =====================================================

function buildScoreboardText(
  mainMatch,
  allMatches,
  now
) {
  const live = allMatches
    .filter(
      (match) =>
        isLive(match) ||
        isHalftime(match)
    )
    .slice(0, 12);

  const selected =
    live.length > 0
      ? live
      : [mainMatch].filter(Boolean);

  const lines = selected.map(
    (match) =>
      `${leagueName(match)}. ` +
      `${spokenScore(match)}`
  );

  return {
    time: brazilTime(now),

    text:
      `Agora, ${brazilTime(now)}. ` +
      (
        lines.length
          ? lines.join(" ")
          : "Nenhum outro placar ao vivo disponível neste momento."
      ),

    matches:
      selected.map(publicMatch),
  };
}

// =====================================================
// PLANTÃO RPF
//
// REGRA:
// fala resultados REAIS disponíveis no backend.
//
// 1. partidas em andamento
// 2. partidas no intervalo
// 3. partidas encerradas
//
// Nunca transforma jogo agendado em resultado.
// =====================================================

function buildBreakingBulletin(
  allMatches = [],
  now = new Date()
) {
  const live = allMatches
    .filter(
      (match) =>
        isLive(match) ||
        isHalftime(match)
    )
    .slice(0, 12);

  const finished = allMatches
    .filter(
      (match) =>
        isFinished(match)
    )
    .slice(0, 12);

  const liveLines =
    live.map((match) => {
      const minute =
        minuteOf(match);

      let when =
        "em andamento";

      if (isHalftime(match)) {
        when = "no intervalo";
      } else if (minute !== null) {
        when =
          `aos ${minute} minutos`;
      }

      return (
        `${leagueName(match)}. ` +
        `${spokenScore(match)} ` +
        `${when}.`
      );
    });

  const finishedLines =
    finished.map(
      (match) =>
        `${leagueName(match)}. ` +
        `Encerrado. ` +
        `${spokenScore(match)}`
    );

  const parts = [
    `Plantão RPF. Agora, ${brazilTime(now)}.`,
  ];

  if (liveLines.length) {
    parts.push(
      "Jogos em andamento. " +
        liveLines.join(" ")
    );
  }

  if (finishedLines.length) {
    parts.push(
      "Resultados finais. " +
        finishedLines.join(" ")
    );
  }

  if (
    !liveLines.length &&
    !finishedLines.length
  ) {
    parts.push(
      "Nenhum resultado ao vivo ou encerrado disponível neste momento."
    );
  }

  return {
    time:
      brazilTime(now),

    text:
      parts.join(" "),

    live:
      live.map(publicMatch),

    finished:
      finished.map(publicMatch),
  };
}

// =====================================================
// CRIAÇÃO DA JORNADA
// =====================================================

export function createRpfJourney({
  fixtureId,
  title = null,

  pregameMinutes =
    DEFAULT_CONFIG.pregameMinutes,

  postgameMinutes =
    DEFAULT_CONFIG.postgameMinutes,

  scoreboardEveryMinutes =
    DEFAULT_CONFIG.scoreboardEveryMinutes,
} = {}) {
  if (!fixtureId) {
    throw new Error(
      "fixtureId é obrigatório para criar a Jornada RPF."
    );
  }

  const id =
    String(fixtureId);

  const journey = {
    fixtureId: id,

    title,

    enabled: true,

    created_at:
      new Date().toISOString(),

    config: {
      pregameMinutes,
      postgameMinutes,
      scoreboardEveryMinutes,
    },
  };

  journeys.set(
    id,
    journey
  );

  if (!states.has(id)) {
    states.set(
      id,
      {
        phase:
          "scheduled",

        previousScores:
          new Map(),

        lastScoreboardAt:
          0,

        events:
          [],

        updated_at:
          null,
      }
    );
  }

  return journey;
}

export function removeRpfJourney(
  fixtureId
) {
  const id =
    String(fixtureId);

  journeys.delete(id);
  states.delete(id);

  return true;
}

export function listRpfJourneys() {
  return [
    ...journeys.values(),
  ];
}

export function getRpfJourneyState(
  fixtureId
) {
  const id =
    String(fixtureId);

  const journey =
    journeys.get(id);

  const state =
    states.get(id);

  if (
    !journey ||
    !state
  ) {
    return null;
  }

  return {
    journey,

    state: {
      phase:
        state.phase,

      updated_at:
        state.updated_at,

      events:
        state.events,
    },
  };
}

// =====================================================
// MOTOR PRINCIPAL
// =====================================================

export function updateRpfEngine({
  mainMatch,
  allMatches = [],
  now = new Date(),
} = {}) {
  if (!mainMatch) {
    return null;
  }

  const fixtureId =
    idOf(mainMatch);

  const journey =
    journeys.get(fixtureId);

  if (
    !journey ||
    !journey.enabled
  ) {
    return null;
  }

  const state =
    states.get(fixtureId) ?? {
      phase:
        "scheduled",

      previousScores:
        new Map(),

      lastScoreboardAt:
        0,

      events:
        [],

      updated_at:
        null,
    };

  states.set(
    fixtureId,
    state
  );

  const newPhase =
    phaseFor(
      mainMatch,
      journey,
      now
    );

  // ===================================================
  // MUDANÇAS DE FASE
  // ===================================================

  if (
    newPhase !== state.phase
  ) {
    state.phase =
      newPhase;

    // -----------------------------------------------
    // T-30 — ESQUENTANDO O JOGO
    // -----------------------------------------------

    if (
      newPhase === "pregame"
    ) {
      pushEvent(
        state,
        audioEvent(
          "PRE_GAME_OPEN",
          {
            audio:
              "/audio/rpf/rpf_esquentando_o_jogo_chamada_curta.wav",

            message:
              "Esquentando o Jogo. Começa o pré-jogo da RPF Jornada Esportiva.",
          }
        )
      );

      // ABERTURA DA JORNADA

      pushEvent(
        state,
        audioEvent(
          "JOURNEY_OPEN",
          {
            audio:
              "/audio/rpf/rpf_vinheta_2_chamada_jornada.wav",

            message:
              "Está no ar a RPF Jornada Esportiva.",
          }
        )
      );

      // PRÉ-JOGO FELIPE LIMA

      pushEvent(
        state,
        audioEvent(
          "PRE_GAME_BULLETIN",
          {
            audio:
              "/audio/rpf/rpf_pre_jogo_felipe_lima.wav",
          }
        )
      );

      // BOLETIM PADRÃO ANA / BRENDA

      pushEvent(
        state,
        audioEvent(
          "RPF_STANDARD_BULLETIN",
          {
            audio:
              "/audio/rpf/rpf_boletim_padrao_ana_brenda.wav",
          }
        )
      );
    }

    // -----------------------------------------------
    // BOLA ROLANDO
    // -----------------------------------------------

    if (
      newPhase === "live"
    ) {
      pushEvent(
        state,
        audioEvent(
          "CROWD_START",
          {
            audio:
              "/audio/rpf/torcida_rpf_loop.mp3",

            loop:
              true,

            fade_ms:
              1200,
          }
        )
      );
    }

    // -----------------------------------------------
    // INTERVALO
    // -----------------------------------------------

    if (
      newPhase === "halftime"
    ) {
      pushEvent(
        state,
        audioEvent(
          "HALFTIME",
          {
            duck_crowd:
              true,

            message:
              `Intervalo. ${spokenScore(
                mainMatch
              )}`,
          }
        )
      );
    }

    // -----------------------------------------------
    // SEGUNDO TEMPO
    // -----------------------------------------------

    if (
      newPhase === "second_half"
    ) {
      pushEvent(
        state,
        audioEvent(
          "SECOND_HALF",
          {
            message:
              `Segundo tempo em andamento. ${spokenScore(
                mainMatch
              )}`,
          }
        )
      );
    }

    // -----------------------------------------------
    // FIM + PÓS-JOGO
    // -----------------------------------------------

    if (
      newPhase === "postgame"
    ) {
      pushEvent(
        state,
        audioEvent(
          "FULLTIME",
          {
            duck_crowd:
              true,

            message:
              `Fim de jogo. ${spokenScore(
                mainMatch
              )}`,
          }
        )
      );

      pushEvent(
        state,
        audioEvent(
          "POST_GAME",
          {
            audio:
              "/audio/rpf/rpf_pos_jogo_felipe_lima.wav",

            message:
              `Pós-jogo RPF. Resultado final. ${spokenScore(
                mainMatch
              )}`,
          }
        )
      );
    }
  }

  // ===================================================
  // TEMPO E PLACAR
  // ===================================================

  if (
    [
      "live",
      "second_half",
      "halftime",
    ].includes(newPhase) &&

    now.getTime() -
        state.lastScoreboardAt >=
      journey.config
        .scoreboardEveryMinutes *
        60000
  ) {
    const bulletin =
      buildScoreboardText(
        mainMatch,
        allMatches,
        now
      );

    pushEvent(
      state,
      audioEvent(
        "TIME_AND_SCORE",
        {
          duck_crowd:
            true,

          intro_audio:
            "/audio/rpf/rpf_vinheta_1_tempo_placar.wav",

          ...bulletin,
        }
      )
    );

    state.lastScoreboardAt =
      now.getTime();
  }

  // ===================================================
  // PLANTÃO RPF
  //
  // Detecta mudança REAL no placar de outro jogo.
  // Depois informa:
  //
  // - jogo que mudou
  // - jogos acontecendo
  // - intervalos
  // - resultados encerrados
  // ===================================================

  for (
    const match of allMatches
  ) {
    const otherId =
      idOf(match);

    if (
      !otherId ||
      otherId === fixtureId
    ) {
      continue;
    }

    const currentKey =
      scoreKey(match);

    const previousKey =
      state.previousScores.get(
        otherId
      );

    if (
      previousKey &&
      previousKey !==
        currentKey &&
      (
        isLive(match) ||
        isHalftime(match)
      )
    ) {
      const oldScore =
        previousKey
          .split(":")
          .slice(0, 2)
          .join(":");

      const newScore =
        currentKey
          .split(":")
          .slice(0, 2)
          .join(":");

      // Só dispara por alteração REAL do placar.
      if (
        oldScore !== newScore
      ) {
        const panorama =
          buildBreakingBulletin(
            allMatches,
            now
          );

        pushEvent(
          state,
          audioEvent(
            "RPF_BREAKING",
            {
              duck_crowd:
                true,

              message:
                `Plantão RPF. ` +
                `Alteração no placar. ` +
                `${leagueName(
                  match
                )}. ` +
                `${spokenScore(
                  match
                )} ` +
                panorama.text,

              match:
                publicMatch(
                  match
                ),

              live:
                panorama.live,

              finished:
                panorama.finished,

              bulletin_time:
                panorama.time,
            }
          )
        );
      }
    }

    state.previousScores.set(
      otherId,
      currentKey
    );
  }

  state.updated_at =
    now.toISOString();

  return {
    fixture:
      publicMatch(
        mainMatch
      ),

    journey,

    phase:
      state.phase,

    events:
      state.events,

    updated_at:
      state.updated_at,
  };
}

// =====================================================
// EVENTOS
// =====================================================

export function consumeRpfEvents(
  fixtureId,
  afterId = null
) {
  const state =
    states.get(
      String(fixtureId)
    );

  if (!state) {
    return [];
  }

  if (!afterId) {
    return state.events;
  }

  const index =
    state.events.findIndex(
      (event) =>
        event.id === afterId
    );

  return index >= 0
    ? state.events.slice(
        index + 1
      )
    : state.events;
}

// =====================================================
// INFORMAÇÕES DO MOTOR
// =====================================================

export const RPF_ENGINE_INFO = {
  name:
    "Motor RPF",

  version:
    "1.2.0",

  modes: [
    "RPF Jornada Esportiva",
    "Tempo e Placar RPF",
    "Plantão RPF",
    "Torcida RPF",
    "Momentos do Jogo",
    "Esquentando o Jogo",
    "Pós-Jogo RPF",
  ],

  narration:
    false,

  rule:
    "O motor somente reage a dados reais recebidos das fontes esportivas.",
};

// =====================================================
// PRIORIDADES EDITORIAIS RPF
//
// A = Dupla Gre-Nal + Chelsea
// B = RPF Interior / jogos especiais
// NORMAL = cobertura normal
// =====================================================

const RPF_PRIORITY_A = [
  "gremio",
  "grêmio",
  "internacional",
  "sport club internacional",
  "chelsea",
  "chelsea fc",
];

const RPF_PRIORITY_B = [
  "brasil de pelotas",
  "brasil-pel",
  "gremio esportivo brasil",
  "grêmio esportivo brasil",
  "pelotas",
  "esporte clube pelotas",
  "gramadense",
  "veranopolis",
  "veranópolis",
];

function normalizeRpfName(
  value = ""
) {
  return String(value)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function matchesRpfTeam(
  team,
  list
) {
  const name =
    normalizeRpfName(team);

  if (!name) {
    return false;
  }

  return list.some(
    (candidate) => {
      const target =
        normalizeRpfName(
          candidate
        );

      return (
        name === target ||
        name.includes(target) ||
        target.includes(name)
      );
    }
  );
}

export function getRpfPriority(
  match
) {
  const home =
    teamName(
      match,
      "home"
    );

  const away =
    teamName(
      match,
      "away"
    );

  if (
    matchesRpfTeam(
      home,
      RPF_PRIORITY_A
    ) ||
    matchesRpfTeam(
      away,
      RPF_PRIORITY_A
    )
  ) {
    return {
      level:
        "A",

      autoJourneyCandidate:
        true,

      reason:
        "Dupla Gre-Nal / Chelsea",
    };
  }

  if (
    matchesRpfTeam(
      home,
      RPF_PRIORITY_B
    ) ||
    matchesRpfTeam(
      away,
      RPF_PRIORITY_B
    )
  ) {
    return {
      level:
        "B",

      autoJourneyCandidate:
        true,

      reason:
        "RPF Interior / jogo especial",
    };
  }

  return {
    level:
      "NORMAL",

    autoJourneyCandidate:
      false,

    reason:
      "Cobertura normal do RPF Placar",
  };
}

export function findRpfJourneyCandidates(
  matches = []
) {
  if (
    !Array.isArray(matches)
  ) {
    return [];
  }

  return matches
    .map(
      (match) => ({
        match:
          publicMatch(
            match
          ),

        priority:
          getRpfPriority(
            match
          ),
      })
    )

    .filter(
      (item) =>
        item.priority
          .autoJourneyCandidate
    )

    .sort(
      (a, b) => {
        const weight = {
          A: 1,
          B: 2,
          C: 3,
          NORMAL: 9,
        };

        return (
          (
            weight[
              a.priority.level
            ] ?? 9
          ) -
          (
            weight[
              b.priority.level
            ] ?? 9
          )
        );
      }
    );
}

export function autoRegisterPriorityJourneys(
  matches = []
) {
  const candidates =
    findRpfJourneyCandidates(
      matches
    );

  const registered = [];

  for (
    const item of candidates
  ) {
    const fixtureId =
      item.match.id;

    if (!fixtureId) {
      continue;
    }

    if (
      !journeys.has(
        String(fixtureId)
      )
    ) {
      const journey =
        createRpfJourney({
          fixtureId,

          title:
            `${item.match.home} x ` +
            `${item.match.away}`,
        });

      registered.push({
        ...journey,

        priority:
          item.priority,
      });
    }
  }

  return {
    candidates:
      candidates.length,

    registered:
      registered.length,

    journeys:
      registered,
  };
}
