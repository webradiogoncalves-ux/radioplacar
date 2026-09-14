// backend/radios.js

const radios = new Map();
const matchRadios = new Map();

/**
 * Cadastro de rádio.
 * IMPORTANTE:
 * - Apenas rádios brasileiras.
 * - Não significa que ela transmite todos os jogos.
 * - A associação com a partida é feita separadamente.
 */

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

    // URL da página oficial da rádio
    website: radio.website || null,

    // Stream direto somente quando realmente confirmado.
    stream: radio.stream || null,

    // true = stream direto confirmado
    stream_verified: radio.stream_verified === true,

    // true = emissora/página oficial verificada
    official: radio.official !== false,

    active: radio.active !== false,

    updated_at: new Date().toISOString(),
  };

  radios.set(normalized.id, normalized);

  return normalized;
}


/**
 * Retorna todas as rádios cadastradas.
 */
export function getRadios() {
  return [...radios.values()];
}


/**
 * Retorna uma rádio pelo ID.
 */
export function getRadio(id) {
  return radios.get(String(id)) || null;
}


/**
 * Vincula uma rádio a uma PARTIDA específica.
 *
 * Nunca vincular rádio automaticamente só por clube.
 * A transmissão daquele jogo precisa estar confirmada.
 */
export function attachRadioToMatch(matchId, radioId, options = {}) {
  const matchKey = String(matchId);
  const radioKey = String(radioId);

  const radio = radios.get(radioKey);

  if (!radio) {
    throw new Error(`Rádio não encontrada: ${radioKey}`);
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

    // true somente quando sabemos que a rádio
    // está transmitindo ESTA partida.
    match_confirmed: options.match_confirmed === true,

    // De onde veio a confirmação.
    source: options.source || null,

    // Página que comprova a transmissão daquele jogo.
    source_url: options.source_url || null,

    // prioridade 1 = principal
    priority:
      Number.isInteger(options.priority) && options.priority > 0
        ? options.priority
        : 99,

    active: options.active !== false,

    confirmed_at:
      options.match_confirmed === true
        ? new Date().toISOString()
        : null,

    updated_at: new Date().toISOString(),
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


/**
 * Retorna rádios de uma partida.
 *
 * Por padrão retorna SOMENTE rádios cuja
 * transmissão da partida foi confirmada.
 */
export function getRadiosForMatch(
  matchId,
  { onlyConfirmed = true } = {}
) {
  const matchKey = String(matchId);

  const associations = matchRadios.get(matchKey) || [];

  return associations
    .filter((item) => {
      if (!item.active) return false;

      if (onlyConfirmed && !item.match_confirmed) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const radio = radios.get(item.radio_id);

      if (!radio || !radio.active) {
        return null;
      }

      return {
        ...item,
        radio,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority);
}


/**
 * Remove associação de rádio com uma partida.
 */
export function detachRadioFromMatch(matchId, radioId) {
  const matchKey = String(matchId);
  const radioKey = String(radioId);

  const list = matchRadios.get(matchKey);

  if (!list) {
    return false;
  }

  const newList = list.filter(
    (item) => item.radio_id !== radioKey
  );

  if (newList.length === 0) {
    matchRadios.delete(matchKey);
  } else {
    matchRadios.set(matchKey, newList);
  }

  return true;
}


/**
 * Remove todas as rádios associadas a uma partida.
 * Útil depois que o jogo terminar.
 */
export function clearMatchRadios(matchId) {
  return matchRadios.delete(String(matchId));
}


/**
 * Limpeza geral.
 */
export function clearAllMatchRadios() {
  matchRadios.clear();
}


/**
 * Lista interna para diagnóstico.
 */
export function getRadioStats() {
  let associations = 0;
  let confirmed = 0;

  for (const list of matchRadios.values()) {
    associations += list.length;

    confirmed += list.filter(
      (item) => item.match_confirmed
    ).length;
  }

  return {
    radios: radios.size,
    matches_with_radios: matchRadios.size,
    associations,
    confirmed,
  };
}


// ========================================================
// RÁDIOS BRASILEIRAS INICIAIS
// ========================================================

// Rádio Grenal
registerRadio({
  id: "grenal",
  name: "Rádio Grenal",
  city: "Porto Alegre",
  state: "RS",
  website: "https://www.radiogrenal.com.br/",
  stream: null,
  stream_verified: false,
  official: true,
});


// Super Rádio Tupi
registerRadio({
  id: "tupi",
  name: "Super Rádio Tupi",
  city: "Rio de Janeiro",
  state: "RJ",
  website: "https://www.tupi.fm/ao-vivo/",
  stream: null,
  stream_verified: false,
  official: true,
});


// Itatiaia
registerRadio({
  id: "itatiaia",
  name: "Rádio Itatiaia",
  city: "Belo Horizonte",
  state: "MG",
  website: "https://www.itatiaia.com.br/aovivo/",
  stream: "https://8903.brasilstream.com.br/stream",
  stream_verified: true,
  official: true,
});
