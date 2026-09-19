// backend/rpf-engine.js
// ============================================================
// RPF PLACAR — MOTOR RPF JORNADA ESPORTIVA
// Versão 1.3.0
// ============================================================
//
// JORNADA PADRÃO RPF
//
// T-30
//   1. Esquentando o Jogo
//   2. Abertura RPF Jornada Esportiva
//   3. Pré-Jogo
//   4. Boletim Padrão
//   5. RPF Notícias
//   6. RPF Internacional
//   7. RPF Interior
//   8. Escalações oficiais — somente se confirmadas
//   9. Contagem regressiva
//
// BOLA ROLANDO
//   - Ambiente de estádio
//   - Tempo e Placar
//   - Plantão RPF
//   - Gol real
//
// INTERVALO
// SEGUNDO TEMPO
// FIM DE JOGO
// PÓS-JOGO
//
// REGRA PRINCIPAL:
// O modo REAL nunca inventa gol, placar, minuto ou resultado.
// O modo TESTE usa dados marcados explicitamente como simulação.
//
// ============================================================

const journeys = new Map();
const states = new Map();
const testSessions = new Map();

const BRAZIL_TZ = "America/Sao_Paulo";

const DEFAULT_CONFIG = {
  pregameMinutes: 30,
  postgameMinutes: 30,
  scoreboardEveryMinutes: 15,
};

// ============================================================
// ÁUDIOS RPF
// Todos devem estar em:
// frontend/public/audio/rpf/
// ============================================================

export const RPF_AUDIO = Object.freeze({
  PRE_GAME_OPEN:
    "/audio/rpf/rpf_esquentando_o_jogo_chamada_curta.wav",

  JOURNEY_OPEN:
    "/audio/rpf/rpf_vinheta_2_chamada_jornada.wav",

  PRE_GAME_BULLETIN:
    "/audio/rpf/rpf_pre_jogo_felipe_lima.wav",

  STANDARD_BULLETIN:
    "/audio/rpf/rpf_boletim_padrao_ana_brenda.wav",

  RPF_NEWS:
    "/audio/rpf/rpf_noticias_esportiva.mp3",

  RPF_INTERNATIONAL:
    "/audio/rpf/rpf_internacional_esportiva.mp3",

  RPF_INTERIOR:
    "/audio/rpf/rpf_interior_esportiva.mp3",

  TIME_AND_SCORE:
    "/audio/rpf/rpf_vinheta_1_tempo_placar.wav",

  BREAKING:
    "/audio/rpf/rpf_01_plantao.wav",

  GOAL_STING:
    "/audio/rpf/Vinheta de Esporte para Rádio (Grito de gol).mp3",

  STADIUM:
    "/audio/rpf/SONS DE ESTÁDIO DOWNLOAD ALTA QUALIDADE.mp3",

  GOAL_CROWD:
    "/audio/rpf/som de torcida na hora do gol grito de torcida na hora do gol..mp3",

  HALFTIME:
    "/audio/rpf/rpf_02_intervalo.wav",

  SECOND_HALF:
    "/audio/rpf/rpf_03_segundo_tempo.wav",

  FULLTIME:
    "/audio/rpf/rpf_04_fim_de_jogo.wav",

  POST_GAME:
    "/audio/rpf/rpf_pos_jogo_felipe_lima.wav",
});

// ============================================================
// UTILITÁRIOS
// ============================================================

function clean(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function num(value) {
  const n = Number(value);
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

function isSecondHalf(match) {
  const s = statusOf(match);

  return [
    "2h",
    "second_half",
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
    if (isSecondHalf(match)) {
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
  // que a bola rolou.
  return "waiting_source";
}

function audioEvent(type, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`,

    type,

    created_at: new Date().toISOString(),

    ...extra,
  };
}

function pushEvent(state, event) {
  state.events.push(event);

  // Evita crescer indefinidamente na memória.
  if (state.events.length > 200) {
    state.events = state.events.slice(-200);
  }
}

function spokenScore(match) {
  const score = scoreOf(match);

  const home =
    teamName(match, "home") || "Mandante";

  const away =
    teamName(match, "away") || "Visitante";

  if (
    score.home === null ||
    score.away === null
  ) {
    return `${home} e ${away}, partida sem placar disponível.`;
  }

  return `${home}, ${score.home}. ${away}, ${score.away}.`;
}

function brazilTime(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function scoreKey(match) {
  const score = scoreOf(match);

  return `${score.home ?? "x"}:${score.away ?? "x"}`;
}

function totalGoals(match) {
  const score = scoreOf(match);

  if (
    score.home === null ||
    score.away === null
  ) {
    return null;
  }

  return score.home + score.away;
}

function publicMatch(match) {
  if (!match) return null;

  const score = scoreOf(match);

  return {
    id: idOf(match),

    league: leagueName(match),

    home: teamName(match, "home"),

    away: teamName(match, "away"),

    home_score: score.home,

    away_score: score.away,

    status: statusOf(match),

    minute: minuteOf(match),

    event_date:
      kickoffOf(match)?.toISOString() ?? null,
  };
}

// ============================================================
// TEMPO E PLACAR
// ============================================================

function buildScoreboardText(
  mainMatch,
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

  const selected =
    live.length > 0
      ? live
      : [mainMatch].filter(Boolean);

  const lines = selected.map((match) => {
    const minute = minuteOf(match);

    let when = "";

    if (isHalftime(match)) {
      when = " No intervalo.";
    } else if (minute !== null) {
      when = ` Aos ${minute} minutos.`;
    }

    return (
      `${leagueName(match)}. ` +
      `${spokenScore(match)}` +
      when
    );
  });

  return {
    time: brazilTime(now),

    text:
      `Agora, ${brazilTime(now)}. ` +
      (
        lines.length
          ? lines.join(" ")
          : "Nenhum placar ao vivo disponível neste momento."
      ),

    matches:
      selected.map(publicMatch),
  };
}

// ============================================================
// PLANTÃO RPF
//
// REGRA:
// - somente jogos reais recebidos pelo backend;
// - jogos AO VIVO / INTERVALO;
// - jogos ENCERRADOS;
// - NÃO fala jogos agendados como resultado.
// ============================================================

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
    .filter(isFinished)
    .slice(0, 12);

  const liveLines = live.map((match) => {
    const minute = minuteOf(match);

    let when = "em andamento";

    if (isHalftime(match)) {
      when = "no intervalo";
    } else if (minute !== null) {
      when = `aos ${minute} minutos`;
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
    `Agora, ${brazilTime(now)}.`,
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
    time: brazilTime(now),

    text: parts.join(" "),

    live: live.map(publicMatch),

    finished:
      finished.map(publicMatch),
  };
}

// ============================================================
// CRIAÇÃO / CONTROLE DA JORNADA
// ============================================================

function createInitialState() {
  return {
    phase: "scheduled",

    previousScores: new Map(),

    mainScoreInitialized: false,

    previousMainScore: null,

    previousMainGoals: null,

    lastScoreboardAt: 0,

    events: [],

    updated_at: null,
  };
}

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

  const id = String(fixtureId);

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

  journeys.set(id, journey);

  if (!states.has(id)) {
    states.set(
      id,
      createInitialState()
    );
  }

  return journey;
}

export function removeRpfJourney(
  fixtureId
) {
  const id = String(fixtureId);

  journeys.delete(id);
  states.delete(id);
  testSessions.delete(id);

  return true;
}

export function listRpfJourneys() {
  return [...journeys.values()];
}

export function getRpfJourneyState(
  fixtureId
) {
  const id = String(fixtureId);

  const journey =
    journeys.get(id);

  const state =
    states.get(id);

  if (!journey || !state) {
    return null;
  }

  return {
    journey,

    state: {
      phase: state.phase,

      updated_at:
        state.updated_at,

      events:
        state.events,
    },
  };
}

// ============================================================
// PRÉ-JOGO PADRÃO
// ============================================================

function queuePregame(
  state,
  mainMatch
) {
  pushEvent(
    state,
    audioEvent("PRE_GAME_OPEN", {
      order: 10,

      audio:
        RPF_AUDIO.PRE_GAME_OPEN,

      message:
        "Esquentando o Jogo. Começa o pré-jogo da RPF Jornada Esportiva.",

      fixture:
        publicMatch(mainMatch),
    })
  );

  pushEvent(
    state,
    audioEvent("JOURNEY_OPEN", {
      order: 20,

      audio:
        RPF_AUDIO.JOURNEY_OPEN,

      message:
        "Está no ar a RPF Jornada Esportiva.",
    })
  );

  pushEvent(
    state,
    audioEvent(
      "PRE_GAME_BULLETIN",
      {
        order: 30,

        audio:
          RPF_AUDIO.PRE_GAME_BULLETIN,
      }
    )
  );

  pushEvent(
    state,
    audioEvent(
      "RPF_STANDARD_BULLETIN",
      {
        order: 40,

        audio:
          RPF_AUDIO.STANDARD_BULLETIN,
      }
    )
  );

  pushEvent(
    state,
    audioEvent("RPF_NEWS", {
      order: 50,

      audio:
        RPF_AUDIO.RPF_NEWS,
    })
  );

  pushEvent(
    state,
    audioEvent(
      "RPF_INTERNATIONAL",
      {
        order: 60,

        audio:
          RPF_AUDIO.RPF_INTERNATIONAL,
      }
    )
  );

  pushEvent(
    state,
    audioEvent("RPF_INTERIOR", {
      order: 70,

      audio:
        RPF_AUDIO.RPF_INTERIOR,
    })
  );

  // Escalações são dinâmicas.
  // O frontend/backend só deve falar quando
  // houver escalação oficialmente confirmada.
  pushEvent(
    state,
    audioEvent(
      "WAIT_OFFICIAL_LINEUPS",
      {
        order: 80,

        dynamic: true,

        speak_only_if_confirmed:
          true,

        message:
          "Aguardando escalações oficiais.",
      }
    )
  );

  // Não usamos gravação fixa para a
  // contagem regressiva.
  pushEvent(
    state,
    audioEvent(
      "COUNTDOWN_READY",
      {
        order: 90,

        dynamic: true,

        message:
          "Contagem regressiva preparada para o início da partida.",
      }
    )
  );
}

// ============================================================
// GOL DA PARTIDA PRINCIPAL
// ============================================================

function detectMainGoal(
  state,
  mainMatch,
  now
) {
  if (
    !isLive(mainMatch) &&
    !isHalftime(mainMatch)
  ) {
    return;
  }

  const currentScore =
    scoreOf(mainMatch);

  const currentGoals =
    totalGoals(mainMatch);

  if (
    currentScore.home === null ||
    currentScore.away === null ||
    currentGoals === null
  ) {
    return;
  }

  if (!state.mainScoreInitialized) {
    state.mainScoreInitialized =
      true;

    state.previousMainScore =
      scoreKey(mainMatch);

    state.previousMainGoals =
      currentGoals;

    return;
  }

  const previousGoals =
    state.previousMainGoals;

  const previousScore =
    state.previousMainScore;

  const currentKey =
    scoreKey(mainMatch);

  // Só considera GOL quando o total
  // aumenta.
  //
  // Correção de placar para baixo NÃO
  // dispara grito de gol.
  if (
    previousGoals !== null &&
    currentGoals > previousGoals
  ) {
    const minute =
      minuteOf(mainMatch);

    let scoringSide = null;

    if (previousScore) {
      const parts =
        previousScore.split(":");

      const previousHome =
        num(parts[0]);

      const previousAway =
        num(parts[1]);

      if (
        previousHome !== null &&
        currentScore.home >
          previousHome
      ) {
        scoringSide = "home";
      }

      if (
        previousAway !== null &&
        currentScore.away >
          previousAway
      ) {
        scoringSide = "away";
      }
    }

    const scoringTeam =
      scoringSide === "home"
        ? teamName(
            mainMatch,
            "home"
          )
        : scoringSide === "away"
          ? teamName(
              mainMatch,
              "away"
            )
          : null;

    const minuteText =
      minute !== null
        ? ` aos ${minute} minutos`
        : "";

    const teamText =
      scoringTeam
        ? ` Gol do ${scoringTeam}${minuteText}.`
        : ` Gol confirmado${minuteText}.`;

    pushEvent(
      state,
      audioEvent("GOAL", {
        duck_crowd: true,

        goal_sting:
          RPF_AUDIO.GOAL_STING,

        goal_crowd:
          RPF_AUDIO.GOAL_CROWD,

        resume_crowd:
          RPF_AUDIO.STADIUM,

        scoring_side:
          scoringSide,

        scoring_team:
          scoringTeam,

        minute,

        score: {
          home:
            currentScore.home,

          away:
            currentScore.away,
        },

        message:
          `${teamText} ` +
          `${spokenScore(mainMatch)}`,

        fixture:
          publicMatch(mainMatch),

        detected_at:
          now.toISOString(),
      })
    );
  }

  state.previousMainGoals =
    currentGoals;

  state.previousMainScore =
    currentKey;
}

// ============================================================
// MOTOR REAL
// ============================================================

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

  if (!fixtureId) {
    return null;
  }

  const journey =
    journeys.get(fixtureId);

  if (
    !journey ||
    !journey.enabled
  ) {
    return null;
  }

  let state =
    states.get(fixtureId);

  if (!state) {
    state =
      createInitialState();

    states.set(
      fixtureId,
      state
    );
  }

  const newPhase =
    phaseFor(
      mainMatch,
      journey,
      now
    );

  // ========================================================
  // MUDANÇA DE FASE
  // ========================================================

  if (newPhase !== state.phase) {
    state.phase = newPhase;

    if (
      newPhase === "pregame"
    ) {
      queuePregame(
        state,
        mainMatch
      );
    }

    if (
      newPhase === "live"
    ) {
      // Inicializa o placar antes de
      // começar a detectar alterações.
      const goals =
        totalGoals(mainMatch);

      if (
        goals !== null &&
        !state.mainScoreInitialized
      ) {
        state.mainScoreInitialized =
          true;

        state.previousMainGoals =
          goals;

        state.previousMainScore =
          scoreKey(mainMatch);
      }

      pushEvent(
        state,
        audioEvent(
          "MATCH_STARTED",
          {
            message:
              "Bola rolando. Começa a partida.",

            fixture:
              publicMatch(mainMatch),
          }
        )
      );

      pushEvent(
        state,
        audioEvent(
          "CROWD_START",
          {
            audio:
              RPF_AUDIO.STADIUM,

            loop: true,

            fade_ms: 1200,
          }
        )
      );
    }

    if (
      newPhase === "halftime"
    ) {
      pushEvent(
        state,
        audioEvent(
          "HALFTIME",
          {
            duck_crowd: true,

            stop_crowd: true,

            audio:
              RPF_AUDIO.HALFTIME,

            message:
              `Intervalo. ${spokenScore(
                mainMatch
              )}`,

            fixture:
              publicMatch(mainMatch),
          }
        )
      );
    }

    if (
      newPhase ===
      "second_half"
    ) {
      pushEvent(
        state,
        audioEvent(
          "SECOND_HALF",
          {
            audio:
              RPF_AUDIO.SECOND_HALF,

            message:
              `Segundo tempo. ${spokenScore(
                mainMatch
              )}`,

            fixture:
              publicMatch(mainMatch),
          }
        )
      );

      pushEvent(
        state,
        audioEvent(
          "CROWD_RESUME",
          {
            audio:
              RPF_AUDIO.STADIUM,

            loop: true,

            fade_ms: 1200,
          }
        )
      );
    }

    if (
      newPhase === "postgame"
    ) {
      pushEvent(
        state,
        audioEvent(
          "FULLTIME",
          {
            duck_crowd: true,

            stop_crowd: true,

            audio:
              RPF_AUDIO.FULLTIME,

            message:
              `Fim de jogo. ${spokenScore(
                mainMatch
              )}`,

            fixture:
              publicMatch(mainMatch),
          }
        )
      );

      pushEvent(
        state,
        audioEvent(
          "POST_GAME",
          {
            audio:
              RPF_AUDIO.POST_GAME,

            message:
              `Pós-jogo RPF. Resultado final. ${spokenScore(
                mainMatch
              )}`,

            fixture:
              publicMatch(mainMatch),
          }
        )
      );
    }
  }

  // ========================================================
  // GOL DA PARTIDA PRINCIPAL
  // ========================================================

  detectMainGoal(
    state,
    mainMatch,
    now
  );

  // ========================================================
  // TEMPO E PLACAR
  // ========================================================

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
          duck_crowd: true,

          intro_audio:
            RPF_AUDIO.TIME_AND_SCORE,

          ...bulletin,
        }
      )
    );

    state.lastScoreboardAt =
      now.getTime();
  }

  // ========================================================
  // PLANTÃO RPF
  // ========================================================

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
        previousKey;

      const newScore =
        currentKey;

      // Só dispara Plantão se
      // realmente mudou o placar.
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
              duck_crowd: true,

              intro_audio:
                RPF_AUDIO.BREAKING,

              message:
                `Alteração no placar. ` +
                `${leagueName(
                  match
                )}. ` +
                `${spokenScore(
                  match
                )} ` +
                `${panorama.text}`,

              match:
                publicMatch(match),

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
      publicMatch(mainMatch),

    journey,

    phase:
      state.phase,

    events:
      state.events,

    updated_at:
      state.updated_at,
  };
}

// ============================================================
// ESCALAÇÕES OFICIAIS
//
// O server.js pode chamar esta função quando tiver confirmação.
// ============================================================

export function pushRpfOfficialLineups({
  fixtureId,

  homeLineup = null,

  awayLineup = null,

  message = null,
} = {}) {
  const id =
    String(fixtureId ?? "");

  if (!id) return null;

  const state =
    states.get(id);

  if (!state) return null;

  const hasHome =
    Array.isArray(homeLineup) &&
    homeLineup.length > 0;

  const hasAway =
    Array.isArray(awayLineup) &&
    awayLineup.length > 0;

  if (
    !hasHome &&
    !hasAway &&
    !message
  ) {
    return null;
  }

  const event =
    audioEvent(
      "OFFICIAL_LINEUPS",
      {
        dynamic: true,

        confirmed: true,

        home_lineup:
          hasHome
            ? homeLineup
            : null,

        away_lineup:
          hasAway
            ? awayLineup
            : null,

        message:
          message ||
          "Escalações oficiais confirmadas.",
      }
    );

  pushEvent(
    state,
    event
  );

  return event;
}

// ============================================================
// CONTAGEM REGRESSIVA
//
// Chamada pelo server/frontend quando houver confirmação
// de que o jogo está prestes a iniciar.
// ============================================================

export function pushRpfCountdown({
  fixtureId,

  seconds = 10,
} = {}) {
  const id =
    String(fixtureId ?? "");

  const state =
    states.get(id);

  if (!state) return null;

  const safeSeconds =
    Math.max(
      1,
      Math.min(
        60,
        Number(seconds) || 10
      )
    );

  const event =
    audioEvent(
      "COUNTDOWN",
      {
        dynamic: true,

        seconds:
          safeSeconds,

        message:
          `Contagem regressiva. ${safeSeconds} segundos para a bola rolar.`,
      }
    );

  pushEvent(
    state,
    event
  );

  return event;
}

// ============================================================
// CONSUMO DOS EVENTOS
// ============================================================

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

// ============================================================
// MODO TESTE DA JORNADA
//
// IMPORTANTE:
// - não altera os dados reais do jogo;
// - não grava placar falso como resultado;
// - eventos vêm com test_mode: true;
// - serve somente para testar áudio/interface.
//
// Sequência:
// PRE_GAME
// LIVE
// GOAL
// BREAKING
// HALFTIME
// SECOND_HALF
// FULLTIME
// POST_GAME
// ============================================================

const TEST_STEPS = [
  "PRE_GAME",
  "LIVE",
  "GOAL",
  "BREAKING",
  "HALFTIME",
  "SECOND_HALF",
  "FULLTIME",
  "POST_GAME",
];

function getOrCreateTestSession(
  fixtureId
) {
  const id =
    String(
      fixtureId ||
        "rpf-test"
    );

  if (
    !testSessions.has(id)
  ) {
    testSessions.set(
      id,
      {
        fixtureId: id,

        active: true,

        step: -1,

        created_at:
          new Date()
            .toISOString(),

        events: [],
      }
    );
  }

  return testSessions.get(id);
}

function pushTestEvent(
  session,
  type,
  extra = {}
) {
  const event =
    audioEvent(
      type,
      {
        test_mode: true,

        ...extra,
      }
    );

  session.events.push(event);

  if (
    session.events.length >
    200
  ) {
    session.events =
      session.events.slice(
        -200
      );
  }

  return event;
}

export function startRpfJourneyTest({
  fixtureId = "rpf-test",
} = {}) {
  const id =
    String(fixtureId);

  const session = {
    fixtureId: id,

    active: true,

    step: -1,

    created_at:
      new Date()
        .toISOString(),

    events: [],
  };

  testSessions.set(
    id,
    session
  );

  return {
    ok: true,

    test_mode: true,

    fixtureId: id,

    next_step:
      TEST_STEPS[0],

    session,
  };
}

export function nextRpfJourneyTestStep({
  fixtureId = "rpf-test",
} = {}) {
  const session =
    getOrCreateTestSession(
      fixtureId
    );

  session.step += 1;

  if (
    session.step >=
    TEST_STEPS.length
  ) {
    session.active =
      false;

    return {
      ok: true,

      test_mode: true,

      finished: true,

      message:
        "Teste completo da Jornada RPF finalizado.",

      events:
        session.events,
    };
  }

  const step =
    TEST_STEPS[
      session.step
    ];

  const emitted = [];

  if (
    step === "PRE_GAME"
  ) {
    emitted.push(
      pushTestEvent(
        session,
        "PRE_GAME_OPEN",
        {
          order: 10,

          audio:
            RPF_AUDIO.PRE_GAME_OPEN,

          message:
            "TESTE RPF. Esquentando o Jogo.",
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "JOURNEY_OPEN",
        {
          order: 20,

          audio:
            RPF_AUDIO.JOURNEY_OPEN,
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "PRE_GAME_BULLETIN",
        {
          order: 30,

          audio:
            RPF_AUDIO.PRE_GAME_BULLETIN,
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "RPF_STANDARD_BULLETIN",
        {
          order: 40,

          audio:
            RPF_AUDIO.STANDARD_BULLETIN,
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "RPF_NEWS",
        {
          order: 50,

          audio:
            RPF_AUDIO.RPF_NEWS,
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "RPF_INTERNATIONAL",
        {
          order: 60,

          audio:
            RPF_AUDIO.RPF_INTERNATIONAL,
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "RPF_INTERIOR",
        {
          order: 70,

          audio:
            RPF_AUDIO.RPF_INTERIOR,
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "COUNTDOWN",
        {
          order: 90,

          dynamic: true,

          seconds: 10,

          message:
            "Teste da contagem regressiva. Dez segundos para a bola rolar.",
        }
      )
    );
  }

  if (step === "LIVE") {
    emitted.push(
      pushTestEvent(
        session,
        "MATCH_STARTED",
        {
          message:
            "TESTE RPF. Bola rolando.",
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "CROWD_START",
        {
          audio:
            RPF_AUDIO.STADIUM,

          loop: true,

          fade_ms: 1200,
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "TIME_AND_SCORE",
        {
          intro_audio:
            RPF_AUDIO.TIME_AND_SCORE,

          duck_crowd: true,

          message:
            "Teste do Tempo e Placar RPF. Sem resultado real associado.",
        }
      )
    );
  }

  if (step === "GOAL") {
    emitted.push(
      pushTestEvent(
        session,
        "GOAL",
        {
          duck_crowd: true,

          goal_sting:
            RPF_AUDIO.GOAL_STING,

          goal_crowd:
            RPF_AUDIO.GOAL_CROWD,

          resume_crowd:
            RPF_AUDIO.STADIUM,

          scoring_team:
            "TIME DE TESTE",

          score: {
            home: 1,
            away: 0,
          },

          message:
            "TESTE DE ÁUDIO. Gol da Jornada RPF. Este placar é apenas uma simulação de teste.",
        }
      )
    );
  }

  if (
    step === "BREAKING"
  ) {
    emitted.push(
      pushTestEvent(
        session,
        "RPF_BREAKING",
        {
          intro_audio:
            RPF_AUDIO.BREAKING,

          duck_crowd: true,

          message:
            "TESTE DE ÁUDIO DO PLANTÃO RPF. Nenhum resultado real está sendo anunciado neste teste.",
        }
      )
    );
  }

  if (
    step === "HALFTIME"
  ) {
    emitted.push(
      pushTestEvent(
        session,
        "HALFTIME",
        {
          audio:
            RPF_AUDIO.HALFTIME,

          duck_crowd: true,

          stop_crowd: true,

          message:
            "TESTE RPF. Intervalo.",
        }
      )
    );
  }

  if (
    step ===
    "SECOND_HALF"
  ) {
    emitted.push(
      pushTestEvent(
        session,
        "SECOND_HALF",
        {
          audio:
            RPF_AUDIO.SECOND_HALF,

          message:
            "TESTE RPF. Segundo tempo.",
        }
      )
    );

    emitted.push(
      pushTestEvent(
        session,
        "CROWD_RESUME",
        {
          audio:
            RPF_AUDIO.STADIUM,

          loop: true,
        }
      )
    );
  }

  if (
    step === "FULLTIME"
  ) {
    emitted.push(
      pushTestEvent(
        session,
        "FULLTIME",
        {
          audio:
            RPF_AUDIO.FULLTIME,

          duck_crowd: true,

          stop_crowd: true,

          message:
            "TESTE RPF. Fim de jogo.",
        }
      )
    );
  }

  if (
    step === "POST_GAME"
  ) {
    emitted.push(
      pushTestEvent(
        session,
        "POST_GAME",
        {
          audio:
            RPF_AUDIO.POST_GAME,

          message:
            "TESTE RPF. Pós-jogo.",
        }
      )
    );
  }

  const nextStep =
    TEST_STEPS[
      session.step + 1
    ] ?? null;

  return {
    ok: true,

    test_mode: true,

    fixtureId:
      session.fixtureId,

    step,

    next_step:
      nextStep,

    emitted,

    total_events:
      session.events.length,
  };
}

export function getRpfJourneyTest({
  fixtureId = "rpf-test",
} = {}) {
  const session =
    testSessions.get(
      String(fixtureId)
    );

  if (!session) {
    return null;
  }

  return {
    ...session,

    current_step:
      session.step >= 0
        ? TEST_STEPS[
            session.step
          ] ?? null
        : null,

    next_step:
      TEST_STEPS[
        session.step + 1
      ] ?? null,
  };
}

export function resetRpfJourneyTest({
  fixtureId = "rpf-test",
} = {}) {
  const id =
    String(fixtureId);

  testSessions.delete(id);

  return {
    ok: true,

    test_mode: true,

    fixtureId: id,

    reset: true,
  };
}

// ============================================================
// PRIORIDADES EDITORIAIS RPF
//
// A = Dupla Gre-Nal + Chelsea
// B = RPF Interior / jogos especiais
// NORMAL = cobertura normal
// ============================================================

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
        name.includes(
          target
        ) ||
        target.includes(
          name
        )
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
      level: "A",

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
      level: "B",

      autoJourneyCandidate:
        true,

      reason:
        "RPF Interior / jogo especial",
    };
  }

  return {
    level: "NORMAL",

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
    .map((match) => ({
      match:
        publicMatch(match),

      priority:
        getRpfPriority(
          match
        ),
    }))

    .filter(
      (item) =>
        item.priority
          .autoJourneyCandidate
    )

    .sort((a, b) => {
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
    });
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
            `${item.match.home} x ${item.match.away}`,
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

// ============================================================
// INFORMAÇÕES DO MOTOR
// ============================================================

export const RPF_ENGINE_INFO = {
  name:
    "Motor RPF",

  version:
    "1.3.0",

  modes: [
    "RPF Jornada Esportiva",
    "Pré-Jogo T-30",
    "Tempo e Placar RPF",
    "Plantão RPF",
    "Gol RPF",
    "Torcida RPF",
    "Intervalo",
    "Segundo Tempo",
    "Fim de Jogo",
    "Pós-Jogo RPF",
    "Modo Teste Jornada",
  ],

  narration: false,

  pregame_minutes: 30,

  test_mode_available:
    true,

  rule:
    "O modo real somente reage a dados reais recebidos das fontes esportivas. O modo de teste é identificado explicitamente e não altera resultados reais.",
};
