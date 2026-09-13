/* =========================================================
   RÁDIOPLACAR - JOGOS DO ESCURO
   Módulo separado da BSD
========================================================= */

const darkGames = new Map();

/* =========================================================
   CRIAR / ATUALIZAR JOGO
========================================================= */

export function saveDarkGame(game) {
  if (!game?.id) {
    throw new Error("Jogo sem ID");
  }

  if (!game?.home?.name || !game?.away?.name) {
    throw new Error("Times do jogo não informados");
  }

  const current = darkGames.get(String(game.id));

  const savedGame = {
    id: String(game.id),

    source: game.source || "external",

    competition: {
      id: game.competition?.id || null,
      name: game.competition?.name || "Competição",
      country: game.competition?.country || "Brazil"
    },

    home: {
      id: game.home?.id || null,
      name: game.home.name,
      logo: game.home?.logo || null
    },

    away: {
      id: game.away?.id || null,
      name: game.away.name,
      logo: game.away?.logo || null
    },

    date: game.date || null,

    status: game.status || "scheduled",

    score: {
      home:
        Number.isInteger(game.score?.home)
          ? game.score.home
          : current?.score?.home ?? 0,

      away:
        Number.isInteger(game.score?.away)
          ? game.score.away
          : current?.score?.away ?? 0
    },

    radio: game.radio || current?.radio || null,

    score_source:
      game.score_source ||
      current?.score_source ||
      "waiting",

    score_confidence:
      typeof game.score_confidence === "number"
        ? game.score_confidence
        : current?.score_confidence ?? 0,

    score_verified:
      typeof game.score_verified === "boolean"
        ? game.score_verified
        : current?.score_verified ?? false,

    last_event:
      game.last_event ||
      current?.last_event ||
      null,

    updated_at: new Date().toISOString()
  };

  darkGames.set(savedGame.id, savedGame);

  return savedGame;
}

/* =========================================================
   LISTAR JOGOS
========================================================= */

export function getDarkGames(date = null) {
  let games = [...darkGames.values()];

  if (date) {
    games = games.filter((game) => {
      if (!game.date) return false;

      return String(game.date).slice(0, 10) === date;
    });
  }

  return games.sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();

    return dateA - dateB;
  });
}

/* =========================================================
   BUSCAR UM JOGO
========================================================= */

export function getDarkGame(id) {
  return darkGames.get(String(id)) || null;
}

/* =========================================================
   VINCULAR RÁDIO
========================================================= */

export function attachRadioToDarkGame(id, radio) {
  const game = getDarkGame(id);

  if (!game) {
    throw new Error("Jogo não encontrado");
  }

  if (!radio?.name || !radio?.stream) {
    throw new Error("Rádio ou stream não informado");
  }

  game.radio = {
    id: radio.id || null,
    name: radio.name,
    stream: radio.stream,
    official: Boolean(radio.official),
    match_confirmed: Boolean(radio.match_confirmed)
  };

  game.updated_at = new Date().toISOString();

  darkGames.set(String(id), game);

  return game;
}

/* =========================================================
   EVENTO DETECTADO PELA NARRAÇÃO
========================================================= */

export function applyRadioScoreEvent(id, event) {
  const game = getDarkGame(id);

  if (!game) {
    throw new Error("Jogo não encontrado");
  }

  /*
    Segurança:
    NÃO muda o placar somente porque ouviu "gol".

    O evento precisa:
    - estar confirmado;
    - indicar o time;
    - possuir placar;
    - atingir confiança mínima.
  */

  if (event?.confirmed !== true) {
    return {
      changed: false,
      reason: "Evento ainda não confirmado",
      game
    };
  }

  const confidence = Number(event?.confidence || 0);

  if (confidence < 0.9) {
    return {
      changed: false,
      reason: "Confiança insuficiente",
      game
    };
  }

  const homeScore = Number(event?.score?.home);
  const awayScore = Number(event?.score?.away);

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    return {
      changed: false,
      reason: "Placar inválido",
      game
    };
  }

  /*
    Impede a narração de diminuir o placar
    por engano.

    Correções/anulações serão tratadas
    separadamente depois.
  */

  if (
    homeScore < game.score.home ||
    awayScore < game.score.away
  ) {
    return {
      changed: false,
      reason: "Evento reduziria o placar atual",
      game
    };
  }

  const changed =
    homeScore !== game.score.home ||
    awayScore !== game.score.away;

  if (!changed) {
    return {
      changed: false,
      reason: "Placar já estava atualizado",
      game
    };
  }

  game.score = {
    home: homeScore,
    away: awayScore
  };

  game.score_source = "radio";
  game.score_confidence = confidence;
  game.score_verified = false;

  game.last_event = {
    type: event.type || "goal",
    team: event.team || null,
    transcript: event.transcript || null,
    detected_at: new Date().toISOString()
  };

  game.updated_at = new Date().toISOString();

  darkGames.set(String(id), game);

  return {
    changed: true,
    game
  };
}

/* =========================================================
   LIMPAR JOGOS ANTIGOS DA MEMÓRIA
========================================================= */

export function clearDarkGames() {
  darkGames.clear();

  return {
    ok: true
  };
}
