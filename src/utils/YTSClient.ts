import axios from "axios";
import { TorrPluginSearchResult, YTSData } from "../types";
import { videoQualities } from "../components/Filters";
import { TorrClient } from "./TorrClient";

let serverAddress = new URL(".", window.location.href).href;

if (serverAddress.substring(serverAddress.length - 1) !== "/") {
  serverAddress = `${serverAddress}/`;
}

// Prefer same-origin proxy endpoints to avoid browser CORS failures.
const PROXY_BASE_URLS = [`${serverAddress}yts/api/v2/`, `${serverAddress}yts/`];

// Public proxy templates for static theme mode where no backend proxy exists.
const DEFAULT_CORS_PROXY_TEMPLATES = [
  "https://corsproxy.io/?{url}",
  "https://api.allorigins.win/raw?url={url}",
];

// Fallback list of YTS mirrors used if the remote config cannot be fetched.
const FALLBACK_MIRRORS = [
  "https://yts.mx/api/v2/",
  "https://yts.am/api/v2/",
  "https://yts.ag/api/v2/",
  "https://yts.lt/api/v2/",
  "https://yts.pm/api/v2/",
  "https://yts.bz/api/v2/",
];

// Remote mirror list hosted in the repo — update this file on GitHub to fix
// broken mirrors for all users without any code change or rebuild needed.
const REMOTE_MIRRORS_URL =
  "https://raw.githubusercontent.com/Indi733/iQbit/main/public/yts-mirrors.json";

const CACHE_KEY = "iqbit-yts-working-mirror";

type IQbitRuntimeConfig = {
  ytsProxyTemplate?: string;
  ytsProxyTemplates?: string[];
};

function getRuntimeConfig(): IQbitRuntimeConfig {
  return ((window as any).iQbitConfig || {}) as IQbitRuntimeConfig;
}

function getProxyTemplates(): string[] {
  const runtimeConfig = getRuntimeConfig();
  const configured = [
    ...(runtimeConfig.ytsProxyTemplates || []),
    runtimeConfig.ytsProxyTemplate || "",
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  return [...configured, ...DEFAULT_CORS_PROXY_TEMPLATES];
}

function buildProxyURL(template: string, targetURL: string): string {
  const encodedTarget = encodeURIComponent(targetURL);
  if (template.includes("{url}")) {
    return template.replace("{url}", encodedTarget);
  }
  return `${template}${encodedTarget}`;
}

function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value));
    }
  });

  return query.toString();
}

function parseResponseData(rawData: any): any {
  if (typeof rawData === "string") {
    try {
      return JSON.parse(rawData);
    } catch {
      return null;
    }
  }

  if (rawData?.contents && typeof rawData.contents === "string") {
    try {
      return JSON.parse(rawData.contents);
    } catch {
      return null;
    }
  }

  return rawData;
}

function extractMovieData(payload: any): YTSData | null {
  const parsed = parseResponseData(payload);
  if (parsed && parsed.data) {
    return parsed.data as YTSData;
  }
  return null;
}

const POSTER_PLACEHOLDER = "/refraction.svg";

function parseYearFromTitle(title: string): number {
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : 0;
}

function parseQuality(name: string): string {
  const lowered = name.toLowerCase();
  if (lowered.includes("2160") || lowered.includes("4k")) return "2160p";
  if (lowered.includes("1080")) return "1080p";
  if (lowered.includes("720")) return "720p";
  return "unknown";
}

function parseType(name: string): string {
  const lowered = name.toLowerCase();
  if (lowered.includes("bluray") || lowered.includes("bdrip") || lowered.includes("brrip")) return "BluRay";
  if (lowered.includes("web-dl") || lowered.includes("webrip") || lowered.includes("web")) return "Web";
  if (lowered.includes("hdrip") || lowered.includes("dvdrip") || lowered.includes("hdtv")) return "HDRip";
  if (lowered.includes("cam") || lowered.includes("ts")) return "CAM";
  return "unknown";
}

function extractMagnetHash(fileUrl: string, fallback: string): string {
  if (!fileUrl.startsWith("magnet:?")) return fallback;
  const match = fileUrl.match(/xt=urn:btih:([^&]+)/i);
  return match?.[1] || fallback;
}

function mapPluginResultToYTSMovie(
  result: TorrPluginSearchResult,
  index: number
) {
  const id = Date.now() + index;
  const title = result.fileName || `Result ${index + 1}`;
  const year = parseYearFromTitle(title);
  const hash = extractMagnetHash(result.fileUrl || "", `plugin-${id}`);

  return {
    small_cover_image: POSTER_PLACEHOLDER,
    year,
    description_full: "Result provided by qBittorrent search plugin fallback.",
    rating: 0,
    large_cover_image: POSTER_PLACEHOLDER,
    title_long: title,
    language: "",
    yt_trailer_code: "",
    title,
    mpa_rating: "",
    genres: [],
    title_english: title,
    id,
    state: "ok",
    slug: `plugin-${id}`,
    summary: "",
    date_uploaded: "",
    runtime: 0,
    synopsis: "",
    url: result.descrLink || result.siteUrl || "",
    imdb_code: "",
    background_image: POSTER_PLACEHOLDER,
    torrents: [
      {
        size_bytes: result.fileSize || 0,
        size: "",
        seeds: result.nbSeeders || 0,
        date_uploaded: "",
        peers: result.nbLeechers || 0,
        date_uploaded_unix: 0,
        type: parseType(title),
        url: result.fileUrl || "",
        hash,
        quality: parseQuality(title),
      },
    ],
    date_uploaded_unix: 0,
    background_image_original: POSTER_PLACEHOLDER,
    medium_cover_image: POSTER_PLACEHOLDER,
  };
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchViaQbitPlugins(query_term: string): Promise<YTSData> {
  const started = await TorrClient.createSearch(query_term);
  const id = started.id;

  try {
    let response = await TorrClient.getResults(id);
    let attempts = 0;

    while (response.status === "Running" && attempts < 8) {
      attempts += 1;
      await wait(700);
      response = await TorrClient.getResults(id);
    }

    const movies = (response.results || []).map((result, index) =>
      mapPluginResultToYTSMovie(result, index)
    );

    return {
      movies,
      page_number: 1,
      movie_count: movies.length,
      limit: movies.length,
    };
  } finally {
    try {
      await TorrClient.stopSearch(id);
    } catch {
      // Ignore cleanup failures
    }
    try {
      await TorrClient.deleteSearch(id);
    } catch {
      // Ignore cleanup failures
    }
  }
}

/** Load the mirror list: tries remote JSON first, falls back to hardcoded list. */
async function loadMirrors(): Promise<string[]> {
  try {
    const { data } = await axios.get(REMOTE_MIRRORS_URL, { timeout: 3000 });
    if (Array.isArray(data?.mirrors) && data.mirrors.length > 0) {
      return data.mirrors as string[];
    }
  } catch {
    // Remote fetch failed — use hardcoded fallback silently
  }
  return FALLBACK_MIRRORS;
}

/** Build a mirror list that tries the cached working mirror first. */
function prioritizeCached(mirrors: string[]): string[] {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached && mirrors.includes(cached)) {
    return [cached, ...mirrors.filter((m) => m !== cached)];
  }
  return mirrors;
}

export type ytsSearchParams = {
  query_term: string;
  limit?: number;
  page?: number;
  quality?: videoQualities;
  minimum_rating?: number;
  genre?:
  | "Action"
  | "Adventure"
  | "Animation"
  | "Biography"
  | "Comedy"
  | "Crime"
  | "Documentary"
  | "Drama"
  | "Family"
  | "Fantasy"
  | "Film Noir"
  | "History"
  | "Horror"
  | "Music"
  | "Musical"
  | "Mystery"
  | "Romance"
  | "Sci-Fi"
  | "Short Film"
  | "Sport"
  | "Superhero"
  | "Thriller"
  | "War"
  | "Western";
  sort_by?:
  | "title"
  | "year"
  | "rating"
  | "peers"
  | "seeds"
  | "download_count"
  | "like_count"
  | "date_added";
  order_by?: "desc" | "asc";
  // with_rt_ratings?: boolean;
};

export const YTSClient = {
  search: async ({
    query_term,
    limit,
    page,
    quality,
    minimum_rating,
    genre,
    sort_by,
    order_by,
  }: ytsSearchParams): Promise<YTSData> => {
    let lastError: any;
    const searchParams = {
      limit,
      page,
      quality,
      minimum_rating,
      query_term,
      genre,
      sort_by,
      order_by,
      with_rt_ratings: true,
    };
    const queryString = buildQueryString(searchParams);

    for (const baseURL of PROXY_BASE_URLS) {
      try {
        const { data } = await axios.get(`${baseURL}list_movies.json`, {
          params: searchParams,
          timeout: 5000,
        });

        const movieData = extractMovieData(data);
        if (movieData) {
          return movieData;
        }
      } catch (error) {
        // Non-fatal: this endpoint may not exist when not using standalone server.
        lastError = error;
      }
    }

    // Load mirrors: tries remote JSON first, falls back to hardcoded list.
    // Then re-orders so the last known working mirror is tried first.
    const mirrors = prioritizeCached(await loadMirrors());
    const proxyTemplates = getProxyTemplates();

    for (const mirrorBaseURL of mirrors) {
      const targetURL = `${mirrorBaseURL}list_movies.json${queryString ? `?${queryString}` : ""}`;

      // First try CORS-friendly proxy templates for static theme mode.
      for (const proxyTemplate of proxyTemplates) {
        try {
          const proxiedURL = buildProxyURL(proxyTemplate, targetURL);
          const { data } = await axios.get(proxiedURL, { timeout: 5000 });
          const movieData = extractMovieData(data);
          if (movieData) {
            localStorage.setItem(CACHE_KEY, mirrorBaseURL);
            return movieData;
          }
        } catch (error) {
          lastError = error;
          console.warn(
            `YTS proxy template failed: ${proxyTemplate}`,
            (error as any)?.message || error
          );
        }
      }

      // Finally try direct mirror access (works in environments where mirror CORS is allowed).
      try {
        const { data } = await axios.get(`${mirrorBaseURL}list_movies.json`, {
          params: searchParams,
          timeout: 3000,
        });

        const movieData = extractMovieData(data);
        if (movieData) {
          localStorage.setItem(CACHE_KEY, mirrorBaseURL);
          return movieData;
        }
      } catch (error) {
        console.warn(`YTS mirror failed: ${mirrorBaseURL}`, error);
        lastError = error;
      }
    }

    // If the loop finishes and no mirror worked, clear the cache and throw
    localStorage.removeItem(CACHE_KEY);
    try {
      return await searchViaQbitPlugins(query_term);
    } catch (pluginError) {
      throw pluginError || lastError || new Error("All YTS mirrors failed.");
    }
  },
};
