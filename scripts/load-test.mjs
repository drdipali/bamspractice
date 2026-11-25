#!/usr/bin/env node

/**
 * Lightweight Load Test for BAMS Practice Cloud DB Read Endpoint
 * Simulates concurrent student sessions fetching chapter questions from Cloud DB.
 */

import { performance } from 'node:perf_hooks';

// Configuration
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '15', 10);
const SHEET_ID = '1-3E3lVtbN-rAQ69FRb8xric5KsV48TPVbctyxahSu5s';

// Cloud DB read endpoint for a single chapter (Row range A1:H50 ~ 50 questions for a chapter practice session)
const TARGET_URL =
  process.env.TARGET_URL ||
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&range=A1:H50`;

console.log('='.repeat(70));
console.log('  BAMS Practice - Cloud DB Read Endpoint Load Test');
console.log('='.repeat(70));
console.log(`Target URL:       ${TARGET_URL}`);
console.log(`Concurrency:      ${CONCURRENCY} virtual students`);
console.log(`Duration:         ${DURATION_SEC} seconds`);
console.log(`Start Time:       ${new Date().toISOString()}`);
console.log('='.repeat(70));
console.log('\nStarting load test... Simulating 50 concurrent students over 15 seconds...\n');

const stats = {
  totalRequests: 0,
  successRequests: 0,
  errorRequests: 0,
  rateLimit429: 0,
  statusCodes: {},
  latencies: [],
  totalBytes: 0,
  errorMessages: {},
};

const startTime = Date.now();
const endTime = startTime + DURATION_SEC * 1000;

async function virtualStudentWorker(workerId) {
  while (Date.now() < endTime) {
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(TARGET_URL, {
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': `BAMS-LoadTest-Student/${workerId}`,
          'Accept': 'text/csv,text/plain,*/*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const buffer = await res.arrayBuffer();
      const latency = performance.now() - t0;

      stats.totalRequests++;
      stats.statusCodes[res.status] = (stats.statusCodes[res.status] || 0) + 1;
      stats.totalBytes += buffer.byteLength;
      stats.latencies.push(latency);

      if (res.status === 200) {
        stats.successRequests++;
      } else {
        stats.errorRequests++;
        if (res.status === 429) {
          stats.rateLimit429++;
        }
      }
    } catch (err) {
      const latency = performance.now() - t0;
      stats.totalRequests++;
      stats.errorRequests++;
      stats.latencies.push(latency);
      const errMsg = err.name === 'AbortError' ? 'Timeout (12s)' : err.message || 'Unknown Error';
      stats.errorMessages[errMsg] = (stats.errorMessages[errMsg] || 0) + 1;
    }
  }
}

// Launch concurrent workers
const workers = Array.from({ length: CONCURRENCY }, (_, i) => virtualStudentWorker(i + 1));
await Promise.all(workers);

const actualDurationSec = (Date.now() - startTime) / 1000;

// Calculate statistical percentiles
stats.latencies.sort((a, b) => a - b);
const count = stats.latencies.length;
const sum = stats.latencies.reduce((a, b) => a + b, 0);
const avgLatency = count > 0 ? (sum / count).toFixed(2) : 0;
const minLatency = count > 0 ? stats.latencies[0].toFixed(2) : 0;
const p50Latency = count > 0 ? stats.latencies[Math.floor(count * 0.5)].toFixed(2) : 0;
const p90Latency = count > 0 ? stats.latencies[Math.floor(count * 0.9)].toFixed(2) : 0;
const p95Latency = count > 0 ? stats.latencies[Math.floor(count * 0.95)].toFixed(2) : 0;
const p99Latency = count > 0 ? stats.latencies[Math.floor(count * 0.99)].toFixed(2) : 0;
const maxLatency = count > 0 ? stats.latencies[count - 1].toFixed(2) : 0;

const totalMBTransferred = (stats.totalBytes / (1024 * 1024)).toFixed(3);
const rps = (stats.totalRequests / actualDurationSec).toFixed(2);
const avgPayloadKB = stats.totalRequests > 0 ? (stats.totalBytes / stats.totalRequests / 1024).toFixed(2) : 0;

// Projections for 1,000 students
const singleChapterEgressMB = ((stats.totalBytes / (stats.totalRequests || 1) * 1000) / (1024 * 1024)).toFixed(2);
// Full sheet sync size benchmark (measured 895,346 bytes wire / 7.11 MB uncompressed)
const fullSyncWireEgressMB = ((895346 * 1000) / (1024 * 1024)).toFixed(2); // ~853.86 MB
const fullSyncUncompressedMB = ((7283349 * 1000) / (1024 * 1024)).toFixed(2); // ~6,945.94 MB (~6.95 GB)

console.log('='.repeat(70));
console.log('  LOAD TEST RESULTS SUMMARY');
console.log('='.repeat(70));
console.log(`Test Duration:           ${actualDurationSec.toFixed(2)}s (Target: ${DURATION_SEC}s)`);
console.log(`Concurrent Students:     ${CONCURRENCY}`);
console.log(`Total Requests Sent:     ${stats.totalRequests}`);
console.log(`Requests / Second (RPS): ${rps} req/sec`);
console.log('-'.repeat(70));
console.log('  RESPONSE TIMES (LATENCY):');
console.log(`  • Average Response Time: ${avgLatency} ms`);
console.log(`  • Median (p50):          ${p50Latency} ms`);
console.log(`  • 90th Percentile (p90): ${p90Latency} ms`);
console.log(`  • 95th Percentile (p95): ${p95Latency} ms`);
console.log(`  • 99th Percentile (p99): ${p99Latency} ms`);
console.log(`  • Min / Max Latency:     ${minLatency} ms / ${maxLatency} ms`);
console.log('-'.repeat(70));
console.log('  SUCCESS VS. ERROR BREAKDOWN:');
console.log(`  • Successful (HTTP 200): ${stats.successRequests} (${((stats.successRequests / (stats.totalRequests || 1)) * 100).toFixed(1)}%)`);
console.log(`  • Failed Requests:       ${stats.errorRequests} (${((stats.errorRequests / (stats.totalRequests || 1)) * 100).toFixed(1)}%)`);
console.log(`  • 429 Rate Limits:       ${stats.rateLimit429} ${stats.rateLimit429 === 0 ? '✓ (No 429 rate limits hit)' : '⚠️ (429 Rate limits encountered!)'}`);

if (Object.keys(stats.statusCodes).length > 0) {
  console.log('  • HTTP Status Codes:    ', JSON.stringify(stats.statusCodes));
}
if (Object.keys(stats.errorMessages).length > 0) {
  console.log('  • Error Details:        ', JSON.stringify(stats.errorMessages));
}
console.log('-'.repeat(70));
console.log('  NETWORK TRANSFER & PAYLOAD:');
console.log(`  • Single Chapter Payload: ${avgPayloadKB} KB per student session`);
console.log(`  • Total Data Transferred: ${totalMBTransferred} MB (during 15s test)`);
console.log('-'.repeat(70));
console.log('  PROJECTED EGRESS FOR 1,000 STUDENTS:');
console.log(`  • 1,000 Students (Single Chapter Practice): ${singleChapterEgressMB} MB (~${(singleChapterEgressMB / 1024).toFixed(3)} GB)`);
console.log(`  • 1,000 Students (Full DB Sync Wire Size):  ${fullSyncWireEgressMB} MB (~${(fullSyncWireEgressMB / 1024).toFixed(2)} GB)`);
console.log(`  • 1,000 Students (Full DB Uncompressed):   ${fullSyncUncompressedMB} MB (~${(fullSyncUncompressedMB / 1024).toFixed(2)} GB)`);
console.log('='.repeat(70));
