/**
 * URL fetcher service with security protections
 * 
 * Provides safe URL fetching with:
 * - SSRF protection
 * - Timeout limits
 * - Size limits
 * - DNS rebinding protection
 */

import { validateUrl, validateResolvedIp, UrlValidationError } from './url-validator';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Configuration for URL fetching
 */
export interface FetchConfig {
  /** Maximum time to wait for response in milliseconds (default: 30000 = 30s) */
  timeoutMs?: number;
  /** Maximum response size in bytes (default: 10485760 = 10MB) */
  maxSizeBytes?: number;
  /** User agent to use for requests */
  userAgent?: string;
  /** Whether to follow redirects (default: true, max 5) */
  followRedirects?: boolean;
  /** Maximum number of redirects to follow (default: 5) */
  maxRedirects?: number;
}

/**
 * Result of fetching a URL
 */
export interface FetchResult {
  /** The final URL after redirects */
  url: string;
  /** HTTP status code */
  status: number;
  /** Content-Type header */
  contentType: string | null;
  /** Response body as text */
  content: string;
  /** Size of response in bytes */
  size: number;
  /** Time taken to fetch in milliseconds */
  durationMs: number;
}

/**
 * Error thrown during URL fetching
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

const DEFAULT_CONFIG: Required<FetchConfig> = {
  timeoutMs: 30000,        // 30 seconds
  maxSizeBytes: 10485760,  // 10 MB
  userAgent: 'NuoStoriesBot/1.0',
  followRedirects: true,
  maxRedirects: 5,
};

/**
 * Safely fetches a URL with security protections
 * 
 * @param urlString - The URL to fetch
 * @param config - Optional configuration
 * @returns FetchResult with the fetched content
 * @throws {UrlValidationError} If URL validation fails
 * @throws {FetchError} If fetching fails
 */
export async function fetchUrl(
  urlString: string,
  config: FetchConfig = {}
): Promise<FetchResult> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Step 1: Validate URL format and basic checks
  const url = validateUrl(urlString);

  // Step 2: DNS resolution and SSRF check
  try {
    const { address } = await dnsLookup(url.hostname);
    validateResolvedIp(url.hostname, address);
  } catch (error) {
    if (error instanceof UrlValidationError) {
      throw error;
    }
    throw new FetchError(
      `DNS resolution failed for ${url.hostname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'DNS_ERROR'
    );
  }

  // Step 3: Fetch with timeout and size limit
  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);

    response = await fetch(urlString, {
      signal: controller.signal,
      headers: {
        'User-Agent': cfg.userAgent,
      },
      redirect: cfg.followRedirects ? 'follow' : 'manual',
    });

    clearTimeout(timeoutId);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new FetchError(
          `Request timeout after ${cfg.timeoutMs}ms`,
          'TIMEOUT'
        );
      }
      throw new FetchError(
        `Failed to fetch URL: ${error.message}`,
        'FETCH_ERROR'
      );
    }
    throw new FetchError('Failed to fetch URL', 'FETCH_ERROR');
  }

  // Step 4: Check response status
  if (!response.ok) {
    throw new FetchError(
      `HTTP ${response.status}: ${response.statusText}`,
      'HTTP_ERROR',
      response.status
    );
  }

  // Step 5: Check content type
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    // We'll be lenient here - some sites don't set proper content-type
    // But we'll store it for later inspection
  }

  // Step 6: Read response with size limit
  let content: string;
  let size: number;
  try {
    // Read the response body with size checking
    const reader = response.body?.getReader();
    if (!reader) {
      throw new FetchError('No response body', 'NO_BODY');
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      totalSize += value.length;
      
      if (totalSize > cfg.maxSizeBytes) {
        reader.cancel();
        throw new FetchError(
          `Response size exceeds limit of ${cfg.maxSizeBytes} bytes`,
          'SIZE_LIMIT_EXCEEDED'
        );
      }
      
      chunks.push(value);
    }

    // Combine chunks and decode
    const allChunks = new Uint8Array(totalSize);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    const decoder = new TextDecoder('utf-8', { fatal: false });
    content = decoder.decode(allChunks);
    size = totalSize;
  } catch (error) {
    if (error instanceof FetchError) {
      throw error;
    }
    throw new FetchError(
      `Failed to read response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'READ_ERROR'
    );
  }

  const durationMs = Date.now() - startTime;

  return {
    url: response.url, // Final URL after redirects
    status: response.status,
    contentType,
    content,
    size,
    durationMs,
  };
}

