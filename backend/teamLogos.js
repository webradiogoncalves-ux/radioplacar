/*
  RÁDIOPLACAR
  Jogos do Escuro
  Escudos externos - v5

  TESTE CONTROLADO

  Não usa BSD.
  Não pesquisa lista pela API do GitHub.
  Usa arquivos já confirmados no repositório.

  Primeira etapa:
  - ABC
  - Amazonas
  - América-RN
  - Anápolis
  - Araguaína
  - Aparecidense
  - Altos-PI
  - Iguatu
  - Maguary
*/

const REPOSITORY =
  "JoseArroyave/football-logos";

const RAW_BASE =
  "https://raw.githubusercontent.com/JoseArroyave/football-logos/main/logos/brazil";

const PAGE_BASE =
  "https://github.com/JoseArroyave/football-logos/blob/main/logos/brazil";

/*
  IMPORTANTE:

  Aqui usamos apenas nomes de arquivos
  que foram confirmados na pasta Brasil
  do repositório.

  A chave é o nome normalizado que vem
  do nosso FootballData.
*/

const VERIFIED_LOGOS = {
  "abc": {
    file: "ABC_Futebol_Clube.svg",
    club: "ABC Futebol Clube"
  },

  "amazonas": {
    file: "Amazonas.svg",
    club: "Amazonas Futebol Clube"
  },

  "america rn": {
    file: "América_de_Natal.svg",
    club: "América Futebol Clube - RN"
  },

  "anapolis": {
    file: "Anápolis.svg",
    club: "Anápolis Futebol Clube"
  },

  "araguaina": {
    file: "Araguaína_Futebol_e_Regatas.svg",
    club: "Araguaína Futebol e Regatas"
  },

  "aparecidense": {
    file: "Associação_Atlética_Aparecidense.svg",
    club: "Associação Atlética Aparecidense"
  },

  "altos pi": {
    file: "Associação_Atlética_de_Altos.svg",
    club: "Associação Atlética de Altos"
  },

  "iguatu": {
    file: "Associação_Desportiva_Iguatu.svg",
    club: "Associação Desportiva Iguatu"
  },

  "maguary": {
    file: "Associação_Atlética_Maguary.svg",
    club: "Associação Atlética Maguary"
  }
};

/*
  Cache simples para não processar
  o mesmo time várias vezes.
*/

const cache = new Map();

/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   CODIFICAR CAMINHO DO ARQUIVO
========================================================= */

function encodeFilename(filename) {
  return String(filename || "")
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");
}

/* =========================================================
   NOMES ALTERNATIVOS DO FOOTBALLDATA

   Somente aliases que identificam
   exatamente o mesmo clube.
========================================================= */

const INPUT_ALIASES = {
  "abc futebol clube": "abc",

  "amazonas fc": "amazonas",
  "amazonas futebol clube": "amazonas",

  "america de natal": "america rn",
  "america futebol clube natal": "america rn",

  "anapolis fc": "anapolis",
  "anapolis futebol clube": "anapolis",

  "araguaina futebol e regatas": "araguaina",

  "associacao atletica aparecidense": "aparecidense",

  "altos": "altos pi",
  "associacao atletica de altos": "altos pi",

  "associacao desportiva iguatu": "iguatu",

  "associacao atletica maguary": "maguary"
};

/* =========================================================
   DESCOBRIR CHAVE DO CLUBE
========================================================= */

function resolveKey(teamName) {
  const normalized =
    normalizeName(teamName);

  if (!normalized) {
    return null;
  }

  /*
    Primeiro tenta exatamente como
    aparece no FootballData.
  */

  if (VERIFIED_LOGOS[normalized]) {
    return normalized;
  }

  /*
    Depois tenta os aliases seguros.
  */

  const alias =
    INPUT_ALIASES[normalized];

  if (
    alias &&
    VERIFIED_LOGOS[alias]
  ) {
    return alias;
  }

  return null;
}

/* =========================================================
   MONTAR RESULTADO
========================================================= */

function buildLogoResult(
  teamName,
  key,
  item
) {
  const encoded =
    encodeFilename(item.file);

  return {
    logo:
      `${RAW_BASE}/${encoded}`,

    source:
      REPOSITORY,

    source_page:
      `${PAGE_BASE}/${encoded}`,

    /*
      A licença do repositório é uma
      coisa; marcas/escudos dos clubes
      podem possuir direitos próprios.

      Não estamos afirmando que a marca
      do clube é MIT.
    */

    license:
      "Repository MIT; club crest/trademark rights may belong to the respective club",

    license_url:
      "https://github.com/JoseArroyave/football-logos/blob/main/LICENSE",

    /*
      verified = correspondência do
      TIME com o ARQUIVO confirmada.

      Não significa liberação comercial
      da marca.
    */

    verified: true,

    matched_team:
      item.club,

    requested_team:
      teamName,

    matched_file:
      item.file,

    match_method:
      "verified-direct-map",

    /*
      Mantemos estes campos para
      compatibilidade com o restante
      do RádioPlacar.
    */

    wikidata_id: null,
    wikidata_url: null
  };
}

/* =========================================================
   FUNÇÃO USADA PELO darkGamesLogos.js
========================================================= */

export async function findExternalTeamLogo(
  teamName
) {
  const normalized =
    normalizeName(teamName);

  if (!normalized) {
    return null;
  }

  /*
    Retorna cache se já foi pesquisado.
  */

  if (cache.has(normalized)) {
    return cache.get(normalized);
  }

  const key =
    resolveKey(teamName);

  /*
    Nesta fase não inventamos
    e não fazemos busca aproximada.

    Se não está no mapa confirmado,
    fica sem escudo.
  */

  if (!key) {
    cache.set(
      normalized,
      null
    );

    return null;
  }

  const item =
    VERIFIED_LOGOS[key];

  const result =
    buildLogoResult(
      teamName,
      key,
      item
    );

  cache.set(
    normalized,
    result
  );

  return result;
}

/* =========================================================
   LIMPAR CACHE
========================================================= */

export function clearTeamLogoCache() {
  cache.clear();
}

/* =========================================================
   DIAGNÓSTICO OPCIONAL
========================================================= */

export function getVerifiedLogoMap() {
  return Object.entries(
    VERIFIED_LOGOS
  ).map(
    ([key, value]) => ({
      key,
      club: value.club,
      file: value.file
    })
  );
}
