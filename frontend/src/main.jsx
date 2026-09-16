import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  Trophy,
  Heart,
  Radio,
  Search,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Clock3,
  Star,
  Play,
  ArrowLeft,
  Wifi,
} from "lucide-react";

import "../styles.css";

const API_URL = "https://radioplacar-api.onrender.com";

// ======================================================
// HELPERS
// ======================================================

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function abbreviation(name) {
  const clean = normalizeText(name)
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "---";

  const ignore = [
    "FC",
    "EC",
    "SC",
    "AC",
    "CF",
    "CLUB",
    "CLUBE",
    "DE",
    "DA",
    "DO",
    "DOS",
    "DAS",
  ];

  const words = clean
    .split(" ")
    .filter(Boolean)
    .filter((word) => !ignore.includes(word.toUpperCase()));

  if (!words.length) {
    return clean.slice(0, 3).toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  if (words.length === 2) {
    return (
      words[0].slice(0, 1) +
      words[1].slice(0, 2)
    ).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getMatchId(match) {
  return String(
    firstValue(
      match?.id,
      match?.fixture_id,
      match?.event_id,
      match?.game_id,
      ""
    )
  );
}

function getHomeName(match) {
  return String(
    firstValue(
      match?.home_team?.name,
      match?.home_team,
      match?.home?.name,
      match?.home,
      match?.mandante?.name,
      match?.mandante,
      "Mandante"
    )
  );
}

function getAwayName(match) {
  return String(
    firstValue(
      match?.away_team?.name,
      match?.away_team,
      match?.away?.name,
      match?.away,
      match?.visitante?.name,
      match?.visitante,
      "Visitante"
    )
  );
}

function getHomeLogo(match) {
  return firstValue(
    match?.home_team_logo,
    match?.home_logo,
    match?.home_team?.logo,
    match?.home_team?.image,
    match?.home?.logo,
    match?.home?.image,
    match?.mandante?.logo
  );
}

function getAwayLogo(match) {
  return firstValue(
    match?.away_team_logo,
    match?.away_logo,
    match?.away_team?.logo,
    match?.away_team?.image,
    match?.away?.logo,
    match?.away?.image,
    match?.visitante?.logo
  );
}

function getLeagueName(match) {
  return String(
    firstValue(
      match?.league?.name,
      match?.league_name,
      match?.league,
      match?.competition?.name,
      match?.competition,
      match?.campeonato?.nome,
      match?.campeonato,
      "Campeonato"
    )
  );
}

function getLeagueId(match) {
  return String(
    firstValue(
      match?.league_id,
      match?.league?.id,
      match?.competition_id,
      match?.competition?.id,
      getLeagueName(match)
    )
  );
}

function getLeagueLogo(match) {
  return firstValue(
    match?.league_logo,
    match?.league?.logo,
    match?.league?.image,
    match?.competition?.logo,
    match?.competition?.image
  );
}

function getHomeScore(match) {
  return firstValue(
    match?.placar_casa,
    match?.home_score,
    match?.score_home,
    match?.home_goals,
    match?.goals?.home,
    match?.score?.home,
    match?.home?.score,
    match?.home_team?.score
  );
}

function getAwayScore(match) {
  return firstValue(
    match?.placar_visitante,
    match?.away_score,
    match?.score_away,
    match?.away_goals,
    match?.goals?.away,
    match?.score?.away,
    match?.away_team?.score
  );
}

function getRawStatus(match) {
  return String(
    firstValue(
      match?.status?.short,
      match?.status?.long,
      match?.status,
      match?.state,
      match?.match_status,
      ""
    )
  ).toLowerCase();
}

function isLive(match) {
  const status = getRawStatus(match);

  return (
    status === "inprogress" ||
    status === "in_progress" ||
    status === "live" ||
    status === "playing" ||
    status === "1st_half" ||
    status === "2nd_half" ||
    status === "halftime" ||
    status.includes("inprogress") ||
    status.includes("progress")
  );
}

function isFinished(match) {
  const status = getRawStatus(match);

  return (
    status === "finished" ||
    status === "fulltime" ||
    status === "full_time" ||
    status === "ft" ||
    status === "ended" ||
    status === "final" ||
    status.includes("finished")
  );
}

function getMinute(match) {
  return firstValue(
    match?.minuto_atual,
    match?.minute,
    match?.elapsed,
    match?.status?.elapsed,
    match?.time?.minute
  );
}

function getSecond(match) {
  return firstValue(
    match?.segundo_atual,
    match?.current_second,
    match?.seconds,
    match?.second,
    match?.time?.second
  );
}

function formatClock(match) {
  if (!isLive(match)) {
    return null;
  }

  const rawMinute = getMinute(match);

  if (
    rawMinute === null ||
    rawMinute === undefined ||
    rawMinute === ""
  ) {
    return "00:00";
  }

  /*
   * Alguns provedores podem devolver o relógio
   * pronto, por exemplo "68:24".
   */
  if (
    typeof rawMinute === "string" &&
    rawMinute.includes(":")
  ) {
    const parts = rawMinute.split(":");

    const minute = Number(parts[0]);
    const second = Number(parts[1]);

    if (
      Number.isFinite(minute) &&
      Number.isFinite(second)
    ) {
      return (
        `${String(Math.max(0, minute)).padStart(2, "0")}:` +
        `${String(
          Math.max(0, Math.min(59, second))
        ).padStart(2, "0")}`
      );
    }
  }

  const minute = Number(rawMinute);
  const second = Number(getSecond(match));

  if (!Number.isFinite(minute)) {
    return "00:00";
  }

  return (
    `${String(Math.max(0, minute)).padStart(2, "0")}:` +
    `${String(
      Number.isFinite(second)
        ? Math.max(0, Math.min(59, second))
        : 0
    ).padStart(2, "0")}`
  );
}

function getMatchDate(match) {
  return firstValue(
    match?.event_date,
    match?.date,
    match?.start_date,
    match?.datetime,
    match?.start_time,
    match?.fixture?.date
  );
}

function formatTime(match) {
  const raw = getMatchDate(match);

  if (!raw) {
    return "--:--";
  }

  try {
    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      const found = String(raw).match(
        /\b(\d{1,2}):(\d{2})\b/
      );

      if (found) {
        return (
          `${found[1].padStart(2, "0")}:` +
          `${found[2]}`
        );
      }

      return "--:--";
    }

    return new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);
  } catch {
    return "--:--";
  }
}

function matchStatus(match) {
  if (isLive(match)) {
    return "AO VIVO";
  }

  if (isFinished(match)) {
    return "ENCERRADO";
  }

  return "AGENDADO";
}

function hasScore(match) {
  const home = getHomeScore(match);
  const away = getAwayScore(match);

  return (
    home !== null &&
    home !== undefined &&
    home !== "" &&
    away !== null &&
    away !== undefined &&
    away !== ""
  );
}

function getRadios(match) {
  return Array.isArray(match?.radios)
    ? match.radios.filter((radio) => radio?.match_confirmed === true)
    : [];
}

function todayISO(offset = 0) {
  const now = new Date();

  const brasil = new Date(
    now.toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    })
  );

  brasil.setDate(brasil.getDate() + offset);

  const year = brasil.getFullYear();
  const month = String(brasil.getMonth() + 1).padStart(2, "0");
  const day = String(brasil.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ======================================================
// ESCUDO / 3 LETRAS
// ======================================================

function TeamBadge({
  name,
  logo,
  size = "normal",
}) {
  const [failed, setFailed] = useState(false);

  if (logo && !failed) {
    return (
      <div className={`team-badge team-badge-${size}`}>
        <img
          src={logo}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`team-badge team-badge-${size} team-badge-fallback`}
      title={name}
    >
      {abbreviation(name)}
    </div>
  );
}

function LeagueBadge({ match }) {
  const logo = getLeagueLogo(match);
  const name = getLeagueName(match);

  const [failed, setFailed] = useState(false);

  if (logo && !failed) {
    return (
      <div className="league-badge">
        <img
          src={logo}
          alt={name}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="league-badge league-badge-fallback">
      <Trophy size={16} />
    </div>
  );
}

// ======================================================
// CABEÇALHO
// ======================================================

function Header() {
  return (
    <header className="topbar rpf-topbar">
      <div className="brand rpf-brand">
        <div className="brand-ball rpf-brand-ball">⚽</div>

        <div className="rpf-brand-text">
          <strong>
            <span>RPF</span> PLACAR
          </strong>
          <small>FUTEBOL • PLACAR • RÁDIO</small>
        </div>
      </div>

      <div className="live-dot-wrap">
        <span className="live-dot" />
        AO VIVO
      </div>
    </header>
  );
}
// ======================================================
// BOTÃO FAVORITO
// ======================================================

function FavoriteButton({
  matchId,
  favorites,
  onToggle,
}) {
  const active = favorites.includes(String(matchId));

  return (
    <button
      className={`favorite-button ${active ? "active" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(matchId);
      }}
      aria-label="Favoritar"
    >
      <Heart
        size={19}
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}

// ======================================================
// CARD DE PARTIDA
// ======================================================
function MatchCard({
  match,
  favorites,
  onToggleFavorite,
  onOpen,
}) {
  const id = getMatchId(match);

  const homeName = getHomeName(match);
  const awayName = getAwayName(match);

  const live = isLive(match);
  const finished = isFinished(match);

  const homeScore = getHomeScore(match);
  const awayScore = getAwayScore(match);

  const radios = getRadios(match);

  const clock = live
    ? formatClock(match) || "00:00"
    : finished
    ? formatClock(match) || "--:--"
    : "00:00";

  const statusText = live
    ? "AO VIVO"
    : finished
    ? "ENCERRADO"
    : "AGENDADO";

  return (
    <article
      className={`match-card rpf-match-card ${
        live ? "match-live" : ""
      }`}
      onClick={() => onOpen(match)}
    >
      <div className="rpf-match-header">
        <div className="rpf-clock-area">
          <strong className="rpf-clock">{clock}</strong>

          <span
            className={`rpf-status ${
              live
                ? "rpf-status-live"
                : finished
                ? "rpf-status-finished"
                : "rpf-status-scheduled"
            }`}
          >
            {live && <span className="mini-live-dot" />}
            {statusText}
          </span>

          {!live && !finished && (
            <small className="rpf-kickoff">
              Início {formatTime(match)}
            </small>
          )}
        </div>

        <FavoriteButton
          matchId={id}
          favorites={favorites}
          onToggle={onToggleFavorite}
        />
      </div>

      <div className="rpf-teams">
        <div className="rpf-team">
          <TeamBadge
            name={homeName}
            logo={getHomeLogo(match)}
            size="large"
          />

          <strong className="rpf-team-code">
            {abbreviation(homeName)}
          </strong>

          <span className="rpf-team-name">
            {homeName}
          </span>
        </div>

        <div className="rpf-versus">
          {hasScore(match) ? (
            <strong className="rpf-score">
              <span>{homeScore}</span>
              <small>−</small>
              <span>{awayScore}</span>
            </strong>
          ) : (
            <strong className="rpf-score rpf-score-pregame">
              <span>0</span>
              <small>−</small>
              <span>0</span>
            </strong>
          )}

          <span className="rpf-vs">PLACAR</span>
        </div>

        <div className="rpf-team">
          <TeamBadge
            name={awayName}
            logo={getAwayLogo(match)}
            size="large"
          />

          <strong className="rpf-team-code">
            {abbreviation(awayName)}
          </strong>

          <span className="rpf-team-name">
            {awayName}
          </span>
        </div>
      </div>

      <div className="rpf-match-league">
        <LeagueBadge match={match} />
        <span>{getLeagueName(match)}</span>
      </div>

      <div className="rpf-match-footer">
        {radios.length > 0 ? (
          <div className="radio-confirmed">
            <Radio size={16} />

            <span>
              {radios.length === 1
                ? "1 rádio transmitindo"
                : `${radios.length} rádios transmitindo`}
            </span>
          </div>
        ) : (
          <span className="no-radio">
            Sem rádio confirmada
          </span>
        )}

        <ChevronRight size={19} />
      </div>
    </article>
  );
} 
// ======================================================
// DESTAQUE TIPO SHORT
// ======================================================
function HighlightCard({
  match,
  onOpen,
}) {
  const homeName = getHomeName(match);
  const awayName = getAwayName(match);

  return (
    <button
      className="highlight-card"
      onClick={() => onOpen(match)}
    >
      <div className="highlight-league">
        <LeagueBadge match={match} />

        <span>{getLeagueName(match)}</span>
      </div>

      <div className="highlight-teams">
        <div>
          <TeamBadge
            name={homeName}
            logo={getHomeLogo(match)}
            size="large"
          />

          <strong>{abbreviation(homeName)}</strong>
        </div>

        <div className="highlight-center">
          {hasScore(match) ? (
            <strong>
              {getHomeScore(match)}
              <span>×</span>
              {getAwayScore(match)}
            </strong>
          ) : (
            <strong>{formatTime(match)}</strong>
          )}

          <small>{matchStatus(match)}</small>
        </div>

        <div>
          <TeamBadge
            name={awayName}
            logo={getAwayLogo(match)}
            size="large"
          />

          <strong>{abbreviation(awayName)}</strong>
        </div>
      </div>

      <div className="highlight-footer">
        <span>
          {getHomeName(match)} x {getAwayName(match)}
        </span>

        <ChevronRight size={17} />
      </div>
    </button>
  );
}

// ======================================================
// GRUPO POR CAMPEONATO
// ======================================================

function CompetitionSection({
  leagueName,
  matches,
  favorites,
  onToggleFavorite,
  onOpen,
  onOpenCompetition,
}) {
  if (!matches.length) return null;

  const example = matches[0];

  return (
    <section className="competition-section">
      <div className="competition-header">
        <div className="competition-title">
          <LeagueBadge match={example} />

          <div>
            <small>CAMPEONATO</small>
            <h3>{leagueName}</h3>
          </div>
        </div>

        <button
          className="competition-link"
          onClick={() =>
            onOpenCompetition({
              id: getLeagueId(example),
              name: leagueName,
              example,
            })
          }
        >
          Ver tudo
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="competition-matches">
        {matches.map((match, index) => (
          <MatchCard
            key={`${getMatchId(match)}-${index}`}
            match={match}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

// ======================================================
// HOME
// ======================================================

function HomeScreen({
  matches,
  favorites,
  onToggleFavorite,
  onOpenMatch,
  onOpenCompetition,
  loading,
}) {
  const [competitions, setCompetitions] = useState([]);
const [competitionsLoading, setCompetitionsLoading] = useState(true);
  
  useEffect(() => {
  let active = true;

  async function loadCompetitions() {
    try {
      setCompetitionsLoading(true);

      const response = await fetch(
        `${API_URL}/api/competitions`
      );

      const data = await response.json();

      if (active) {
        setCompetitions(
          Array.isArray(data?.response)
            ? data.response
            : []
        );
      }
    } catch (error) {
      console.error(
        "Erro ao carregar campeonatos:",
        error
      );

      if (active) {
        setCompetitions([]);
      }
    } finally {
      if (active) {
        setCompetitionsLoading(false);
      }
    }
  }

  loadCompetitions();

  return () => {
    active = false;
  };
}, []);
  const liveMatches = matches.filter(isLive);
  
  const interiorWords = [
    "gaucho",
    "gauchao",
    "carioca",
    "paulista",
    "mineiro",
    "paranaense",
    "catarinense",
    "baiano",
    "pernambucano",
    "cearense",
    "goiano",
    "paraense",
    "amazonense",
    "alagoano",
    "sergipano",
    "potiguar",
    "capixaba",
    "paraibano",
    "maranhense",
    "piauiense",
    "acreano",
    "rondoniense",
    "roraimense",
    "amapaense",
    "serie c",
    "serie d",
    "a2",
    "a3",
    "b1",
    "b2",
    "divisao de acesso",
  ];

  const isInteriorMatch = (match) => {
    const league = normalizeText(
      getLeagueName(match)
    ).toLowerCase();

    return interiorWords.some((word) =>
      league.includes(word)
    );
  };

  const interiorMatches = matches.filter(isInteriorMatch);


  const scheduledInterior = interiorMatches.filter(
    (match) => !isLive(match) && !isFinished(match)
  );

  /*
   * O destaque principal dá prioridade ao futebol
   * estadual/interior quando houver partida relevante
   * no dia. Depois entram jogos ao vivo e demais jogos.
   */
  const heroMatch =
    interiorMatches.find(isLive) ||
    scheduledInterior[0] ||
    liveMatches[0] ||
    matches[0] ||
    null;

  const highlights = [
    ...(heroMatch ? [heroMatch] : []),
    ...liveMatches,
    ...scheduledInterior,
    ...matches,
  ]
    .filter(
      (match, index, array) =>
        array.findIndex(
          (item) =>
            String(getMatchId(item)) ===
            String(getMatchId(match))
        ) === index
    )
    .slice(0, 8);

  const groups = useMemo(() => {
    const map = new Map();

    for (const match of matches) {
      const league = getLeagueName(match);

      if (!map.has(league)) {
        map.set(league, []);
      }

      map.get(league).push(match);
    }

    return Array.from(map.entries());
  }, [matches]);

  return (
    <main className="screen home-screen rpf-home">

      {/* CAPA DO DIA */}

      <section className="rpf-home-cover">
        <div className="rpf-cover-copy">
          <span className="hero-kicker">
            ⚽ RPF PLACAR • FUTEBOL HOJE
          </span>

          <h1>O futebol do dia está aqui.</h1>

          <p>
            Placar, campeonatos e rádios confirmadas
            em um só lugar.
          </p>

          <div className="rpf-cover-numbers">
            <div>
              <strong>{matches.length}</strong>
              <span>PARTIDAS</span>
            </div>

            <div>
              <strong>{liveMatches.length}</strong>
              <span>AO VIVO</span>
            </div>

            <div>
              <strong>{interiorMatches.length}</strong>
              <span>INTERIOR</span>
            </div>
          </div>
        </div>
      </section>


      {/* DESTAQUE PRINCIPAL */}

      {heroMatch && (
        <section className="home-block rpf-main-highlight">
          <div className="section-heading">
            <div>
              <span
                className={`section-kicker ${
                  isLive(heroMatch)
                    ? "live-kicker"
                    : ""
                }`}
              >
                {isLive(heroMatch)
                  ? "🟢 AO VIVO"
                  : isInteriorMatch(heroMatch)
                  ? "🔴 PRÉ-JOGO • RPF INTERIOR"
                  : "⭐ DESTAQUE DO DIA"}
              </span>

              <h2>
                {getHomeName(heroMatch)} x{" "}
                {getAwayName(heroMatch)}
              </h2>
            </div>

            <Star size={21} />
          </div>

          <MatchCard
            match={heroMatch}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onOpen={onOpenMatch}
          />
        </section>
      )}


      {/* DESTAQUES DO DIA */}

      <section className="home-block">
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              EM DESTAQUE
            </span>

            <h2>Destaques do dia</h2>
          </div>

          <Star size={21} />
        </div>

        {loading ? (
          <div className="loading-card">
            Carregando destaques...
          </div>
        ) : highlights.length > 0 ? (
          <div className="highlights-scroll">
            {highlights.map((match, index) => (
              <HighlightCard
                key={`highlight-${getMatchId(match)}-${index}`}
                match={match}
                onOpen={onOpenMatch}
              />
            ))}
          </div>
        ) : (
          <div className="empty-card">
            Nenhuma partida encontrada para hoje.
          </div>
        )}
      </section>


      {/* RPF INTERIOR */}

      {interiorMatches.length > 0 && (
        <section className="home-block rpf-interior-block">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                🌾 FUTEBOL DE VERDADE
              </span>

              <h2>RPF Interior</h2>
            </div>

            <Radio size={21} />
          </div>

          <p className="rpf-section-description">
            Estaduais, divisões de acesso, Série C,
            Série D e o futebol que também merece
            destaque.
          </p>

          <div className="rpf-interior-scroll">
            {interiorMatches
              .slice(0, 6)
              .map((match, index) => (
                <HighlightCard
                  key={`interior-${getMatchId(match)}-${index}`}
                  match={match}
                  onOpen={onOpenMatch}
                />
              ))}
          </div>
        </section>
      )}


      {/* POR CAMPEONATO */}

      <section className="home-block">
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              PROGRAMAÇÃO
            </span>

            <h2>Por campeonato</h2>
          </div>

          <CalendarDays size={21} /
<div className="rpf-league-grid">
  {competitionsLoading ? (
  <div className="loading-card">
    Carregando campeonatos...
  </div>
) : competitions.length === 0 ? (
  <div className="empty-card">
    Nenhum campeonato disponível.
  </div>
) : (
  <div className="rpf-league-grid">
    {competitions.map((competition) => {
      const leagueId =
        competition?.league_id ??
        competition?.id;

      const seasonId =
        competition?.season_id ??
        competition?.current_season?.id ??
        competition?.temporada_atual?.id ??
        competition?.season?.id;

      const leagueName =
        competition?.name ??
        competition?.nome ??
        "Campeonato";

      return (
        <button
          type="button"
          key={`${leagueId}-${seasonId}`}
          className="rpf-league-card"
          onClick={() =>
            onOpenCompetition({
              ...competition,
              id: leagueId,
              league_id: leagueId,
              season_id: seasonId,
              name: leagueName,
            })
          }
        >
          <div className="rpf-league-logo">
            <div className="competition-logo-fallback">
              <Trophy size={22} />
            </div>
          </div>

          <div className="rpf-league-info">
            <strong>{leagueName}</strong>

            <span>
              Classificação
            </span>
          </div>

          <div className="rpf-league-next">
            <strong>🏆 TABELA</strong>
          </div>

          <ChevronRight size={18} />
        </button>
      );
    })}
  </div>
)}
        {groups.length === 0 ? (
          <div className="empty-card">
            Nenhum campeonato encontrado.
          </div>
        ) : (
          <div className="rpf-league-grid">
            {groups.map(([league, leagueMatches]) => {
              const example = leagueMatches[0];

              return (
                <button
                  type="button"
                  key={league}
                  className="rpf-league-card"
                  onClick={() =>
                    onOpenCompetition({
                      id: getLeagueId(example),
                      name: league,
                      example,
                    })
                  }
                >
                  <div className="rpf-league-logo">
                    <LeagueBadge match={example} />
                  </div>

                  <div className="rpf-league-info">
                    <strong>{league}</strong>

                    <span>
                      {leagueMatches.length}{" "}
                      {leagueMatches.length === 1
                        ? "partida"
                        : "partidas"}
                    </span>
                  </div>

                  <div className="rpf-league-next">
                    {leagueMatches[0] && (
                      <>
                        <span>
                          {abbreviation(
                            getHomeName(
                              leagueMatches[0]
                            )
                          )}
                        </span>

                        <strong>
                          {hasScore(leagueMatches[0])
                            ? `${getHomeScore(
                                leagueMatches[0]
                              )} - ${getAwayScore(
                                leagueMatches[0]
                              )}`
                            : formatTime(
                                leagueMatches[0]
                              )}
                        </strong>

                        <span>
                          {abbreviation(
                            getAwayName(
                              leagueMatches[0]
                            )
                          )}
                        </span>
                      </>
                    )}
                  </div>

                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        )}
      </section>


      {/* AO VIVO */}

      {liveMatches.length > 0 && (
        <section className="home-block rpf-live-block">
          <div className="section-heading">
            <div>
              <span className="section-kicker live-kicker">
                🟢 AO VIVO
              </span>

              <h2>Jogando agora</h2>
            </div>

            <Wifi size={21} />
          </div>

          <div className="rpf-live-list">
            {liveMatches
              .slice(0, 5)
              .map((match, index) => (
                <MatchCard
                  key={`live-${getMatchId(match)}-${index}`}
                  match={match}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                  onOpen={onOpenMatch}
                />
              ))}
          </div>
        </section>
      )}

    </main>
  );
}

// ======================================================
// JOGOS
// ======================================================

function GamesScreen({
  matches,
  favorites,
  onToggleFavorite,
  onOpenMatch,
  onOpenCompetition,
  loading,
  selectedDate,
  onDateChange,
}) {
  const groups = useMemo(() => {
    const map = new Map();

    for (const match of matches) {
      const league = getLeagueName(match);

      if (!map.has(league)) {
        map.set(league, []);
      }

      map.get(league).push(match);
    }

    return Array.from(map.entries());
  }, [matches]);

  return (
    <main className="screen games-screen">
      <div className="screen-title">
        <div>
          <span className="section-kicker">PLACARES</span>
          <h1>Jogos</h1>
        </div>

        <Trophy size={27} />
      </div>

      <div className="date-selector">
        <button
          className={selectedDate === todayISO(-1) ? "active" : ""}
          onClick={() => onDateChange(todayISO(-1))}
        >
          <span>ONTEM</span>
          <strong>
            {todayISO(-1).slice(8, 10)}
          </strong>
        </button>

        <button
          className={selectedDate === todayISO(0) ? "active" : ""}
          onClick={() => onDateChange(todayISO(0))}
        >
          <span>HOJE</span>
          <strong>
            {todayISO(0).slice(8, 10)}
          </strong>
        </button>

        <button
          className={selectedDate === todayISO(1) ? "active" : ""}
          onClick={() => onDateChange(todayISO(1))}
        >
          <span>AMANHÃ</span>
          <strong>
            {todayISO(1).slice(8, 10)}
          </strong>
        </button>
      </div>

      {loading ? (
        <div className="loading-card">
          Carregando partidas...
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-card">
          Nenhuma partida encontrada nesta data.
        </div>
      ) : (
        groups.map(([league, leagueMatches]) => (
          <CompetitionSection
            key={league}
            leagueName={league}
            matches={leagueMatches}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onOpen={onOpenMatch}
            onOpenCompetition={onOpenCompetition}
          />
        ))
      )}
    </main>
  );
}

// ======================================================
// FAVORITOS
// ======================================================

function FavoritesScreen({
  matches,
  favorites,
  onToggleFavorite,
  onOpenMatch,
}) {
  const favoriteMatches = matches.filter((match) =>
    favorites.includes(getMatchId(match))
  );

  return (
    <main className="screen favorites-screen">
      <div className="screen-title">
        <div>
          <span className="section-kicker">
            SEUS TIMES E JOGOS
          </span>

          <h1>Favoritos</h1>
        </div>

        <Heart size={27} />
      </div>

      {favoriteMatches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Heart size={34} />
          </div>

          <h2>Nenhum favorito ainda</h2>

          <p>
            Toque no coração de uma partida para ela
            aparecer aqui.
          </p>
        </div>
      ) : (
        <div className="competition-matches">
          {favoriteMatches.map((match, index) => (
            <MatchCard
              key={`fav-${getMatchId(match)}-${index}`}
              match={match}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
              onOpen={onOpenMatch}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// ======================================================
// RÁDIOS
// ======================================================

function RadiosScreen({ radios, loading }) {
  const [search, setSearch] = useState("");

  const filtered = radios.filter((radio) => {
    const text = normalizeText(
      `${radio?.name || ""} ${radio?.state || ""} ${radio?.city || ""}`
    ).toLowerCase();

    return text.includes(normalizeText(search).toLowerCase());
  });

  const grouped = useMemo(() => {
    const map = new Map();

    for (const radio of filtered) {
      const state =
        firstValue(
          radio?.state,
          radio?.uf,
          radio?.region,
          "OUTRAS"
        ) || "OUTRAS";

      if (!map.has(state)) {
        map.set(state, []);
      }

      map.get(state).push(radio);
    }

    return Array.from(map.entries());
  }, [filtered]);

  return (
    <main className="screen radios-screen">
      <div className="screen-title">
        <div>
          <span className="section-kicker">
            FUTEBOL NO RÁDIO
          </span>

          <h1>Rádios</h1>
        </div>

        <Radio size={27} />
      </div>

      <div className="search-box">
        <Search size={19} />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar rádio ou estado..."
        />
      </div>

      {loading ? (
        <div className="loading-card">
          Carregando rádios...
        </div>
      ) : grouped.length === 0 ? (
        <div className="empty-card">
          Nenhuma rádio encontrada.
        </div>
      ) : (
        grouped.map(([state, stateRadios]) => (
          <section
            className="radio-state-section"
            key={state}
          >
            <div className="radio-state-title">
              <span>{state}</span>
              <small>{stateRadios.length}</small>
            </div>

            <div className="radio-list">
              {stateRadios.map((radio) => {
                const stream =
                  radio?.stream_verified === true &&
                  radio?.stream
                    ? radio.stream
                    : null;

                return (
                  <article
                    className="radio-card"
                    key={radio.id}
                  >
                    <div className="radio-icon">
                      <Radio size={22} />
                    </div>

                    <div className="radio-info">
                      <strong>{radio.name}</strong>

                      <span>
                        {firstValue(
                          radio.city,
                          radio.state,
                          "Rádio esportiva"
                        )}
                      </span>
                    </div>

                    {stream ? (
                      <a
                        className="radio-play"
                        href={stream}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Ouvir ${radio.name}`}
                      >
                        <Play size={19} fill="currentColor" />
                      </a>
                    ) : (
                      <div
                        className="radio-play disabled"
                        title="Stream ainda não verificada"
                      >
                        <Radio size={18} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

// ======================================================
// DETALHE DA PARTIDA
// ======================================================

function MatchDetail({
  match,
  onBack,
  favorites,
  onToggleFavorite,
}) {
  if (!match) return null;

  const homeName = getHomeName(match);
  const awayName = getAwayName(match);

  const radios = getRadios(match);

  const live = isLive(match);
  const finished = isFinished(match);

  const clock = live
    ? formatClock(match) || "00:00"
    : finished
    ? formatClock(match) || "--:--"
    : "00:00";

  const statusText = live
    ? "AO VIVO"
    : finished
    ? "ENCERRADO"
    : "AGENDADO";

  return (
    <main className="screen detail-screen rpf-detail-screen">
      <div className="detail-top rpf-detail-top">
        <button
          className="back-button"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="rpf-detail-heading">
          <small>{getLeagueName(match)}</small>
          <strong>DETALHES DA PARTIDA</strong>
        </div>

        <FavoriteButton
          matchId={getMatchId(match)}
          favorites={favorites}
          onToggle={onToggleFavorite}
        />
      </div>

      <section
        className={`rpf-detail-scoreboard ${
          live ? "is-live" : ""
        }`}
      >
        <div className="rpf-detail-clock">
          <strong>{clock}</strong>

          <span
            className={`rpf-detail-status ${
              live
                ? "live"
                : finished
                ? "finished"
                : "scheduled"
            }`}
          >
            {live && <span className="mini-live-dot" />}
            {statusText}
          </span>

          {!live && !finished && (
            <small>
              Início previsto: {formatTime(match)}
            </small>
          )}
        </div>

        <div className="rpf-detail-teams">
          <div className="rpf-detail-team">
            <TeamBadge
              name={homeName}
              logo={getHomeLogo(match)}
              size="xlarge"
            />

            <strong className="rpf-detail-team-code">
              {abbreviation(homeName)}
            </strong>

            <span className="rpf-detail-team-name">
              {homeName}
            </span>
          </div>

          <div className="rpf-detail-score">
            {hasScore(match) ? (
              <>
                <strong>
                  <span>{getHomeScore(match)}</span>
                  <small>−</small>
                  <span>{getAwayScore(match)}</span>
                </strong>

                <span className="rpf-detail-score-label">
                  PLACAR
                </span>
              </>
            ) : (
              <>
                <strong className="pregame">
                  <span>0</span>
                  <small>−</small>
                  <span>0</span>
                </strong>

                <span className="rpf-detail-score-label">
                  PRÉ-JOGO
                </span>
              </>
            )}
          </div>

          <div className="rpf-detail-team">
            <TeamBadge
              name={awayName}
              logo={getAwayLogo(match)}
              size="xlarge"
            />

            <strong className="rpf-detail-team-code">
              {abbreviation(awayName)}
            </strong>

            <span className="rpf-detail-team-name">
              {awayName}
            </span>
          </div>
        </div>

        <div className="rpf-detail-competition">
          <LeagueBadge match={match} />

          <span>{getLeagueName(match)}</span>
        </div>
      </section>

      <section className="detail-section rpf-detail-section">
        <div className="detail-section-title rpf-section-title">
          <div className="rpf-section-icon">
            <Radio size={20} />
          </div>

          <div>
            <small>RPF NO JOGO</small>
            <h2>Rádios transmitindo</h2>
          </div>
        </div>

        {radios.length === 0 ? (
          <div className="empty-card rpf-empty-radio">
            <Radio size={22} />

            <div>
              <strong>Sem rádio confirmada</strong>

              <span>
                A partida continua disponível com placar e
                informações em tempo real.
              </span>
            </div>
          </div>
        ) : (
          <div className="radio-list">
            {radios.map((radio) => {
              const canPlay =
                radio?.stream_verified === true &&
                Boolean(radio?.stream);

              return (
                <article
                  className="radio-card match-radio-card"
                  key={radio.id}
                >
                  <div className="radio-icon">
                    <Radio size={22} />
                  </div>

                  <div className="radio-info">
                    <strong>{radio.name}</strong>

                    <span>Transmissão confirmada</span>
                  </div>

                  {canPlay ? (
                    <a
                      className="radio-play"
                      href={radio.stream}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                      aria-label={`Ouvir ${radio.name}`}
                    >
                      <Play
                        size={19}
                        fill="currentColor"
                      />
                    </a>
                  ) : (
                    <div className="radio-confirmed-badge">
                      CONFIRMADA
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="detail-section rpf-detail-section">
        <div className="detail-section-title rpf-section-title">
          <div className="rpf-section-icon">
            <Clock3 size={20} />
          </div>

          <div>
            <small>PARTIDA</small>
            <h2>Linha do tempo</h2>
          </div>
        </div>

        <div className="rpf-timeline">
          <div className="rpf-timeline-marker">
            <span />
          </div>

          <div className="rpf-timeline-content">
            <strong>
              {live
                ? clock
                : finished
                ? statusText
                : formatTime(match)}
            </strong>

            <span>
              Os eventos da partida aparecerão aqui quando
              estiverem disponíveis na BSD.
            </span>
          </div>
        </div>
      </section>

      <div className="detail-slogan rpf-detail-slogan">
        <strong>
          <span>RPF</span> PLACAR
        </strong>

        <small>O futebol passa. A emoção fica.</small>
      </div>
    </main>
  );
}
// ======================================================
// CAMPEONATO
// ======================================================

function CompetitionScreen({
  competition,
  matches,
  favorites,
  onToggleFavorite,
  onOpenMatch,
  onBack,
}) {
  const [tab, setTab] = useState("matches");

  const competitionMatches = useMemo(() => {
    if (!competition) return [];

    const wantedLeagueId = String(
      firstValue(
        competition?.league_id,
        competition?.id,
        ""
      )
    );

    return matches.filter((match) => {
      return String(getLeagueId(match)) === wantedLeagueId;
    });
  }, [competition, matches]);

  const leagueId = firstValue(
    competition?.league_id,
    competition?.id
  );

  /*
   * A Série A que testamos na BSD:
   * league_id 9 / season_id 28.
   *
   * Para outros campeonatos NÃO inventamos temporada.
   * Quando a competição trouxer season_id,
   * ele será usado automaticamente.
   */
  const seasonId = firstValue(
    competition?.season_id,
    competition?.season?.id,
    String(leagueId) === "9" ? 28 : null
  );

  const competitionForStandings = {
    ...competition,
    league_id: leagueId,
    season_id: seasonId,

  const leagueName = String(
    firstValue(
      competition?.name,
      competition?.league_name,
      competition?.league?.name,
      competitionMatches[0]
        ? getLeagueName(competitionMatches[0])
        : null,
      "Campeonato"
    )
  );

  const leagueLogo = firstValue(
    competition?.logo,
    competition?.league_logo,
    competition?.league?.logo,
    competitionMatches[0]
      ? getLeagueLogo(competitionMatches[0])
      : null
  );

  return (
    <main className="screen competition-screen">
      <div className="competition-top">
        <button
          className="back-button"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="competition-title">
          {leagueLogo ? (
            <img
              src={leagueLogo}
              alt={leagueName}
              className="competition-logo"
            />
          ) : (
            <div className="competition-logo-fallback">
              <Trophy size={22} />
            </div>
          )}

          <div>
            <small>CAMPEONATO</small>
            <strong>{leagueName}</strong>
          </div>
        </div>
      </div>

      <div className="competition-tabs">
        <button
          className={
            tab === "matches"
              ? "competition-tab active"
              : "competition-tab"
          }
          onClick={() => setTab("matches")}
        >
          ⚽ PARTIDAS
        </button>

        <button
          className={
            tab === "standings"
              ? "competition-tab active"
              : "competition-tab"
          }
          onClick={() => setTab("standings")}
        >
          🏆 CLASSIFICAÇÃO
        </button>
      </div>

      {tab === "matches" ? (
        <section className="competition-content">
          {competitionMatches.length > 0 ? (
            <div className="matches-list">
              {competitionMatches.map((match) => (
                <MatchCard
                  key={getMatchId(match)}
                  match={match}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                  onOpen={onOpenMatch}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Trophy size={32} />

              <strong>
                Nenhuma partida encontrada
              </strong>

              <span>
                Não há partidas disponíveis para este campeonato.
              </span>
            </div>
          )}
        </section>
      ) : (
        <StandingsPlaceholder
          competition={competitionForStandings}
        />
      )}
    </main>
  );
}
// ======================================================
// CLASSIFICAÇÃO
// ======================================================
function StandingsPlaceholder({ competition }) {
  const [standings, setStandings] = useState([]);
  const [season, setSeason] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const leagueId = firstValue(
    competition?.league_id,
    competition?.id,
    competition?.league?.id
  );

  const seasonId = firstValue(
    competition?.season_id,
    competition?.season?.id
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStandings() {
      if (!leagueId || !seasonId) {
        setStandings([]);
        setSeason(null);
        setZones([]);
        setError(
          "Classificação indisponível para este campeonato."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/standings/${encodeURIComponent(
            leagueId
          )}?season_id=${encodeURIComponent(seasonId)}`
        );

        if (!response.ok) {
          throw new Error(
            `Erro ${response.status} ao buscar classificação`
          );
        }

        const data = await response.json();

        /*
         * O backend pode devolver "response".
         * Mantemos fallbacks para respostas que venham
         * traduzidas ou normalizadas.
         */
        const payload =
          data?.response ??
          data?.resposta ??
          data ??
          {};

        const rows =
          payload?.standings ??
          payload?.classificações ??
          payload?.classificacoes ??
          [];

        if (cancelled) return;

        setStandings(
          Array.isArray(rows) ? rows : []
        );

        setSeason(
          payload?.season ??
          payload?.temporada ??
          null
        );

        setZones(
          Array.isArray(payload?.zones)
            ? payload.zones
            : Array.isArray(payload?.zonas)
            ? payload.zonas
            : []
        );
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Erro ao carregar classificação:",
          err
        );

        setStandings([]);
        setSeason(null);
        setZones([]);
        setError(
          "Não foi possível carregar a classificação."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStandings();

    return () => {
      cancelled = true;
    };
  }, [leagueId, seasonId]);

  function rowValue(row, ...keys) {
    for (const key of keys) {
      const value = row?.[key];

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

  function getStandingTeamId(row) {
    return rowValue(
      row,
      "team_id",
      "id_da_equipe",
      "id_equipe"
    );
  }

  function getStandingTeamName(row) {
    return String(
      rowValue(
        row,
        "team_name",
        "nome_da_equipe",
        "nome_do_time",
        "nome_equipe"
      ) || "Time"
    );
  }

  function getStandingPosition(row) {
    return rowValue(
      row,
      "position",
      "posição",
      "posicao"
    );
  }

  function getStandingPlayed(row) {
    return rowValue(
      row,
      "played",
      "jogados",
      "jogos"
    );
  }

  function getStandingWins(row) {
    return rowValue(
      row,
      "won",
      "wins",
      "ganhou",
      "vitorias",
      "vitórias"
    );
  }

  function getStandingDraws(row) {
    return rowValue(
      row,
      "drawn",
      "draws",
      "empatados",
      "empatado",
      "empates"
    );
  }

  function getStandingLosses(row) {
    return rowValue(
      row,
      "lost",
      "losses",
      "perdido",
      "derrotas"
    );
  }

  function getStandingGoalDifference(row) {
    return rowValue(
      row,
      "gd",
      "goal_difference",
      "saldo"
    );
  }

  function getStandingPoints(row) {
    return rowValue(
      row,
      "pts",
      "points",
      "pontos"
    );
  }

  function getStandingZone(row) {
    return (
      row?.zone ??
      row?.zona ??
      null
    );
  }

  function getZoneClass(zone) {
    const key = normalizeText(
      firstValue(
        zone?.key,
        zone?.chave,
        zone?.type,
        zone?.tipo,
        ""
      )
    ).toLowerCase();

    if (
      key === "cl" ||
      key.includes("libertadores")
    ) {
      return "standing-zone-libertadores";
    }

    if (
      key === "clq" ||
      key.includes("qualifica")
    ) {
      return "standing-zone-prelibertadores";
    }

    if (
      key === "el" ||
      key.includes("sul-americana") ||
      key.includes("sul americana")
    ) {
      return "standing-zone-sulamericana";
    }

    if (
      key === "rel" ||
      key.includes("rebaix")
    ) {
      return "standing-zone-rebaixamento";
    }

    return "";
  }

  if (loading) {
    return (
      <section className="standings-real">
        <div className="standings-loading">
          <Trophy size={24} />
          <strong>
            Carregando classificação...
          </strong>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="standings-real">
        <div className="standings-empty">
          <Trophy size={28} />

          <strong>CLASSIFICAÇÃO</strong>

          <span>{error}</span>
        </div>
      </section>
    );
  }

  if (!standings.length) {
    return (
      <section className="standings-real">
        <div className="standings-empty">
          <Trophy size={28} />

          <strong>
            CLASSIFICAÇÃO INDISPONÍVEL
          </strong>

          <span>
            A BSD não retornou tabela para esta competição.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="standings-real">
      <div className="standings-title">
        <div>
          <span>CLASSIFICAÇÃO</span>

          <strong>
            {firstValue(
              season?.name,
              season?.nome,
              getLeagueName(competition)
            )}
          </strong>
        </div>

        <Trophy size={25} />
      </div>

      <div className="standings-scroll">
        <div className="standings-table">
          <div className="standings-row standings-head">
            <div>POS</div>
            <div>TIME</div>
            <div>PTS</div>
            <div>J</div>
            <div>V</div>
            <div>E</div>
            <div>D</div>
            <div>SG</div>
          </div>

          {standings.map((row, index) => {
            const teamId =
              getStandingTeamId(row);

            const teamName =
              getStandingTeamName(row);

            const zone =
              getStandingZone(row);

            const zoneClass =
              getZoneClass(zone);

            const logo = teamId
  ? `${API_URL}/api/team-logo/${encodeURIComponent(teamId)}`
  : null;

            return (
              <div
                className={`standings-row ${zoneClass}`}
                key={
                  teamId ||
                  `${teamName}-${index}`
                }
              >
                <div className="standing-position">
                  {getStandingPosition(row) ??
                    index + 1}
                </div>

                <div className="standing-team">
                  <TeamBadge
                    name={teamName}
                    logo={logo}
                    size="normal"
                  />

                  <div className="standing-team-name">
                    <strong>
                      {teamName}
                    </strong>

                    {zone && (
                      <small>
                        {firstValue(
                          zone?.label,
                          zone?.rótulo,
                          zone?.rotulo,
                          ""
                        )}
                      </small>
                    )}
                  </div>
                </div>

                <div className="standing-points">
                  {getStandingPoints(row) ?? "-"}
                </div>

                <div>
                  {getStandingPlayed(row) ?? "-"}
                </div>

                <div>
                  {getStandingWins(row) ?? "-"}
                </div>

                <div>
                  {getStandingDraws(row) ?? "-"}
                </div>

                <div>
                  {getStandingLosses(row) ?? "-"}
                </div>

                <div>
                  {getStandingGoalDifference(row) ?? "-"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {zones.length > 0 && (
        <div className="standings-legend">
          {zones.map((zone, index) => (
            <span
              key={
                firstValue(
                  zone?.key,
                  zone?.chave,
                  index
                )
              }
            >
              <i
                className={getZoneClass(zone)}
              />

              {firstValue(
                zone?.label,
                zone?.rótulo,
                zone?.rotulo,
                "Zona"
              )}
            </span>
          ))}
        </div>
      )}

      <div className="standings-source">
        Dados de classificação atualizados pela BSD
      </div>
    </section>
  );
}
// ======================================================
// NAVEGAÇÃO INFERIOR
// ======================================================

function BottomNavigation({
  active,
  onChange,
}) {
  const items = [
    {
      id: "home",
      label: "INÍCIO",
      icon: Home,
    },
    {
      id: "games",
      label: "JOGOS",
      icon: Trophy,
    },
    {
      id: "favorites",
      label: "FAVORITOS",
      icon: Heart,
    },
    {
      id: "radios",
      label: "RÁDIOS",
      icon: Radio,
    },
  ];

  return (
    <nav className="bottom-navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;

        return (
          <button
            key={item.id}
            className={selected ? "active" : ""}
            onClick={() => onChange(item.id)}
          >
            <Icon
              size={22}
              fill={
                item.id === "favorites" && selected
                  ? "currentColor"
                  : "none"
              }
            />

            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ======================================================
// APP
// ======================================================

function App() {
  const [activeTab, setActiveTab] = useState("home");

  const [matches, setMatches] = useState([]);
  const [radios, setRadios] = useState([]);

  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingRadios, setLoadingRadios] = useState(true);

  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedCompetition, setSelectedCompetition] = useState(null);

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("radioplacar-favorites");

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ====================================================
  // PARTIDAS
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      setLoadingMatches(true);

      try {
        const response = await fetch(
          `${API_URL}/api/matches?date=${encodeURIComponent(selectedDate)}`
        );

        const data = await response.json();

        if (cancelled) return;

        if (data?.ok && Array.isArray(data?.response)) {
          setMatches(data.response);
        } else {
          setMatches([]);
        }
      } catch (error) {
        console.error("Erro ao carregar partidas:", error);

        if (!cancelled) {
          setMatches([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMatches(false);
        }
      }
    }

    loadMatches();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // ====================================================
  // RÁDIOS
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadRadios() {
      setLoadingRadios(true);

      try {
        const response = await fetch(`${API_URL}/api/radios`);
        const data = await response.json();

        if (cancelled) return;

        if (data?.ok && Array.isArray(data?.response)) {
          setRadios(data.response);
        } else {
          setRadios([]);
        }
      } catch (error) {
        console.error("Erro ao carregar rádios:", error);

        if (!cancelled) {
          setRadios([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingRadios(false);
        }
      }
    }

    loadRadios();

    return () => {
      cancelled = true;
    };
  }, []);

  // ====================================================
  // FAVORITOS
  // ====================================================

  function toggleFavorite(matchId) {
    const id = String(matchId);

    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      localStorage.setItem(
        "radioplacar-favorites",
        JSON.stringify(next)
      );

      return next;
    });
  }

  // ====================================================
  // ABRIR PARTIDA
  // ====================================================

  async function openMatch(match) {
    setSelectedCompetition(null);
    setSelectedMatch(match);

    const id = getMatchId(match);

    if (!id) return;

    try {
      const response = await fetch(
        `${API_URL}/api/fixture/${encodeURIComponent(id)}`
      );

      const data = await response.json();

      if (data?.ok && data?.response) {
        setSelectedMatch(data.response);
      }
    } catch (error) {
      console.error("Erro ao atualizar partida:", error);
    }
  }

  function openCompetition(competition) {
    setSelectedMatch(null);
    setSelectedCompetition(competition);
  }

  function closeDetails() {
    setSelectedMatch(null);
    setSelectedCompetition(null);
  }

  function changeMainTab(tab) {
    setSelectedMatch(null);
    setSelectedCompetition(null);
    setActiveTab(tab);
  }

  // ====================================================
  // CONTEÚDO
  // ====================================================

  function renderContent() {
    if (selectedMatch) {
      return (
        <MatchDetail
          match={selectedMatch}
          onBack={closeDetails}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      );
    }

    if (selectedCompetition) {
      return (
        <CompetitionScreen
          competition={selectedCompetition}
          matches={matches}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenMatch={openMatch}
          onBack={closeDetails}
        />
      );
    }

    if (activeTab === "home") {
      return (
        <HomeScreen
          matches={matches}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenMatch={openMatch}
          onOpenCompetition={openCompetition}
          loading={loadingMatches}
        />
      );
    }

    if (activeTab === "games") {
      return (
        <GamesScreen
          matches={matches}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenMatch={openMatch}
          onOpenCompetition={openCompetition}
          loading={loadingMatches}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      );
    }

    if (activeTab === "favorites") {
      return (
        <FavoritesScreen
          matches={matches}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenMatch={openMatch}
        />
      );
    }

    return (
      <RadiosScreen
        radios={radios}
        loading={loadingRadios}
      />
    );
  }

  return (
    <div className="app-shell">
      <Header />

      <div className="app-content">
        {renderContent()}
      </div>

      {!selectedMatch && !selectedCompetition && (
        <BottomNavigation
          active={activeTab}
          onChange={changeMainTab}
        />
      )}
    </div>
  );
}

// ======================================================
// START
// ======================================================

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
