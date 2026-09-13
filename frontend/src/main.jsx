import React, {
  useEffect,
  useMemo,
  useState
} from "react";

import ReactDOM from "react-dom/client";

import {
  Radio,
  Play,
  Pause,
  RefreshCw,
  Clock3,
  Trophy,
  MapPin,
  ChevronDown,
  ChevronUp,
  ArrowLeft
} from "lucide-react";

import "./styles.css";

const API =
  import.meta.env.VITE_API_BASE ||
  "https://radioplacar-api.onrender.com/api";

const IMAGE_BASE =
  "https://sports.bzzoiro.com/img";

/* =========================
   NORMALIZAR RESPOSTAS
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
    if (
      data.length === 1 &&
      Array.isArray(data[0]?.events)
    ) {
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
  const value =
    String(status || "").toLowerCase();

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
  const value =
    String(status || "").toLowerCase();

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
  if (!dateString) {
    return "--:--";
  }

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "--:--";
  }

  return date.toLocaleTimeString(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

/* =========================
   DATA
========================= */

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );
}

/* =========================
   ESCUDO DO TIME
========================= */

function TeamLogo({
  teamId,
  teamName
}) {
  const [
    failed,
    setFailed
  ] = useState(false);

  if (
    !teamId ||
    failed
  ) {
    return (
      <span>
        {teamName
          ?.slice(0, 1)
          ?.toUpperCase() ||
          "?"}
      </span>
    );
  }

  return (
    <img
      src={`${IMAGE_BASE}/team/${teamId}/?bg=transparent`}
      alt={
        teamName || "Time"
      }
      loading="lazy"
      onError={() =>
        setFailed(true)
      }
    />
  );
}

/* =========================
   LOGO DA LIGA
========================= */

function LeagueLogo({
  leagueId,
  leagueName
}) {
  const [
    failed,
    setFailed
  ] = useState(false);

  if (
    !leagueId ||
    failed
  ) {
    return (
      <Trophy size={16} />
    );
  }

  return (
    <img
      src={`${IMAGE_BASE}/league/${leagueId}/?bg=transparent`}
      alt={
        leagueName ||
        "Competição"
      }
      loading="lazy"
      onError={() =>
        setFailed(true)
      }
      style={{
        width: "22px",
        height: "22px",
        objectFit: "contain"
      }}
    />
  );
}

/* =========================
   CARD DO JOGO
========================= */

function MatchCard({
  match,
  onOpen
}) {
  const live =
    isLive(match.status);

  const finished =
    isFinished(
      match.status
    );

  const homeScore =
    match.home_score;

  const awayScore =
    match.away_score;

  const hasScore =
    live ||
    finished ||
    homeScore != null ||
    awayScore != null;

  return (
    <button
      type="button"
      onClick={() =>
        onOpen(match)
      }
      className="match-card"
      style={{
        width: "100%",
        color: "#ffffff",
        textAlign: "initial"
      }}
    >
      <div className="teams">
        <div className="team">
          <div className="team-logo">
            <TeamLogo
              teamId={
                match.home_team_id
              }
              teamName={
                match.home_team
              }
            />
          </div>

          <div className="team-name">
            {match.home_team ||
              "Mandante"}
          </div>
        </div>

        <div className="score">
          <div className="score-number">
            {hasScore
              ? `${
                  homeScore ?? 0
                } - ${
                  awayScore ?? 0
                }`
              : "x"}
          </div>

          <div className="score-time">
            {live
              ? match.current_minute
                ? `${match.current_minute}'`
                : "AO VIVO"
              : finished
              ? "ENCERRADO"
              : formatTime(
                  match.event_date
                )}
          </div>
        </div>

        <div className="team">
          <div className="team-logo">
            <TeamLogo
              teamId={
                match.away_team_id
              }
              teamName={
                match.away_team
              }
            />
          </div>

          <div className="team-name">
            {match.away_team ||
              "Visitante"}
          </div>
        </div>
      </div>

      {live && (
        <div
          style={{
            marginTop: "12px",
            textAlign: "center"
          }}
        >
          <span className="live-badge">
            AO VIVO
          </span>
        </div>
      )}
    </button>
  );
}

/* =========================
   GRUPO DE COMPETIÇÃO
========================= */

function CompetitionGroup({
  group,
  open,
  onToggle,
  onOpenMatch
}) {
  return (
    <section
      style={{
        marginBottom: "14px"
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "13px 14px",
          marginBottom:
            open
              ? "10px"
              : "0",
          display: "flex",
          alignItems: "center",
          gap: "11px",
          borderRadius:
            "16px",
          background:
            "rgba(14,90,150,0.22)",
          border:
            "1px solid rgba(92,200,242,0.12)",
          color: "#ffffff",
          textAlign: "left"
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            flex: "0 0 42px",
            display: "grid",
            placeItems: "center",
            borderRadius:
              "12px",
            background:
              "rgba(255,255,255,0.07)"
          }}
        >
          <LeagueLogo
            leagueId={
              group.leagueId
            }
            leagueName={
              group.name
            }
          />
        </div>

        <div
          style={{
            minWidth: 0,
            flex: 1
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: "5px",
              color:
                "#5cc8f2",
              fontSize:
                "9px",
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.7px"
            }}
          >
            <MapPin size={10} />

            {group.country}
          </div>

          <div
            style={{
              marginTop:
                "3px",
              color: "#fff",
              fontSize:
                "14px",
              fontWeight: 900,
              lineHeight: 1.2
            }}
          >
            {group.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "8px"
          }}
        >
          <span className="section-count">
            {
              group.matches
                .length
            }
          </span>

          {open ? (
            <ChevronUp
              size={18}
              color="#5cc8f2"
            />
          ) : (
            <ChevronDown
              size={18}
              color="#5cc8f2"
            />
          )}
        </div>
      </button>

      {open &&
        group.matches.map(
          (match) => (
            <MatchCard
              key={
                match.id
              }
              match={match}
              onOpen={
                onOpenMatch
              }
            />
          )
        )}
    </section>
  );
}

/* =========================
   TELA DE DETALHES
========================= */

function MatchDetails({
  match,
  league,
  onBack
}) {
  const [
    detail,
    setDetail
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${API}/fixture/${match.id}`
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Erro ao carregar detalhes"
          );
        }

        const data =
          await response.json();

        if (active) {
          setDetail(data);
        }
      } catch (err) {
        console.error(err);

        if (active) {
          setError(
            "Não foi possível carregar os detalhes desta partida."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [match.id]);

  const data =
    detail || match;

  const live =
    isLive(data.status);

  const finished =
    isFinished(
      data.status
    );

  const hasScore =
    live ||
    finished ||
    data.home_score !=
      null ||
    data.away_score !=
      null;

  const h2h =
    data.head_to_head;

  const recentMatches =
    Array.isArray(
      h2h?.recent_matches
    )
      ? h2h.recent_matches
      : [];

  return (
    <div className="app">
      <header className="header">
        <button
          type="button"
          onClick={onBack}
          style={{
            width: "42px",
            height: "42px",
            display: "grid",
            placeItems:
              "center",
            borderRadius:
              "50%",
            background:
              "rgba(255,255,255,0.08)",
            color: "#ffffff"
          }}
        >
          <ArrowLeft
            size={21}
          />
        </button>

        <div
          style={{
            flex: 1,
            marginLeft:
              "12px"
          }}
        >
          <div className="brand-name">
            RADIO
            <span>
              PLACAR
            </span>
          </div>

          <div className="brand-subtitle">
            DETALHES DO JOGO
          </div>
        </div>
      </header>

      <main className="content">
        <div
          style={{
            padding:
              "16px",
            marginBottom:
              "15px",
            borderRadius:
              "18px",
            background:
              "rgba(14,90,150,0.22)",
            border:
              "1px solid rgba(92,200,242,0.12)"
          }}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: "10px"
            }}
          >
            <LeagueLogo
              leagueId={
                data.league_id
              }
              leagueName={
                league?.name
              }
            />

            <div>
              <div
                style={{
                  fontSize:
                    "13px",
                  fontWeight:
                    900
                }}
              >
                {league?.name ||
                  `Liga ${data.league_id}`}
              </div>

              <div
                style={{
                  marginTop:
                    "3px",
                  color:
                    "#5cc8f2",
                  fontSize:
                    "10px"
                }}
              >
                {league?.country ||
                  "Competição"}
              </div>
            </div>
          </div>
        </div>

        <div className="match-card">
          <div className="teams">
            <div className="team">
              <div className="team-logo">
                <TeamLogo
                  teamId={
                    data.home_team_id
                  }
                  teamName={
                    data.home_team
                  }
                />
              </div>

              <div className="team-name">
                {data.home_team ||
                  "Mandante"}
              </div>
            </div>

            <div className="score">
              <div className="score-number">
                {hasScore
                  ? `${
                      data.home_score ??
                      0
                    } - ${
                      data.away_score ??
                      0
                    }`
                  : "x"}
              </div>

              <div className="score-time">
                {live
                  ? data.current_minute
                    ? `${data.current_minute}'`
                    : "AO VIVO"
                  : finished
                  ? "ENCERRADO"
                  : formatTime(
                      data.event_date
                    )}
              </div>
            </div>

            <div className="team">
              <div className="team-logo">
                <TeamLogo
                  teamId={
                    data.away_team_id
                  }
                  teamName={
                    data.away_team
                  }
                />
              </div>

              <div className="team-name">
                {data.away_team ||
                  "Visitante"}
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="loading">
            Carregando detalhes...
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {!loading &&
          !error && (
            <>
              <div className="section-title">
                <h2>
                  INFORMAÇÕES
                </h2>
              </div>

              <div className="radio-card">
                <div className="radio-info">
                  <div className="radio-name">
                    Data e horário
                  </div>

                  <div className="radio-status">
                    {formatDate(
                      data.event_date
                    )}
                    {" • "}
                    {formatTime(
                      data.event_date
                    )}
                  </div>
                </div>
              </div>

              {data.round_number !=
                null && (
                <div className="radio-card">
                  <div className="radio-info">
                    <div className="radio-name">
                      Rodada
                    </div>

                    <div className="radio-status">
                      {data.round_label ||
                        data.round_name ||
                        `Rodada ${data.round_number}`}
                    </div>
                  </div>
                </div>
              )}

              {data.stage_name && (
                <div className="radio-card">
                  <div className="radio-info">
                    <div className="radio-name">
                      Fase
                    </div>

                    <div className="radio-status">
                      {
                        data.stage_name
                      }
                    </div>
                  </div>
                </div>
              )}

              {h2h && (
                <>
                  <div className="section-title">
                    <h2>
                      CONFRONTO DIRETO
                    </h2>
                  </div>

                  <div className="radio-card">
                    <div
                      className="radio-info"
                      style={{
                        textAlign:
                          "center"
                      }}
                    >
                      <div className="radio-name">
                        Total de jogos
                      </div>

                      <div
                        style={{
                          marginTop:
                            "8px",
                          fontSize:
                            "22px",
                          fontWeight:
                            900
                        }}
                      >
                        {h2h.total_matches ??
                          0}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "1fr 1fr 1fr",
                      gap: "8px"
                    }}
                  >
                    <div className="radio-card">
                      <div
                        className="radio-info"
                        style={{
                          textAlign:
                            "center"
                        }}
                      >
                        <div className="radio-name">
                          Casa
                        </div>

                        <div
                          style={{
                            marginTop:
                              "6px",
                            fontSize:
                              "20px",
                            fontWeight:
                              900
                          }}
                        >
                          {h2h.home_wins ??
                            0}
                        </div>
                      </div>
                    </div>

                    <div className="radio-card">
                      <div
                        className="radio-info"
                        style={{
                          textAlign:
                            "center"
                        }}
                      >
                        <div className="radio-name">
                          Empates
                        </div>

                        <div
                          style={{
                            marginTop:
                              "6px",
                            fontSize:
                              "20px",
                            fontWeight:
                              900
                          }}
                        >
                          {h2h.draws ??
                            0}
                        </div>
                      </div>
                    </div>

                    <div className="radio-card">
                      <div
                        className="radio-info"
                        style={{
                          textAlign:
                            "center"
                        }}
                      >
                        <div className="radio-name">
                          Fora
                        </div>

                        <div
                          style={{
                            marginTop:
                              "6px",
                            fontSize:
                              "20px",
                            fontWeight:
                              900
                          }}
                        >
                          {h2h.away_wins ??
                            0}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {recentMatches.length >
                0 && (
                <>
                  <div className="section-title">
                    <h2>
                      ÚLTIMOS CONFRONTOS
                    </h2>
                  </div>

                  {recentMatches.map(
                    (
                      previous,
                      index
                    ) => (
                      <div
                        key={
                          previous.id ||
                          index
                        }
                        className="radio-card"
                      >
                        <div className="radio-info">
                          <div className="radio-name">
                            {previous.home_team ||
                              "Mandante"}{" "}
                            {previous.home_score !=
                              null
                              ? previous.home_score
                              : "-"}{" "}
                            x{" "}
                            {previous.away_score !=
                              null
                              ? previous.away_score
                              : "-"}{" "}
                            {previous.away_team ||
                              "Visitante"}
                          </div>

                          <div className="radio-status">
                            {formatDate(
                              previous.event_date
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </>
          )}
      </main>
    </div>
  );
}

/* =========================
   APP
========================= */

function App() {
  const [
    matches,
    setMatches
  ] = useState([]);

  const [
    liveMatches,
    setLiveMatches
  ] = useState([]);

  const [
    leagues,
    setLeagues
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  const [
    playing
  ] = useState(false);

  const [
    selectedMatch,
    setSelectedMatch
  ] = useState(null);

  const [
    expandedCompetitions,
    setExpandedCompetitions
  ] = useState({});

  /* =========================
     CARREGAR DADOS
  ========================= */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        todayResponse,
        liveResponse,
        leaguesResponse
      ] = await Promise.all([
        fetch(`${API}/today`),
        fetch(`${API}/live`),
        fetch(`${API}/leagues`)
      ]);

      if (!todayResponse.ok) {
        throw new Error(
          "Erro ao carregar jogos"
        );
      }

      if (!liveResponse.ok) {
        throw new Error(
          "Erro ao carregar jogos ao vivo"
        );
      }

      if (!leaguesResponse.ok) {
        throw new Error(
          "Erro ao carregar competições"
        );
      }

      const todayData =
        await todayResponse.json();

      const liveData =
        await liveResponse.json();

      const leaguesData =
        await leaguesResponse.json();

      setMatches(
        getResults(todayData)
      );

      setLiveMatches(
        getResults(liveData)
      );

      setLeagues(
        getResults(
          leaguesData
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        "Não foi possível carregar os dados agora."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const timer =
      setInterval(() => {
        loadData();
      }, 30000);

    return () => {
      clearInterval(
        timer
      );
    };
  }, []);

  /* =========================
     IDS AO VIVO
  ========================= */

  const liveIds =
    useMemo(() => {
      return new Set(
        liveMatches.map(
          (match) =>
            String(match.id)
        )
      );
    }, [liveMatches]);

  /* =========================
     CORRIGIR STATUS
  ========================= */

  const normalizedMatches =
    useMemo(() => {
      return matches.map(
        (match) => {
          if (
            liveIds.has(
              String(match.id)
            )
          ) {
            return {
              ...match,
              status:
                match.status ===
                "notstarted"
                  ? "live"
                  : match.status
            };
          }

          return match;
        }
      );
    }, [
      matches,
      liveIds
    ]);

  /* =========================
     MAPA DAS LIGAS
  ========================= */

  const leaguesMap =
    useMemo(() => {
      const map =
        new Map();

      leagues.forEach(
        (league) => {
          map.set(
            String(
              league.id
            ),
            league
          );
        }
      );

      return map;
    }, [leagues]);

  /* =========================
     AGRUPAR COMPETIÇÕES
  ========================= */

  const groupedMatches =
    useMemo(() => {
      const map =
        new Map();

      normalizedMatches.forEach(
        (match) => {
          const leagueId =
            String(
              match.league_id ??
                "unknown"
            );

          const league =
            leaguesMap.get(
              leagueId
            );

          const groupName =
            league?.name ||
            `Liga ${leagueId}`;

          const country =
            league?.country ||
            "Internacional";

          if (
            !map.has(
              leagueId
            )
          ) {
            map.set(
              leagueId,
              {
                leagueId:
                  match.league_id,
                name:
                  groupName,
                country,
                matches: []
              }
            );
          }

          map
            .get(
              leagueId
            )
            .matches.push(
              match
            );
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) => {
          const aHasLive =
            a.matches.some(
              (match) =>
                isLive(
                  match.status
                )
            );

          const bHasLive =
            b.matches.some(
              (match) =>
                isLive(
                  match.status
                )
            );

          if (
            aHasLive &&
            !bHasLive
          ) {
            return -1;
          }

          if (
            !aHasLive &&
            bHasLive
          ) {
            return 1;
          }

          const countryCompare =
            String(
              a.country
            ).localeCompare(
              String(
                b.country
              ),
              "pt-BR"
            );

          if (
            countryCompare !==
            0
          ) {
            return countryCompare;
          }

          return String(
            a.name
          ).localeCompare(
            String(
              b.name
            ),
            "pt-BR"
          );
        }
      );
    }, [
      normalizedMatches,
      leaguesMap
    ]);

  /* =========================
     ABRIR AO VIVO
  ========================= */

  useEffect(() => {
    if (
      groupedMatches.length ===
      0
    ) {
      return;
    }

    setExpandedCompetitions(
      (old) => {
        const next = {
          ...old
        };

        groupedMatches.forEach(
          (group) => {
            const key =
              String(
                group.leagueId
              );

            if (
              next[key] ===
              undefined
            ) {
              next[key] =
                group.matches.some(
                  (match) =>
                    isLive(
                      match.status
                    )
                );
            }
          }
        );

        return next;
      }
    );
  }, [groupedMatches]);

  /* =========================
     ABRIR / FECHAR
  ========================= */

  function toggleCompetition(
    leagueId
  ) {
    const key =
      String(
        leagueId
      );

    setExpandedCompetitions(
      (old) => ({
        ...old,
        [key]:
          !old[key]
      })
    );
  }

  /* =========================
     TOTAL AO VIVO
  ========================= */

  const liveCount =
    useMemo(() => {
      return normalizedMatches.filter(
        (match) =>
          isLive(
            match.status
          )
      ).length;
    }, [
      normalizedMatches
    ]);

  /* =========================
     TELA DETALHES
  ========================= */

  if (selectedMatch) {
    const league =
      leaguesMap.get(
        String(
          selectedMatch.league_id
        )
      );

    return (
      <MatchDetails
        match={
          selectedMatch
        }
        league={
          league
        }
        onBack={() =>
          setSelectedMatch(
            null
          )
        }
      />
    );
  }

  /* =========================
     TELA PRINCIPAL
  ========================= */

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-name">
            RADIO
            <span>
              PLACAR
            </span>
          </div>

          <div className="brand-subtitle">
            ESPORTE EM TEMPO REAL
          </div>
        </div>

        <div className="header-live">
          AO VIVO{" "}
          {liveCount > 0
            ? liveCount
            : ""}
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <div className="hero-small">
            FUTEBOL + RÁDIO
          </div>

          <h1>
            Placar e emoção em
            tempo real
          </h1>

          <p>
            Jogos reais separados
            por competição, com
            placares atualizados
            pelo RádioPlacar.
          </p>
        </section>

        <div className="section-title">
          <h2>
            JOGOS DE HOJE
          </h2>

          <span className="section-count">
            {
              normalizedMatches.length
            }
          </span>
        </div>

        {loading && (
          <div className="loading">
            Carregando jogos e
            competições...
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          normalizedMatches.length ===
            0 && (
            <div className="empty">
              Nenhum jogo
              encontrado agora.
            </div>
          )}

        {!loading &&
          !error &&
          groupedMatches.map(
            (group) => {
              const key =
                String(
                  group.leagueId
                );

              return (
                <CompetitionGroup
                  key={key}
                  group={
                    group
                  }
                  open={
                    expandedCompetitions[
                      key
                    ] === true
                  }
                  onToggle={() =>
                    toggleCompetition(
                      group.leagueId
                    )
                  }
                  onOpenMatch={
                    setSelectedMatch
                  }
                />
              );
            }
          )}

        <div className="section-title">
          <h2>
            RÁDIOS AO VIVO
          </h2>

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
              As rádios serão
              adicionadas somente
              com transmissões
              reais verificadas.
            </div>
          </div>

          <button
            className="play-button"
            type="button"
            disabled
          >
            <Play size={17} />
          </button>
        </div>

        <button
          type="button"
          onClick={
            loadData
          }
          className="radio-card"
          style={{
            width: "100%",
            color: "white"
          }}
        >
          <div className="radio-logo">
            <RefreshCw
              size={20}
            />
          </div>

          <div className="radio-info">
            <div className="radio-name">
              Atualizar placares
            </div>

            <div className="radio-status">
              Buscar novamente
              jogos e competições
              reais
            </div>
          </div>

          <Clock3
            size={19}
          />
        </button>
      </main>

      <div className="player">
        <div className="player-icon">
          <Radio size={21} />
        </div>

        <div className="player-info">
          <div className="player-station">
            RádioPlacar
          </div>

          <div className="player-match">
            Player preparado para
            rádios oficiais
          </div>
        </div>

        <button
          type="button"
          className="player-button"
          disabled
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

ReactDOM.createRoot(
  document.getElementById(
    "root"
  )
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
