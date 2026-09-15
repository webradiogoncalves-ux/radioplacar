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

// IMPORTANTE:
// as imagens da BSD ficam fora de /api/v2.
const IMAGE_BASE =
  "https://sports.bzzoiro.com";

const API_KEY =
  process.env.API_FOOTBALL_KEY;

const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL ||
  "https://radioplacar-api.onrender.com";

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

function getTeamLogo(teamId) {
  if (
    teamId === null ||
    teamId === undefined ||
    teamId === ""
  ) {
    return null;
  }

  return (
    `${PUBLIC_API_URL}/api/team-logo/` +
    `${encodeURIComponent(teamId)}`
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
    `${PUBLIC_API_URL}/api/league-logo/` +
    `${encodeURIComponent(leagueId)}`
  );
}

// ======================================================
// ENRIQUECER PARTIDA
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
// TEMPORADAS DOS CAMPEONATOS BSD
// ======================================================

async function getLeagueSeasons(leagueId) {
  const safeLeagueId = String(leagueId || "").trim();

  if (!safeLeagueId) {
    return [];
  }

  const cacheKey =
    `league-seasons:${safeLeagueId}`;

  const saved =
    cacheGet(cacheKey);

  if (saved) {
    return saved;
  }

  const seasons =
    await getPaginated(
      `/leagues/${encodeURIComponent(
        safeLeagueId
      )}/seasons/?limit=200`,
      10
    );

  return cacheSet(
    cacheKey,
    seasons,
    30 * 60 * 1000
  );
}

function seasonValue(season, ...keys) {
  for (const key of keys) {
    const value = season?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function findCurrentSeason(seasons) {
  if (!Array.isArray(seasons)) {
    return null;
  }

  const current =
    seasons.find((season) => {
      const value =
        seasonValue(
          season,
          "current",
          "is_current",
          "atual",
          "isCurrent"
        );

      return (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true"
      );
    });

  if (current) {
    return current;
  }

  /*
   * Se a BSD não marcar "current",
   * usamos somente os dados reais recebidos:
   * ordenamos pelo ano/id e pegamos o mais recente.
   */
  return (
    [...seasons]
      .sort((a, b) => {
        const yearA =
          Number(
            seasonValue(
              a,
              "year",
              "ano"
            )
          ) || 0;

        const yearB =
          Number(
            seasonValue(
              b,
              "year",
              "ano"
            )
          ) || 0;

        if (yearA !== yearB) {
          return yearB - yearA;
        }

        const idA =
          Number(
            seasonValue(
              a,
              "id",
              "season_id"
            )
          ) || 0;

        const idB =
          Number(
            seasonValue(
              b,
              "id",
              "season_id"
            )
          ) || 0;

        return idB - idA;
      })[0] || null
  );
}

function getSeasonId(season) {
  return seasonValue(
    season,
    "id",
    "season_id"
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
// PROXY DE ESCUDOS / IMAGENS BSD
// ======================================================

async function proxyBsdImage(req, res, type) {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "API_FOOTBALL_KEY não configurada no Render",
      });
    }

    const id =
      encodeURIComponent(
        req.params.id
      );

    const imageUrl =
      `${IMAGE_BASE}/img/${type}/${id}/?bg=transparent`;

    const response =
      await fetch(imageUrl, {
        headers: {
          Authorization:
            `Token ${API_KEY}`,

          Accept:
            "image/*,*/*;q=0.8",
        },
      });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({
          ok: false,

          error:
            `BSD respondeu ${response.status} ao buscar imagem`,

          type,

          id:
            req.params.id,
        });
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) ||
      "application/octet-stream";

    if (
      !contentType
        .toLowerCase()
        .startsWith("image/")
    ) {
      return res.status(502).json({
        ok: false,

        error:
          "BSD não retornou um arquivo de imagem",

        type,

        id:
          req.params.id,

        content_type:
          contentType,
      });
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400"
    );

    return res.send(buffer);
  } catch (error) {
    console.error(
      `ERRO proxy BSD ${type}:`,
      error
    );

    return res.status(500).json({
      ok: false,

      error:
        error?.message ||
        "Falha ao carregar imagem BSD",
    });
  }
}

app.get(
  "/api/team-logo/:id",
  (req, res) =>
    proxyBsdImage(
      req,
      res,
      "team"
    )
);

app.get(
  "/api/league-logo/:id",
  (req, res) =>
    proxyBsdImage(
      req,
      res,
      "league"
    )
);

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
// CAMPEONATOS + TEMPORADA ATUAL
// ======================================================

app.get(
  "/api/competitions",
  async (_req, res) => {
    try {
      const leagues =
        await getAllLeagues();

      const competitions =
        leagues.map((league) => {
          const leagueId =
            league?.id ??
            league?.league_id ??
            league?.id_liga ??
            league?.id_da_liga ??
            null;

          const currentSeason =
            league?.current_season ??
            league?.temporada_atual ??
            null;

          const seasonId =
            currentSeason?.id ??
            currentSeason?.season_id ??
            currentSeason?.id_temporada ??
            currentSeason?.id_da_temporada ??
            null;

          return {
            ...league,

            league_id:
              leagueId,

            season_id:
              seasonId,

            season:
              currentSeason,

            league_logo:
              leagueId !== null
                ? getLeagueLogo(
                    leagueId
                  )
                : null,
          };
        });

      res.json({
        ok: true,

        count:
          competitions.length,

        response:
          competitions,
      });
    } catch (error) {
      console.error(
        "ERRO /api/competitions:",
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
// CLASSIFICAÇÃO DO CAMPEONATO - BSD
// ======================================================

app.get(
  "/api/standings/:leagueId",
  async (req, res) => {
    try {
      const leagueId =
        encodeURIComponent(
          req.params.leagueId
        );

      const seasonId =
        req.query.season_id;

      if (!seasonId) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "season_id é obrigatório",
          });
      }

      const safeSeasonId =
        encodeURIComponent(
          seasonId
        );

      const cacheKey =
        `standings:${leagueId}:${safeSeasonId}`;

      let standings =
        cacheGet(cacheKey);

      if (!standings) {
        standings =
          await apiRequest(
            `/leagues/${leagueId}/standings/?season_id=${safeSeasonId}`
          );

        cacheSet(
          cacheKey,
          standings,
          5 * 60 * 1000
        );
      }

      res.json({
        ok: true,

        league_id:
          req.params.leagueId,

        season_id:
          seasonId,

        response:
          standings,
      });
    } catch (error) {
      console.error(
        "ERRO /api/standings:",
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
