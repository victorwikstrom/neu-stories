/**
 * Example: Complete ingestion pipeline usage
 * 
 * This example demonstrates how to use the fetch and extract services
 * to process a URL through the ingestion pipeline.
 */

import { createIngestionJob } from '@/server/repositories/ingestionJobRepository';
import { fetchIngestionJob } from '@/server/services/ingestion-fetcher';
import { extractIngestionJob } from '@/server/services/ingestion-extractor';

/**
 * Process a URL through the complete ingestion pipeline
 */
async function processUrl(url: string) {
  console.log('Starting ingestion for:', url);
  
  try {
    // Step 1: Create ingestion job
    const job = await createIngestionJob({ url });
    console.log('✓ Job created:', job.id, '- Status:', job.status);
    
    // Step 2: Fetch the URL
    const fetchResult = await fetchIngestionJob(job.id);
    
    if (!fetchResult.success) {
      console.error('✗ Fetch failed:', fetchResult.error);
      return;
    }
    
    console.log('✓ Fetch completed - Status:', fetchResult.job.status);
    console.log('  - HTTP Status:', fetchResult.job.httpStatus);
    console.log('  - Content Type:', fetchResult.job.contentType);
    console.log('  - HTML Size:', fetchResult.job.rawHtml?.length, 'bytes');
    
    // Step 3: Extract title and text
    // Note: Fetch auto-triggers extraction in the background, but calling explicitly
    // is also safe due to idempotency. This call may return skipped=true if
    // the auto-triggered extraction already completed.
    const extractResult = await extractIngestionJob(fetchResult.job.id);
    
    if (!extractResult.success) {
      console.error('✗ Extraction failed:', extractResult.error);
      return;
    }
    
    const skippedNote = extractResult.skipped ? ' (skipped - already extracted)' : '';
    console.log('✓ Extraction completed - Status:', extractResult.job.status + skippedNote);
    console.log('  - Title:', extractResult.job.extractedTitle);
    console.log('  - Text Length:', extractResult.job.extractedText?.length, 'chars');
    console.log('  - Preview:', extractResult.job.extractedText?.substring(0, 100) + '...');
    
    // Step 4: Ready for generation
    console.log('\n✓ Job ready for content generation!');
    
    return extractResult.job;
  } catch (error) {
    console.error('Pipeline error:', error);
    throw error;
  }
}

/**
 * Process multiple URLs in parallel
 */
async function processBatch(urls: string[]) {
  console.log(`Processing ${urls.length} URLs...`);
  
  const results = await Promise.allSettled(
    urls.map(url => processUrl(url))
  );
  
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`\nBatch complete: ${succeeded} succeeded, ${failed} failed`);
  
  return results;
}

/**
 * Poll for jobs and process them (useful for background workers)
 */
async function backgroundWorker() {
  console.log('Background worker started...');
  
  while (true) {
    try {
      // Process fetch jobs
      const { processNextQueuedJob } = await import('@/server/services/ingestion-fetcher');
      const fetchJob = await processNextQueuedJob();
      
      if (fetchJob && fetchJob.success) {
        console.log('Processed fetch job:', fetchJob.job.id);
      }
      
      // Process extraction jobs
      const { processNextExtractingJob } = await import('@/server/services/ingestion-extractor');
      const extractJob = await processNextExtractingJob();
      
      if (extractJob && extractJob.success) {
        console.log('Processed extraction job:', extractJob.job.id);
      }
      
      // If no jobs, wait before checking again
      if (!fetchJob && !extractJob) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
      }
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds on error
    }
  }
}

// Example usage
if (require.main === module) {
  const exampleUrl = 'https://example.com/article';
  
  // Single URL
  processUrl(exampleUrl).catch(console.error);
  
  // Multiple URLs
  // processBatch([
  //   'https://example.com/article1',
  //   'https://example.com/article2',
  //   'https://example.com/article3',
  // ]).catch(console.error);
  
  // Background worker
  // backgroundWorker().catch(console.error);
}

