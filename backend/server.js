import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_FOOTBALL_KEY;

const API_BASE = "https://sports.bzzoiro.com/api/v2";

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
    throw new Error(`Erro API ${response.status}: ${text}`);
  }

  return response.json();
}

app.get("/", (req, res) => {
  res.json({
    app: "RádioPlacar API",
    status: "online",
    version: "1.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "radioplacar-api",
    footballApi: Boolean(API_KEY)
  });
});

app.get("/api/live", async (req, res) => {
  try {
    const data = await apiRequest("/football/live");
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.get("/api/today", async (req, res) => {
  try {
    const data = await apiRequest("/football/today");
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RádioPlacar API rodando na porta ${PORT}`);
});
