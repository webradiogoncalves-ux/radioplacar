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

// URL pública do nosso próprio backend.
// Assim o frontend não precisa receber a chave da BSD.
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
//
// Agora o JSON NÃO manda a URL protegida da BSD diretamente.
//
// Ele manda uma URL do próprio RadioPlacar:
//
// /api/team-logo/2242
//
// Essa rota busca o escudo na BSD usando a chave somente
// dentro do servidor.
//
// Se o escudo não existir, o frontend continua usando
// as 3 letras como fallback.
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
// PROXY DE ESCUDOS / IMAGENS BSD
// ======================================================
//
// ESTE É O CONSERTO PRINCIPAL.
//
// O navegador não conhece API_FOOTBALL_KEY.
//
// Portanto:
//
// frontend
//    ↓
// radioplacar-api
//    ↓ Authorization: Token ...
// BSD
//    ↓
// imagem
//
// A chave nunca vai para o frontend.
// ======================================================

async function proxyBsdImage(
  req,
  res,
  type
) {
  try {
    if (!API_KEY) {
      return res
        .status(500)
        .json({
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
      `${API_BASE}/img/${type}/${id}/?bg=transparent`;

    const response =
      await fetch(
        imageUrl,
        {
          headers: {
            Authorization:
              `Token ${API_KEY}`,

            Accept:
              "image/*,*/*;q=0.8",
          },
        }
      );

    if (!response.ok) {
      return res
        .status(
          response.status
        )
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
      return res
        .status(502)
        .json({
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

    return res
      .status(500)
      .json({
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
