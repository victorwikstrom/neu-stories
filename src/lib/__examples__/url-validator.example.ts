/**
 * Examples demonstrating URL validation and SSRF protection
 * 
 * This file can be run with: tsx src/lib/__examples__/url-validator.example.ts
 * Note: This is for demonstration purposes only, not automated tests
 */

import { validateUrl, safeValidateUrl, isPrivateIp, UrlValidationError } from '../url-validator';

console.log('=== URL Validator Examples ===\n');

// Example 1: Valid URLs
console.log('1. Valid URLs:');
const validUrls = [
  'https://example.com',
  'http://news.bbc.co.uk/article',
  'https://www.nytimes.com/2024/01/01/world/article.html',
];

validUrls.forEach(url => {
  try {
    const parsed = validateUrl(url);
    console.log(`   ✓ ${url} -> ${parsed.hostname}`);
  } catch (error) {
    console.log(`   ✗ ${url} -> ERROR: ${error}`);
  }
});

// Example 2: Invalid protocols
console.log('\n2. Invalid protocols (should fail):');
const invalidProtocols = [
  'file:///etc/passwd',
  'ftp://example.com',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
];

invalidProtocols.forEach(url => {
  try {
    validateUrl(url);
    console.log(`   ✗ ${url} -> Should have failed!`);
  } catch (error) {
    if (error instanceof UrlValidationError) {
      console.log(`   ✓ ${url} -> Blocked: ${error.message}`);
    }
  }
});

// Example 3: Private/local hostnames
console.log('\n3. Private/local hostnames (should fail):');
const blockedHosts = [
  'http://localhost:8080',
  'http://127.0.0.1',
  'http://metadata.google.internal',
  'http://169.254.169.254/latest/meta-data',
  'http://localhost.example.com', // Should pass - different domain
];

blockedHosts.forEach(url => {
  try {
    validateUrl(url);
    console.log(`   ✗ ${url} -> Should have failed!`);
  } catch (error) {
    if (error instanceof UrlValidationError) {
      console.log(`   ✓ ${url} -> Blocked: ${error.message}`);
    } else {
      console.log(`   ? ${url} -> Unexpected error: ${error}`);
    }
  }
});

// Example 4: Private IP detection
console.log('\n4. Private IP detection:');
const ips = [
  { ip: '127.0.0.1', expected: true },
  { ip: '10.0.0.1', expected: true },
  { ip: '172.16.0.1', expected: true },
  { ip: '192.168.1.1', expected: true },
  { ip: '169.254.169.254', expected: true },
  { ip: '8.8.8.8', expected: false },
  { ip: '1.1.1.1', expected: false },
  { ip: '93.184.216.34', expected: false }, // example.com
];

ips.forEach(({ ip, expected }) => {
  const result = isPrivateIp(ip);
  const status = result === expected ? '✓' : '✗';
  console.log(`   ${status} ${ip} -> ${result ? 'private' : 'public'} (expected: ${expected ? 'private' : 'public'})`);
});

// Example 5: Safe validation (non-throwing)
console.log('\n5. Safe validation (returns result object):');
const testUrls = [
  'https://example.com',
  'http://localhost',
  'not-a-url',
  'ftp://example.com',
];

testUrls.forEach(url => {
  const result = safeValidateUrl(url);
  if (result.valid) {
    console.log(`   ✓ ${url} -> Valid`);
  } else {
    console.log(`   ✗ ${url} -> Invalid: ${result.error}`);
  }
});

console.log('\n=== Examples Complete ===');

