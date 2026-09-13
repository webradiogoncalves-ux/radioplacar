import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import {
  getDarkGames,
  getDarkGame
} from "./darkGames.js";

import {
  importDarkGames,
  importAllDarkGames
} from "./darkGamesSource.js";

import {
  enrichDarkGameLogos
} from "./darkGamesLogos.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT =
  process.env.PORT || 3001;

const API_KEY =
  process.env.API_FOOTBALL_KEY;

const API_BASE =
  "https://sports.bzzoiro.com";

/* =========================
   CACHE
========================= */

const cache = new Map();

function getCache(key, maxAge) {
  const item =
    cache.get(key);

  if (!item) return null;

  if (
    Date.now() - item.time >
    maxAge
  ) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

function setCache(key, data) {
  cache.set(key, {
    time: Date.now(),
    data
  });
}

/* =========================
   API BSD
========================= */

async function apiRequest(pathOrUrl) {
  if (!API_KEY) {
    throw new Error(
      "API_FOOTBALL_KEY não configurada"
    );
  }

  const url =
    pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${API_BASE}${pathOrUrl}`;

  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Token ${API_KEY}`,
        Accept:
          "application/json"
      }
    });

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Erro na API ${response.status}: ${text}`
    );
  }

  return response.json();
}

/* =========================
   DATA
========================= */

function hojeUTC() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

/* =========================
   TODAS AS PÁGINAS DOS JOGOS
========================= */

async function getAllMatches(date) {
  const cacheKey =
    `matches-${date}`;

  const cached =
    getCache(
      cacheKey,
      60000
    );

  if (cached) {
    return cached;
  }

  let url =
    `/api/v2/events/?date_from=${date}` +
    `&date_to=${date}` +
    `&limit=50&offset=0`;

  const allResults = [];

  let total = 0;
  let pages = 0;

  while (
    url &&
    pages < 20
  ) {
    const data =
      await apiRequest(url);

    pages += 1;

    if (
      Array.isArray(
        data?.results
      )
    ) {
      allResults.push(
        ...data.results
      );
    }

    if (
      typeof data?.count ===
      "number"
    ) {
      total =
        data.count;
    }

    url =
      data?.next || null;
  }

  const response = {
    count:
      total ||
      allResults.length,

    returned:
      allResults.length,

    pages,

    results:
      allResults
  };

  setCache(
    cacheKey,
    response
  );

  return response;
}

/* =========================
   TODAS AS PÁGINAS DAS LIGAS
========================= */

async function getAllLeagues() {
  const cached =
    getCache(
      "leagues-all",
      30 * 60 * 1000
    );

  if (cached) {
    return cached;
  }

  let url =
    "/api/v2/leagues/?limit=50&offset=0";

  const allResults = [];

  let total = 0;
  let pages = 0;

  while (
    url &&
    pages < 20
  ) {
    const data =
      await apiRequest(url);

    pages += 1;

    if (
      Array.isArray(
        data?.results
      )
    ) {
      allResults.push(
        ...data.results
      );
    }

    if (
      typeof data?.count ===
      "number"
    ) {
      total =
        data.count;
    }

    url =
      data?.next || null;
  }

  const response = {
    count:
      total ||
      allResults.length,

    returned:
      allResults.length,

    pages,

    results:
      allResults
  };

  setCache(
    "leagues-all",
    response
  );

  return response;
}

/* =========================
   INÍCIO
========================= */

app.get(
  "/",
  (req, res) => {
    res.json({
      app:
        "RádioPlacar API",

      status:
        "online",

      version:
        "1.6.0"
    });
  }
);

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,

      app:
        "radioplacar-api",

      footballApi:
        Boolean(API_KEY)
    });
  }
);

/* =========================
   JOGOS AO VIVO BSD
========================= */

app.get(
  "/api/live",
  async (req, res) => {
    try {
      const cached =
        getCache(
          "live",
          20000
        );

      if (cached) {
        return res.json(
          cached
        );
      }

      const data =
        await apiRequest(
          "/api/v2/events/live/"
        );

      setCache(
        "live",
        data
      );

      res.json(data);

    } catch (error) {
      console.error(
        "Erro /api/live:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   JOGOS DE HOJE BSD
========================= */

app.get(
  "/api/today",
  async (req, res) => {
    try {
      const date =
        hojeUTC();

      const data =
        await getAllMatches(
          date
        );

      res.json(data);

    } catch (error) {
      console.error(
        "Erro /api/today:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   JOGOS BSD POR DATA
========================= */

app.get(
  "/api/matches",
  async (req, res) => {
    try {
      const date =
        req.query.date ||
        hojeUTC();

      const data =
        await getAllMatches(
          date
        );

      res.json(data);

    } catch (error) {
      console.error(
        "Erro /api/matches:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   LIGAS BSD
========================= */

app.get(
  "/api/leagues",
  async (req, res) => {
    try {
      const data =
        await getAllLeagues();

      res.json(data);

    } catch (error) {
      console.error(
        "Erro /api/leagues:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   DETALHE BSD
========================= */

app.get(
  "/api/fixture/:id",
  async (req, res) => {
    try {
      const id =
        req.params.id;

      const cacheKey =
        `fixture-${id}`;

      const cached =
        getCache(
          cacheKey,
          30000
        );

      if (cached) {
        return res.json(
          cached
        );
      }

      const data =
        await apiRequest(
          `/api/v2/events/${id}/`
        );

      setCache(
        cacheKey,
        data
      );

      res.json(data);

    } catch (error) {
      console.error(
        "Erro /api/fixture:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   IMPORTAR TODOS OS
   JOGOS DO ESCURO
========================= */

app.get(
  "/api/dark-games/import",
  async (req, res) => {
    try {
      const result =
        await importAllDarkGames();

      res.json({
        ok: true,

        source:
          "FootballData",

        imports:
          result
      });

    } catch (error) {
      console.error(
        "Erro import dark-games:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   IMPORTAR UMA COMPETIÇÃO
========================= */

app.get(
  "/api/dark-games/import/:source",
  async (req, res) => {
    try {
      const result =
        await importDarkGames(
          req.params.source
        );

      res.json({
        ok: true,
        ...result
      });

    } catch (error) {
      console.error(
        "Erro import competição:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   ESCUDOS JOGOS DO ESCURO
========================= */

app.get(
  "/api/dark-games/logos",
  async (req, res) => {
    try {
      let games =
        getDarkGames();

      /*
        O Render pode reiniciar e
        apagar o Map da memória.
        Se estiver vazio, importa
        os jogos novamente.
      */

      if (
        games.length === 0
      ) {
        await importAllDarkGames();

        games =
          getDarkGames();
      }

      const result =
        await enrichDarkGameLogos();

      res.json({
        ok: true,
        ...result
      });

    } catch (error) {
      console.error(
        "Erro escudos dark-games:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   LISTAR JOGOS DO ESCURO
========================= */

app.get(
  "/api/dark-games",
  (req, res) => {
    try {
      const date =
        req.query.date ||
        null;

      const games =
        getDarkGames(date);

      res.json({
        source:
          "dark-games",

        count:
          games.length,

        results:
          games
      });

    } catch (error) {
      console.error(
        "Erro /api/dark-games:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   DETALHE JOGO DO ESCURO
========================= */

app.get(
  "/api/dark-games/:id",
  (req, res) => {
    try {
      const game =
        getDarkGame(
          req.params.id
        );

      if (!game) {
        return res
          .status(404)
          .json({
            error: true,
            message:
              "Jogo não encontrado"
          });
      }

      res.json(game);

    } catch (error) {
      console.error(
        "Erro /api/dark-games/:id:",
        error.message
      );

      res
        .status(500)
        .json({
          error: true,
          message:
            error.message
        });
    }
  }
);

/* =========================
   CACHE
========================= */

app.get(
  "/api/cache",
  (req, res) => {
    res.json({
      entries:
        cache.size
    });
  }
);

/* =========================
   SERVIDOR
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `RádioPlacar API rodando na porta ${PORT}`
    );
  }
);
