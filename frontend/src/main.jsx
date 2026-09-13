import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Radio,
  Play,
  Pause,
  RefreshCw,
  Clock3,
  Trophy
} from "lucide-react";
import "./styles.css";

const API =
  import.meta.env.VITE_API_BASE ||
  "https://radioplacar-api.onrender.com/api";

const IMAGE_BASE = "https://sports.bzzoiro.com/img";

/* =========================
   DADOS DA API
========================= */

function getResults(data) {
  if (!data) return [];

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (Array.isArray(data.events)) {
    return data.events;
  }

  if (Array.isArray(data)) {
    if (data.length === 1 && Array.isArray(data[0]?.events)) {
      return data[0].events;
    }

    return data;
  }

  return [];
}

/* =========================
   STATUS
========================= */

function isLive(status) {
  const value = String(status || "").toLowerCase();

  return [
    "live",
    "1st_half",
    "2nd_half",
    "halftime",
    "extra_time",
    "penalties"
  ].includes(value);
}

function isFinished(status) {
  const value = String(status || "").toLowerCase();

  return [
    "finished",
    "ft",
    "after_extra_time",
    "after_penalties"
  ].includes(value);
}

/* =========================
   HORÁRIO
========================= */

function formatTime(dateString) {
  if (!dateString) return "--:--";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* =========================
   ESCUDO DO TIME
========================= */

function TeamLogo({ teamId, teamName }) {
  const [failed, setFailed] = useState(false);

  if (!teamId || failed) {
    return (
      <span>
        {teamName?.slice(0, 1)?.toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <img
      src={`${IMAGE_BASE}/team/${teamId}/?bg=transparent`}
      alt={teamName || "Time"}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{
        width: "38px",
        height: "38px",
        objectFit: "contain"
      }}
    />
  );
}

/* =========================
   CARD DA PARTIDA
========================= */

function MatchCard({ match }) {
  const live = isLive(match.status);
  const finished = isFinished(match.status);

  const homeScore = match.home_score;
  const awayScore = match.away_score;

  const hasScore =
    live ||
    finished ||
    homeScore != null ||
    awayScore != null;

  return (
    <div className="match-card">
      <div className="competition">
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          {match.league_id && (
            <img
              src={`${IMAGE_BASE}/league/${match.league_id}/?bg=transparent`}
              alt=""
              loading="lazy"
              style={{
                width: "18px",
                height: "18px",
                objectFit: "contain"
              }}
            />
          )}

          <Trophy size={12} />

          <span>
            Liga #{match.league_id || "-"}
          </span>
        </span>

        {live && (
          <span className="live-badge">
            AO VIVO
          </span>
        )}
      </div>

      <div className="teams">
        {/* TIME DA CASA */}

        <div className="team">
          <div className="team-logo">
            <TeamLogo
              teamId={match.home_team_id}
              teamName={match.home_team}
            />
          </div>

          <div className="team-name">
            {match.home_team || "Mandante"}
          </div>
        </div>

        {/* PLACAR */}

        <div className="score">
          <div className="score-number">
            {hasScore
              ? `${homeScore ?? 0} - ${awayScore ?? 0}`
              : "x"}
          </div>

          <div className="score-time">
            {live
              ? match.current_minute
                ? `${match.current_minute}'`
                : "AO VIVO"
              : finished
              ? "ENCERRADO"
              : formatTime(match.event_date)}
          </div>
        </div>

        {/* TIME VISITANTE */}

        <div className="team">
          <div className="team-logo">
            <TeamLogo
              teamId={match.away_team_id}
              teamName={match.away_team}
            />
          </div>

          <div className="team-name">
            {match.away_team || "Visitante"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   APLICATIVO
========================= */

function App() {
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [playing] = useState(false);

  /* =========================
     CARREGAR JOGOS
  ========================= */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [todayResponse, liveResponse] =
        await Promise.all([
          fetch(`${API}/today`),
          fetch(`${API}/live`)
        ]);

      if (!todayResponse.ok) {
        throw new Error(
          "Erro ao carregar jogos de hoje"
        );
      }

      if (!liveResponse.ok) {
        throw new Error(
          "Erro ao carregar jogos ao vivo"
        );
      }

      const todayData =
        await todayResponse.json();

      const liveData =
        await liveResponse.json();

      setMatches(getResults(todayData));
      setLiveMatches(getResults(liveData));
    } catch (err) {
      console.error(err);

      setError(
        "Não foi possível carregar os jogos agora."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     ATUALIZAÇÃO AUTOMÁTICA
  ========================= */

  useEffect(() => {
    loadData();

    const timer = setInterval(() => {
      loadData();
    }, 30000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  /* =========================
     IDENTIFICAR AO VIVO
  ========================= */

  const liveIds = useMemo(() => {
    return new Set(
      liveMatches.map((match) =>
        String(match.id)
      )
    );
  }, [liveMatches]);

  const normalizedMatches = useMemo(() => {
    return matches.map((match) => {
      if (liveIds.has(String(match.id))) {
        return {
          ...match,
          status:
            match.status === "notstarted"
              ? "live"
              : match.status
        };
      }

      return match;
    });
  }, [matches, liveIds]);

  const liveCount = useMemo(() => {
    return normalizedMatches.filter((match) =>
      isLive(match.status)
    ).length;
  }, [normalizedMatches]);

  /* =========================
     TELA
  ========================= */

  return (
    <div className="app">
      {/* CABEÇALHO */}

      <header className="header">
        <div className="brand">
          <div className="brand-name">
            RADIO<span>PLACAR</span>
          </div>

          <div className="brand-subtitle">
            ESPORTE EM TEMPO REAL
          </div>
        </div>

        <div className="header-live">
          AO VIVO {liveCount > 0 ? liveCount : ""}
        </div>
      </header>

      <main className="content">
        {/* DESTAQUE */}

        <section className="hero">
          <div className="hero-small">
            FUTEBOL + RÁDIO
          </div>

          <h1>
            Placar e emoção em tempo real
          </h1>

          <p>
            Acompanhe os jogos reais do dia e os
            placares atualizados pelo RádioPlacar.
          </p>
        </section>

        {/* JOGOS */}

        <div className="section-title">
          <h2>JOGOS DE HOJE</h2>

          <span className="section-count">
            {normalizedMatches.length}
          </span>
        </div>

        {loading && (
          <div className="loading">
            Carregando jogos...
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          normalizedMatches.length === 0 && (
            <div className="empty">
              Nenhum jogo encontrado agora.
            </div>
          )}

        {!loading &&
          !error &&
          normalizedMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
            />
          ))}

        {/* RÁDIOS */}

        <div className="section-title">
          <h2>RÁDIOS AO VIVO</h2>

          <span className="section-count">
            EM BREVE
          </span>
        </div>

        <div className="radio-card">
          <div className="radio-logo">
            <Radio size={22} />
          </div>

          <div className="radio-info">
            <div className="radio-name">
              RádioPlacar
            </div>

            <div className="radio-status">
              As rádios serão adicionadas somente
              com transmissões reais verificadas.
            </div>
          </div>

          <button
            className="play-button"
            type="button"
            disabled
            aria-label="Player ainda não disponível"
          >
            <Play size={17} />
          </button>
        </div>

        {/* ATUALIZAR */}

        <button
          type="button"
          onClick={loadData}
          className="radio-card"
          style={{
            width: "100%",
            color: "white"
          }}
        >
          <div className="radio-logo">
            <RefreshCw size={20} />
          </div>

          <div className="radio-info">
            <div className="radio-name">
              Atualizar placares
            </div>

            <div className="radio-status">
              Buscar novamente os dados reais
            </div>
          </div>

          <Clock3 size={19} />
        </button>
      </main>

      {/* PLAYER FIXO */}

      <div className="player">
        <div className="player-icon">
          <Radio size={21} />
        </div>

        <div className="player-info">
          <div className="player-station">
            RádioPlacar
          </div>

          <div className="player-match">
            Player preparado para rádios oficiais
          </div>
        </div>

        <button
          type="button"
          className="player-button"
          disabled
          aria-label="Player ainda não disponível"
        >
          {playing ? (
            <Pause size={18} />
          ) : (
            <Play size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

/* =========================
   INICIAR REACT
========================= */

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
