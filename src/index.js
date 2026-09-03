/**
 * Allowed origins for CORS.
 * Add or remove origins here as needed.
 * Each value must include the scheme and port (if non-default).
 */
const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:8082"
];

/**
 * Origins matching these patterns are also allowed.
 * `*` matches any subdomain segment (but not nested subdomains).
 */
const ALLOWED_ORIGIN_PATTERNS = [
  "https://*.podnajom.workers.dev",
];

/**
 * CORS headers applied to all allowed responses.
 */
const CORS_METHODS = "GET, HEAD, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization";
const CORS_MAX_AGE = "86400";

/**
 * Returns the CORS origin to allow, or null if the origin is not allowed.
 * @param {Request} request
 * @returns {string | null}
 */
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return null;
  }

  // Check exact matches first
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // Check pattern matches
  for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
    if (matchOriginPattern(origin, pattern)) {
      return origin;
    }
  }

  return null;
}

/**
 * Matches an origin against a pattern where `*` matches a single subdomain segment.
 * @param {string} origin
 * @param {string} pattern
 * @returns {boolean}
 */
function matchOriginPattern(origin, pattern) {
  try {
    const originUrl = new URL(origin);
    const patternUrl = new URL(pattern);

    // Protocol and port must match exactly
    if (originUrl.protocol !== patternUrl.protocol) return false;
    if (originUrl.port !== patternUrl.port) return false;

    const originHost = originUrl.hostname;
    const patternHost = patternUrl.hostname;

    // Only allow a single wildcard segment
    const wildcardIdx = patternHost.indexOf("*");
    if (wildcardIdx === -1) {
      return originHost === patternHost;
    }

    // Pattern like "*.podnajom.workers.dev"
    if (patternHost.startsWith("*.")) {
      const suffix = patternHost.slice(2); // "podnajom.workers.dev"
      // origin must end with ".suffix" and have exactly one segment before it
      if (!originHost.endsWith("." + suffix)) return false;
      const prefix = originHost.slice(0, originHost.length - suffix.length - 1);
      // prefix must be non-empty and contain no dots (single subdomain segment)
      return prefix.length > 0 && !prefix.includes(".");
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Builds a Response with CORS headers attached.
 * @param {Response} response
 * @param {string} origin
 * @returns {Response}
 */
function withCorsHeaders(response, origin) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", origin);
  newResponse.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  newResponse.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  newResponse.headers.set("Access-Control-Max-Age", CORS_MAX_AGE);
  newResponse.headers.set("Vary", "Origin");
  return newResponse;
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request);

    // Handle preflight (OPTIONS) requests
    if (request.method === "OPTIONS") {
      if (origin) {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": CORS_METHODS,
            "Access-Control-Allow-Headers": CORS_HEADERS,
            "Access-Control-Max-Age": CORS_MAX_AGE,
            "Vary": "Origin",
          },
        });
      }
      // Origin not allowed - reject preflight
      return new Response(null, { status: 403 });
    }

    // Forward to static assets
    const response = await env.ASSETS.fetch(request);

    // Attach CORS headers if the origin is allowed
    if (origin) {
      return withCorsHeaders(response, origin);
    }

    return response;
  },
};
// test
