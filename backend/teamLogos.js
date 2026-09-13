// backend/teamLogos.js
// RádioPlacar - Jogos do Escuro
// v6
//
// NÃO usa BSD.
// 1) Mapeamento direto para clubes confirmados.
// 2) Consulta a pasta Brazil do repositório externo.
// 3) Faz comparação normalizada e conservadora.
// 4) Em empate/ambiguidade, NÃO escolhe escudo.
//
// "verified" significa identidade do clube conferida pelo algoritmo/mapeamento.
// NÃO significa que a marca/escudo esteja livre de direitos de terceiros.

const REPO_OWNER = "JoseArroyave";
const REPO_NAME = "football-logos";
const BRANCH = "main";

const RAW_BASE =
  `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/logos/brazil`;

const PAGE_BASE =
  `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${BRANCH}/logos/brazil`;

const API_DIR =
  `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/logos/brazil`;

const CACHE_TIME = 24 * 60 * 60 * 1000;

let brazilFilesCache = null;
let brazilFilesCacheAt = 0;

const resultCache = new Map();


// ============================================================
// NORMALIZAÇÃO
// ============================================================

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[_-]+/g, " ")
    .replace(/\.(svg|png|webp)$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function compact(value) {
  return normalize(value).replace(/\s+/g, "");
}


// ============================================================
// CLUBES CONFIRMADOS
// ============================================================
//
// Mantemos os 9 que já passaram no teste e acrescentamos
// somente nomes de arquivo que já foram confirmados na coleção.
//

const VERIFIED_LOGOS = {

  // ----- já testados na v5 -----

  "abc": "ABC_Futebol_Clube.svg",

  "amazonas": "Amazonas.svg",

  "america rn": "América_de_Natal.svg",
  "america de natal": "América_de_Natal.svg",

  "anapolis": "Anápolis.svg",

  "aparecidense": "Associação_Atlética_Aparecidense.svg",

  "araguaina": "Araguaína_Futebol_e_Regatas.svg",

  "altos pi": "Associação_Atlética_de_Altos.svg",
  "altos": "Associação_Atlética_de_Altos.svg",

  "iguatu": "Associação_Desportiva_Iguatu.svg",

  "maguary": "Associação_Atlética_Maguary.svg",


  // ----- confirmados na coleção brasileira -----

  "aguia de maraba": "Águia_de_Marabá.svg",

  "botafogo pb": "Botafogo-PB.svg",

  "brasiliense": "Brasiliense.svg",

  "brusque": "Brusque.svg",

  "capital df": "Capital-DF.svg",

  "caxias": "Caxias.svg",

  "ceilandia": "Ceilândia.svg",

  "central": "Central.svg",

  "confianca": "Confiança.svg",

  "ferroviaria": "Ferroviária.svg",

  "ferroviario": "Ferroviário.svg",

  "figueirense": "Figueirense.svg",

  "floresta": "Floresta.svg",

  "fluminense pi": "Fluminense-PI.svg",

  "galvez": "Galvez.svg",

  "gama": "Gama.svg",

  "gas": "GAS.svg",

  "guapore": "Guaporé.svg",

  "guarani": "Guarani.svg",

  "iape": "Iape.svg",

  "independencia": "Independência.svg",

  "inhumas": "Inhumas.svg",

  "internacional de limeira": "Internacional_de_Limeira.svg",
  "inter de limeira": "Internacional_de_Limeira.svg",

  "itabaiana": "Itabaiana.svg",

  "ituano": "Ituano.svg",

  "laguna rn": "Laguna-RN.svg",

  "luverdense": "Luverdense.svg",

  "manauara": "Manauara.svg",

  "manaus": "Manaus.svg",

  "maracana": "Maracanã.svg",

  "maranhao": "Maranhão.svg",

  "maringa": "Maringá.svg",

  "mixto": "Mixto.svg",

  "monte roraima": "Monte_Roraima.svg",

  "moto club": "Moto_Club.svg",

  "nacional am": "Nacional-AM.svg",

  "oratorio": "Oratório.svg",

  "parnahyba": "Parnahyba.svg",

  "paysandu": "Paysandu.svg",

  "piaui": "Piauí.svg",

  "porto velho": "Porto_Velho.svg",

  "primavera": "Primavera.svg",

  "sampaio correa": "Sampaio_Corrêa.svg",

  "santa cruz": "Santa_Cruz.svg",

  "sao raimundo rr": "São_Raimundo-RR.svg",

  "sousa": "Sousa.svg",

  "tirol": "Tirol.svg",

  "tocantinopolis": "Tocantinópolis.svg",

  "trem": "Trem.svg",

  "tuna luso": "Tuna_Luso.svg",

  "uniao rondonopolis": "União_Rondonópolis.svg",

  "volta redonda": "Volta_Redonda.svg",

  "ypiranga": "Ypiranga.svg"
};


// ============================================================
// NOMES QUE NÃO PODEM SER ESCOLHIDOS POR APROXIMAÇÃO
// ============================================================
//
// Esses clubes possuem nomes que podem apontar para equipes diferentes.
// Só usamos se houver mapeamento EXATO.
//

const AMBIGUOUS = new Set([
  "america",
  "atletico",
  "botafogo",
  "operario",
  "portuguesa",
  "rio branco",
  "sampaio correa rj",
  "sao jose",
  "sao joseense",
  "vitoria",
  "nacional",
  "porto"
]);


// ============================================================
// RESULTADO
// ============================================================

function makeResult(teamName, fileName, method = "verified-map") {

  const encoded = encodeURIComponent(fileName);

  return {
    team: teamName,

    logo: `${RAW_BASE}/${encoded}`,

    source: "JoseArroyave/football-logos",

    source_page: `${PAGE_BASE}/${encoded}`,

    license:
      "Repository MIT; club crest/trademark rights may belong to the respective club",

    license_url:
      `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${BRANCH}/LICENSE`,

    verified: true,

    verification_method: method,

    wikidata_id: null,
    wikidata_url: null
  };
}


// ============================================================
// BUSCAR LISTA DE SVGs
// ============================================================

async function getBrazilFiles() {

  const now = Date.now();

  if (
    brazilFilesCache &&
    now - brazilFilesCacheAt < CACHE_TIME
  ) {
    return brazilFilesCache;
  }

  try {

    const response = await fetch(API_DIR, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "RadioPlacar"
      }
    });

    if (!response.ok) {
      throw new Error(
        `GitHub directory HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Resposta inesperada do GitHub");
    }

    const files = data
      .filter(
        item =>
          item?.type === "file" &&
          /\.svg$/i.test(item?.name || "")
      )
      .map(item => ({
        name: item.name,
        normalized: normalize(item.name),
        compact: compact(item.name)
      }));

    brazilFilesCache = files;
    brazilFilesCacheAt = now;

    console.log(
      `[teamLogos] ${files.length} SVGs brasileiros carregados`
    );

    return files;

  } catch (error) {

    console.error(
      "[teamLogos] Falha ao carregar diretório GitHub:",
      error.message
    );

    // A falha da API NÃO derruba os escudos do mapa direto.
    return brazilFilesCache || [];
  }
}


// ============================================================
// MAPA DIRETO
// ============================================================

function findVerified(teamName) {

  const key = normalize(teamName);

  const file = VERIFIED_LOGOS[key];

  if (!file) return null;

  return makeResult(
    teamName,
    file,
    "verified-map"
  );
}


// ============================================================
// PONTUAÇÃO CONSERVADORA
// ============================================================

function similarityScore(teamName, file) {

  const team = normalize(teamName);
  const candidate = file.normalized;

  const teamCompact = compact(teamName);
  const candidateCompact = file.compact;

  if (!team || !candidate) return 0;


  // correspondência perfeita
  if (team === candidate) {
    return 1000;
  }


  // perfeita ignorando espaços/hífen/underscore
  if (teamCompact === candidateCompact) {
    return 950;
  }


  const teamWords =
    team.split(" ").filter(Boolean);

  const candidateWords =
    candidate.split(" ").filter(Boolean);


  // Para nome curto, não aceitamos aproximação.
  if (
    teamWords.length === 1 &&
    team.length <= 5
  ) {
    return 0;
  }


  let score = 0;


  // candidato começa com o nome completo do clube
  if (
    candidate.startsWith(`${team} `)
  ) {
    score += 500;
  }


  // nome do clube começa com candidato
  if (
    team.startsWith(`${candidate} `)
  ) {
    score += 450;
  }


  // palavras iguais
  const common =
    teamWords.filter(
      word => candidateWords.includes(word)
    );

  score += common.length * 100;


  // exige que praticamente todas as palavras importantes
  // estejam presentes
  const important =
    teamWords.filter(word => word.length >= 4);

  const importantMatched =
    important.filter(
      word => candidateWords.includes(word)
    );


  if (
    important.length > 0 &&
    importantMatched.length === important.length
  ) {
    score += 250;
  }


  // penaliza candidato muito diferente
  const difference =
    Math.abs(
      candidateWords.length -
      teamWords.length
    );

  score -= difference * 20;


  return score;
}


// ============================================================
// BUSCA AUTOMÁTICA SEGURA
// ============================================================

async function findSafeAutomatic(teamName) {

  const key = normalize(teamName);

  if (!key) return null;


  // Não fazemos aproximação nesses nomes.
  if (AMBIGUOUS.has(key)) {
    return null;
  }


  const files = await getBrazilFiles();

  if (!files.length) {
    return null;
  }


  const ranked = files
    .map(file => ({
      file,
      score: similarityScore(teamName, file)
    }))
    .filter(item => item.score >= 700)
    .sort((a, b) => b.score - a.score);


  if (!ranked.length) {
    return null;
  }


  const first = ranked[0];
  const second = ranked[1];


  // Se os dois melhores forem muito próximos,
  // consideramos ambíguo.
  if (
    second &&
    first.score - second.score < 100
  ) {

    console.warn(
      `[teamLogos] Ambíguo: ${teamName} -> ` +
      `${first.file.name} / ${second.file.name}`
    );

    return null;
  }


  return makeResult(
    teamName,
    first.file.name,
    "safe-directory-match"
  );
}


// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

export async function findExternalTeamLogo(teamName) {

  const key = normalize(teamName);

  if (!key) {
    return null;
  }


  if (resultCache.has(key)) {
    return resultCache.get(key);
  }


  // 1. Primeiro o mapa confirmado.
  const verified = findVerified(teamName);

  if (verified) {

    resultCache.set(
      key,
      verified
    );

    return verified;
  }


  // 2. Depois busca automática conservadora.
  let automatic = null;

  try {

    automatic =
      await findSafeAutomatic(teamName);

  } catch (error) {

    console.error(
      `[teamLogos] ${teamName}:`,
      error.message
    );
  }


  resultCache.set(
    key,
    automatic
  );

  return automatic;
}


// ============================================================
// LIMPAR CACHE
// ============================================================

export function clearTeamLogoCache() {

  resultCache.clear();

  brazilFilesCache = null;
  brazilFilesCacheAt = 0;
}
