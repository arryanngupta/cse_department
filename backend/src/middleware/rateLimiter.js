// ipKeyGenerator normalises IPv6 addresses to a /56 prefix. Hand-rolling
// `req.ip` as a key lets one client walk a /64 and get a fresh bucket per
// request, which is why express-rate-limit exports this helper.
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// The previous authLimiter allowed 100 attempts per minute while its comments
// claimed "15 minutes" and "5 requests" — in practice that is no brute-force
// protection at all. These values match what the comments always intended.

const json = (message) => (req, res) => res.status(429).json({ error: message });

/**
 * Login and other credential-checking routes.
 * Only failed attempts count, so a legitimate user working normally is never
 * locked out by their own successful logins.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Configurable because the test suite intentionally performs failed logins
  // (wrong password, unknown email, missing field) and would otherwise lock
  // itself out for 15 minutes on a second run. Keep the default in
  // production; raise it only for CI and local test runs.
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many login attempts, please try again in 15 minutes'),
});

/** File uploads: bounded per hour to cap Cloudinary spend and disk churn. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many upload requests, please try again later'),
});

/**
 * Baseline limit for the whole public API. Generous enough that ordinary
 * browsing never notices, low enough to blunt scraping and accidental loops.
 */
/**
 * General API traffic.
 *
 * Mounted on all of `/api`, so this is every page load on the public site.
 *
 * The previous ceiling was 600 per 15 minutes per IP, which sounds generous
 * and is not. A university department site is read almost entirely from the
 * campus network, where hundreds of students and staff share one public
 * address — so the whole campus draws on a single bucket, and a lecture hall
 * browsing the site locks everyone out for a quarter of an hour. The symptom
 * is not subtle: every page renders its error state at once.
 *
 * 5000 is roughly 5–6 requests per second sustained for an entire NAT'd
 * network, which still stops a scraper while leaving normal institutional
 * traffic alone. Configurable, because the right number depends on how the
 * deployment sits behind proxies and how many visitors share an address.
 *
 * Note the limit is per process. Behind several instances the effective
 * ceiling multiplies, and a shared store is needed to make it exact.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 5000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json(
    'Too many requests from this network. Please wait a moment and try again.',
  ),
});

/**
 * The AI assistant costs money per call, so it is limited far more tightly
 * than the rest of the API and is configurable per deployment.
 */
/**
 * Assistant requests.
 *
 * Keyed per authenticated user when a session exists, and per IP otherwise.
 *
 * IP alone is wrong in both directions here. A whole campus behind one NAT
 * address shares a single bucket, so one heavy user locks out everybody; and
 * an authenticated caller can rotate IPs to reset the counter while keeping
 * the same session. Keying on the user id when one is available fixes both:
 * the limit then follows the account, which is the thing being protected.
 *
 * Mount this *after* optionalAuthenticate so `req.user` is populated — the
 * key generator reads it, and an unauthenticated mount order would silently
 * fall back to IP keying for everyone.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req)}`,
  handler: json(
    'You have reached the hourly limit for the assistant. Please try again later.',
  ),
});
