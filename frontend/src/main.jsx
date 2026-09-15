import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";

const API = "https://radioplacar-api.onrender.com";

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function abbreviation(name = "") {
  const clean = normalize(name)
    .replace(/\b(CLUB|CLUBE|ESPORTE|SPORT|FUTEBOL|FOOTBALL|FC|SC|EC|CA|CR)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const special = {
    "VASCO DA GAMA": "VAS",
    "INDEPENDIENTE SANTA FE": "SFE",
    "CLUB ATLETICO PLATENSE": "PLA",
    PLATENSE: "PLA",
    FLUMINENSE: "FLU",
    FLAMENGO: "FLA",
    CORINTHIANS: "COR",
    PALMEIRAS: "PAL",
    SANTOS: "SAN",
    "SAO PAULO": "SAO",
    "ATLETICO MINEIRO": "CAM",
    GREMIO: "GRE",
    INTERNACIONAL: "INT",
    BOTAFOGO: "BOT",
  };

  if (special[normalize(name)]) {
    return special[normalize(name)];
  }

  const words = clean
    .split(" ")
    .filter(
      (word) =>
        word &&
        !["DA", "DE", "DO", "DAS", "DOS", "DEL", "LA"].includes(word)
    );

  if (words.length === 1) {
    return words[0].slice(0, 3);
  }

  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .slice(0, 3);
  }

  return words.join("").slice(0, 3);
}

function formatScore(score) {
  return score === null || score === undefined ? "0" : String(score);
}

function getStatus(match) {
  const status = String(match?.status || "").toLowerCase();

  if (
    status.includes("finished") ||
    status.includes("ended") ||
    status.includes("fulltime")
  ) {
    return "ENCERRADO";
  }

  if (
    status.includes("halftime") ||
    status.includes("interval")
  ) {
    return "INTERVALO";
  }

  if (
    status.includes("progress") ||
    status.includes("live") ||
    status.includes("first") ||
    status.includes("second")
  ) {
    return "AO VIVO";
  }

  return "AGENDADO";
}

function formatClock(match) {
  const minute =
    match?.current_minute ??
    match?.minuto_atual ??
    null;

  if (minute === null || minute === undefined) {
    const date = match?.event_date;

    if (!date) return "--:--";

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(date));
    } catch {
      return "--:--";
    }
  }

  if (typeof minute === "string" && minute.includes(":")) {
    return minute;
  }

  const numericMinute = Number(minute);

  if (!Number.isFinite(numericMinute)) {
    return "--:--";
  }

  return `${String(Math.floor(numericMinute)).padStart(2, "0")}:00`;
}

function Team({ name }) {
  return (
    <div className="team">
      <div className="team-badge">
        {abbreviation(name)}
      </div>

      <div className="team-full-name">
        {name || "Time"}
      </div>
    </div>
  );
}

function RadioRow({ item }) {
  const radio = item?.radio || {};
  const playable =
    radio?.stream_verified === true &&
    Boolean(radio?.stream);

  function playRadio(event) {
    event.stopPropagation();

    if (!playable) return;

    window.open(radio.stream, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="radio-row">
      <div className="radio-symbol">📻</div>

      <div className="radio-info">
        <strong>{radio?.name || item?.radio_id || "Rádio"}</strong>

        <span>
          {radio?.cidade || ""}
          {radio?.estado || radio?.state
            ? ` • ${radio?.estado || radio?.state}`
            : ""}
        </span>
      </div>

      <button
        type="button"
        className={`play-button ${!playable ? "disabled" : ""}`}
        disabled={!playable}
        onClick={playRadio}
        title={
          playable
            ? "Ouvir rádio"
            : "Áudio ainda não verificado"
        }
      >
        ▶
      </button>
    </div>
  );
}

function MatchCard({ match, onOpen }) {
  const homeName =
    match?.home_team ||
    match?.teams?.home?.name ||
    "Mandante";

  const awayName =
    match?.away_team ||
    match?.teams?.away?.name ||
    "Visitante";

  const homeScore =
    match?.home_score ??
    match?.placar_em_casa ??
    match?.goals?.home ??
    null;

  const awayScore =
    match?.away_score ??
    match?.placar_fora ??
    match?.goals?.away ??
    null;

  const radios = Array.isArray(match?.radios)
    ? match.radios.filter(
        (item) =>
          item?.active !== false &&
          item?.match_confirmed !== false
      )
    : [];

  const status = getStatus(match);

  return (
    <article
      className="match-card"
      onClick={() => onOpen(match)}
    >
      <div className="match-card-top">
        <span
          className={`status-pill ${
            status === "AO VIVO" ? "live" : ""
          }`}
        >
          {status}
        </span>

        <span className="match-clock">
          {formatClock(match)}
        </span>
      </div>

      <div className="scoreboard">
        <Team name={homeName} />

        <div className="score-center">
          <div className="score">
            <span>{formatScore(homeScore)}</span>
            <b>-</b>
            <span>{formatScore(awayScore)}</span>
          </div>

          <small>
            {match?.round_label ||
              match?.round_name ||
              match?.stage_name ||
              "Partida"}
          </small>
        </div>

        <Team name={awayName} />
      </div>

      {radios.length > 0 && (
        <div className="match-radios">
          <div className="radio-title">
            RÁDIOS TRANSMITINDO
          </div>

          {radios.map((radio, index) => (
            <RadioRow
              key={`${match.id}-${radio.radio_id}-${index}`}
              item={radio}
            />
          ))}
        </div>
      )}

      <div className="open-match">
        TOQUE PARA ABRIR A PARTIDA ›
      </div>
    </article>
  );
}

function MatchDetail({ match, onBack }) {
  if (!match) return null;

  const homeName = match?.home_team || "Mandante";
  const awayName = match?.away_team || "Visitante";

  const homeScore =
    match?.home_score ??
    match?.placar_em_casa ??
    null;

  const awayScore =
    match?.away_score ??
    match?.placar_fora ??
    null;

  const radios = Array.isArray(match?.radios)
    ? match.radios
    : [];

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          ‹
        </button>

        <div>
          <strong>PARTIDA</strong>
          <span>
            {match?.league_name ||
              match?.league?.name ||
              "RadioPlacar"}
          </span>
        </div>

        <div className="detail-live-dot">●</div>
      </header>

      <main className="detail-content">
        <div className="detail-competition">
          {match?.round_label ||
            match?.round_name ||
            match?.stage_name ||
            "Futebol ao vivo"}
        </div>

        <section className="detail-scoreboard">
          <Team name={homeName} />

          <div className="detail-score-center">
            <div className="detail-clock">
              {formatClock(match)}
            </div>

            <div className="detail-score">
              {formatScore(homeScore)}
              <span>-</span>
              {formatScore(awayScore)}
            </div>

            <div className="detail-status">
              {getStatus(match)}
            </div>
          </div>

          <Team name={awayName} />
        </section>

        <section className="detail-section">
          <h2>📻 RÁDIOS TRANSMITINDO</h2>

          {radios.length > 0 ? (
            radios.map((radio, index) => (
              <RadioRow
                key={`${radio.radio_id}-${index}`}
                item={radio}
              />
            ))
          ) : (
            <div className="empty-small">
              Nenhuma rádio confirmada para esta partida.
            </div>
          )}
        </section>

        <section className="detail-section">
          <h2>⚽ PARTIDA</h2>

          <div className="match-data-row">
            <span>Status</span>
            <strong>{getStatus(match)}</strong>
          </div>

          <div className="match-data-row">
            <span>Horário / relógio</span>
            <strong>{formatClock(match)}</strong>
          </div>

          {match?.venue_id && (
            <div className="match-data-row">
              <span>Estádio</span>
              <strong>#{match.venue_id}</strong>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RadioCatalog({ radios, loading }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const text = normalize(search);

    return radios.filter((radio) => {
      if (!text) return true;

      return normalize(
        `${radio.name} ${radio.cidade || ""} ${
          radio.estado || radio.state || ""
        }`
      ).includes(text);
    });
  }, [radios, search]);

  const grouped = useMemo(() => {
    const groups = {};

    filtered.forEach((radio) => {
      const state =
        radio.estado ||
        radio.state ||
        "OUTRAS";

      if (!groups[state]) {
        groups[state] = [];
      }

      groups[state].push(radio);
    });

    return groups;
  }, [filtered]);

  return (
    <main className="page-content radios-page">
      <div className="page-title">
        <div>
          <span>CATÁLOGO</span>
          <h1>Rádios esportivas</h1>
        </div>

        <strong>{radios.length}</strong>
      </div>

      <input
        className="radio-search"
        placeholder="Buscar rádio, cidade ou estado..."
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
      />

      {loading && (
        <div className="loading-box">
          Carregando rádios...
        </div>
      )}

      {!loading &&
        Object.entries(grouped)
          .sort(([a], [b]) =>
            a.localeCompare(b, "pt-BR")
          )
          .map(([state, list]) => (
            <section
              className="radio-state"
              key={state}
            >
              <h2>{state}</h2>

              {list.map((radio) => {
                const playable =
                  radio.stream_verified === true &&
                  Boolean(radio.stream);

                return (
                  <div
                    className="catalog-radio"
                    key={radio.id}
                  >
                    <div className="catalog-radio-icon">
                      📻
                    </div>

                    <div className="catalog-radio-text">
                      <strong>{radio.name}</strong>
                      <span>
                        {radio.cidade || "Brasil"}
                      </span>
                    </div>

                    <div
                      className={`catalog-status ${
                        playable ? "available" : ""
                      }`}
                    >
                      {playable
                        ? "▶"
                        : "SEM ÁUDIO"}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}

      {!loading && filtered.length === 0 && (
        <div className="empty-box">
          Nenhuma rádio encontrada.
        </div>
      )}
    </main>
  );
}

function App() {
  const [tab, setTab] = useState("games");
  const [matches, setMatches] = useState([]);
  const [radios, setRadios] = useState([]);
  const [selectedMatch, setSelectedMatch] =
    useState(null);

  const [loadingMatches, setLoadingMatches] =
    useState(true);

  const [loadingRadios, setLoadingRadios] =
    useState(true);

  const [error, setError] = useState("");

  async function loadMatches(showLoading = false) {
    try {
      if (showLoading) {
        setLoadingMatches(true);
      }

      const response = await fetch(
        `${API}/api/today`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `API respondeu ${response.status}`
        );
      }

      const data = await response.json();

      const list = Array.isArray(data?.response)
        ? data.response
        : [];

      setMatches(list);
      setError("");
    } catch (err) {
      console.error(err);

      setError(
        "Não foi possível carregar as partidas."
      );
    } finally {
      setLoadingMatches(false);
    }
  }

  async function loadRadios() {
    try {
      setLoadingRadios(true);

      const response = await fetch(
        `${API}/api/radios`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `API respondeu ${response.status}`
        );
      }

      const data = await response.json();

      setRadios(
        Array.isArray(data?.response)
          ? data.response
          : []
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRadios(false);
    }
  }

  useEffect(() => {
    loadMatches(true);
    loadRadios();

    const interval = window.setInterval(() => {
      loadMatches(false);
    }, 20000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const groupedMatches = useMemo(() => {
    const groups = {};

    matches.forEach((match) => {
      const league =
        match?.league_name ||
        match?.league?.name ||
        match?.competition_name ||
        `CAMPEONATO ${match?.league_id || ""}`;

      if (!groups[league]) {
        groups[league] = [];
      }

      groups[league].push(match);
    });

    return groups;
  }, [matches]);

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
          <div className="brand-icon">🎙</div>

          <div className="brand-name">
            RADIO<span>PLACAR</span>
          </div>
        </div>

        <div className="live-indicator">
          <i />
          AO VIVO
        </div>
      </header>

      {tab === "games" && (
        <main className="page-content">
          <section className="hero">
            <span>FUTEBOL + RÁDIO</span>
            <h1>O jogo acontece aqui.</h1>
            <p>
              Placar em tempo real e as rádios
              confirmadas em cada partida.
            </p>
          </section>

          <div className="date-tabs">
            <button type="button">
              ONTEM
            </button>

            <button
              type="button"
              className="active"
            >
              HOJE
            </button>

            <button type="button">
              AMANHÃ
            </button>
          </div>

          {loadingMatches && (
            <div className="loading-box">
              Carregando partidas...
            </div>
          )}

          {error && (
            <div className="error-box">
              {error}

              <button
                type="button"
                onClick={() =>
                  loadMatches(true)
                }
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loadingMatches &&
            !error &&
            matches.length === 0 && (
              <div className="empty-box">
                Nenhuma partida encontrada hoje.
              </div>
            )}

          {!loadingMatches &&
            Object.entries(groupedMatches).map(
              ([league, games]) => (
                <section
                  className="competition"
                  key={league}
                >
                  <div className="competition-title">
                    <div>
                      <span>🏆</span>
                      <strong>{league}</strong>
                    </div>

                    <small>
                      {games.length}{" "}
                      {games.length === 1
                        ? "jogo"
                        : "jogos"}
                    </small>
                  </div>

                  {games.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onOpen={setSelectedMatch}
                    />
                  ))}
                </section>
              )
            )}
        </main>
      )}

      {tab === "radios" && (
        <RadioCatalog
          radios={radios}
          loading={loadingRadios}
        />
      )}

      <nav className="bottom-nav">
        <button
          type="button"
          className={
            tab === "games" ? "active" : ""
          }
          onClick={() => setTab("games")}
        >
          <span>⚽</span>
          JOGOS
        </button>

        <button
          type="button"
          className={
            tab === "radios" ? "active" : ""
          }
          onClick={() => setTab("radios")}
        >
          <span>📻</span>
          RÁDIOS
        </button>
      </nav>
    </div>
  );
}

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
