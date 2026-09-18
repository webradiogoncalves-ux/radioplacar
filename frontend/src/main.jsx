import React, { useEffect, useMemo, useRef, useState } from "react";
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

      {match?._rpfJourney && (
        <div className="rpf-match-jornada-badge">
          <span>🎙️ RPF JORNADA ESPORTIVA</span>
          <small>Prioridade {match._rpfJourney?.priority || match._rpfJourney?.prioridade || "RPF"}</small>
        </div>
      )}

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

  // ====================================================
  // RPF EM 3 MINUTOS - GIRO AUTOMÁTICO COM DADOS REAIS
  // ====================================================

  const rpfThreeMinutes = useMemo(() => {
    const normalizedLeague = (match) =>
      normalizeText(getLeagueName(match)).toLowerCase();

    const brazilWords = [
      "brasileiro", "brasileirao", "brasileiro serie a", "brasileiro serie b",
      "copa do brasil", "brasil"
    ];

    const internationalWords = [
      "premier league", "champions league", "europa league",
      "bundesliga", "serie a", "ligue 1", "la liga",
      "primeira liga", "conference league"
    ];

    const findMatch = (predicate, usedIds = new Set()) =>
      matches.find((match) =>
        !usedIds.has(getMatchId(match)) && predicate(match)
      ) || null;

    const used = new Set();

    const brasil =
      findMatch(
        (match) =>
          brazilWords.some((word) => normalizedLeague(match).includes(word)) &&
          !isInteriorMatch(match),
        used
      ) ||
      findMatch((match) => !isInteriorMatch(match), used);

    if (brasil) used.add(getMatchId(brasil));

    const internacional =
      findMatch(
        (match) =>
          normalizedLeague(match).includes("premier league"),
        used
      ) ||
      findMatch(
        (match) =>
          internationalWords.some((word) =>
            normalizedLeague(match).includes(word)
          ),
        used
      );

    if (internacional) used.add(getMatchId(internacional));

    const interior =
      findMatch((match) => isInteriorMatch(match), used);

    const makeCall = (match, category, emoji) => {
      if (!match) {
        return {
          category,
          emoji,
          match: null,
          title: "Sem jogo selecionado no momento",
          text: "O giro será atualizado quando houver partida desta categoria nos dados do dia.",
        };
      }

      const home = getHomeName(match);
      const away = getAwayName(match);
      const league = getLeagueName(match);

      let text;

      if (isLive(match)) {
        const score = hasScore(match)
          ? `${getHomeScore(match)} a ${getAwayScore(match)}`
          : "placar em andamento";
        text = `${league}: ${home} e ${away} estão ao vivo, ${score}.`;
      } else if (isFinished(match)) {
        const score = hasScore(match)
          ? `${getHomeScore(match)} a ${getAwayScore(match)}`
          : "partida encerrada";
        text = `${league}: ${home} x ${away} terminou ${score}.`;
      } else {
        text = `${league}: ${home} x ${away}, às ${formatTime(match)}.`;
      }

      return {
        category,
        emoji,
        match,
        title: `${home} x ${away}`,
        text,
      };
    };

    return [
      makeCall(brasil, "Brasil", "🇧🇷"),
      makeCall(internacional, "Internacional", "🌍"),
      makeCall(interior, "Interior", "🌾"),
    ];
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


      {/* RPF EDITORIAL */}
      <section className="home-block rpf-editorial-block">
        <div className="section-heading">
          <div>
            <span className="section-kicker">RPF EM CAMPO</span>
            <h2>Notícias e cobertura RPF</h2>
          </div>
          <Wifi size={21} />
        </div>

        <div className="rpf-editorial-grid">
          <article className="rpf-editorial-card">
            <span>🇧🇷 RPF NOTÍCIAS</span>
            <strong>Futebol brasileiro</strong>
            <p>Jogos, campeonatos e destaques nacionais ligados à programação do RPF PLACAR.</p>
          </article>
          <article className="rpf-editorial-card">
            <span>🌍 RPF INTERNACIONAL</span>
            <strong>Europa e mundo</strong>
            <p>Premier League em prioridade, além das principais competições internacionais.</p>
          </article>
          <article className="rpf-editorial-card">
            <span>🌾 RPF INTERIOR</span>
            <strong>O futebol que merece espaço</strong>
            <p>Estaduais, divisões de acesso, Série C, Série D e competições regionais.</p>
          </article>
        </div>
      </section>

      {/* =====================================================
          RPF 3 MINUTOS — TELA TV PADRÃO RPF
          ===================================================== */}

      <section className="home-block">
        <div
          style={{
            background: "#020503",
            border: "1px solid rgba(70,255,120,.35)",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 18px 50px rgba(0,0,0,.45)",
          }}
        >
          {/* CABEÇALHO DA TV */}
          <div
            style={{
              minHeight: 56,
              padding: "9px 13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              background:
                "linear-gradient(90deg,#07110a,#111713,#07110a)",
              borderBottom: "3px solid #42ff72",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: "#42ff72",
                  color: "#020603",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 1000,
                  fontSize: 16,
                }}
              >
                RPF
              </div>

              <div>
                <strong
                  style={{
                    display: "block",
                    color: "#fff",
                    fontSize: 17,
                    fontWeight: 1000,
                    lineHeight: 1,
                  }}
                >
                  RPF 3 MINUTOS
                </strong>

                <small
                  style={{
                    color: "#42ff72",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "1.2px",
                  }}
                >
                  JORNAL ESPORTIVO
                </small>
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
                color: "#fff",
              }}
            >
              <small
                style={{
                  display: "block",
                  color: "#42ff72",
                  fontWeight: 900,
                  fontSize: 9,
                }}
              >
                RPF TV
              </small>

              <strong style={{ fontSize: 11 }}>
                FUTEBOL • NOTÍCIAS
              </strong>
            </div>
          </div>

          {/* TELA PRINCIPAL 16:9 */}
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              minHeight: 260,
              background:
                "radial-gradient(circle at 35% 40%,#17311e 0%,#09110c 34%,#020403 75%)",
              overflow: "hidden",
            }}
          >
            {/* FUNDO DECORATIVO */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.18,
                backgroundImage:
                  "linear-gradient(rgba(70,255,120,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(70,255,120,.18) 1px,transparent 1px)",
                backgroundSize: "32px 32px",
                pointerEvents: "none",
              }}
            />

            {heroMatch ? (
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  height: "100%",
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0,1.65fr) minmax(160px,.75fr)",
                }}
              >
                {/* PAINEL PRINCIPAL */}
                <button
                  type="button"
                  onClick={() => onOpenMatch(heroMatch)}
                  style={{
                    position: "relative",
                    border: 0,
                    padding: 0,
                    textAlign: "left",
                    color: "#fff",
                    background: "transparent",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      padding: "18px 18px 68px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {/* CAMPEONATO */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          background: "#42ff72",
                          color: "#031006",
                          padding: "5px 8px",
                          borderRadius: 5,
                          fontWeight: 1000,
                          fontSize: 9,
                        }}
                      >
                        {isLive(heroMatch)
                          ? "● AO VIVO"
                          : "ESQUENTANDO O JOGO"}
                      </span>

                      <span
                        style={{
                          color: "#c8d1ca",
                          fontWeight: 800,
                          fontSize: 10,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getLeagueName(heroMatch)}
                      </span>
                    </div>

                    {/* TIMES */}
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "clamp(12px,4vw,36px)",
                      }}
                    >
                      <div
                        style={{
                          textAlign: "center",
                          minWidth: 70,
                        }}
                      >
                        <TeamBadge
                          name={getHomeName(heroMatch)}
                          logo={getHomeLogo(heroMatch)}
                        />

                        <strong
                          style={{
                            display: "block",
                            marginTop: 7,
                            fontSize: "clamp(13px,2vw,19px)",
                          }}
                        >
                          {abbreviation(
                            getHomeName(heroMatch)
                          )}
                        </strong>

                        <small
                          style={{
                            display: "block",
                            maxWidth: 120,
                            color: "#b7c0b9",
                            fontSize: 9,
                          }}
                        >
                          {getHomeName(heroMatch)}
                        </small>
                      </div>

                      <div
                        style={{
                          textAlign: "center",
                          minWidth: 76,
                        }}
                      >
                        <small
                          style={{
                            color: "#42ff72",
                            fontWeight: 1000,
                            fontSize: 9,
                          }}
                        >
                          {matchStatus(heroMatch)}
                        </small>

                        <strong
                          style={{
                            display: "block",
                            color: "#fff",
                            fontSize: "clamp(24px,5vw,46px)",
                            lineHeight: 1.05,
                            margin: "5px 0",
                          }}
                        >
                          {isLive(heroMatch) ||
                          isFinished(heroMatch)
                            ? hasScore(heroMatch)
                              ? `${getHomeScore(
                                  heroMatch
                                )} - ${getAwayScore(
                                  heroMatch
                                )}`
                              : "X"
                            : formatTime(heroMatch)}
                        </strong>

                        {isLive(heroMatch) && (
                          <small
                            style={{
                              color: "#42ff72",
                              fontWeight: 900,
                            }}
                          >
                            {formatClock(heroMatch)}
                          </small>
                        )}

                        {!isLive(heroMatch) &&
                          !isFinished(heroMatch) && (
                            <small
                              style={{
                                color: "#9ca69f",
                                fontSize: 9,
                              }}
                            >
                              HORÁRIO DO JOGO
                            </small>
                          )}
                      </div>

                      <div
                        style={{
                          textAlign: "center",
                          minWidth: 70,
                        }}
                      >
                        <TeamBadge
                          name={getAwayName(heroMatch)}
                          logo={getAwayLogo(heroMatch)}
                        />

                        <strong
                          style={{
                            display: "block",
                            marginTop: 7,
                            fontSize: "clamp(13px,2vw,19px)",
                          }}
                        >
                          {abbreviation(
                            getAwayName(heroMatch)
                          )}
                        </strong>

                        <small
                          style={{
                            display: "block",
                            maxWidth: 120,
                            color: "#b7c0b9",
                            fontSize: 9,
                          }}
                        >
                          {getAwayName(heroMatch)}
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* GC / MANCHETE */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "inline-block",
                        background: "#42ff72",
                        color: "#021006",
                        padding: "5px 10px",
                        fontSize: 9,
                        fontWeight: 1000,
                        letterSpacing: ".7px",
                      }}
                    >
                      🔥 ESQUENTANDO O JOGO
                    </div>

                    <div
                      style={{
                        padding: "8px 12px",
                        background:
                          "rgba(0,0,0,.92)",
                        borderTop:
                          "1px solid rgba(66,255,114,.35)",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize:
                            "clamp(12px,2vw,18px)",
                          lineHeight: 1.15,
                        }}
                      >
                        {getHomeName(heroMatch)} x{" "}
                        {getAwayName(heroMatch)}
                      </strong>

                      <small
                        style={{
                          color: "#b9c2bb",
                          fontSize: 9,
                        }}
                      >
                        {getLeagueName(heroMatch)} •
                        acompanhe no RPF PLACAR
                      </small>
                    </div>
                  </div>
                </button>

                {/* COLUNA DE NOTÍCIAS */}
                <aside
                  style={{
                    background: "rgba(3,7,4,.94)",
                    borderLeft:
                      "1px solid rgba(66,255,114,.28)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 10px",
                      background: "#42ff72",
                      color: "#031006",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 10,
                        fontWeight: 1000,
                      }}
                    >
                      RPF AGORA
                    </strong>
                  </div>

                  {rpfThreeMinutes.map(
                    (item, index) => (
                      <button
                        type="button"
                        key={`rpf-tv-news-${item.category}`}
                        disabled={!item.match}
                        onClick={() =>
                          item.match &&
                          onOpenMatch(item.match)
                        }
                        style={{
                          width: "100%",
                          minHeight: 65,
                          padding: "8px 9px",
                          border: 0,
                          borderBottom:
                            "1px solid rgba(255,255,255,.08)",
                          background:
                            index % 2
                              ? "#080d09"
                              : "#050806",
                          color: "#fff",
                          textAlign: "left",
                          cursor: item.match
                            ? "pointer"
                            : "default",
                        }}
                      >
                        <small
                          style={{
                            display: "block",
                            color: "#42ff72",
                            fontSize: 8,
                            fontWeight: 1000,
                            marginBottom: 3,
                          }}
                        >
                          {item.emoji} RPF{" "}
                          {String(
                            item.category
                          ).toUpperCase()}
                        </small>

                        <strong
                          style={{
                            display: "block",
                            fontSize: 10,
                            lineHeight: 1.2,
                            marginBottom: 3,
                          }}
                        >
                          {item.title}
                        </strong>

                        <small
                          style={{
                            display: "block",
                            color: "#9ea7a0",
                            fontSize: 8,
                            lineHeight: 1.2,
                          }}
                        >
                          {item.text}
                        </small>
                      </button>
                    )
                  )}
                </aside>
              </div>
            ) : (
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  padding: 30,
                  textAlign: "center",
                  color: "#fff",
                }}
              >
                <div>
                  <strong
                    style={{
                      display: "block",
                      color: "#42ff72",
                      fontSize: 22,
                    }}
                  >
                    RPF 3 MINUTOS
                  </strong>

                  <span
                    style={{
                      color: "#aab3ac",
                    }}
                  >
                    Aguardando a programação
                    esportiva do dia.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* BARRA DE BAIXO */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              minHeight: 38,
              background: "#000",
              borderTop: "2px solid #42ff72",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                background: "#42ff72",
                color: "#031006",
                fontSize: 9,
                fontWeight: 1000,
                whiteSpace: "nowrap",
              }}
            >
              RPF AGORA
            </div>

            <div
              style={{
                padding: "10px 12px",
                color: "#fff",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              ⚽ Futebol brasileiro &nbsp; • &nbsp;
              🌍 Futebol internacional &nbsp; • &nbsp;
              🌾 RPF Interior &nbsp; • &nbsp;
              📻 RPF Jornada Esportiva
            </div>
          </div>

          {/* IDENTIFICAÇÃO */}
          <div
            style={{
              padding: "8px 12px",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              background: "#050806",
              color: "#7f8981",
              fontSize: 8,
            }}
          >
            <span>RPF 3 MINUTOS</span>
            <span>
              NOTÍCIAS • JOGOS • INFORMAÇÃO
            </span>
          </div>
        </div>
      </section>

      {/* POR CAMPEONATO */}

      <section className="home-block">
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              PROGRAMAÇÃO
            </span>

            <h2>Por campeonato</h2>
          </div>

         <CalendarDays size={21} />
</div>

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
// RPF JORNADA ESPORTIVA - MOTOR DE ÁUDIO
// ======================================================

function getFixtureEvents(payload) {
  const candidates = [
    payload?.events,
    payload?.eventos,
    payload?.incidents,
    payload?.timeline,
    payload?.raw?.events,
    payload?.raw?.eventos,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function eventMinute(event) {
  return firstValue(
    event?.minute,
    event?.minuto,
    event?.elapsed,
    event?.time?.elapsed,
    event?.time?.minute
  );
}

function eventFingerprint(event, index = 0) {
  return JSON.stringify([
    firstValue(event?.id, event?.event_id, event?.incident_id, index),
    eventMinute(event),
    firstValue(event?.type, event?.tipo, event?.detail, event?.detalhe, ""),
    firstValue(event?.player?.name, event?.player_name, event?.jogador, ""),
    firstValue(event?.team?.name, event?.team_name, event?.equipe, ""),
  ]);
}

function narrationForEvent(event, match) {
  const rawType = normalizeText(
    firstValue(
      event?.type,
      event?.tipo,
      event?.detail,
      event?.detalhe,
      event?.name,
      ""
    )
  ).toLowerCase();

  const minute = eventMinute(event);
  const minuteText =
    minute !== null && minute !== undefined && minute !== ""
      ? ` aos ${minute} minutos`
      : "";

  const team = String(
    firstValue(
      event?.team?.name,
      event?.team_name,
      event?.equipe?.nome,
      event?.equipe,
      ""
    ) || ""
  );

  const player = String(
    firstValue(
      event?.player?.name,
      event?.player_name,
      event?.jogador?.nome,
      event?.jogador,
      ""
    ) || ""
  );

  const who = player
    ? ` de ${player}${team ? `, do ${team}` : ""}`
    : team
    ? ` do ${team}`
    : "";

  if (rawType.includes("goal") || rawType.includes("gol")) {
    const home = getHomeScore(match);
    const away = getAwayScore(match);
    const score = hasScore(match)
      ? ` Placar agora: ${getHomeName(match)} ${home}, ${getAwayName(match)} ${away}.`
      : "";

    return `Gol! Gol${who}${minuteText}.${score}`;
  }

  if (
    rawType.includes("red card") ||
    rawType.includes("cartao vermelho") ||
    rawType.includes("cartão vermelho")
  ) {
    return `Cartão vermelho${who}${minuteText}.`;
  }

  if (
    rawType.includes("yellow") ||
    rawType.includes("amarelo")
  ) {
    return `Cartão amarelo${who}${minuteText}.`;
  }

  if (
    rawType.includes("substitution") ||
    rawType.includes("substitu")
  ) {
    return `Substituição${team ? ` no ${team}` : ""}${minuteText}.`;
  }

  if (
    rawType.includes("half") ||
    rawType.includes("interval") ||
    rawType.includes("intervalo")
  ) {
    return `Intervalo de jogo. ${getHomeName(match)} ${getHomeScore(match) ?? 0}, ${getAwayName(match)} ${getAwayScore(match) ?? 0}.`;
  }

  if (
    rawType.includes("finished") ||
    rawType.includes("full time") ||
    rawType.includes("fim")
  ) {
    return `Fim de jogo. ${getHomeName(match)} ${getHomeScore(match) ?? 0}, ${getAwayName(match)} ${getAwayScore(match) ?? 0}.`;
  }

  // A RPF não inventa lance. Evento desconhecido fica sem narração.
  return null;
}

function rpfPhaseLabel(phase) {
  const value = normalizeText(phase).toLowerCase();

  if (value.includes("pre")) return "PRÉ-JOGO";
  if (value.includes("live") || value.includes("ao vivo")) return "AO VIVO";
  if (value.includes("half") || value.includes("interval")) return "INTERVALO";
  if (value.includes("post")) return "PÓS-JOGO";
  if (value.includes("full") || value.includes("finish") || value.includes("fim")) return "FIM DE JOGO";
  return "PROGRAMADA";
}

function rpfEventLabel(event) {
  const type = normalizeText(
    firstValue(event?.type, event?.tipo, event?.name, event?.event, "EVENTO RPF")
  ).toUpperCase();

  if (type.includes("JOURNEY_OPEN")) return "🎙️ RPF JORNADA NO AR";
  if (type.includes("CROWD_START")) return "🏟️ TORCIDA RPF";
  if (type.includes("TIME_AND_SCORE")) return "⏱️ TEMPO E PLACAR RPF";
  if (type.includes("BREAKING") || type.includes("PLANTAO")) return "🚨 PLANTÃO RPF";
  if (type.includes("GOAL") || type.includes("GOL")) return "⚽ GOL";
  if (type.includes("HALFTIME") || type.includes("INTERVAL")) return "⏸️ INTERVALO";
  if (type.includes("FULLTIME") || type.includes("FINISH")) return "🏁 FIM DE JOGO";

  return type || "EVENTO RPF";
}

function rpfEventText(event) {
  return String(
    firstValue(
      event?.text,
      event?.message,
      event?.mensagem,
      event?.description,
      event?.descricao,
      event?.payload?.text,
      event?.payload?.message,
      "Evento confirmado pelo Motor RPF."
    )
  );
}

function RPFJornadaPlayer({ match }) {
  const id = getMatchId(match);
  const registered = Boolean(match?._rpfJourney);

  const [loading, setLoading] = useState(registered);
  const [engineState, setEngineState] = useState(null);
  const [engineEvents, setEngineEvents] = useState([]);
  const [error, setError] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const crowdAudioRef = useRef(null);
  const stingerAudioRef = useRef(null);
  const playedMotorEventsRef = useRef(new Set());
  const audioEnabledRef = useRef(false);
  const latestEventsRef = useRef([]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    latestEventsRef.current = engineEvents;
  }, [engineEvents]);

  useEffect(() => {
    if (!registered || !id) {
      setEngineState(null);
      setEngineEvents([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;

    async function loadJourney() {
      try {
        const [stateResponse, eventsResponse] = await Promise.all([
          fetch(`${API_URL}/api/rpf/jornada/${encodeURIComponent(id)}`, { cache: "no-store" }),
          fetch(`${API_URL}/api/rpf/jornada/${encodeURIComponent(id)}/eventos`, { cache: "no-store" }),
        ]);

        if (!stateResponse.ok) throw new Error(`Motor RPF respondeu ${stateResponse.status}`);

        const stateData = await stateResponse.json();
        const eventsData = eventsResponse.ok ? await eventsResponse.json() : null;
        if (cancelled) return;

        const statePayload = stateData?.response ?? stateData?.resposta ?? stateData;
        const eventsPayload = eventsData?.response ?? eventsData?.resposta ?? eventsData;
        setEngineState(statePayload);

        const eventCandidates = [
          eventsPayload?.events, eventsPayload?.eventos,
          eventsPayload?.generatedEvents, eventsPayload?.EventosGerados,
          statePayload?.generatedEvents, statePayload?.EventosGerados,
          statePayload?.state?.events, statePayload?.state?.eventos,
        ];
        const foundEvents = eventCandidates.find(Array.isArray) || [];
        setEngineEvents(foundEvents.slice().reverse().slice(0, 20));
        setError("");
      } catch (requestError) {
        if (!cancelled) {
          console.error("Motor RPF: erro ao consultar Jornada", requestError);
          setError("Não foi possível atualizar o Motor RPF agora.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJourney();
    const timer = window.setInterval(loadJourney, 12000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [id, registered]);

  const phase = firstValue(
    engineState?.phase, engineState?.fase,
    engineState?.state?.phase, engineState?.state?.fase,
    "scheduled"
  );
  const phaseLabel = rpfPhaseLabel(phase);
  const livePhase = phaseLabel === "AO VIVO";

  useEffect(() => {
    const crowd = crowdAudioRef.current;
    if (!crowd) return;

    if (audioEnabled && livePhase) {
      crowd.volume = 0.22;
      crowd.loop = true;
      crowd.play().catch((audioError) => {
        console.warn("RPF: torcida não iniciou", audioError);
      });
    } else {
      crowd.pause();
    }
  }, [audioEnabled, livePhase]);

  if (!registered) return null;

  const priority = firstValue(
    engineState?.priority, engineState?.prioridade,
    match?._rpfJourney?.priority, match?._rpfJourney?.prioridade, "RPF"
  );

  const motorMatch = engineState?.match || engineState?.partida || {};
  const home = firstValue(motorMatch?.homeTeam, motorMatch?.home_team, getHomeName(match));
  const away = firstValue(motorMatch?.awayTeam, motorMatch?.away_team, getAwayName(match));
  const homeScore = firstValue(motorMatch?.homeScore, motorMatch?.home_score, getHomeScore(match), 0);
  const awayScore = firstValue(motorMatch?.awayScore, motorMatch?.away_score, getAwayScore(match), 0);
  const kickoffRaw = firstValue(motorMatch?.kickoff, motorMatch?.date, match?.fixture?.date, match?.date);
  const kickoff = kickoffRaw ? new Date(kickoffRaw) : null;
  const preGame = kickoff && !Number.isNaN(kickoff.getTime()) ? new Date(kickoff.getTime() - 60 * 60 * 1000) : null;
  const preGameText = preGame ? preGame.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "60 min antes";

  function motorAudioUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(String(path))) return String(path);
  return `${API_URL}${String(path).startsWith("/") ? "" : "/"}${path}`;
}

  function speakMotorText(text) {
    if (!audioEnabledRef.current || !text || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.lang = "pt-BR";
      utterance.rate = 1.03;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } catch (speechError) {
      console.warn("RPF: TTS indisponível", speechError);
    }
  }

  function playStinger(path, afterText = "") {
    if (!audioEnabledRef.current || !stingerAudioRef.current || !path) return;

    const audio = stingerAudioRef.current;
    const crowd = crowdAudioRef.current;

    try {
      audio.pause();
      audio.src = motorAudioUrl(path);
      audio.currentTime = 0;
      audio.volume = 0.95;

      if (crowd && !crowd.paused) crowd.volume = 0.07;

      audio.onended = () => {
        if (crowd && audioEnabledRef.current && livePhase) crowd.volume = 0.22;
        if (afterText) window.setTimeout(() => speakMotorText(afterText), 180);
      };

      audio.onerror = () => {
        console.warn("RPF: arquivo de áudio não carregou:", audio.src);
        if (crowd && audioEnabledRef.current && livePhase) crowd.volume = 0.22;
        if (afterText) speakMotorText(afterText);
      };

      audio.play().catch((audioError) => {
        console.warn("RPF: reprodução bloqueada/indisponível", audioError);
        if (crowd && audioEnabledRef.current && livePhase) crowd.volume = 0.22;
        if (afterText) speakMotorText(afterText);
      });
    } catch (audioError) {
      console.warn("RPF: erro ao tocar vinheta", audioError);
      if (afterText) speakMotorText(afterText);
    }
  }

  function motorEventId(event, index = 0) {
    return String(firstValue(
      event?.id,
      event?.event_id,
      event?.eventId,
      `${firstValue(event?.type, event?.tipo, "evento")}-${firstValue(event?.createdAt, event?.criadoEm, index)}`
    ));
  }

  function motorEventType(event) {
    return normalizeText(firstValue(event?.type, event?.tipo, event?.name, "")).toUpperCase();
  }

  function handleMotorEventAudio(event, index = 0) {
    if (!audioEnabledRef.current || !event) return;

    const eventId = motorEventId(event, index);
    if (playedMotorEventsRef.current.has(eventId)) return;
    playedMotorEventsRef.current.add(eventId);

    const type = motorEventType(event);
    const path = firstValue(event?.audio, event?.audioPath, event?.audio_path, event?.payload?.audio, "");
    const text = firstValue(event?.text, event?.texto, event?.message, event?.mensagem, event?.payload?.text, "");

    if (type.includes("CROWD_START") || type.includes("PUBLICO_INICIADO")) {
      const crowd = crowdAudioRef.current;
      if (crowd && livePhase) {
        crowd.volume = 0.22;
        crowd.loop = true;
        crowd.play().catch((audioError) => console.warn("RPF: torcida bloqueada", audioError));
      }
      return;
    }

    // Vinheta primeiro; depois o texto dinâmico do Motor RPF.
    if (path) {
      playStinger(path, text);
    } else if (text) {
      speakMotorText(text);
    }
  }

  function enableRpfAudio() {
    const next = !audioEnabled;

    if (!next) {
      setAudioEnabled(false);
      if (crowdAudioRef.current) crowdAudioRef.current.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      return;
    }

    // O clique do usuário libera o áudio no navegador/celular.
    audioEnabledRef.current = true;
    setAudioEnabled(true);

    const crowd = crowdAudioRef.current;
    if (crowd && livePhase) {
      crowd.volume = 0.22;
      crowd.loop = true;
      crowd.play().catch((audioError) => console.warn("RPF: torcida não iniciou no clique", audioError));
    }

    // Não toca toda a abertura antiga. Ao ativar no meio do jogo,
    // reproduz somente o evento RPF mais recente que tenha áudio/texto.
    const newest = latestEventsRef.current.find((event) =>
      Boolean(firstValue(event?.audio, event?.audioPath, event?.audio_path, event?.text, event?.texto))
    );

    if (newest) {
      playedMotorEventsRef.current.add(motorEventId(newest, 0));
      const path = firstValue(newest?.audio, newest?.audioPath, newest?.audio_path, "");
      const text = firstValue(newest?.text, newest?.texto, newest?.message, newest?.mensagem, "");
      if (path) playStinger(path, text);
      else if (text) speakMotorText(text);
    }
  }

  useEffect(() => {
    if (!audioEnabled || !engineEvents.length) return;

    // engineEvents está do mais novo para o mais antigo.
    // Processamos em ordem cronológica e ignoramos o que já tocou.
    [...engineEvents]
      .reverse()
      .forEach((event, index) => handleMotorEventAudio(event, index));
  }, [engineEvents, audioEnabled, livePhase]);

  const panelStyle = {
    margin: "14px 0", border: "1px solid rgba(68,255,142,.35)", borderRadius: 22,
    overflow: "hidden", background: "linear-gradient(145deg, rgba(2,28,24,.98), rgba(2,12,12,.98))",
    boxShadow: "0 18px 48px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.04)"
  };
  const topStyle = { padding: "16px 16px 13px", borderBottom: "1px solid rgba(255,255,255,.07)" };
  const green = "#58ff91";

  return (
    <section className="rpf-jornada is-on" style={panelStyle}>
      <audio ref={crowdAudioRef} preload="auto" src={`${API_URL}/audio/rpf/torcida_rpf_loop.mp3`} />
      <audio ref={stingerAudioRef} preload="auto" />

      <div style={topStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", fontSize: 24, background: "rgba(88,255,145,.12)", border: "1px solid rgba(88,255,145,.25)" }}>🎙️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <small style={{ color: green, fontWeight: 900, letterSpacing: ".09em" }}>MOTOR RPF • PRIORIDADE {priority}</small>
            <h2 style={{ margin: "3px 0 0", fontSize: 20 }}>RPF Jornada Esportiva</h2>
          </div>
          <span style={{ padding: "7px 10px", borderRadius: 999, fontSize: 11, fontWeight: 900, color: livePhase ? "#06120b" : green, background: livePhase ? green : "rgba(88,255,145,.10)", border: "1px solid rgba(88,255,145,.30)" }}>{phaseLabel}</span>
        </div>

        <div style={{ marginTop: 15, padding: "13px 12px", borderRadius: 16, background: "rgba(0,0,0,.24)", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "left" }}><strong style={{ display: "block", fontSize: 15 }}>{home}</strong><small style={{ opacity: .6 }}>{abbreviation(home)}</small></div>
          <div style={{ textAlign: "center" }}><strong style={{ color: green, fontSize: 27, letterSpacing: ".05em" }}>{homeScore} - {awayScore}</strong><small style={{ display: "block", opacity: .65, marginTop: 2 }}>{phaseLabel}</small></div>
          <div style={{ textAlign: "right" }}><strong style={{ display: "block", fontSize: 15 }}>{away}</strong><small style={{ opacity: .6 }}>{abbreviation(away)}</small></div>
        </div>

        <p style={{ margin: "12px 1px 0", lineHeight: 1.45, opacity: .82, fontSize: 13 }}>
          {loading ? "Conectando ao Motor RPF..." : error ? error :
           phaseLabel === "PROGRAMADA" ? `Jornada confirmada. A transmissão abre às ${preGameText}.` :
           phaseLabel === "PRÉ-JOGO" ? "Pré-jogo RPF no ar. Contagem regressiva para a bola rolar." :
           livePhase ? "Jornada no ar. Torcida RPF, Tempo e Placar, Plantão RPF e momentos confirmados." :
           phaseLabel === "INTERVALO" ? "Intervalo de jogo na RPF Jornada Esportiva." :
           phaseLabel === "FIM DE JOGO" ? "Fim de jogo. Pós-jogo RPF em preparação." : "Pós-jogo RPF em andamento."}
        </p>
      </div>

      <div style={{ padding: "13px 16px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <button type="button" onClick={enableRpfAudio} style={{ border: 0, borderRadius: 12, padding: "10px 12px", fontWeight: 900, cursor: "pointer", background: audioEnabled ? green : "rgba(255,255,255,.09)", color: audioEnabled ? "#05110a" : "#fff" }}>
          {audioEnabled ? "🔊 ÁUDIO RPF ATIVO" : "🔇 ATIVAR ÁUDIO RPF"}
        </button>
        <button type="button" disabled={!audioEnabled} onClick={() => playStinger("/audio/rpf/rpf_vinheta_2_chamada_jornada.wav")} style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: "10px 12px", fontWeight: 800, background: "rgba(255,255,255,.06)", color: "#fff", opacity: audioEnabled ? 1 : .45 }}>VINHETA</button>
        <button type="button" disabled={!audioEnabled} onClick={() => playStinger("/audio/rpf/rpf_vinheta_1_tempo_placar.wav")} style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: "10px 12px", fontWeight: 800, background: "rgba(255,255,255,.06)", color: "#fff", opacity: audioEnabled ? 1 : .45 }}>TEMPO E PLACAR</button>
      </div>

      <div style={{ padding: "15px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <strong style={{ fontSize: 13, letterSpacing: ".08em" }}>MOMENTOS DO JOGO</strong>
          <small style={{ color: green }}>● SOMENTE EVENTOS CONFIRMADOS</small>
        </div>

        {engineEvents.length === 0 ? (
          <div style={{ padding: "14px", borderRadius: 14, background: "rgba(255,255,255,.045)", opacity: .7, fontSize: 13 }}>
            {phaseLabel === "PROGRAMADA" ? "Os momentos aparecerão aqui quando a Jornada começar." : "Aguardando o próximo evento confirmado pelo Motor RPF."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {engineEvents.map((event, index) => {
              const minute = firstValue(event?.minute, event?.minuto, event?.payload?.minute, event?.payload?.minuto);
              return (
                <article key={`${eventFingerprint(event, index)}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 12px", borderRadius: 14, background: "rgba(255,255,255,.045)", borderLeft: `3px solid ${green}` }}>
                  <div><strong style={{ fontSize: 13 }}>{rpfEventLabel(event)}</strong><p style={{ margin: "3px 0 0", opacity: .72, fontSize: 12 }}>{rpfEventText(event)}</p></div>
                  {minute !== null && minute !== undefined && minute !== "" && <span style={{ color: green, fontWeight: 900 }}>{minute}'</span>}
                </article>
              );
            })}
          </div>
        )}

        <small style={{ display: "block", marginTop: 12, opacity: .48, lineHeight: 1.4 }}>
          Sem narração contínua: o Motor RPF reage somente a dados reais confirmados pelas fontes esportivas.
        </small>
      </div>
    </section>
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

      <RPFJornadaPlayer match={match} />

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
    competition?.current_season?.id,
    competition?.temporada_atual?.id,
    competition?.season?.id,
    String(leagueId) === "9" ? 28 : null
  );

  const competitionForStandings = {
    ...competition,
    league_id: leagueId,
    season_id: seasonId,
  };

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
    competition?.current_season?.id,
    competition?.temporada_atual?.id,
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
  const [rpfJourneys, setRpfJourneys] = useState([]);

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
  // RPF JORNADAS ATIVAS
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadRpfJourneys() {
      try {
        const response = await fetch(`${API_URL}/api/rpf/jornadas`, {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();
        if (cancelled) return;

        const list = Array.isArray(data?.response)
          ? data.response
          : Array.isArray(data?.resposta)
          ? data.resposta
          : Array.isArray(data?.journeys)
          ? data.journeys
          : [];

        // Aceita o formato normal da API e também nomes exibidos
        // traduzidos pelo navegador. Só mantém Jornadas realmente ativas.
        const activeJourneys = list.filter((journey) => {
          const enabled = firstValue(
            journey?.enabled,
            journey?.ativado,
            journey?.active,
            journey?.ativo,
            true
          );

          return (
            enabled === true ||
            String(enabled).toLowerCase() === "true" ||
            String(enabled).toLowerCase() === "verdadeiro"
          );
        });

        setRpfJourneys(activeJourneys);
      } catch (error) {
        console.error("Erro ao carregar Jornadas RPF:", error);
      }
    }

    loadRpfJourneys();
    const timer = window.setInterval(loadRpfJourneys, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rpfJourneyMap = useMemo(() => {
    const map = new Map();

    for (const journey of rpfJourneys) {
      const fixtureId = String(
        firstValue(
          journey?.fixtureId,
          journey?.fixture_id,
          journey?.eventId,
          journey?.event_id,
          journey?.id,
          ""
        )
      ).trim();

      if (fixtureId) map.set(fixtureId, journey);
    }

    return map;
  }, [rpfJourneys]);

  const visibleMatches = useMemo(
    () =>
      matches.map((match) => {
        const journey = rpfJourneyMap.get(getMatchId(match));
        return journey ? { ...match, _rpfJourney: journey } : match;
      }),
    [matches, rpfJourneyMap]
  );

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
        const journey = rpfJourneyMap.get(String(id));
        setSelectedMatch({
          ...match,
          ...data.response,
          ...(journey ? { _rpfJourney: journey } : {}),
        });
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
          matches={visibleMatches}
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
          matches={visibleMatches}
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
          matches={visibleMatches}
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
          matches={visibleMatches}
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
