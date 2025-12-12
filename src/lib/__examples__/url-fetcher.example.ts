/**
 * Examples demonstrating URL fetching with security protections
 * 
 * This file can be run with: tsx src/lib/__examples__/url-fetcher.example.ts
 * Note: This is for demonstration purposes only, not automated tests
 * 
 * ⚠️  This will make real HTTP requests!
 */

import { fetchUrl, FetchError } from '../url-fetcher';
import { UrlValidationError } from '../url-validator';

console.log('=== URL Fetcher Examples ===\n');

// Example 1: Successful fetch
console.log('1. Fetching a valid URL:');
async function example1() {
  try {
    const result = await fetchUrl('https://example.com', {
      timeoutMs: 10000,
      maxSizeBytes: 1048576, // 1 MB
    });
    
    console.log(`   ✓ Success!`);
    console.log(`     - Status: ${result.status}`);
    console.log(`     - Content-Type: ${result.contentType}`);
    console.log(`     - Size: ${result.size} bytes`);
    console.log(`     - Duration: ${result.durationMs}ms`);
    console.log(`     - Content preview: ${result.content.substring(0, 100)}...`);
  } catch (error) {
    console.log(`   ✗ Failed: ${error}`);
  }
}

// Example 2: Blocked URL (SSRF protection)
console.log('\n2. Attempting to fetch localhost (should fail):');
async function example2() {
  try {
    await fetchUrl('http://localhost:8080');
    console.log(`   ✗ Should have been blocked!`);
  } catch (error) {
    if (error instanceof UrlValidationError) {
      console.log(`   ✓ Blocked by SSRF protection: ${error.message}`);
    } else {
      console.log(`   ? Unexpected error: ${error}`);
    }
  }
}

// Example 3: Timeout
console.log('\n3. Testing timeout (very short timeout):');
async function example3() {
  try {
    await fetchUrl('https://example.com', {
      timeoutMs: 1, // 1ms - will definitely timeout
    });
    console.log(`   ✗ Should have timed out!`);
  } catch (error) {
    if (error instanceof FetchError && error.code === 'TIMEOUT') {
      console.log(`   ✓ Timeout protection working: ${error.message}`);
    } else {
      console.log(`   ? Got error: ${error}`);
    }
  }
}

// Example 4: Invalid protocol
console.log('\n4. Testing invalid protocol (should fail):');
async function example4() {
  try {
    await fetchUrl('ftp://example.com');
    console.log(`   ✗ Should have been blocked!`);
  } catch (error) {
    if (error instanceof UrlValidationError) {
      console.log(`   ✓ Protocol validation working: ${error.message}`);
    } else {
      console.log(`   ? Unexpected error: ${error}`);
    }
  }
}

// Example 5: Custom configuration
console.log('\n5. Fetching with custom configuration:');
async function example5() {
  try {
    const result = await fetchUrl('https://example.com', {
      timeoutMs: 5000,
      maxSizeBytes: 512000, // 500 KB
      userAgent: 'CustomBot/1.0',
      followRedirects: true,
      maxRedirects: 3,
    });
    
    console.log(`   ✓ Fetched with custom config`);
    console.log(`     - Size: ${result.size} bytes`);
    console.log(`     - Duration: ${result.durationMs}ms`);
  } catch (error) {
    console.log(`   ✗ Failed: ${error}`);
  }
}

// Run examples
(async () => {
  await example1();
  await example2();
  await example3();
  await example4();
  await example5();
  
  console.log('\n=== Examples Complete ===');
})();

