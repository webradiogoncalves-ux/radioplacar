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
  // RPF 3 MINUTOS — NOTÍCIAS AUTOMÁTICAS
  // ====================================================

  const [rpfNews, setRpfNews] = useState({
    brasil: [],
    internacional: [],
    interior: [],
    ticker: [],
  });

  const [rpfNewsLoading, setRpfNewsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer = null;

    async function loadRpfNews() {
      try {
        const response = await fetch(`${API_URL}/api/rpf/noticias`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`RPF Notícias respondeu ${response.status}`);
        }

        const data = await response.json();
        if (!active) return;

        const noticias = data?.noticias && typeof data.noticias === "object"
          ? data.noticias
          : {};

        setRpfNews({
          brasil: Array.isArray(noticias?.brasil) ? noticias.brasil : [],
          internacional: Array.isArray(noticias?.internacional) ? noticias.internacional : [],
          interior: Array.isArray(noticias?.interior) ? noticias.interior : [],
          ticker: Array.isArray(data?.ticker) ? data.ticker : [],
        });
      } catch (error) {
        console.error("Erro ao carregar RPF Notícias:", error);
      } finally {
        if (active) setRpfNewsLoading(false);
      }
    }

    loadRpfNews();
    timer = window.setInterval(loadRpfNews, 10 * 60 * 1000);

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

 function cleanRpfNewsText(value) {
  return String(value || "")
    // entidades HTML comuns
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")

    // tags HTML
    .replace(/<[^>]*>/g, " ")

    // sujeiras comuns de captura
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/�+/g, "")
    .replace(/\s*&%\s*&?/g, " ")
    .replace(/\s*%\s*&\s*/g, " ")

    // espaços duplicados
    .replace(/\s+/g, " ")
    .trim();
}

const normalizeRpfNews = (item, category, emoji) => ({
  id:
    item?.id ||
    `${category}-${item?.url || item?.title || "updating"}`,

  category,
  emoji,

  title: cleanRpfNewsText(
    item?.title ||
      item?.titulo ||
      "Atualizando notícias"
  ),

  text: cleanRpfNewsText(
    item?.text ||
      item?.texto ||
      item?.description ||
      item?.descricao ||
      ""
  ),

  source: cleanRpfNewsText(
    item?.source ||
      item?.fonte ||
      "RPF"
  ),

  url:
    item?.url ||
    item?.link ||
    "",

  publishedAt:
    item?.publishedAt ||
    item?.published_at ||
    item?.data ||
    null,

  match: null,
});
const rpfThreeMinutes = useMemo(() => [
  normalizeRpfNews(
    rpfNews.brasil[0],
    "RPF Notícias",
    "🇧🇷"
  ),

  normalizeRpfNews(
    rpfNews.internacional[0],
    "RPF Internacional",
    "🌍"
  ),

  normalizeRpfNews(
    rpfNews.interior[0],
    "RPF Interior",
    "🌾"
  ),
], [rpfNews]);

const rpfFeaturedNews = useMemo(() => {
  if (!heroMatch) return null;

  const home = normalizeText(
    getHomeName(heroMatch)
  ).toLowerCase();

  const away = normalizeText(
    getAwayName(heroMatch)
  ).toLowerCase();

  const league = normalizeText(
    getLeagueName(heroMatch)
  ).toLowerCase();

  const allNews = [
    ...rpfNews.brasil,
    ...rpfNews.internacional,
    ...rpfNews.interior,
  ];

  const importantWords = (value) =>
    value
      .split(" ")
      .filter((word) => word.length >= 5);

  const scoreNews = (item) => {
    const title = normalizeText(
      item?.title ||
      item?.titulo ||
      ""
    ).toLowerCase();

    const text = normalizeText(
      item?.text ||
      item?.texto ||
      item?.description ||
      ""
    ).toLowerCase();

    const content = `${title} ${text}`;

    let score = 0;

    if (
      home &&
      content.includes(home)
    ) {
      score += 10;
    }

    if (
      away &&
      content.includes(away)
    ) {
      score += 10;
    }

    if (
      importantWords(home).some(
        (word) => content.includes(word)
      )
    ) {
      score += 4;
    }

    if (
      importantWords(away).some(
        (word) => content.includes(word)
      )
    ) {
      score += 4;
    }

    if (
      importantWords(league).some(
        (word) => content.includes(word)
      )
    ) {
      score += 2;
    }

    return score;
  };

  return allNews
    .map((item) => ({
      item,
      score: scoreNews(item),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score
    )[0]?.item || null;

}, [heroMatch, rpfNews]);

const rpfTickerNews = useMemo(() => {
  const source =
    rpfNews.ticker.length
      ? rpfNews.ticker
      : [
          ...rpfNews.brasil,
          ...rpfNews.internacional,
          ...rpfNews.interior,
        ];

  const seen = new Set();

  return source
    .map((item, index) => {
      const title =
        cleanRpfNewsText(
          item?.title ||
          item?.titulo ||
          ""
        );

      const text =
        cleanRpfNewsText(
          item?.text ||
          item?.texto ||
          item?.description ||
          ""
        );

      const key =
        normalizeText(
          `${title}-${item?.url || index}`
        ).toLowerCase();

      return {
        id:
          item?.id ||
          `ticker-${index}`,

        category:
          item?.category ||
          item?.categoria ||
          "RPF",

        title,
        text,

        url:
          item?.url ||
          item?.link ||
          "",

        key,
      };
    })

    .filter((item) => {
      if (
        !item.title ||
        seen.has(item.key)
      ) {
        return false;
      }

      seen.add(item.key);
      return true;
    })

    .slice(0, 20);

}, [rpfNews]);

return (
  <main className="screen home-screen rpf-home">
    
{/* ============================================================
    RPF 3 MINUTOS — TELA TV OFICIAL
    Logo da competição + Esquentando + ticker contínuo
============================================================ */}

<style>{`
  @keyframes rpfTickerMove {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(-50%, 0, 0);
    }
  }

  .rpf-tv-ticker {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .rpf-tv-ticker-track {
    display: flex;
    align-items: center;
    width: max-content;
    min-width: max-content;
    white-space: nowrap;

    animation-name: rpfTickerMove;
    animation-duration: 390s;
    animation-timing-function: linear;
    animation-iteration-count: infinite;

    will-change: transform;
  }

  .rpf-tv-ticker-track > span {
    flex: 0 0 auto;
    padding-right: 42px;
  }

  .rpf-tv-news-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  @media (max-width: 650px) {
    .rpf-tv-news-grid {
      grid-template-columns: 1fr;
    }

    .rpf-tv-ticker-track {
      animation-duration: 400s;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rpf-tv-ticker-track {
      animation: rpfTickerMove 600s linear infinite !important;
    }
  }
`}</style>

<section className="home-block">
  <div
    style={{
      overflow: "hidden",
      borderRadius: 18,
      border: "1px solid rgba(70,255,115,.32)",
      background: "#030604",
     boxShadow: "0 20px 55px rgba(0,0,0,.45)",
    }}
  >
    {/* ================= CABEÇALHO ================= */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 13px",
        background:
          "linear-gradient(90deg,#050a06,#111a13,#050a06)",
        borderBottom: "3px solid #45ff73",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 43,
            height: 43,
            display: "grid",
            placeItems: "center",
            borderRadius: 7,
            background: "#45ff73",
            color: "#020703",
            fontWeight: 1000,
            fontSize: 15,
          }}
        >
          RPF
        </div>

        <div>
          <strong
            style={{
              display: "block",
              color: "#fff",
              fontSize: 18,
              fontWeight: 1000,
            }}
          >
            RPF 3 MINUTOS
          </strong>

          <span
            style={{
              color: "#45ff73",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 1.3,
            }}
          >
            JORNAL ESPORTIVO
          </span>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <strong
          style={{
            display: "block",
            color: "#45ff73",
            fontSize: 11,
          }}
        >
          RPF TV
        </strong>

        <span style={{ color: "#9ba49d", fontSize: 9 }}>
          ESPORTE QUE CONECTA
        </span>
      </div>
    </div>


    {heroMatch ? (
      <>

        {/* ================= COMPETIÇÃO ================= */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "9px 12px",
            background: "#080d09",
            borderBottom: "1px solid rgba(69,255,115,.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              minWidth: 0,
            }}
          >

            {/* LOGO REAL DA COMPETIÇÃO */}
            <LeagueBadge match={heroMatch} />

            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  color: "#45ff73",
                  fontSize: 8,
                  fontWeight: 1000,
                }}
              >
                COMPETIÇÃO
              </span>

              <strong
                style={{
                  display: "block",
                  color: "#fff",
                  fontSize: 13,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {getLeagueName(heroMatch)}
              </strong>
            </div>
          </div>

          <span
            style={{
              padding: "5px 8px",
              borderRadius: 5,
              background: isLive(heroMatch)
                ? "#45ff73"
                : "#172219",
              color: isLive(heroMatch)
                ? "#021006"
                : "#45ff73",
              fontSize: 9,
              fontWeight: 1000,
              whiteSpace: "nowrap",
            }}
          >
            {isLive(heroMatch)
              ? "● AO VIVO"
              : matchStatus(heroMatch)}
          </span>
        </div>


        {/* ================= ESQUENTANDO ================= */}
        <div
          style={{
            padding: "8px 12px",
            color: "#021006",
            background:
              "linear-gradient(90deg,#45ff73,#24c953)",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 8,
              fontWeight: 1000,
              letterSpacing: 1,
            }}
          >
            RPF 3 MINUTOS APRESENTA
          </span>

          <strong
            style={{
              display: "block",
              fontSize: 21,
              fontWeight: 1000,
            }}
          >
            ESQUENTANDO O JOGO
          </strong>
        </div>


        {/* ================= JOGO PRINCIPAL ================= */}
        <button
          type="button"
          onClick={() => onOpenMatch(heroMatch)}
          style={{
            width: "100%",
            padding: "20px 12px",
            border: 0,
            cursor: "pointer",
            color: "#fff",
            background:
              "radial-gradient(circle at center,#173820 0%,#09120b 48%,#020403 100%)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 12,
            }}
          >

            {/* MANDANTE */}
            <div style={{ textAlign: "center" }}>
              <TeamBadge
                name={getHomeName(heroMatch)}
                logo={getHomeLogo(heroMatch)}
              />

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 18,
                }}
              >
                {abbreviation(getHomeName(heroMatch))}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  color: "#aeb7b0",
                  fontSize: 10,
                }}
              >
                {getHomeName(heroMatch)}
              </span>
            </div>


            {/* PLACAR / HORÁRIO */}
            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  color: "#45ff73",
                  fontSize: 10,
                  fontWeight: 1000,
                }}
              >
                {isLive(heroMatch)
                  ? formatClock(heroMatch)
                  : matchStatus(heroMatch)}
              </span>

              <strong
                style={{
                  display: "block",
                  margin: "6px 0",
                  fontSize: "clamp(30px,8vw,50px)",
                  lineHeight: 1,
                }}
              >
                {isLive(heroMatch) || isFinished(heroMatch)
                  ? hasScore(heroMatch)
                    ? `${getHomeScore(heroMatch)} - ${getAwayScore(
                        heroMatch
                      )}`
                    : "X"
                  : formatTime(heroMatch)}
              </strong>

              <span
                style={{
                  color: "#9ba49d",
                  fontSize: 9,
                }}
              >
                {isLive(heroMatch)
                  ? "TEMPO E PLACAR"
                  : isFinished(heroMatch)
                  ? "RESULTADO FINAL"
                  : "HORÁRIO DO JOGO"}
              </span>
            </div>


            {/* VISITANTE */}
            <div style={{ textAlign: "center" }}>
              <TeamBadge
                name={getAwayName(heroMatch)}
                logo={getAwayLogo(heroMatch)}
              />

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 18,
                }}
              >
                {abbreviation(getAwayName(heroMatch))}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  color: "#aeb7b0",
                  fontSize: 10,
                }}
              >
                {getAwayName(heroMatch)}
              </span>
            </div>
          </div>
        </button>


        {/* ================= DADOS DA PARTIDA ================= */}
        <div
          style={{
            margin: "0 12px 12px",
            padding: 11,
            borderLeft: "4px solid #45ff73",
            borderTop: "1px solid rgba(255,255,255,.08)",
            borderRight: "1px solid rgba(255,255,255,.08)",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            background: "#070b08",
          }}
        >
          <span
            style={{
              display: "block",
              color: "#45ff73",
              fontSize: 9,
              fontWeight: 1000,
            }}
          >
            DESTAQUE RPF
          </span>

          <strong
            style={{
              display: "block",
              marginTop: 3,
              color: "#fff",
              fontSize: 16,
            }}
          >
            {getHomeName(heroMatch)} x {getAwayName(heroMatch)}
          </strong>

          <span
            style={{
              display: "block",
              marginTop: 5,
              color: "#aeb7b0",
              fontSize: 10,
            }}
          >
            {getLeagueName(heroMatch)}
            {" • "}
            {isLive(heroMatch)
              ? "Jogo em andamento"
              : isFinished(heroMatch)
              ? "Partida encerrada"
              : `Bola rola às ${formatTime(heroMatch)}`}
          </span>

          {rpfFeaturedNews && (
            <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid rgba(69,255,115,.18)" }}>
              <span style={{ display: "block", color: "#45ff73", fontSize: 8, fontWeight: 1000, marginBottom: 4 }}>
                ESQUENTANDO O JOGO • ÚLTIMA INFORMAÇÃO
              </span>
              <strong style={{ display: "block", color: "#fff", fontSize: 12, lineHeight: 1.3 }}>
                {rpfFeaturedNews?.title || rpfFeaturedNews?.titulo}
              </strong>
              {(rpfFeaturedNews?.source || rpfFeaturedNews?.fonte) && (
                <span style={{ display: "block", marginTop: 5, color: "#8d968f", fontSize: 8 }}>
                  Fonte: {rpfFeaturedNews?.source || rpfFeaturedNews?.fonte}
                </span>
              )}
            </div>
          )}
        </div>


        {/* ================= RPF AGORA ================= */}
        <div
          style={{
            padding: "12px",
            background: "#050805",
            borderTop: "1px solid rgba(69,255,115,.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 9,
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  color: "#45ff73",
                  fontSize: 9,
                  fontWeight: 1000,
                }}
              >
                CENTRAL DE NOTÍCIAS
              </span>

              <strong
                style={{
                  color: "#fff",
                  fontSize: 16,
                }}
              >
                RPF AGORA
              </strong>
            </div>

            <span
              style={{
                padding: "4px 7px",
                borderRadius: 4,
                color: "#45ff73",
                background: "#101a12",
                fontSize: 8,
                fontWeight: 1000,
              }}
            >
              ATUALIZAÇÃO
            </span>
          </div>


          {/* NOTÍCIAS */}
          <div className="rpf-tv-news-grid">
            {rpfThreeMinutes.map((item, index) => (
              <button
                type="button"
                key={`rpf-tv-news-${item.id}-${index}`}
                onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
                disabled={!item.url}
                style={{
                  minHeight: 105,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: index === 0 ? "#0d1a10" : "#080c09",
                  color: "#fff",
                  textAlign: "left",
                  cursor: item.url ? "pointer" : "default",
                }}
              >
                <span style={{ display: "block", color: "#45ff73", fontSize: 8, fontWeight: 1000, marginBottom: 5 }}>
                  {item.emoji} {String(item.category).toUpperCase()}
                </span>
                <strong style={{ display: "block", fontSize: 11, lineHeight: 1.25 }}>
                  {item.title}
                </strong>
                {item.text && (
                  <span style={{ display: "block", marginTop: 5, color: "#9da69f", fontSize: 9, lineHeight: 1.3 }}>
                    {item.text}
                  </span>
                )}
                {item.source && (
                  <span style={{ display: "block", marginTop: 7, color: "#45ff73", fontSize: 8, fontWeight: 800 }}>
                    FONTE • {item.source}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </>
    ) : (

      /* SEM JOGO */
      <div
        style={{
          minHeight: 330,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 30,
          background: "#050805",
        }}
      >
        <div>
          <strong
            style={{
              display: "block",
              color: "#45ff73",
              fontSize: 22,
            }}
          >
            RPF 3 MINUTOS
          </strong>

          <span style={{ color: "#aeb7b0" }}>
            Atualizando os jogos do dia...
          </span>
        </div>
      </div>
    )}


    {/* =================================================
        TICKER DE TV — RPF AGORA
        DIREITA -> ESQUERDA
    ================================================= */}

    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderTop: "3px solid #45ff73",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* CAIXA FIXA */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          padding: "9px 11px",
          background: "#45ff73",
          color: "#021006",
          fontSize: 10,
          fontWeight: 1000,
        }}
      >
        RPF AGORA
      </div>


      {/* TEXTO ROLANDO */}
      <div className="rpf-tv-ticker">
        <div className="rpf-tv-ticker-track">

          {rpfTickerNews.map((item, index) => (
            <span
              key={`ticker-${item.category}-${index}`}
              style={{
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <b style={{ color: "#45ff73" }}>
                {String(item.category).toUpperCase()}
              </b>
              {"  •  "}
              {item.title}
              {item.text ? ` — ${item.text}` : ""}
            </span>
          ))}


          {/* SEGUNDA CÓPIA PARA O GIRO NÃO FICAR VAZIO */}
          {rpfTickerNews.map((item, index) => (
            <span
              key={`ticker-repeat-${item.category}-${index}`}
              style={{
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <b style={{ color: "#45ff73" }}>
                {String(item.category).toUpperCase()}
              </b>
              {"  •  "}
              {item.title}
              {item.text ? ` — ${item.text}` : ""}
            </span>
          ))}

        </div>
      </div>
    </div>


    {/* BARRA FINAL */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        padding: "7px 11px",
        background: "#070b08",
        borderTop: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <strong
        style={{
          color: "#45ff73",
          fontSize: 9,
        }}
      >
        RPF PLACAR
      </strong>

      <span
        style={{
          color: "#8d968f",
          fontSize: 8,
        }}
      >
        ESPORTE QUE CONECTA
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

  const [loading, setLoading] = useState(Boolean(id));
  const [engineState, setEngineState] = useState(null);
  const [engineEvents, setEngineEvents] = useState([]);
  const [error, setError] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);

  const crowdAudioRef = useRef(null);
  const stingerAudioRef = useRef(null);

  const playedMotorEventsRef = useRef(new Set());
  const audioEnabledRef = useRef(false);
  const latestEventsRef = useRef([]);

  // =====================================================
  // ÁUDIO RPF
  // =====================================================

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    latestEventsRef.current = engineEvents;
  }, [engineEvents]);

  function motorAudioUrl(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(String(path))) {
      return String(path);
    }

    // Os áudios estão em:
    // frontend/public/audio/rpf/
   const fileName = String(path)
  .replace(/^.*\/audio\/rpf\//, "")
  .replace(/^.*\/media\/audio\/rpc\//, "")
  .replace(/^\/+/, "");

return new URL(
  `/media/audio/rpc/${fileName}`,
  window.location.origin
).href;
  }

  // =====================================================
  // CONSULTA MOTOR RPF
  // =====================================================

  useEffect(() => {
    if (!id) {
      setEngineState(null);
      setEngineEvents([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;

    async function loadJourney() {
      try {
        const [stateResponse, eventsResponse] =
          await Promise.all([
            fetch(
              `${API_URL}/api/rpf/jornada/${encodeURIComponent(id)}`,
              { cache: "no-store" }
            ),

            fetch(
              `${API_URL}/api/rpf/jornada/${encodeURIComponent(id)}/eventos`,
              { cache: "no-store" }
            ),
          ]);

        /*
         * A partida pode ainda não estar registrada no Motor.
         * Nesse caso não derrubamos a tela.
         */
        if (stateResponse.status === 404) {
          if (!cancelled) {
            setEngineState(null);
            setEngineEvents([]);
            setError("");
            setLoading(false);
          }

          return;
        }

        if (!stateResponse.ok) {
          throw new Error(
            `Motor RPF respondeu ${stateResponse.status}`
          );
        }

        const stateData =
          await stateResponse.json();

        const eventsData =
          eventsResponse.ok
            ? await eventsResponse.json()
            : null;

        if (cancelled) return;

        const statePayload =
          stateData?.response ??
          stateData?.resposta ??
          stateData;

        const eventsPayload =
          eventsData?.response ??
          eventsData?.resposta ??
          eventsData;

        setEngineState(statePayload);

        const eventCandidates = [
          eventsPayload?.events,
          eventsPayload?.eventos,

          eventsPayload?.generatedEvents,
          eventsPayload?.EventosGerados,

          statePayload?.generatedEvents,
          statePayload?.EventosGerados,

          statePayload?.state?.events,
          statePayload?.state?.eventos,
        ];

        const foundEvents =
          eventCandidates.find(Array.isArray) || [];

        setEngineEvents(
          foundEvents
            .slice()
            .reverse()
            .slice(0, 30)
        );

        setError("");
      } catch (requestError) {
        if (!cancelled) {
          console.error(
            "Motor RPF: erro ao consultar Jornada",
            requestError
          );

          setError(
            "Não foi possível atualizar o Motor RPF agora."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadJourney();

    const timer =
      window.setInterval(
        loadJourney,
        5000
      );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  // =====================================================
  // ESTADO DA JORNADA
  // =====================================================

  const phase = firstValue(
    engineState?.phase,
    engineState?.fase,

    engineState?.state?.phase,
    engineState?.state?.fase,

    "scheduled"
  );

  const phaseLabel =
    rpfPhaseLabel(phase);

  const livePhase =
    phaseLabel === "AO VIVO";

  const priority =
    firstValue(
      engineState?.priority,
      engineState?.prioridade,

      match?._rpfJourney?.priority,
      match?._rpfJourney?.prioridade,

      "RPF"
    );

  const motorMatch =
    engineState?.match ||
    engineState?.partida ||
    {};

  const home =
    firstValue(
      motorMatch?.homeTeam,
      motorMatch?.home_team,
      getHomeName(match)
    );

  const away =
    firstValue(
      motorMatch?.awayTeam,
      motorMatch?.away_team,
      getAwayName(match)
    );

  const homeScore =
    firstValue(
      motorMatch?.homeScore,
      motorMatch?.home_score,
      getHomeScore(match),
      0
    );

  const awayScore =
    firstValue(
      motorMatch?.awayScore,
      motorMatch?.away_score,
      getAwayScore(match),
      0
    );

  const kickoffRaw =
    firstValue(
      motorMatch?.kickoff,
      motorMatch?.date,
      match?.fixture?.date,
      match?.date
    );

  const kickoff =
    kickoffRaw
      ? new Date(kickoffRaw)
      : null;

  const preGame =
    kickoff &&
    !Number.isNaN(kickoff.getTime())
      ? new Date(
          kickoff.getTime() -
          30 * 60 * 1000
        )
      : null;

  const preGameText =
    preGame
      ? preGame.toLocaleTimeString(
          "pt-BR",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      : "30 min antes";

  // =====================================================
  // TORCIDA
  // =====================================================

  function startCrowd() {
    const crowd =
      crowdAudioRef.current;

    if (
      !crowd ||
      !audioEnabledRef.current
    ) {
      return;
    }

    crowd.src =
      motorAudioUrl(
        "/audio/rpf/SONS DE ESTÁDIO DOWNLOAD ALTA QUALIDADE.mp3"
      );

    crowd.loop = true;
    crowd.volume = 0.22;

    crowd
      .play()
      .catch((audioError) => {
        console.warn(
          "RPF: torcida não iniciou",
          audioError
        );
      });
  }

  function stopCrowd() {
    const crowd =
      crowdAudioRef.current;

    if (!crowd) return;

    crowd.pause();

    try {
      crowd.currentTime = 0;
    } catch {
      // Ignora navegadores que ainda
      // não carregaram o arquivo.
    }
  }

  function duckCrowd() {
    const crowd =
      crowdAudioRef.current;

    if (
      crowd &&
      !crowd.paused
    ) {
      crowd.volume = 0.06;
    }
  }

  function restoreCrowd() {
    const crowd =
      crowdAudioRef.current;

    if (
      crowd &&
      audioEnabledRef.current &&
      !crowd.paused
    ) {
      crowd.volume = 0.22;
    }
  }

  // =====================================================
  // VOZ DINÂMICA
  // =====================================================

  function speakMotorText(text) {
    if (
      !audioEnabledRef.current ||
      !text ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          String(text)
        );

      utterance.lang = "pt-BR";
      utterance.rate = 1.03;
      utterance.pitch = 1;
      utterance.volume = 1;

      window.speechSynthesis.speak(
        utterance
      );
    } catch (speechError) {
      console.warn(
        "RPF: TTS indisponível",
        speechError
      );
    }
  }

// =====================================================
// VINHETAS / FILA DE ÁUDIO
// =====================================================

async function playRpfAudioQueue(paths = []) {
  if (!audioEnabledRef.current || !paths.length) return;

  for (const path of paths) {
    if (!audioEnabledRef.current) break;

    await new Promise((resolve) => {
      const audio = new Audio();

      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;

        audio.onended = null;
        audio.onerror = null;

        audio.pause();
        resolve();
      };

      audio.preload = "auto";
      audio.src = motorAudioUrl(path);
      audio.volume = 0.95;

      audio.onended = finish;

      audio.onerror = () => {
        console.warn(
          "RPF: arquivo da fila não carregou:",
          audio.src
        );

        finish();
      };

      audio.play().catch((audioError) => {
        console.warn(
          "RPF: arquivo da fila não reproduziu:",
          audio.src,
          audioError
        );

        finish();
      });
    });

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500);
    });
  }
}

function playStinger(
  path,
  afterText = "",
  options = {}
) {
  if (!audioEnabledRef.current) {
    return;
  }

  const audio = stingerAudioRef.current;

  if (!audio || !path) {
    return;
  }

  const {
    duck = true,
    restore = true,
    stopAfter = false,
    onFinished = null,
  } = options;

  try {
    audio.pause();

    audio.src = motorAudioUrl(path);
    audio.currentTime = 0;
    audio.volume = 0.95;

    if (duck) {
      duckCrowd();
    }

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;

      audio.onended = null;
      audio.onerror = null;

      if (stopAfter) {
        stopCrowd();
      } else if (restore) {
        restoreCrowd();
      }

      // Sem TTS automático depois das gravações RPF.

      if (
        typeof onFinished === "function"
      ) {
        onFinished();
      }
    };

    audio.onended = finish;

    audio.onerror = () => {
      console.warn(
        "RPF: arquivo de áudio não carregou:",
        audio.src
      );

      finish();
    };

    audio.play().catch((audioError) => {
      console.warn(
        "RPF: reprodução bloqueada/indisponível",
        audioError
      );

      finish();
    });
  } catch (audioError) {
    console.warn(
      "RPF: erro ao tocar vinheta",
      audioError
    );

    if (
      typeof onFinished === "function"
    ) {
      onFinished();
    }
  }
}
  // =====================================================
  // IDENTIFICAÇÃO DOS EVENTOS
  // =====================================================

  function motorEventId(
    event,
    index = 0
  ) {
    return String(
      firstValue(
        event?.id,
        event?.event_id,
        event?.eventId,

        `${firstValue(
          event?.type,
          event?.tipo,
          "evento"
        )}-${firstValue(
          event?.created_at,
          event?.createdAt,
          event?.criadoEm,
          index
        )}`
      )
    );
  }

  function motorEventType(event) {
    return normalizeText(
      firstValue(
        event?.type,
        event?.tipo,
        event?.name,
        ""
      )
    ).toUpperCase();
  }

  // =====================================================
  // GOL RPF
  // =====================================================

  function playGoal(event) {
    const message =
      firstValue(
        event?.message,
        event?.mensagem,
        event?.text,
        event?.texto,
        ""
      );

    const goalSting =
      firstValue(
        event?.goal_sting,
        event?.goalSting,
        event?.audio,
        ""
      );

    const goalCrowd =
      firstValue(
        event?.goal_crowd,
        event?.goalCrowd,
        ""
      );

    duckCrowd();

    if (goalSting) {
      playStinger(
        goalSting,
        "",
        {
          duck: true,
          restore: false,

          onFinished: () => {
            if (goalCrowd) {
              playStinger(
                goalCrowd,
                message,
                {
                  duck: false,
                  restore: true,
                }
              );
            } else {
              restoreCrowd();

              if (message) {
                speakMotorText(
                  message
                );
              }
            }
          },
        }
      );
    } else if (goalCrowd) {
      playStinger(
        goalCrowd,
        message
      );
    } else {
      restoreCrowd();

      if (message) {
        speakMotorText(message);
      }
    }
  }

  // =====================================================
  // PROCESSA EVENTOS DO MOTOR
  // =====================================================

  function handleMotorEventAudio(
    event,
    index = 0
  ) {
    if (
      !audioEnabledRef.current ||
      !event
    ) {
      return;
    }

    const eventId =
      motorEventId(
        event,
        index
      );

    if (
      playedMotorEventsRef.current.has(
        eventId
      )
    ) {
      return;
    }

    playedMotorEventsRef.current.add(
      eventId
    );

    const type =
      motorEventType(event);

    const path =
      firstValue(
        event?.audio,
        event?.intro_audio,
        event?.audioPath,
        event?.audio_path,
        event?.payload?.audio,
        ""
      );

    const text =
      firstValue(
        event?.text,
        event?.texto,
        event?.message,
        event?.mensagem,
        event?.payload?.text,
        ""
      );

    // -------------------------------
    // TORCIDA COMEÇA / RETORNA
    // -------------------------------

    if (
      type.includes("CROWD_START") ||
      type.includes("CROWD_RESUME") ||
      type.includes("PUBLICO_INICIADO")
    ) {
      startCrowd();
      return;
    }

    // -------------------------------
    // GOL
    // -------------------------------

    if (
      type === "GOAL" ||
      type.includes("GOL")
    ) {
      playGoal(event);
      return;
    }

    // -------------------------------
    // INTERVALO
    // -------------------------------

    if (
      type.includes("HALFTIME") ||
      type.includes("INTERVALO")
    ) {
      playStinger(
        path,
        text,
        {
          duck: true,
          restore: false,
          stopAfter: true,
        }
      );

      return;
    }

    // -------------------------------
    // FIM DE JOGO
    // -------------------------------

    if (
      type.includes("FULLTIME") ||
      type.includes("FIM_DE_JOGO")
    ) {
      playStinger(
        path,
        text,
        {
          duck: true,
          restore: false,
          stopAfter: true,
        }
      );

      return;
    }

    // -------------------------------
    // PLANTÃO / TEMPO E PLACAR
    // -------------------------------

    if (
      type.includes("RPF_BREAKING") ||
      type.includes("BREAKING") ||
      type.includes("TIME_AND_SCORE")
    ) {
      if (path) {
        playStinger(
          path,
          text,
          {
            duck: true,
            restore: true,
          }
        );
      } else if (text) {
        duckCrowd();
        speakMotorText(text);

        window.setTimeout(
          restoreCrowd,
          1800
        );
      }

      return;
    }

    // -------------------------------
    // EVENTO NORMAL
    // -------------------------------

    if (path) {
      playStinger(
        path,
        text
      );
    } else if (text) {
      speakMotorText(text);
    }
  }

  // =====================================================
  // ATIVAR / DESATIVAR ÁUDIO
  // =====================================================

  function enableRpfAudio() {
    const next =
      !audioEnabled;

    if (!next) {
      audioEnabledRef.current =
        false;

      setAudioEnabled(false);

      stopCrowd();

      if (
        stingerAudioRef.current
      ) {
        stingerAudioRef.current.pause();
      }

      if (
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }

      return;
    }

    // Clique libera reprodução
    // no navegador e no celular.
    audioEnabledRef.current = true;
    setAudioEnabled(true);

    /*
     * Não toca todo o histórico.
     * Se entrar no meio da Jornada,
     * começa pelo momento atual.
     */
    const newest =
      latestEventsRef.current.find(
        (event) =>
          Boolean(
            firstValue(
              event?.audio,
              event?.intro_audio,
              event?.goal_sting,
              event?.text,
              event?.texto,
              event?.message,
              event?.mensagem
            )
          )
      );

    if (newest) {
      handleMotorEventAudio(
        newest,
        0
      );
    }

    if (livePhase) {
      startCrowd();
    }
  }

  // =====================================================
  // NOVOS EVENTOS
  // =====================================================

  useEffect(() => {
    if (
      !audioEnabled ||
      !engineEvents.length
    ) {
      return;
    }

    /*
     * engineEvents chega do mais
     * novo para o mais antigo.
     */
    [...engineEvents]
      .reverse()
      .forEach(
        (event, index) =>
          handleMotorEventAudio(
            event,
            index
          )
      );
  }, [
    engineEvents,
    audioEnabled,
    livePhase,
  ]);

  // =====================================================
  // VISUAL
  // =====================================================

  const panelStyle = {
    margin: "14px 0",
    border:
      "1px solid rgba(68,255,142,.35)",
    borderRadius: 22,
    overflow: "hidden",
    background:
      "linear-gradient(145deg, rgba(2,28,24,.98), rgba(2,12,12,.98))",
    boxShadow:
      "0 18px 48px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.04)",
  };

  const topStyle = {
    padding: "16px 16px 13px",
    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  };

  const green = "#58ff91";

  /*
   * Só mostra o painel quando
   * realmente existir uma Jornada.
   */
  
  return (
    <section
      className="rpf-jornada is-on"
      style={panelStyle}
    >
      <audio
        ref={crowdAudioRef}
        preload="auto"
      />

      <audio
        ref={stingerAudioRef}
        preload="auto"
      />

      <div style={topStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              background:
                "rgba(88,255,145,.12)",
              border:
                "1px solid rgba(88,255,145,.25)",
            }}
          >
            🎙️
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <small
              style={{
                color: green,
                fontWeight: 900,
                letterSpacing: ".09em",
              }}
            >
              MOTOR RPF • PRIORIDADE{" "}
              {priority}
            </small>

            <h2
              style={{
                margin: "3px 0 0",
                fontSize: 20,
              }}
            >
              RPF Jornada Esportiva
            </h2>
          </div>

          <span
            style={{
              padding: "7px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 900,
              color: livePhase
                ? "#06120b"
                : green,
              background: livePhase
                ? green
                : "rgba(88,255,145,.10)",
              border:
                "1px solid rgba(88,255,145,.30)",
            }}
          >
            {phaseLabel}
          </span>
        </div>

        <div
          style={{
            marginTop: 15,
            padding: "13px 12px",
            borderRadius: 16,
            background:
              "rgba(0,0,0,.24)",
            display: "grid",
            gridTemplateColumns:
              "1fr auto 1fr",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              textAlign: "left",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: 15,
              }}
            >
              {home}
            </strong>

            <small
              style={{
                opacity: 0.6,
              }}
            >
              {abbreviation(home)}
            </small>
          </div>

          <div
            style={{
              textAlign: "center",
            }}
          >
            <strong
              style={{
                color: green,
                fontSize: 27,
                letterSpacing: ".05em",
              }}
            >
              {homeScore} - {awayScore}
            </strong>

            <small
              style={{
                display: "block",
                opacity: 0.65,
                marginTop: 2,
              }}
            >
              {phaseLabel}
            </small>
          </div>

          <div
            style={{
              textAlign: "right",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: 15,
              }}
            >
              {away}
            </strong>

            <small
              style={{
                opacity: 0.6,
              }}
            >
              {abbreviation(away)}
            </small>
          </div>
        </div>

        <p
          style={{
            margin: "12px 1px 0",
            lineHeight: 1.45,
            opacity: 0.82,
            fontSize: 13,
          }}
        >
          {loading
            ? "Conectando ao Motor RPF..."
            : error
            ? error
            : phaseLabel ===
              "PROGRAMADA"
            ? `Jornada confirmada. A transmissão abre às ${preGameText}.`
            : phaseLabel ===
              "PRÉ-JOGO"
            ? "Pré-jogo RPF no ar. Contagem regressiva para a bola rolar."
            : livePhase
            ? "Jornada no ar. Torcida RPF, Tempo e Placar, Plantão RPF e momentos confirmados."
            : phaseLabel ===
              "INTERVALO"
            ? "Intervalo de jogo na RPF Jornada Esportiva."
            : phaseLabel ===
              "FIM DE JOGO"
            ? "Fim de jogo. Pós-jogo RPF em preparação."
            : "Pós-jogo RPF em andamento."}
        </p>
      </div>

      <div
        style={{
          padding: "13px 16px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderBottom:
            "1px solid rgba(255,255,255,.07)",
        }}
      >
        <button
          type="button"
          onClick={enableRpfAudio}
          style={{
            border: 0,
            borderRadius: 12,
            padding: "10px 12px",
            fontWeight: 900,
            cursor: "pointer",
            background:
              audioEnabled
                ? green
                : "rgba(255,255,255,.09)",
            color:
              audioEnabled
                ? "#05110a"
                : "#fff",
          }}
        >
          {audioEnabled
            ? "🔊 ÁUDIO RPF ATIVO"
            : "🔇 ATIVAR ÁUDIO RPF"}
        </button>

        <button
          type="button"
          disabled={!audioEnabled}
          onClick={() =>
            playStinger(
              "/audio/rpf/rpf_vinheta_2_chamada_jornada.wav"
            )
          }
          style={{
            border:
              "1px solid rgba(255,255,255,.10)",
            borderRadius: 12,
            padding: "10px 12px",
            fontWeight: 800,
            background:
              "rgba(255,255,255,.06)",
            color: "#fff",
            opacity:
              audioEnabled ? 1 : 0.45,
          }}
        >
          VINHETA
        </button>
<button
  type="button"
  disabled={!audioEnabled}
  onClick={async () => {
    try {
      const startResponse = await fetch(
        `${API_URL}/api/rpf/test/start?fixtureId=rpf-test`,
        { cache: "no-store" }
      );

      if (!startResponse.ok) {
        throw new Error(
          `Teste RPF respondeu ${startResponse.status}`
        );
      }

      playedMotorEventsRef.current.clear();

      const nextResponse = await fetch(
        `${API_URL}/api/rpf/test/next?fixtureId=rpf-test`,
        { cache: "no-store" }
      );

      if (!nextResponse.ok) {
        throw new Error(
          `Motor RPF respondeu ${nextResponse.status}`
        );
      }

      const data = await nextResponse.json();

      const payload =
        data?.response ??
        data?.resposta ??
        data;

      const events =
        payload?.emitted ??
        payload?.events ??
        [];

      if (!Array.isArray(events)) return;

      const ordered = [...events].sort(
        (a, b) =>
          Number(a?.order || 0) -
          Number(b?.order || 0)
      );

      /*
       * Primeiro teste:
       * toca somente o primeiro áudio.
       * Assim confirmamos o caminho dos arquivos
       * antes de montar a fila completa.
       */
      const firstEvent = ordered.find(
        (event) =>
          event?.audio ||
          event?.intro_audio
      );

   // ========================================
// PRÉ-JOGO RPF
// ========================================

await playRpfAudioQueue([
  "/audio/rpf/rpf_esquentando_o_jogo_chamada_curta.wav",
  "/audio/rpf/rpf_vinheta_2_chamada_jornada.wav",
  "/audio/rpf/rpf_pre_jogo_felipe_lima.wav",
  "/audio/rpf/rpf_boletim_padrao_ana_brenda.wav",
  "/audio/rpf/rpf_noticias_esportiva.mp3",
  "/audio/rpf/rpf_internacional_esportiva.mp3",
  "/audio/rpf/rpf_interior_esportiva.mp3",
]);

// Pequena pausa representando a contagem regressiva.
// A contagem real depois virá do Motor.
await new Promise((resolve) =>
  window.setTimeout(resolve, 2500)
);

// ========================================
// BOLA ROLANDO / ESTÁDIO
// ========================================

startCrowd();

await new Promise((resolve) =>
  window.setTimeout(resolve, 3000)
);

// ========================================
// TEMPO E PLACAR
// ========================================

duckCrowd();

await playRpfAudioQueue([
  "/audio/rpf/rpf_vinheta_1_tempo_placar.wav",
]);

restoreCrowd();

await new Promise((resolve) =>
  window.setTimeout(resolve, 2500)
);

// ========================================
// GOL RPF
// ========================================

duckCrowd();

await playRpfAudioQueue([
  "/audio/rpf/Vinheta de Esporte para Rádio (Grito de gol).mp3",
  "/audio/rpf/som de torcida na hora do gol grito de torcida na hora do gol..mp3",
]);

restoreCrowd();

await new Promise((resolve) =>
  window.setTimeout(resolve, 3000)
);

// ========================================
// PLANTÃO RPF
// ========================================

duckCrowd();

await playRpfAudioQueue([
  "/audio/rpf/rpf_01_plantao.wav",
]);

restoreCrowd();

await new Promise((resolve) =>
  window.setTimeout(resolve, 2500)
);

// ========================================
// INTERVALO
// ========================================

stopCrowd();

await playRpfAudioQueue([
  "/audio/rpf/rpf_02_intervalo.wav",
]);

await new Promise((resolve) =>
  window.setTimeout(resolve, 2000)
);

// ========================================
// SEGUNDO TEMPO
// ========================================

await playRpfAudioQueue([
  "/audio/rpf/rpf_03_segundo_tempo.wav",
]);

startCrowd();

await new Promise((resolve) =>
  window.setTimeout(resolve, 3000)
);

// ========================================
// FIM DE JOGO
// ========================================

duckCrowd();

await playRpfAudioQueue([
  "/audio/rpf/rpf_04_fim_de_jogo.wav",
]);

stopCrowd();

await new Promise((resolve) =>
  window.setTimeout(resolve, 1500)
);

// ========================================
// PÓS-JOGO
// ========================================

await playRpfAudioQueue([
  "/audio/rpf/rpf_pos_jogo_felipe_lima.wav",
]);
    } catch (testError) {
      console.error(
        "RPF: erro no teste da Jornada",
        testError
      );

      alert(
        "Não foi possível iniciar o teste da Jornada RPF."
      );
    }
  }}
  style={{
    border: "1px solid rgba(88,255,145,.35)",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 900,
    cursor: audioEnabled
      ? "pointer"
      : "default",
    background: "rgba(88,255,145,.10)",
    color: "#58ff91",
    opacity: audioEnabled ? 1 : 0.45,
  }}
>
  🧪 TESTAR JORNADA RPF
</button>
        <button
          type="button"
          disabled={!audioEnabled}
          onClick={() =>
            playStinger(
              "/audio/rpf/rpf_vinheta_1_tempo_placar.wav"
            )
          }
          style={{
            border:
              "1px solid rgba(255,255,255,.10)",
            borderRadius: 12,
            padding: "10px 12px",
            fontWeight: 800,
            background:
              "rgba(255,255,255,.06)",
            color: "#fff",
            opacity:
              audioEnabled ? 1 : 0.45,
          }}
        >
          TEMPO E PLACAR
        </button>
      </div>

      <div
        style={{
          padding: "15px 16px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent:
              "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <strong
            style={{
              fontSize: 13,
              letterSpacing: ".08em",
            }}
          >
            MOMENTOS DO JOGO
          </strong>

          <small
            style={{
              color: green,
            }}
          >
            ● SOMENTE EVENTOS CONFIRMADOS
          </small>
        </div>

        {engineEvents.length === 0 ? (
          <div
            style={{
              padding: "14px",
              borderRadius: 14,
              background:
                "rgba(255,255,255,.045)",
              opacity: 0.7,
              fontSize: 13,
            }}
          >
            {phaseLabel ===
            "PROGRAMADA"
              ? "Os momentos aparecerão aqui quando a Jornada começar."
              : "Aguardando o próximo evento confirmado pelo Motor RPF."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {engineEvents.map(
              (event, index) => {
                const minute =
                  firstValue(
                    event?.minute,
                    event?.minuto,
                    event?.payload
                      ?.minute,
                    event?.payload
                      ?.minuto
                  );

                return (
                  <article
                    key={`${eventFingerprint(
                      event,
                      index
                    )}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 12,
                      padding:
                        "11px 12px",
                      borderRadius: 14,
                      background:
                        "rgba(255,255,255,.045)",
                      borderLeft: `3px solid ${green}`,
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize: 13,
                        }}
                      >
                        {rpfEventLabel(
                          event
                        )}
                      </strong>

                      <p
                        style={{
                          margin:
                            "3px 0 0",
                          opacity: 0.72,
                          fontSize: 12,
                        }}
                      >
                        {rpfEventText(
                          event
                        )}
                      </p>
                    </div>

                    {minute !== null &&
                      minute !==
                        undefined &&
                      minute !== "" && (
                        <span
                          style={{
                            color:
                              green,
                            fontWeight:
                              900,
                          }}
                        >
                          {minute}'
                        </span>
                      )}
                  </article>
                );
              }
            )}
          </div>
        )}

        <small
          style={{
            display: "block",
            marginTop: 12,
            opacity: 0.48,
            lineHeight: 1.4,
          }}
        >
          Sem narração contínua: o
          Motor RPF reage somente a
          dados reais confirmados pelas
          fontes esportivas.
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
function RpfNotificationToast({ notification, onClose }) {
  if (!notification) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 76,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        width: "calc(100% - 28px)",
        maxWidth: 430,
        padding: "14px 15px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        borderRadius: 17,
        background:
          "linear-gradient(145deg,#0c291d,#071a12)",
        border:
          "1px solid rgba(44,255,139,.38)",
        boxShadow:
          "0 18px 50px rgba(0,0,0,.55)",
        color: "#fff",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          flex: "0 0 40px",
          display: "grid",
          placeItems: "center",
          borderRadius: 12,
          background: "#2cff8b",
          color: "#04130b",
          fontSize: 20,
        }}
      >
        {notification.icon || "⚽"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <strong
          style={{
            display: "block",
            color: "#2cff8b",
            fontSize: 10,
            letterSpacing: ".7px",
            marginBottom: 4,
          }}
        >
          RPF PLACAR
        </strong>

        <strong
          style={{
            display: "block",
            fontSize: 14,
            lineHeight: 1.25,
          }}
        >
          {notification.title}
        </strong>

        <span
          style={{
            display: "block",
            marginTop: 4,
            color: "#b8c9c0",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {notification.text}
        </span>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          border: 0,
          background: "transparent",
          color: "#8ea69a",
          fontSize: 20,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
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
const [rpfNotification, setRpfNotification] = useState(null);

const previousMatchesRef = useRef(new Map());
const notificationTimerRef = useRef(null);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("radioplacar-favorites");

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
function showRpfNotification(notification) {
  setRpfNotification(notification);

  if (notificationTimerRef.current) {
    window.clearTimeout(
      notificationTimerRef.current
    );
  }

  notificationTimerRef.current =
    window.setTimeout(() => {
      setRpfNotification(null);
    }, 7000);
}
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
useEffect(() => {
  if (!Array.isArray(matches) || !matches.length) {
    return;
  }

  const previousMap = previousMatchesRef.current;

  if (previousMap.size === 0) {
    for (const match of matches) {
      previousMap.set(getMatchId(match), {
        homeScore: getHomeScore(match),
        awayScore: getAwayScore(match),
        status: getRawStatus(match),
      });
    }

    return;
  }

  for (const match of matches) {
    const id = getMatchId(match);

    if (!id) continue;

    const previous = previousMap.get(id);

    const current = {
      homeScore: getHomeScore(match),
      awayScore: getAwayScore(match),
      status: getRawStatus(match),
    };

    const favorite = favorites.includes(String(id));

    if (previous && favorite) {
      const home = getHomeName(match);
      const away = getAwayName(match);

      const previousHome = Number(previous.homeScore);
      const previousAway = Number(previous.awayScore);

      const currentHome = Number(current.homeScore);
      const currentAway = Number(current.awayScore);

      if (
        Number.isFinite(previousHome) &&
        Number.isFinite(previousAway) &&
        Number.isFinite(currentHome) &&
        Number.isFinite(currentAway) &&
        (
          currentHome > previousHome ||
          currentAway > previousAway
        )
      ) {
        showRpfNotification({
          icon: "⚽",
          title: "GOOOOOOL!",
          text:
            `${home} ${current.homeScore} x ` +
            `${current.awayScore} ${away}`,
        });
      }

      const status =
        String(current.status).toLowerCase();

      const oldStatus =
        String(previous.status).toLowerCase();

      if (
        !oldStatus.includes("progress") &&
        !oldStatus.includes("live") &&
        isLive(match)
      ) {
        showRpfNotification({
          icon: "🔥",
          title: "BOLA ROLANDO!",
          text: `${home} x ${away} começou.`,
        });
      }

      if (
        (
          status.includes("halftime") ||
          status.includes("half_time") ||
          status === "ht"
        ) &&
        !(
          oldStatus.includes("halftime") ||
          oldStatus.includes("half_time") ||
          oldStatus === "ht"
        )
      ) {
        showRpfNotification({
          icon: "⏸️",
          title: "INTERVALO",
          text:
            `${home} ${current.homeScore ?? 0} x ` +
            `${current.awayScore ?? 0} ${away}`,
        });
      }

      if (
        !oldStatus.includes("finished") &&
        isFinished(match)
      ) {
        showRpfNotification({
          icon: "🏁",
          title: "FIM DE JOGO",
          text:
            `${home} ${current.homeScore ?? 0} x ` +
            `${current.awayScore ?? 0} ${away}`,
        });
      }
    }

    previousMap.set(id, current);
  }
}, [matches, favorites]);
 useEffect(() => {
  if (selectedDate !== todayISO()) {
    return;
  }

  let cancelled = false;

  async function refreshLiveMatches() {
    try {
      const response = await fetch(
        `${API_URL}/api/matches?date=${encodeURIComponent(
          selectedDate
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (
        !cancelled &&
        data?.ok &&
        Array.isArray(data?.response)
      ) {
        setMatches(data.response);
      }
    } catch (error) {
      console.warn(
        "RPF: atualização silenciosa falhou",
        error
      );
    }
  }

  const timer = window.setInterval(
    refreshLiveMatches,
    20000
  );

  return () => {
    cancelled = true;
    window.clearInterval(timer);
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
      
<RpfNotificationToast
  notification={rpfNotification}
  onClose={() =>
    setRpfNotification(null)
  }
/>     
 <button
  type="button"
  onClick={() =>
    showRpfNotification({
      icon: "⚽",
      title: "GOOOOOOL!",
      text: "Internacional 1 x 0 Grêmio",
    })
  }
  style={{
    position: "fixed",
    right: 16,
    bottom: 90,
    zIndex: 99998,
    padding: "10px 14px",
    border: 0,
    borderRadius: 12,
    background: "#2cff8b",
    color: "#04130b",
    fontWeight: 900,
    cursor: "pointer",
  }}
>
  TESTAR NOTIFICAÇÃO
</button>     
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
