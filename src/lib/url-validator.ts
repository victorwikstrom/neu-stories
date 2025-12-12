/**
 * URL validation and SSRF protection utilities
 * 
 * Provides security checks to prevent Server-Side Request Forgery (SSRF) attacks
 * by validating URLs before fetching them.
 */

import { URL } from 'url';

/**
 * Error thrown when URL validation fails
 */
export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

/**
 * Private IP ranges to block (RFC 1918, RFC 4193, etc.)
 */
const PRIVATE_IP_RANGES = [
  // IPv4 Private ranges
  /^127\./,                    // Loopback
  /^10\./,                     // Private network
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private network
  /^192\.168\./,               // Private network
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  // IPv6 Private ranges
  /^::1$/,                     // Loopback
  /^fe80:/i,                   // Link-local
  /^fc00:/i,                   // Unique local
  /^fd00:/i,                   // Unique local
  /^::ffff:127\./i,            // IPv4-mapped loopback
  /^::ffff:10\./i,             // IPv4-mapped private
  /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./i, // IPv4-mapped private
  /^::ffff:192\.168\./i,       // IPv4-mapped private
];

/**
 * Blocked hostnames
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',   // GCP metadata service
  '169.254.169.254',             // AWS/Azure metadata service
];

/**
 * Validates that a URL is safe to fetch
 * 
 * @param urlString - The URL to validate
 * @throws {UrlValidationError} If the URL is invalid or unsafe
 * @returns The parsed URL object
 */
export function validateUrl(urlString: string): URL {
  // Basic URL parsing
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new UrlValidationError('Invalid URL format');
  }

  // Check protocol - only allow http and https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlValidationError(`Protocol ${url.protocol} is not allowed. Only http and https are supported.`);
  }

  // Check for blocked hostnames (case-insensitive)
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.some(blocked => hostname === blocked || hostname.endsWith(`.${blocked}`))) {
    throw new UrlValidationError(`Hostname ${url.hostname} is not allowed`);
  }

  return url;
}

/**
 * Checks if an IP address is private/internal
 * 
 * @param ip - The IP address to check
 * @returns true if the IP is private, false otherwise
 */
export function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(pattern => pattern.test(ip));
}

/**
 * Validates that a hostname resolves to a public IP address
 * This check happens after DNS resolution
 * 
 * @param hostname - The hostname that was resolved
 * @param resolvedIp - The IP address it resolved to
 * @throws {UrlValidationError} If the IP is private or blocked
 */
export function validateResolvedIp(hostname: string, resolvedIp: string): void {
  if (isPrivateIp(resolvedIp)) {
    throw new UrlValidationError(
      `Hostname ${hostname} resolves to private IP ${resolvedIp}, which is not allowed`
    );
  }

  // Additional check for cloud metadata services by IP
  if (resolvedIp === '169.254.169.254') {
    throw new UrlValidationError('Access to cloud metadata service is not allowed');
  }
}

/**
 * Performs complete URL validation including protocol and hostname checks
 * 
 * @param urlString - The URL to validate
 * @returns An object with validation result and the parsed URL if valid
 */
export function safeValidateUrl(urlString: string): { 
  valid: boolean; 
  url?: URL; 
  error?: string 
} {
  try {
    const url = validateUrl(urlString);
    return { valid: true, url };
  } catch (error) {
    if (error instanceof UrlValidationError) {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Unknown validation error' };
  }
}

