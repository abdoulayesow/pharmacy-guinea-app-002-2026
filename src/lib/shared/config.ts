/**
 * Authentication Configuration
 *
 * Configurable via environment variables for flexibility across environments.
 * These values can be overridden in .env files.
 *
 * Note: Client-side values use NEXT_PUBLIC_ prefix
 */

/**
 * Auth configuration constants
 * All values have sensible defaults but can be customized via environment variables
 */
export const AUTH_CONFIG = {
  /**
   * Default PIN for new users (set on first Google login)
   * Users are forced to change this on first login
   * Default: '1234'
   * Client-accessible: Yes (NEXT_PUBLIC_)
   */
  DEFAULT_PIN: process.env.NEXT_PUBLIC_DEFAULT_PIN || '1234',

  /**
   * Session duration in days before requiring Google re-authentication
   * Default: 7 days
   * Client-accessible: No (server-only)
   */
  SESSION_MAX_AGE_DAYS: parseInt(process.env.SESSION_MAX_AGE_DAYS || '7', 10),

  /**
   * Inactivity timeout in minutes before requiring PIN re-entry
   * Default: 5 minutes
   * Client-accessible: Yes (NEXT_PUBLIC_)
   */
  INACTIVITY_TIMEOUT_MINUTES: parseInt(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES || '5', 10),

  /**
   * Number of failed PIN attempts before account lockout
   * Default: 5 attempts
   * Client-accessible: No (server-only)
   */
  MAX_FAILED_ATTEMPTS: parseInt(process.env.MAX_FAILED_ATTEMPTS || '5', 10),

  /**
   * Lockout duration in minutes after max failed attempts
   * Default: 30 minutes
   * Client-accessible: No (server-only)
   */
  LOCKOUT_DURATION_MINUTES: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30', 10),
};

/**
 * Computed values (derived from config)
 */
export const AUTH_COMPUTED = {
  /** Session max age in seconds (for NextAuth) */
  SESSION_MAX_AGE_SECONDS: AUTH_CONFIG.SESSION_MAX_AGE_DAYS * 24 * 60 * 60,

  /** Inactivity timeout in milliseconds (for activity monitor) */
  INACTIVITY_TIMEOUT_MS: AUTH_CONFIG.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000,

  /** Lockout duration in milliseconds */
  LOCKOUT_DURATION_MS: AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000,
};

