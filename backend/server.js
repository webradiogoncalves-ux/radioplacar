import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE = "https://sports.bzzoiro.com";

async function apiRequest(path) {
  if (!API_KEY) {
    throw new Error("API_FOOTBALL_KEY não configurada");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Token ${API_KEY}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro na API ${response.status}: ${text}`);
  }

  return response.json();
}

function hojeUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Página inicial da API
app.get("/", (req, res) => {
  res.json({
    app: "RádioPlacar API",
    status: "online",
    version: "1.0.1"
  });
});

// Teste da API
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "radioplacar-api",
    footballApi: Boolean(API_KEY)
  });
});

// Jogos AO VIVO
app.get("/api/live", async (req, res) => {
  try {
    const data = await apiRequest("/api/v2/events/live/");
    res.json(data);
  } catch (error) {
    console.error("Erro /api/live:", error.message);

    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

// Jogos de hoje
app.get("/api/today", async (req, res) => {
  try {
    const date = hojeUTC();

    const data = await apiRequest(
      `/api/v2/events/?date_from=${date}&date_to=${date}`
    );

    res.json(data);
  } catch (error) {
    console.error("Erro /api/today:", error.message);

    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

// Jogos por data
// Exemplo:
// /api/matches?date=2026-09-13
app.get("/api/matches", async (req, res) => {
  try {
    const date = req.query.date || hojeUTC();

    const data = await apiRequest(
      `/api/v2/events/?date_from=${date}&date_to=${date}`
    );

    res.json(data);
  } catch (error) {
    console.error("Erro /api/matches:", error.message);

    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

// Detalhes de uma partida
app.get("/api/fixture/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const data = await apiRequest(`/api/v2/events/${id}/`);

    res.json(data);
  } catch (error) {
    console.error("Erro /api/fixture:", error.message);

    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RádioPlacar API rodando na porta ${PORT}`);
});
