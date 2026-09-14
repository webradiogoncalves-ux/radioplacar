// backend/server.js

import express from "express";
import cors from "cors";

import {
  getRadios,
  getRadio,
  getRadiosForMatch,
  attachRadioToMatch,
  detachRadioFromMatch,
  clearMatchRadios,
  getRadioStats,
} from "./radios.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ======================================================
// BSD - BZZOIRO SPORTS DATA
// ======================================================

const API_BASE = "https://sports.bzzoiro.com/api/v2";

// Mantemos o mesmo nome que já está no Render.
const API_KEY = process.env.API_FOOTBALL_KEY;

const cache = new Map();

function cacheGet(key) {
  const item = cache.get(key);

  if (!item) return null;

  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

function cacheSet(key, data, ttlMs) {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs,
  });

  return data;
}


// ======================================================
// DATA DO BRASIL
// ======================================================

function brasilDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}


// ======================================================
// REQUISIÇÃO BSD
// ======================================================

async function apiRequest(pathOrUrl) {
  if (!API_KEY) {
    throw new Error(
      "API_FOOTBALL_KEY não configurada no Render"
    );
  }

  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${API_BASE}${pathOrUrl}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${API_KEY}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    const error = new Error(
      `BSD respondeu ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}


// ======================================================
// PAGINAÇÃO
// ======================================================

async function getPaginated(path, maxPages = 20) {
  let next = path;

  const results = [];

  let page = 0;

  while (next && page < maxPages) {
    const data = await apiRequest(next);

    if (Array.isArray(data)) {
      results.push(...data);
      break;
    }

    if (Array.isArray(data?.results)) {
      results.push(...data.results);
    }

    next = data?.next || null;

    page++;
  }

  return results;
}


// ======================================================
// PARTIDAS POR DATA
// ======================================================

async function getAllMatches(date) {
  const cacheKey = `matches:${date}`;

  const saved = cacheGet(cacheKey);

  if (saved) return saved;

  const path =
    `/events/?date_from=${encodeURIComponent(date)}` +
    `&date_to=${encodeURIComponent(date)}` +
    `&limit=50`;

  const matches = await getPaginated(path, 20);

  return cacheSet(
    cacheKey,
    matches,
    60 * 1000
  );
}


// ======================================================
// AO VIVO
// ======================================================

async function getLiveMatches() {
  const cacheKey = "live";

  const saved = cacheGet(cacheKey);

  if (saved) return saved;

  const matches = await getPaginated(
    "/events/live/?limit=50",
    20
  );

  return cacheSet(
    cacheKey,
    matches,
    20 * 1000
  );
}


// ======================================================
// CAMPEONATOS
// ======================================================

async function getAllLeagues() {
  const cacheKey = "leagues";

  const saved = cacheGet(cacheKey);

  if (saved) return saved;

  const leagues = await getPaginated(
    "/leagues/?limit=50",
    20
  );

  return cacheSet(
    cacheKey,
    leagues,
    30 * 60 * 1000
  );
}


// ======================================================
// HEALTH
// ======================================================

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    app: "radioplacar-api",
    provider: "BSD - Bzzoiro Sports Data",
    radioSystem: true,
  });
});


app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,

    app: "radioplacar-api",

    provider:
      "BSD - Bzzoiro Sports Data",

    apiConfigured:
      Boolean(API_KEY),

    radioSystem: true,

    radios:
      getRadioStats(),

    cacheItems:
      cache.size,

    date:
      brasilDate(),
  });
});


// ======================================================
// JOGOS AO VIVO
// ======================================================

app.get("/api/live", async (_req, res) => {
  try {
    const matches =
      await getLiveMatches();

    res.json({
      ok: true,
      count: matches.length,
      response: matches,
    });

  } catch (error) {
    console.error(
      "ERRO /api/live:",
      error
    );

    res
      .status(error.status || 500)
      .json({
        ok: false,

        error:
          error.message,

        details:
          error.data || null,
      });
  }
});


// ======================================================
// JOGOS DE HOJE
// ======================================================

app.get("/api/today", async (req, res) => {
  try {
    const date =
      req.query.date ||
      brasilDate();

    const matches =
      await getAllMatches(date);

    res.json({
      ok: true,

      date,

      count:
        matches.length,

      response:
        matches,
    });

  } catch (error) {
    console.error(
      "ERRO /api/today:",
      error
    );

    res
      .status(error.status || 500)
      .json({
        ok: false,

        error:
          error.message,

        details:
          error.data || null,
      });
  }
});


// ======================================================
// PARTIDAS POR DATA
//
// exemplo:
// /api/matches?date=2026-09-14
// ======================================================

app.get("/api/matches", async (req, res) => {
  try {
    const date =
      req.query.date ||
      brasilDate();

    const matches =
      await getAllMatches(date);

    res.json({
      ok: true,

      date,

      count:
        matches.length,

      response:
        matches,
    });

  } catch (error) {
    console.error(
      "ERRO /api/matches:",
      error
    );

    res
      .status(error.status || 500)
      .json({
        ok: false,

        error:
          error.message,

        details:
          error.data || null,
      });
  }
});


// ======================================================
// DETALHES DA PARTIDA
// ======================================================

app.get(
  "/api/fixture/:id",
  async (req, res) => {

    try {
      const id =
        encodeURIComponent(
          req.params.id
        );

      const cacheKey =
        `fixture:${id}`;

      let fixture =
        cacheGet(cacheKey);

      if (!fixture) {
        fixture =
          await apiRequest(
            `/events/${id}/`
          );

        cacheSet(
          cacheKey,
          fixture,
          30 * 1000
        );
      }

      // rádios brasileiras
      // confirmadas para esta partida
      const radios =
        getRadiosForMatch(
          req.params.id
        );

      res.json({
        ok: true,

        response:
          fixture,

        radios,
      });

    } catch (error) {
      console.error(
        "ERRO /api/fixture:",
        error
      );

      res
        .status(error.status || 500)
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data || null,
        });
    }
  }
);


// ======================================================
// CAMPEONATOS
// ======================================================

app.get(
  "/api/leagues",
  async (_req, res) => {

    try {
      const leagues =
        await getAllLeagues();

      res.json({
        ok: true,

        count:
          leagues.length,

        response:
          leagues,
      });

    } catch (error) {
      console.error(
        "ERRO /api/leagues:",
        error
      );

      res
        .status(error.status || 500)
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data || null,
        });
    }
  }
);


// ======================================================
// RÁDIOS BRASILEIRAS CADASTRADAS
// ======================================================

app.get(
  "/api/radios",
  (_req, res) => {

    const radios =
      getRadios();

    res.json({
      ok: true,

      count:
        radios.length,

      response:
        radios,
    });
  }
);


// ======================================================
// UMA RÁDIO
// ======================================================

app.get(
  "/api/radios/:id",
  (req, res) => {

    const radio =
      getRadio(
        req.params.id
      );

    if (!radio) {
      return res
        .status(404)
        .json({
          ok: false,
          error:
            "Rádio não encontrada",
        });
    }

    res.json({
      ok: true,
      response: radio,
    });
  }
);


// ======================================================
// RÁDIOS DE UMA PARTIDA
//
// exemplo:
// /api/fixture/7259/radios
// ======================================================

app.get(
  "/api/fixture/:id/radios",
  (req, res) => {

    const radios =
      getRadiosForMatch(
        req.params.id
      );

    res.json({
      ok: true,

      match_id:
        String(
          req.params.id
        ),

      count:
        radios.length,

      response:
        radios,
    });
  }
);


// ======================================================
// VINCULAR RÁDIO A UMA PARTIDA
//
// Isso será usado pelo nosso
// mapeador automático mais adiante.
//
// POST
// /api/fixture/7259/radios
// ======================================================

app.post(
  "/api/fixture/:id/radios",
  (req, res) => {

    try {
      const {
        radio_id,
        match_confirmed,
        source,
        source_url,
        priority,
      } = req.body;

      if (!radio_id) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "radio_id obrigatório",
          });
      }

      const result =
        attachRadioToMatch(
          req.params.id,
          radio_id,
          {
            match_confirmed:
              match_confirmed === true,

            source:
              source || null,

            source_url:
              source_url || null,

            priority:
              Number.isInteger(
                priority
              )
                ? priority
                : 99,
          }
        );

      res.json({
        ok: true,
        response: result,
      });

    } catch (error) {

      res
        .status(400)
        .json({
          ok: false,
          error:
            error.message,
        });
    }
  }
);


// ======================================================
// DESVINCULAR RÁDIO DA PARTIDA
// ======================================================

app.delete(
  "/api/fixture/:matchId/radios/:radioId",
  (req, res) => {

    const removed =
      detachRadioFromMatch(
        req.params.matchId,
        req.params.radioId
      );

    res.json({
      ok: true,
      removed,
    });
  }
);


// ======================================================
// LIMPAR TODAS AS RÁDIOS DE UMA PARTIDA
// ======================================================

app.delete(
  "/api/fixture/:id/radios",
  (req, res) => {

    const removed =
      clearMatchRadios(
        req.params.id
      );

    res.json({
      ok: true,
      removed,
    });
  }
);


// ======================================================
// ESTATÍSTICAS DAS RÁDIOS
// ======================================================

app.get(
  "/api/radio-stats",
  (_req, res) => {

    res.json({
      ok: true,
      response:
        getRadioStats(),
    });
  }
);


// ======================================================
// CACHE
// ======================================================

app.get(
  "/api/cache",
  (_req, res) => {

    const items = [];

    for (
      const [key, value]
      of cache.entries()
    ) {

      items.push({
        key,

        expires:
          new Date(
            value.expires
          ).toISOString(),

        valid:
          Date.now() <
          value.expires,
      });
    }

    res.json({
      ok: true,

      count:
        items.length,

      response:
        items,
    });
  }
);


// ======================================================
// 404
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    ok: false,

    error:
      "Rota não encontrada",

    path:
      req.originalUrl,
  });
});


// ======================================================
// SERVIDOR
// ======================================================

app.listen(PORT, () => {
  console.log(
    `RádioPlacar rodando na porta ${PORT}`
  );

  console.log(
    `BSD configurada: ${Boolean(API_KEY)}`
  );

  console.log(
    `Rádios cadastradas: ${getRadios().length}`
  );
});
