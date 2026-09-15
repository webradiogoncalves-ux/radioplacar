import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Radio,
  Search,
  ChevronLeft,
  Play,
  RefreshCw,
  CalendarDays,
  Trophy,
} from "lucide-react";
import "../styles.css";

const API = "https://radioplacar-api.onrender.com";

function abbreviation(name = "") {
  const clean = String(name).trim();

  if (!clean) return "---";

  const ignored = new Set([
    "fc",
    "cf",
    "sc",
    "ac",
    "ec",
    "club",
    "clube",
    "de",
    "da",
    "do",
    "dos",
    "das",
  ]);

  const words = clean
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);

  const useful = words.filter((word) => !ignored.has(word.toLowerCase()));

  if (useful.length >= 2) {
    return useful
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }

  return (useful[0] || words[0] || "---")
    .replace(/[^a-zA-ZÀ-ÿ0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

function getHomeName(match) {
  return (
    match?.home_team ||
    match?.time_casa ||
    match?.home?.name ||
    match?.teams?.home?.name ||
    "Mandante"
  );
}

function getAwayName(match) {
  return (
    match?.away_team ||
    match?.time_visitante ||
    match?.away?.name ||
    match?.teams?.away?.name ||
    "Visitante"
  );
}

function getHomeLogo(match) {
  return (
    match?.home_team_logo ||
    match?.logo_do_time_casa ||
    match?.logotipo_do_time_casa ||
    match?.home_logo ||
    match?.home?.logo ||
    match?.teams?.home?.logo ||
    null
  );
}

function getAwayLogo(match) {
  return (
    match?.away_team_logo ||
    match?.logo_do_time_fora ||
    match?.logotipo_do_time_visitante ||
    match?.away_logo ||
    match?.away?.logo ||
    match?.teams?.away?.logo ||
    null
  );
}

function getLeagueLogo(match) {
  return (
    match?.league_logo ||
    match?.logo_da_liga ||
    match?.logotipo_da_liga ||
    match?.league?.logo ||
    null
  );
}

function getHomeScore(match) {
  const values = [
    match?.home_score,
    match?.placar_casa,
    match?.placar_em_casa,
    match?.goals?.home,
  ];

  return values.find((value) => value !== null && value !== undefined);
}

function getAwayScore(match) {
  const values = [
    match?.away_score,
    match?.placar_visitante,
    match?.placar_fora,
    match?.goals?.away,
  ];

  return values.find((value) => value !== null && value !== undefined);
}

function getStatus(match) {
  return String(match?.status || "").toLowerCase();
}

function isScheduled(match) {
  return [
    "notstarted",
    "not_started",
    "scheduled",
    "agendado",
    "não_iniciado",
    "nao_iniciado",
    "ns",
  ].includes(getStatus(match));
}

function isFinished(match) {
  return [
    "finished",
    "finalizado",
    "encerrado",
    "ended",
    "ft",
    "afterpenalties",
    "after_penalties",
  ].includes(getStatus(match));
}

function isPostponed(match) {
  return ["postponed", "adiado", "cancelled", "canceled"].includes(
    getStatus(match)
  );
}

function isLive(match) {
  const status = getStatus(match);

  if (isScheduled(match) || isFinished(match) || isPostponed(match)) {
    return false;
  }

  return [
    "inprogress",
    "in_progress",
    "live",
    "1st_half",
    "2nd_half",
    "halftime",
    "half_time",
    "extra_time",
    "penalties",
  ].includes(status);
}

function formatClock(match) {
  const minute =
    match?.current_minute ??
    match?.minuto_atual ??
    match?.fixture?.status?.elapsed ??
    null;

  if (minute === null || minute === undefined || minute === "") {
    return "";
  }

  if (typeof minute === "string" && minute.includes(":")) {
    return minute;
  }

  const numeric = Number(minute);

  if (!Number.isNaN(numeric)) {
    return `${String(Math.max(0, Math.floor(numeric))).padStart(2, "0")}:00`;
  }

  return String(minute);
}

function formatMatchTime(match) {
  const raw = match?.event_date || match?.data_do_evento;

  if (!raw) return "--:--";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function statusLabel(match) {
  if (isLive(match)) {
    const clock = formatClock(match);
    return clock || "AO VIVO";
  }

  if (isFinished(match)) return "ENCERRADO";
  if (isPostponed(match)) return "ADIADO";
  if (isScheduled(match)) return formatMatchTime(match);

  return String(match?.status || "").toUpperCase() || "PARTIDA";
}

function competitionName(match) {
  return (
    match?.league?.name ||
    match?.league_name ||
    match?.nome_da_liga ||
    match?.competition_name ||
    `CAMPEONATO ${match?.league_id ?? match?.id_da_liga ?? ""}`.trim()
  );
}

function matchRadios(match) {
  if (!Array.isArray(match?.radios)) return [];

  return match.radios
    .map((item) => {
      if (item?.radio) {
        return {
          ...item.radio,
          association: item,
        };
      }

      return item;
    })
    .filter(Boolean);
}

function TeamBadge({ name, logo }) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logo) && !failed;

  return (
    <div className="team">
      <div className={`team-badge ${showLogo ? "has-logo" : ""}`}>
        {showLogo ? (
          <img
            src={logo}
            alt={`Escudo ${name}`}
            className="team-logo"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <span>{abbreviation(name)}</span>
        )}
      </div>

      <div className="team-name">{name}</div>
    </div>
  );
}

function LeagueTitle({ match }) {
  const [failed, setFailed] = useState(false);
  const logo = getLeagueLogo(match);

  return (
    <div className="competition-title">
      {logo && !failed ? (
        <img
          src={logo}
          alt=""
          className="league-logo"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Trophy size={17} />
      )}

      <span>{competitionName(match)}</span>
    </div>
  );
}

function ScoreArea({ match }) {
  if (isScheduled(match)) {
    return (
      <div className="score-area scheduled-score">
        <div className="scheduled-time">{formatMatchTime(match)}</div>
        <div className="scheduled-label">AGENDADO</div>
      </div>
    );
  }

  if (isPostponed(match)) {
    return (
      <div className="score-area scheduled-score">
        <div className="scheduled-time">—</div>
        <div className="scheduled-label">ADIADO</div>
      </div>
    );
  }

  const home = getHomeScore(match);
  const away = getAwayScore(match);

  return (
    <div className="score-area">
      <div className="score">
        <span>{home ?? "-"}</span>
        <span className="score-separator">-</span>
        <span>{away ?? "-"}</span>
      </div>

      <div className={`match-status ${isLive(match) ? "live" : ""}`}>
        {statusLabel(match)}
      </div>
    </div>
  );
}

function RadioRow({ radio, compact = false }) {
  const stream = radio?.stream;
  const verified = radio?.stream_verified === true && Boolean(stream);

  function playRadio(event) {
    event.stopPropagation();

    if (!verified) return;

    window.open(stream, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`radio-row ${compact ? "compact" : ""}`}>
      <div className="radio-icon">
        <Radio size={20} />
      </div>

      <div className="radio-info">
        <strong>{radio?.name || radio?.nome || "Rádio"}</strong>

        <span>
          {[radio?.cidade, radio?.estado || radio?.state]
            .filter(Boolean)
            .join(" · ") || "Rádio esportiva"}
        </span>
      </div>

      <button
        type="button"
        className={`play-button ${verified ? "enabled" : "disabled"}`}
        disabled={!verified}
        onClick={playRadio}
        title={
          verified
            ? "Ouvir transmissão"
            : "Áudio ainda não verificado"
        }
      >
        <Play size={18} fill="currentColor" />
      </button>
    </div>
  );
}

function MatchCard({ match, onOpen }) {
  const radios = matchRadios(match);

  return (
    <button
      type="button"
      className="match-card"
      onClick={() => onOpen(match)}
    >
      <div className="match-card-content">
        <TeamBadge
          name={getHomeName(match)}
          logo={getHomeLogo(match)}
        />

        <ScoreArea match={match} />

        <TeamBadge
          name={getAwayName(match)}
          logo={getAwayLogo(match)}
        />
      </div>

      {radios.length > 0 && (
        <div className="match-radio-summary">
          <Radio size={15} />
          <span>
            {radios.length === 1
              ? "1 rádio transmitindo"
              : `${radios.length} rádios transmitindo`}
          </span>
        </div>
      )}
    </button>
  );
}

function MatchDetail({ match, onBack }) {
  const radios = matchRadios(match);

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          <ChevronLeft size={25} />
        </button>

        <div>
          <strong>RadioPlacar</strong>
          <span>DETALHES DA PARTIDA</span>
        </div>
      </header>

      <main className="detail-content">
        <section className="detail-competition">
          <LeagueTitle match={match} />
        </section>

        <section className="detail-score-card">
          <TeamBadge
            name={getHomeName(match)}
            logo={getHomeLogo(match)}
          />

          <ScoreArea match={match} />

          <TeamBadge
            name={getAwayName(match)}
            logo={getAwayLogo(match)}
          />
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <Radio size={19} />
            <h2>RÁDIOS TRANSMITINDO</h2>
          </div>

          {radios.length > 0 ? (
            <div className="detail-radios">
              {radios.map((radio, index) => (
                <RadioRow
                  key={`${radio?.id || radio?.radio_id || "radio"}-${index}`}
                  radio={radio}
                />
              ))}
            </div>
          ) : (
            <div className="empty-card">
              <Radio size={26} />
              <strong>Nenhuma rádio confirmada</strong>
              <span>
                A partida continua disponível com placar e informações ao vivo.
              </span>
            </div>
          )}
        </section>

        <section className="detail-section">
          <div className="section-heading">
            <CalendarDays size={19} />
            <h2>PARTIDA</h2>
          </div>

          <div className="match-info-card">
            <div>
              <span>Status</span>
              <strong>{statusLabel(match)}</strong>
            </div>

            <div>
              <span>Horário</span>
              <strong>{formatMatchTime(match)}</strong>
            </div>

            <div>
              <span>Competição</span>
              <strong>{competitionName(match)}</strong>
            </div>
          </div>
        </section>

        <div className="detail-slogan">
          O JOGO ACONTECE AQUI.
        </div>
      </main>
    </div>
  );
}

function RadioCatalog({ radios }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return radios;

    return radios.filter((radio) => {
      const text = [
        radio?.name,
        radio?.nome,
        radio?.cidade,
        radio?.estado,
        radio?.state,
        radio?.country,
        radio?.país,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [radios, search]);

  const grouped = useMemo(() => {
    const groups = {};

    filtered.forEach((radio) => {
      const state =
        radio?.estado ||
        radio?.state ||
        "OUTRAS";

      if (!groups[state]) groups[state] = [];
      groups[state].push(radio);
    });

    return Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [filtered]);

  return (
    <main className="page-content radio-page">
      <section className="radio-page-title">
        <div>
          <span>RADIOPLACAR</span>
          <h1>Rádios esportivas</h1>
        </div>

        <Radio size={31} />
      </section>

      <div className="search-box">
        <Search size={19} />

        <input
          type="search"
          placeholder="Buscar rádio, cidade ou estado..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {grouped.length === 0 ? (
        <div className="empty-card">
          <Search size={26} />
          <strong>Nenhuma rádio encontrada</strong>
          <span>Tente outra busca.</span>
        </div>
      ) : (
        grouped.map(([state, stateRadios]) => (
          <section className="radio-state-section" key={state}>
            <div className="state-heading">
              <span>{state}</span>
              <small>{stateRadios.length}</small>
            </div>

            <div className="radio-list">
              {stateRadios.map((radio, index) => (
                <RadioRow
                  key={`${radio?.id || "radio"}-${index}`}
                  radio={radio}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function Home({
  matches,
  loading,
  error,
  onRefresh,
  onOpenMatch,
}) {
  const groups = useMemo(() => {
    const result = new Map();

    matches.forEach((match) => {
      const name = competitionName(match);

      if (!result.has(name)) {
        result.set(name, []);
      }

      result.get(name).push(match);
    });

    return [...result.entries()];
  }, [matches]);

  return (
    <main className="page-content">
      <section className="hero">
        <div className="hero-brand">RADIOPLACAR</div>
        <h1>O jogo acontece aqui.</h1>
        <p>
          Placar, futebol e rádios esportivas em um só lugar.
        </p>
      </section>

      <section className="date-tabs">
        <button type="button">ONTEM</button>
        <button type="button" className="active">
          HOJE
        </button>
        <button type="button">AMANHÃ</button>
      </section>

      <div className="feed-toolbar">
        <div>
          <span>PARTIDAS</span>
          <strong>{matches.length}</strong>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw
            size={18}
            className={loading ? "spin" : ""}
          />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="error-card">
          <strong>Não foi possível atualizar agora.</strong>
          <span>{error}</span>
        </div>
      )}

      {loading && matches.length === 0 ? (
        <div className="loading-card">
          <RefreshCw size={28} className="spin" />
          <strong>Carregando partidas...</strong>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-card">
          <Trophy size={27} />
          <strong>Nenhuma partida encontrada</strong>
          <span>Não há jogos disponíveis para hoje.</span>
        </div>
      ) : (
        groups.map(([competition, competitionMatches]) => (
          <section className="competition-section" key={competition}>
            <LeagueTitle match={competitionMatches[0]} />

            <div className="matches-list">
              {competitionMatches.map((match, index) => (
                <MatchCard
                  key={match?.id || `${competition}-${index}`}
                  match={match}
                  onOpen={onOpenMatch}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function App() {
  const [matches, setMatches] = useState([]);
  const [radios, setRadios] = useState([]);
  const [activeTab, setActiveTab] = useState("games");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMatches(showLoading = true) {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch(`${API}/api/today`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`API respondeu ${response.status}`);
      }

      const data = await response.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.response)
        ? data.response
        : Array.isArray(data?.matches)
        ? data.matches
        : [];

      setMatches(list);
      setError("");

      setSelectedMatch((current) => {
        if (!current) return null;

        const updated = list.find(
          (item) => String(item?.id) === String(current?.id)
        );

        return updated || current;
      });
    } catch (err) {
      setError(err?.message || "Erro ao carregar partidas.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function loadRadios() {
    try {
      const response = await fetch(`${API}/api/radios`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = await response.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.response)
        ? data.response
        : Array.isArray(data?.radios)
        ? data.radios
        : [];

      setRadios(list);
    } catch {
      // O placar continua funcionando mesmo se o catálogo falhar.
    }
  }

  useEffect(() => {
    loadMatches(true);
    loadRadios();

    const interval = window.setInterval(() => {
      loadMatches(false);
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

  if (selectedMatch) {
    return (
      <MatchDetail
        match={selectedMatch}
        onBack={() => setSelectedMatch(null)}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-radio">
            <Radio size={22} />
          </div>

          <div>
            <strong>RADIOPLACAR</strong>
            <span>FUTEBOL + RÁDIO</span>
          </div>
        </div>

        <div className="live-pill">
          <span />
          AO VIVO
        </div>
      </header>

      {activeTab === "games" ? (
        <Home
          matches={matches}
          loading={loading}
          error={error}
          onRefresh={() => loadMatches(true)}
          onOpenMatch={setSelectedMatch}
        />
      ) : (
        <RadioCatalog radios={radios} />
      )}

      <nav className="bottom-nav">
        <button
          type="button"
          className={activeTab === "games" ? "active" : ""}
          onClick={() => setActiveTab("games")}
        >
          <Trophy size={21} />
          <span>Jogos</span>
        </button>

        <button
          type="button"
          className={activeTab === "radios" ? "active" : ""}
          onClick={() => setActiveTab("radios")}
        >
          <Radio size={21} />
          <span>Rádios</span>
        </button>
      </nav>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
