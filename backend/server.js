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

import {
  collectTransmissions,
  getRadioCollectorInfo,
} from "./radio-collector.js";

import {
  mapTransmissions,
} from "./radio-mapper.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;


// ======================================================
// BSD - BZZOIRO SPORTS DATA
// ======================================================

const API_BASE = "https://sports.bzzoiro.com/api/v2";
const API_KEY = process.env.API_FOOTBALL_KEY;


// ======================================================
// CACHE
// ======================================================

const cache = new Map();

function cacheGet(key) {
  const item = cache.get(key);

  if (!item) {
    return null;
  }

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
// PAGINAÇÃO BSD
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

  if (saved) {
    return saved;
  }

  const path =
    `/events/?date_from=${encodeURIComponent(date)}` +
    `&date_to=${encodeURIComponent(date)}` +
    `&limit=50`;

  const matches = await getPaginated(
    path,
    20
  );

  return cacheSet(
    cacheKey,
    matches,
    60 * 1000
  );
}


// ======================================================
// PARTIDAS AO VIVO
// ======================================================

async function getLiveMatches() {
  const cacheKey = "live";

  const saved = cacheGet(cacheKey);

  if (saved) {
    return saved;
  }

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

  if (saved) {
    return saved;
  }

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
// ID DA PARTIDA
// ======================================================

function getMatchId(match) {
  if (!match || typeof match !== "object") {
    return null;
  }

  return (
    match.id ??
    match?.fixture?.id ??
    match.event_id ??
    null
  );
}


// ======================================================
// ACRESCENTAR RÁDIOS À PARTIDA
// ======================================================

function addRadiosToMatch(match) {
  if (!match || typeof match !== "object") {
    return match;
  }

  const id = getMatchId(match);

  if (id === null || id === undefined) {
    return {
      ...match,
      radios: [],
    };
  }

  return {
    ...match,

    radios:
      getRadiosForMatch(
        String(id)
      ),
  };
}


// ======================================================
// ACRESCENTAR RÁDIOS À LISTA
// ======================================================

function addRadiosToMatches(matches) {
  if (!Array.isArray(matches)) {
    return [];
  }

  return matches.map(
    addRadiosToMatch
  );
}


// ======================================================
// ESTADO DO MAPEADOR
// ======================================================

let radioMapperRunning = false;

let lastRadioMapperRun = null;

let lastRadioMapperResult = null;

let radioMapperPromise = null;


// ======================================================
// EXECUTAR MAPEADOR
// ======================================================

async function runRadioMapper(
  date = brasilDate(),
  options = {}
) {
  if (radioMapperPromise) {
    return radioMapperPromise;
  }

  const maxMatches =
    Number.isInteger(
      options.maxMatches
    )
      ? Math.max(
          1,
          Math.min(
            options.maxMatches,
            100
          )
        )
      : 40;

  radioMapperPromise =
    (async () => {
      radioMapperRunning = true;

      const startedAt =
        new Date().toISOString();

      try {
        const matches =
          await getAllMatches(
            date
          );

        const collected =
          await collectTransmissions({
            maxMatches,
          });

        /*
         * IMPORTANTE:
         *
         * clearExisting fica FALSE.
         *
         * Assim o automático NÃO apaga
         * associações adicionadas
         * manualmente.
         */

        const mapped =
          mapTransmissions(
            matches,
            collected.transmissions || [],
            {
              clearExisting: false,
            }
          );

        lastRadioMapperRun =
          new Date().toISOString();

        lastRadioMapperResult = {
          ok: true,

          date,

          started_at:
            startedAt,

          finished_at:
            lastRadioMapperRun,

          bsd_matches:
            matches.length,

          source:
            collected.source ||
            "RadiosNet",

          source_url:
            collected.source_url ||
            "https://www.radios.com.br/futebol",

          match_pages_found:
            collected.match_pages_found ??
            0,

          match_pages_checked:
            collected.match_pages_checked ??
            0,

          transmissions_found:
            collected.transmissions_found ??
            (
              Array.isArray(
                collected.transmissions
              )
                ? collected.transmissions.length
                : 0
            ),

          mapped:
            mapped?.mapped ??
            0,

          not_mapped:
            mapped?.not_mapped ??
            0,

          ignored_radios:
            collected.ignored_radios ||
            [],

          collector_errors:
            collected.errors ||
            [],

          results:
            mapped?.results ||
            [],
        };

        return lastRadioMapperResult;

      } catch (error) {
        lastRadioMapperRun =
          new Date().toISOString();

        lastRadioMapperResult = {
          ok: false,

          date,

          started_at:
            startedAt,

          finished_at:
            lastRadioMapperRun,

          error:
            error?.message ||
            String(error),

          details:
            error?.data ||
            null,
        };

        throw error;

      } finally {
        radioMapperRunning = false;
      }
    })();

  try {
    return await radioMapperPromise;
  } finally {
    radioMapperPromise = null;
  }
}


// ======================================================
// EXECUÇÃO EM SEGUNDO PLANO
// ======================================================

async function backgroundRadioMapper() {
  try {
    const result =
      await runRadioMapper(
        brasilDate(),
        {
          maxMatches: 40,
        }
      );

    console.log(
      "Mapeador de rádios concluído:",
      {
        date:
          result.date,

        transmissions:
          result.transmissions_found,

        mapped:
          result.mapped,

        notMapped:
          result.not_mapped,
      }
    );

  } catch (error) {
    console.error(
      "Mapeador de rádios falhou:",
      error?.message ||
      error
    );
  }
}


// ======================================================
// RAIZ
// ======================================================

app.get("/", (_req, res) => {
  res.json({
    ok: true,

    app:
      "radioplacar-api",

    provider:
      "BSD - Bzzoiro Sports Data",

    radioSystem:
      true,

    radioCollector:
      true,

    radioMapper:
      true,

    date:
      brasilDate(),
  });
});


// ======================================================
// HEALTH
// ======================================================

app.get(
  "/api/health",
  (_req, res) => {
    res.json({
      ok: true,

      app:
        "radioplacar-api",

      provider:
        "BSD - Bzzoiro Sports Data",

      apiConfigured:
        Boolean(API_KEY),

      radioSystem:
        true,

      radioCollector:
        getRadioCollectorInfo(),

      radioMapper: {
        running:
          radioMapperRunning,

        last_run:
          lastRadioMapperRun,

        last_result:
          lastRadioMapperResult,
      },

      radios:
        getRadioStats(),

      cacheItems:
        cache.size,

      date:
        brasilDate(),
    });
  }
);


// ======================================================
// JOGOS AO VIVO
// ======================================================

app.get(
  "/api/live",
  async (_req, res) => {
    try {
      const matches =
        await getLiveMatches();

      const response =
        addRadiosToMatches(
          matches
        );

      res.json({
        ok: true,

        count:
          response.length,

        response,
      });

    } catch (error) {
      console.error(
        "ERRO /api/live:",
        error
      );

      res
        .status(
          error.status ||
          500
        )
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data ||
            null,
        });
    }
  }
);


// ======================================================
// JOGOS DE HOJE
// ======================================================

app.get(
  "/api/today",
  async (req, res) => {
    try {
      const date =
        req.query.date ||
        brasilDate();

      const matches =
        await getAllMatches(
          date
        );

      const response =
        addRadiosToMatches(
          matches
        );

      res.json({
        ok: true,

        date,

        count:
          response.length,

        response,
      });

    } catch (error) {
      console.error(
        "ERRO /api/today:",
        error
      );

      res
        .status(
          error.status ||
          500
        )
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data ||
            null,
        });
    }
  }
);


// ======================================================
// PARTIDAS POR DATA
// ======================================================

app.get(
  "/api/matches",
  async (req, res) => {
    try {
      const date =
        req.query.date ||
        brasilDate();

      const matches =
        await getAllMatches(
          date
        );

      const response =
        addRadiosToMatches(
          matches
        );

      res.json({
        ok: true,

        date,

        count:
          response.length,

        response,
      });

    } catch (error) {
      console.error(
        "ERRO /api/matches:",
        error
      );

      res
        .status(
          error.status ||
          500
        )
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data ||
            null,
        });
    }
  }
);


// ======================================================
// DETALHES DE UMA PARTIDA
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
        cacheGet(
          cacheKey
        );

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
        .status(
          error.status ||
          500
        )
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data ||
            null,
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
        .status(
          error.status ||
          500
        )
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data ||
            null,
        });
    }
  }
);


// ======================================================
// TODAS AS RÁDIOS
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

      response:
        radio,
    });
  }
);


// ======================================================
// RÁDIOS DE UMA PARTIDA
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
// VINCULAR RÁDIO MANUALMENTE
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
              source ||
              null,

            source_url:
              source_url ||
              null,

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

        response:
          result,
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
// DESVINCULAR UMA RÁDIO
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
// LIMPAR RÁDIOS DE UMA PARTIDA
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
// INFORMAÇÕES DO COLETOR
// ======================================================

app.get(
  "/api/radio-collector",
  (_req, res) => {
    res.json({
      ok: true,

      response:
        getRadioCollectorInfo(),
    });
  }
);


// ======================================================
// STATUS DO MAPEADOR
// ======================================================

app.get(
  "/api/radio-mapper/status",
  (_req, res) => {
    res.json({
      ok: true,

      running:
        radioMapperRunning,

      last_run:
        lastRadioMapperRun,

      last_result:
        lastRadioMapperResult,
    });
  }
);


// ======================================================
// EXECUTAR MAPEADOR
//
// AGORA FUNCIONA PELO NAVEGADOR:
//
// GET /api/radio-mapper/run
//
// Também continua aceitando POST.
// ======================================================

async function radioMapperRunHandler(
  req,
  res
) {
  try {
    const date =
      req.query.date ||
      brasilDate();

    const maxRaw =
      Number(
        req.query.max ||
        40
      );

    const maxMatches =
      Number.isFinite(
        maxRaw
      )
        ? Math.max(
            1,
            Math.min(
              Math.trunc(
                maxRaw
              ),
              100
            )
          )
        : 40;

    const result =
      await runRadioMapper(
        date,
        {
          maxMatches,
        }
      );

    res.json(
      result
    );

  } catch (error) {
    console.error(
      "ERRO /api/radio-mapper/run:",
      error
    );

    res
      .status(
        error.status ||
        500
      )
      .json({
        ok: false,

        error:
          error.message,

        details:
          error.data ||
          null,
      });
  }
}


// ======================================================
// GET - TESTE PELO NAVEGADOR
// ======================================================

app.get(
  "/api/radio-mapper/run",
  radioMapperRunHandler
);


// ======================================================
// POST - MANTIDO
// ======================================================

app.post(
  "/api/radio-mapper/run",
  radioMapperRunHandler
);


// ======================================================
// VER ASSOCIAÇÕES ATUAIS
// ======================================================

app.get(
  "/api/radio-mapper/associations",
  async (req, res) => {
    try {
      const date =
        req.query.date ||
        brasilDate();

      const matches =
        await getAllMatches(
          date
        );

      const response =
        addRadiosToMatches(
          matches
        )
          .filter(
            (match) =>
              Array.isArray(
                match.radios
              ) &&
              match.radios.length > 0
          );

      res.json({
        ok: true,

        date,

        matches_with_radios:
          response.length,

        response,
      });

    } catch (error) {
      console.error(
        "ERRO /api/radio-mapper/associations:",
        error
      );

      res
        .status(
          error.status ||
          500
        )
        .json({
          ok: false,

          error:
            error.message,

          details:
            error.data ||
            null,
        });
    }
  }
);


// ======================================================
// CACHE INFO
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

app.use(
  (req, res) => {
    res
      .status(404)
      .json({
        ok: false,

        error:
          "Rota não encontrada",

        path:
          req.originalUrl,
      });
  }
);


// ======================================================
// SERVIDOR
// ======================================================

app.listen(
  PORT,
  () => {
    console.log(
      `RádioPlacar rodando na porta ${PORT}`
    );

    console.log(
      `BSD configurada: ${Boolean(API_KEY)}`
    );

    console.log(
      `Rádios cadastradas: ${getRadios().length}`
    );


    // ==================================================
    // PRIMEIRA SINCRONIZAÇÃO
    //
    // Aguarda 10 segundos depois do servidor iniciar.
    // Não impede o Render de colocar a API no ar.
    // ==================================================

    setTimeout(
      () => {
        backgroundRadioMapper();
      },
      10 * 1000
    );


    // ==================================================
    // SINCRONIZAÇÃO PERIÓDICA
    //
    // 15 minutos para não bombardear
    // a fonte externa com requisições.
    // ==================================================

    setInterval(
      () => {
        backgroundRadioMapper();
      },
      15 * 60 * 1000
    );
  }
);
