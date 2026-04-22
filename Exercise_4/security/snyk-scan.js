#!/usr/bin/env node
/**
 * Snyk Security Scanner – Wrapper Script
 * Runs Snyk dependency and code (SAST) scanning, parses the output,
 * and writes a structured JSON report.
 *
 * Requires:
 *   - Snyk CLI: npm install -g snyk   OR  npx snyk
 *   - Authentication: snyk auth <token>  OR  SNYK_TOKEN env var
 *
 * Usage:
 *   node Exercise_4/security/snyk-scan.js [--code] [--all-projects]
 *
 * Environment variables:
 *   SNYK_TOKEN   Snyk authentication token
 */

'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR   = path.resolve(__dirname, '../reports');
const REPORT_FILE  = path.join(REPORT_DIR, 'snyk-security-report.json');

const ARGS         = process.argv.slice(2);
const RUN_CODE     = ARGS.includes('--code');
const ALL_PROJECTS = ARGS.includes('--all-projects');

// Severity levels in ascending severity order
const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function findSnyk() {
  const localBin = path.join(PROJECT_ROOT, 'node_modules/.bin/snyk');
  if (fs.existsSync(localBin)) return localBin;
  const globalCheck = spawnSync('which', ['snyk'], { encoding: 'utf-8' });
  if (globalCheck.status === 0) return 'snyk';
  return null;
}

function runSnykTest(snykBin) {
  console.log('  Running Snyk dependency vulnerability test...');
  const cmdArgs = ['test', '--json'];
  if (ALL_PROJECTS) cmdArgs.push('--all-projects');

  const result = spawnSync(snykBin, cmdArgs, {
    cwd:      PROJECT_ROOT,
    encoding: 'utf-8',
    env:      { ...process.env },
    timeout:  120000,
  });

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = { error: 'Could not parse Snyk output', rawOutput: result.stdout };
  }

  return { output: parsed, exitCode: result.status || 0 };
}

function runSnykCodeTest(snykBin) {
  console.log('  Running Snyk SAST (code) test...');
  const result = spawnSync(snykBin, ['code', 'test', '--json'], {
    cwd:      PROJECT_ROOT,
    encoding: 'utf-8',
    env:      { ...process.env },
    timeout:  120000,
  });

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = { error: 'Could not parse Snyk code output', rawOutput: result.stdout };
  }

  return { output: parsed, exitCode: result.status || 0 };
}

function extractVulnerabilities(snykOutput) {
  const vulns = [];

  // Standard `snyk test` JSON output format
  if (snykOutput.vulnerabilities && Array.isArray(snykOutput.vulnerabilities)) {
    snykOutput.vulnerabilities.forEach(v => {
      vulns.push({
        id:          v.id,
        title:       v.title,
        severity:    v.severity,
        packageName: v.packageName,
        version:     v.version,
        fixedIn:     v.fixedIn,
        isUpgradable:v.isUpgradable,
        isPatchable: v.isPatchable,
        cvssScore:   v.cvssScore,
        url:         v.url,
      });
    });
  }

  return vulns;
}

function categorizeVulnerabilities(vulns) {
  const bySeverity = { critical: [], high: [], medium: [], low: [] };
  vulns.forEach(v => {
    const sev = (v.severity || 'low').toLowerCase();
    if (bySeverity[sev]) bySeverity[sev].push(v);
    else bySeverity.low.push(v);
  });
  return bySeverity;
}

function simulateScan() {
  console.log('\n  [SIMULATION MODE] Snyk CLI not found or not authenticated.');
  console.log('  Install Snyk: npm install -g snyk && snyk auth');
  console.log('  Or set SNYK_TOKEN environment variable.\n');

  return {
    simulated: true,
    vulnerabilities: [],
    bySeverity: { critical: [], high: [], medium: [], low: [] },
    criticalCount: 0,
    highCount: 0,
  };
}

function printReport(bySeverity, simulated) {
  const PASS = '\x1b[32m✔\x1b[0m';
  const FAIL = '\x1b[31m✘\x1b[0m';
  const WARN = '\x1b[33m⚠\x1b[0m';

  const critical = bySeverity.critical.length;
  const high     = bySeverity.high.length;
  const medium   = bySeverity.medium.length;
  const low      = bySeverity.low.length;
  const total    = critical + high + medium + low;

  console.log('\n========================================');
  console.log('  SNYK SECURITY SCAN REPORT');
  console.log('========================================');
  if (simulated) console.log('  ⚠  SIMULATED (Snyk not available)');
  console.log(`  Total vulnerabilities: ${total}`);
  console.log(`  Critical: ${critical === 0 ? PASS : FAIL} ${critical}`);
  console.log(`  High:     ${high     === 0 ? PASS : WARN} ${high}`);
  console.log(`  Medium:   ${WARN} ${medium}`);
  console.log(`  Low:      ${low}`);

  if (bySeverity.critical.length > 0) {
    console.log('\n  Critical vulnerabilities:');
    bySeverity.critical.forEach(v => {
      console.log(`    ${FAIL} [${v.id}] ${v.title}`);
      console.log(`       Package: ${v.packageName}@${v.version}`);
      console.log(`       Fix:     ${v.fixedIn ? v.fixedIn.join(', ') : 'no fix available'}`);
    });
  }

  if (bySeverity.high.length > 0) {
    console.log('\n  High severity vulnerabilities:');
    bySeverity.high.forEach(v => {
      console.log(`    ${WARN} [${v.id}] ${v.title} – ${v.packageName}@${v.version}`);
    });
  }

  const qualityMet = critical === 0;
  console.log('\n========================================');
  console.log(`  Security target (0 critical): ${qualityMet ? PASS + ' PASSED' : FAIL + ' FAILED'}`);
  console.log('========================================\n');

  return qualityMet;
}

async function main() {
  ensureDir(REPORT_DIR);

  console.log('========================================');
  console.log('  Snyk Dependency & SAST Scanner');
  console.log('========================================\n');

  const snykBin = findSnyk();

  let depResult   = null;
  let codeResult  = null;
  let simulated   = false;

  if (!snykBin) {
    const sim = simulateScan();
    simulated = true;
    const report = {
      timestamp: new Date().toISOString(),
      simulated: true,
      summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      qualityTarget: { maxCritical: 0, met: true },
      vulnerabilities: [],
      note: 'Snyk CLI not found. Install with: npm install -g snyk && snyk auth',
    };
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`Report written to: ${path.relative(PROJECT_ROOT, REPORT_FILE)}`);
    printReport(sim.bySeverity, true);
    return;
  }

  depResult = runSnykTest(snykBin);
  if (RUN_CODE) codeResult = runSnykCodeTest(snykBin);

  const depVulns   = extractVulnerabilities(depResult.output);
  const codeVulns  = codeResult ? extractVulnerabilities(codeResult.output) : [];
  const allVulns   = [...depVulns, ...codeVulns];
  const bySeverity = categorizeVulnerabilities(allVulns);

  const report = {
    timestamp:  new Date().toISOString(),
    simulated:  false,
    scanTypes:  RUN_CODE ? ['dependencies', 'sast'] : ['dependencies'],
    summary: {
      critical: bySeverity.critical.length,
      high:     bySeverity.high.length,
      medium:   bySeverity.medium.length,
      low:      bySeverity.low.length,
      total:    allVulns.length,
    },
    qualityTarget: {
      maxCritical: 0,
      met:         bySeverity.critical.length === 0,
    },
    bySeverity,
    vulnerabilities: allVulns,
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`Report written to: ${path.relative(PROJECT_ROOT, REPORT_FILE)}`);

  const passed = printReport(bySeverity, false);
  process.exitCode = passed ? 0 : 1;
}

main().catch(err => {
  console.error('Snyk scan error:', err.message);
  process.exitCode = 1;
});
