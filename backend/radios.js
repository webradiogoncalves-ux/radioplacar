// backend/radios.js

const radios = new Map();
const matchRadios = new Map();

/**
 * RADIOPLACAR - SISTEMA DE RÁDIOS
 *
 * IMPORTANTE:
 * - Cadastro de uma rádio NÃO significa que ela transmite todos os jogos.
 * - Cada rádio só aparece em uma partida quando a transmissão
 *   daquela partida for confirmada.
 * - Não inventamos stream.
 * - Stream direto só é usado quando estiver confirmado.
 */


// ========================================================
// CADASTRAR RÁDIO
// ========================================================

export function registerRadio(radio) {
  if (!radio?.id) {
    throw new Error("Rádio sem id");
  }

  if (!radio?.name) {
    throw new Error("Rádio sem nome");
  }

  const normalized = {
    id: String(radio.id),
    name: radio.name,

    city: radio.city || null,
    state: radio.state || null,
    country: "Brasil",

    // Página oficial da emissora
    website: radio.website || null,

    // Stream direto somente quando confirmado
    stream: radio.stream || null,

    // true somente quando o stream direto foi verificado
    stream_verified: radio.stream_verified === true,

    // Página/emissora oficial verificada
    official: radio.official !== false,

    active: radio.active !== false,

    updated_at: new Date().toISOString(),
  };

  radios.set(normalized.id, normalized);

  return normalized;
}


// ========================================================
// TODAS AS RÁDIOS
// ========================================================

export function getRadios() {
  return [...radios.values()]
    .filter((radio) => radio.active)
    .sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );
}


// ========================================================
// BUSCAR UMA RÁDIO
// ========================================================

export function getRadio(id) {
  return radios.get(String(id)) || null;
}


// ========================================================
// VINCULAR RÁDIO A UMA PARTIDA
// ========================================================

export function attachRadioToMatch(
  matchId,
  radioId,
  options = {}
) {
  const matchKey = String(matchId);
  const radioKey = String(radioId);

  const radio = radios.get(radioKey);

  if (!radio) {
    throw new Error(
      `Rádio não encontrada: ${radioKey}`
    );
  }

  if (!matchRadios.has(matchKey)) {
    matchRadios.set(matchKey, []);
  }

  const list = matchRadios.get(matchKey);

  const existingIndex = list.findIndex(
    (item) => item.radio_id === radioKey
  );

  const association = {
    radio_id: radioKey,

    // Só fica true quando a transmissão
    // DESTA partida estiver confirmada
    match_confirmed:
      options.match_confirmed === true,

    // Fonte da confirmação
    source:
      options.source || null,

    // Página que comprova a transmissão
    source_url:
      options.source_url || null,

    // 1 = maior prioridade
    priority:
      Number.isInteger(options.priority) &&
      options.priority > 0
        ? options.priority
        : 99,

    active:
      options.active !== false,

    confirmed_at:
      options.match_confirmed === true
        ? new Date().toISOString()
        : null,

    updated_at:
      new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    list[existingIndex] = association;
  } else {
    list.push(association);
  }

  matchRadios.set(matchKey, list);

  return {
    match_id: matchKey,
    ...association,
    radio,
  };
}


// ========================================================
// RÁDIOS DE UMA PARTIDA
// ========================================================

export function getRadiosForMatch(
  matchId,
  { onlyConfirmed = true } = {}
) {
  const matchKey = String(matchId);

  const associations =
    matchRadios.get(matchKey) || [];

  return associations
    .filter((item) => {
      if (!item.active) {
        return false;
      }

      if (
        onlyConfirmed &&
        !item.match_confirmed
      ) {
        return false;
      }

      return true;
    })

    .map((item) => {
      const radio =
        radios.get(item.radio_id);

      if (!radio || !radio.active) {
        return null;
      }

      return {
        ...item,
        radio,
      };
    })

    .filter(Boolean)

    .sort(
      (a, b) =>
        a.priority - b.priority
    );
}


// ========================================================
// DESVINCULAR UMA RÁDIO DA PARTIDA
// ========================================================

export function detachRadioFromMatch(
  matchId,
  radioId
) {
  const matchKey =
    String(matchId);

  const radioKey =
    String(radioId);

  const list =
    matchRadios.get(matchKey);

  if (!list) {
    return false;
  }

  const newList =
    list.filter(
      (item) =>
        item.radio_id !== radioKey
    );

  if (newList.length === 0) {
    matchRadios.delete(matchKey);
  } else {
    matchRadios.set(
      matchKey,
      newList
    );
  }

  return true;
}


// ========================================================
// LIMPAR RÁDIOS DE UMA PARTIDA
// ========================================================

export function clearMatchRadios(matchId) {
  return matchRadios.delete(
    String(matchId)
  );
}


// ========================================================
// LIMPEZA GERAL
// ========================================================

export function clearAllMatchRadios() {
  matchRadios.clear();
}


// ========================================================
// ESTATÍSTICAS
// ========================================================

export function getRadioStats() {
  let associations = 0;
  let confirmed = 0;

  for (
    const list
    of matchRadios.values()
  ) {
    associations += list.length;

    confirmed +=
      list.filter(
        (item) =>
          item.match_confirmed
      ).length;
  }

  return {
    radios: radios.size,

    matches_with_radios:
      matchRadios.size,

    associations,

    confirmed,
  };
}


// ========================================================
// ========================================================
// RÁDIOS BRASILEIRAS - RADIOPLACAR
// ========================================================
// ========================================================


// ========================================================
// RIO GRANDE DO SUL
// ========================================================


// Rádio Grenal

registerRadio({
  id: "grenal",
  name: "Rádio Grenal",

  city: "Porto Alegre",
  state: "RS",

  website:
    "https://www.radiogrenal.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// Rádio Gaúcha

registerRadio({
  id: "gaucha",
  name: "Rádio Gaúcha",

  city: "Porto Alegre",
  state: "RS",

  website:
    "https://gauchazh.clicrbs.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// Rádio Guaíba

registerRadio({
  id: "guaiba",
  name: "Rádio Guaíba",

  city: "Porto Alegre",
  state: "RS",

  website:
    "https://guaiba.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// Rádio Caxias

registerRadio({
  id: "caxias",
  name: "Rádio Caxias",

  city: "Caxias do Sul",
  state: "RS",

  website:
    "https://radiocaxias.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// Rádio Gaúcha Serra

registerRadio({
  id: "gaucha-serra",
  name: "Rádio Gaúcha Serra",

  city: "Caxias do Sul",
  state: "RS",

  website:
    "https://gauchazh.clicrbs.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// ========================================================
// RIO DE JANEIRO
// ========================================================


// Super Rádio Tupi

registerRadio({
  id: "tupi",
  name: "Super Rádio Tupi",

  city: "Rio de Janeiro",
  state: "RJ",

  website:
    "https://www.tupi.fm/ao-vivo/",

  stream: null,
  stream_verified: false,

  official: true,
});


// CBN Rio

registerRadio({
  id: "cbn-rio",
  name: "CBN Rio",

  city: "Rio de Janeiro",
  state: "RJ",

  website:
    "https://cbn.globo.com/",

  stream: null,
  stream_verified: false,

  official: true,
});


// Rádio Globo

registerRadio({
  id: "radio-globo-rj",
  name: "Rádio Globo",

  city: "Rio de Janeiro",
  state: "RJ",

  website:
    "https://radioglobo.globo.com/",

  stream: null,
  stream_verified: false,

  official: true,
});


// ========================================================
// MINAS GERAIS
// ========================================================


// Rádio Itatiaia

registerRadio({
  id: "itatiaia",
  name: "Rádio Itatiaia",

  city: "Belo Horizonte",
  state: "MG",

  website:
    "https://www.itatiaia.com.br/aovivo/",

  stream:
    "https://8903.brasilstream.com.br/stream",

  stream_verified: true,

  official: true,
});


// Rádio Inconfidência

registerRadio({
  id: "inconfidencia",
  name: "Rádio Inconfidência",

  city: "Belo Horizonte",
  state: "MG",

  website:
    "https://www.inconfidencia.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// ========================================================
// SÃO PAULO
// ========================================================


// Rádio Bandeirantes

registerRadio({
  id: "bandeirantes-sp",
  name: "Rádio Bandeirantes",

  city: "São Paulo",
  state: "SP",

  website:
    "https://www.band.uol.com.br/radio-bandeirantes",

  stream: null,
  stream_verified: false,

  official: true,
});


// Jovem Pan

registerRadio({
  id: "jovem-pan",
  name: "Jovem Pan",

  city: "São Paulo",
  state: "SP",

  website:
    "https://jovempan.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// CBN São Paulo

registerRadio({
  id: "cbn-sp",
  name: "CBN São Paulo",

  city: "São Paulo",
  state: "SP",

  website:
    "https://cbn.globo.com/",

  stream: null,
  stream_verified: false,

  official: true,
});


// Energia 97

registerRadio({
  id: "energia97",
  name: "Energia 97 FM",

  city: "São Paulo",
  state: "SP",

  website:
    "https://www.energia97fm.com.br/",

  stream: null,
  stream_verified: false,

  official: true,
});


// Rádio TMC

registerRadio({
  id: "tmc-sp",
  name: "Rádio TMC",

  city: "São Paulo",
  state: "SP",

  website: null,

  stream: null,
  stream_verified: false,

  official: false,
});


// ========================================================
// BAHIA
// ========================================================


// Rádio Sociedade

registerRadio({
  id: "sociedade-ba",
  name: "Rádio Sociedade",

  city: "Salvador",
  state: "BA",

  website: null,

  stream: null,
  stream_verified: false,

  official: false,
});
