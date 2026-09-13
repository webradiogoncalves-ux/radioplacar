const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function metadataValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value || "");
}

function acceptedLicense(metadata) {
  const shortName = metadataValue(metadata, "LicenseShortName")
    .toLowerCase();

  const copyrighted = metadataValue(metadata, "Copyrighted")
    .toLowerCase();

  const allowed = [
    "cc0",
    "public domain",
    "cc by",
    "cc-by",
    "cc by-sa",
    "cc-by-sa"
  ];

  return {
    ok:
      allowed.some((license) => shortName.includes(license)) ||
      copyrighted === "false",
    name: metadataValue(metadata, "LicenseShortName") || null,
    url: metadataValue(metadata, "LicenseUrl") || null
  };
}

function teamMatches(teamName, title, description) {
  const team = normalizeName(teamName);
  const haystack = normalizeName(`${title} ${description}`);

  if (!team || !haystack) return false;

  return haystack.includes(team);
}

async function searchCommons(teamName) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${teamName} football club logo`,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "256",
    format: "json",
    origin: "*"
  });

  const response = await fetch(`${COMMONS_API}?${params}`);

  if (!response.ok) {
    throw new Error(`Wikimedia Commons ${response.status}`);
  }

  const data = await response.json();

  return Object.values(data?.query?.pages || {});
}

export async function findExternalTeamLogo(teamName) {
  const key = normalizeName(teamName);

  if (!key) return null;

  const cached = cache.get(key);

  if (cached && Date.now() - cached.time < CACHE_MS) {
    return cached.value;
  }

  try {
    const pages = await searchCommons(teamName);

    for (const page of pages) {
      const info = page?.imageinfo?.[0];
      if (!info) continue;

      const metadata = info.extmetadata || {};

      const description =
        metadataValue(metadata, "ImageDescription");

      if (!teamMatches(teamName, page.title, description)) {
        continue;
      }

      const license = acceptedLicense(metadata);

      if (!license.ok) {
        continue;
      }

      const logo =
        info.thumburl ||
        info.url ||
        null;

      if (!logo) continue;

      const result = {
        logo,
        source: "Wikimedia Commons",
        source_page:
          info.descriptionurl || null,
        license: license.name,
        license_url: license.url,
        verified: true
      };

      cache.set(key, {
        time: Date.now(),
        value: result
      });

      return result;
    }
  } catch (error) {
    console.error(
      `[teamLogos] ${teamName}:`,
      error.message
    );
  }

  cache.set(key, {
    time: Date.now(),
    value: null
  });

  return null;
}

export function clearTeamLogoCache() {
  cache.clear();
}
