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

const API_BASE =
  "https://sports.bzzoiro.com/api/v2";

const API_KEY =
  process.env.API_FOOTBALL_KEY;

const cache = new Map();

// ======================================================
// CACHE
// ======================================================

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
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

// ======================================================
// ESCUDOS / IMAGENS BSD
// ======================================================
//
// Não buscamos escudo em Google, Wikipedia etc.
// A URL abaixo aponta somente para o serviço de
// imagens da própria BSD.
//
// Se não houver team_id, retorna null.
// O frontend poderá usar as 3 letras como fallback.
// ======================================================

function getTeamLogo(teamId) {
  if (
    teamId === null ||
    teamId === undefined ||
    teamId === ""
  ) {
    return null;
  }

  return (
    `${API_BASE}/img/team/` +
    `${encodeURIComponent(teamId)}/` +
    `?bg=transparent`
  );
}

function getLeagueLogo(leagueId) {
  if (
    leagueId === null ||
    leagueId === undefined ||
    leagueId === ""
  ) {
    return null;
  }

  return (
    `${API_BASE}/img/league/` +
    `${encodeURIComponent(leagueId)}/` +
    `?bg=transparent`
  );
}

// ======================================================
// ENRIQUECER PARTIDA
// ======================================================
//
// Mantém TODOS os dados originais da BSD.
// Apenas acrescenta:
//
// home_team_logo
// away_team_logo
// league_logo
// radios
//
// A ordem casa/fora continua exatamente como a BSD.
// ======================================================

function enrichMatch(match) {
  if (!match || typeof match !== "object") {
    return match;
  }

  const matchId =
    match.id ??
    match.fixture_id ??
    match.event_id ??
    null;

  return {
    ...match,

    home_team_logo:
      getTeamLogo(
        match.home_team_id
      ),

    away_team_logo:
      getTeamLogo(
        match.away_team_id
      ),

    league_logo:
      getLeagueLogo(
        match.league_id
      ),

    radios:
      matchId !== null
        ? getRadiosForMatch(
            String(matchId)
          )
        : [],
  };
}

function enrichMatches(matches) {
  if (!Array.isArray(matches)) {
    return [];
  }

  return matches.map(enrichMatch);
}

// ======================================================
// REQUISIÇÃO BSD
// ======================================================

async function apiRequest(pathOrUrl) {
  if (!API_KEY) {
    const error = new Error(
      "API_FOOTBALL_KEY não configurada no Render"
    );

    error.status = 500;

    throw error;
  }

  const url =
    pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${API_BASE}${pathOrUrl}`;

  const response = await fetch(url, {
    headers: {
      Authorization:
        `Token ${API_KEY}`,

      Accept:
        "application/json",
    },
  });

  const text =
    await response.text();

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

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }

  return data;
}

// ======================================================
// PAGINAÇÃO BSD
// ======================================================

async function getPaginated(
  path,
  maxPages = 20
) {
  let next = path;

  const results = [];

  let page = 0;

  while (
    next &&
    page < maxPages
  ) {
    const data =
      await apiRequest(next);

    if (Array.isArray(data)) {
      results.push(...data);
      break;
    }

    if (
      Array.isArray(
        data?.results
      )
    ) {
      results.push(
        ...data.results
      );
    }

    next =
      data?.next || null;

    page++;
  }

  return results;
}

// ======================================================
// PARTIDAS POR DATA
// ======================================================

async function getAllMatches(date) {
  const cacheKey =
    `matches:${date}`;

  const saved =
    cacheGet(cacheKey);

  if (saved) {
    return saved;
  }

  const path =
    `/events/?date_from=${encodeURIComponent(date)}` +
    `&date_to=${encodeURIComponent(date)}` +
    `&limit=50`;

  const matches =
    await getPaginated(
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
// AO VIVO
// ======================================================

async function getLiveMatches() {
  const cacheKey =
    "live";

  const saved =
    cacheGet(cacheKey);

  if (saved) {
    return saved;
  }

  const matches =
    await getPaginated(
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
  const cacheKey =
    "leagues";

  const saved =
    cacheGet(cacheKey);

  if (saved) {
    return saved;
  }

  const leagues =
    await getPaginated(
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
// MAPEAMENTO AUTOMÁTICO DAS RÁDIOS
// ======================================================

let radioMapperRunning =
  false;

let lastRadioMapperRun =
  null;

let lastRadioMapperResult =
  null;

async function runRadioMapper(
  date = brasilDate(),
  options = {}
) {
  if (radioMapperRunning) {
    return {
      ok: true,
      running: true,
      message:
        "Mapeador de rádios já está em execução",
      last_run:
        lastRadioMapperRun,
      last_result:
        lastRadioMapperResult,
    };
  }

  radioMapperRunning = true;

  try {
    const matches =
      await getAllMatches(date);

    const collected =
      await collectTransmissions({
        maxMatches:
          Number.isInteger(
            options.maxMatches
          )
            ? options.maxMatches
            : 40,
      });

    const mapped =
      mapTransmissions(
        matches,
        collected.transmissions ||
          [],
        {
          clearExisting:
            options.clearExisting ===
            true,
        }
      );

    lastRadioMapperRun =
      new Date().toISOString();

    lastRadioMapperResult = {
      ok: true,

      date,

      bsd_matches:
        matches.length,

      source:
        collected.source,

      source_url:
        collected.source_url,

      match_pages_found:
        collected.match_pages_found,

      match_pages_checked:
        collected.match_pages_checked,

      transmissions_found:
        collected.transmissions_found,

      mapped:
        mapped.mapped,

      not_mapped:
        mapped.not_mapped,

      ignored_radios:
        collected.ignored_radios ||
        [],

      collector_errors:
        collected.errors || [],

      results:
        mapped.results,
    };

    return lastRadioMapperResult;
  } finally {
    radioMapperRunning =
      false;
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

    teamLogos:
      "BSD",

    radioSystem:
      true,

    radioCollector:
      true,

    radioMapper:
      true,
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

      teamLogos:
        "BSD",

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
        enrichMatches(matches);

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
          error.status || 500
        )
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
        enrichMatches(
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
          error.status || 500
        )
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
// PARTIDAS POR DATA
//
// exemplo:
// /api/matches?date=2026-09-15
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
        enrichMatches(
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
          error.status || 500
        )
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

      const enriched =
        enrichMatch(
          fixture
        );

      res.json({
        ok: true,

        response:
          enriched,

        radios:
          getRadiosForMatch(
            req.params.id
          ),
      });
    } catch (error) {
      console.error(
        "ERRO /api/fixture:",
        error
      );

      res
        .status(
          error.status || 500
        )
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

      const response =
        leagues.map(
          (league) => ({
            ...league,

            logo:
              league?.logo ||
              getLeagueLogo(
                league?.id
              ),
          })
        );

      res.json({
        ok: true,

        count:
          response.length,

        response,
      });
    } catch (error) {
      console.error(
        "ERRO /api/leagues:",
        error
      );

      res
        .status(
          error.status || 500
        )
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
// RÁDIOS
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
// VINCULAR RÁDIO A UMA PARTIDA
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
              match_confirmed ===
              true,

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
// COLETOR DE RÁDIOS
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
// EXECUTAR MAPEADOR
//
// Funciona tanto pelo navegador (GET)
// quanto POST.
// ======================================================

async function radioMapperRoute(
  req,
  res
) {
  try {
    const date =
      req.query.date ||
      brasilDate();

    const maxRaw =
      Number(
        req.query.max || 40
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

          // Não apaga associação
          // manual já existente.
          clearExisting:
            false,
        }
      );

    res.json(result);
  } catch (error) {
    console.error(
      "ERRO /api/radio-mapper/run:",
      error
    );

    res
      .status(
        error.status || 500
      )
      .json({
        ok: false,

        error:
          error.message,

        details:
          error.data || null,
      });
  }
}

app.get(
  "/api/radio-mapper/run",
  radioMapperRoute
);

app.post(
  "/api/radio-mapper/run",
  radioMapperRoute
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
// ASSOCIAÇÕES ATUAIS
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
        enrichMatches(
          matches
        ).filter(
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
          error.status || 500
        )
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
// MAPEADOR AUTOMÁTICO
// ======================================================
//
// Primeira execução 10 segundos após subir.
//
// Depois repete a cada 15 minutos.
//
// Não apaga vínculos manuais.
// ======================================================

async function backgroundRadioMapper() {
  try {
    const result =
      await runRadioMapper(
        brasilDate(),
        {
          maxMatches: 40,

          clearExisting:
            false,
        }
      );

    console.log(
      `Mapeador de rádios: ${result.mapped ?? 0} vínculos confirmados`
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
// VER CACHE
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
  res
    .status(404)
    .json({
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
    `RadioPlacar rodando na porta ${PORT}`
  );

  console.log(
    `BSD configurada: ${Boolean(API_KEY)}`
  );

  console.log(
    `Rádios cadastradas: ${getRadios().length}`
  );

  console.log(
    "Escudos: serviço de imagens BSD"
  );

  setTimeout(() => {
    backgroundRadioMapper();
  }, 10 * 1000);

  setInterval(() => {
    backgroundRadioMapper();
  }, 15 * 60 * 1000);
});
