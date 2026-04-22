#!/usr/bin/env bash
# =============================================================================
# run-qa.sh – Master QA Execution Script
# Exercise 4: Complete QA Automation System
#
# Runs all QA checks in sequence and generates a consolidated dashboard:
#   1. Unit tests (POM framework) with coverage
#   2. ESLint code quality analysis
#   3. Cyclomatic complexity check
#   4. OWASP ZAP security scan (requires ZAP daemon)
#   5. Snyk dependency scan (requires Snyk auth)
#   6. k6 performance tests (requires k6 binary)
#   7. Quality dashboard generation
#
# Usage:
#   chmod +x Exercise_4/scripts/run-qa.sh
#   ./Exercise_4/scripts/run-qa.sh [--skip-security] [--skip-performance] [--ci]
#
# Options:
#   --skip-security     Skip ZAP and Snyk scans (useful without external services)
#   --skip-performance  Skip k6 performance tests (useful without k6 installed)
#   --ci                CI mode: exit with error code on any gate failure
#
# Environment variables:
#   APP_URL             Target application URL  (default: http://localhost:3000)
#   ZAP_HOST            OWASP ZAP host          (default: localhost)
#   ZAP_PORT            OWASP ZAP port          (default: 8080)
#   ZAP_API_KEY         OWASP ZAP API key       (default: empty)
#   SNYK_TOKEN          Snyk authentication token
#   VIRTUAL_USERS       k6 virtual users        (default: 10)
#   DURATION            k6 test duration        (default: 30s)
# =============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EX4_DIR="${PROJECT_ROOT}/Exercise_4"
REPORT_DIR="${EX4_DIR}/reports"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Flags
SKIP_SECURITY=false
SKIP_PERFORMANCE=false
CI_MODE=false

for arg in "$@"; do
  case "$arg" in
    --skip-security)    SKIP_SECURITY=true    ;;
    --skip-performance) SKIP_PERFORMANCE=true ;;
    --ci)               CI_MODE=true          ;;
  esac
done

# ── Tracking ───────────────────────────────────────────────────────────────────

declare -A STEP_RESULTS   # step_name -> PASS|FAIL|SKIP|WARN
OVERALL_PASSED=true
START_TIME=$(date +%s)

# ── Helpers ────────────────────────────────────────────────────────────────────

log_header() {
  echo ""
  echo -e "${CYAN}${BOLD}================================================================${RESET}"
  echo -e "${CYAN}${BOLD}  $1${RESET}"
  echo -e "${CYAN}${BOLD}================================================================${RESET}"
}

log_step() {
  echo -e "\n${BLUE}▶  $1${RESET}"
}

log_pass() {
  echo -e "   ${GREEN}✔  $1${RESET}"
  STEP_RESULTS["$2"]="PASS"
}

log_fail() {
  echo -e "   ${RED}✘  $1${RESET}"
  STEP_RESULTS["$2"]="FAIL"
  OVERALL_PASSED=false
}

log_skip() {
  echo -e "   ${YELLOW}⏭  $1 (skipped)${RESET}"
  STEP_RESULTS["$2"]="SKIP"
}

log_warn() {
  echo -e "   ${YELLOW}⚠  $1${RESET}"
  STEP_RESULTS["$2"]="WARN"
}

require_node() {
  if ! command -v node &>/dev/null; then
    echo -e "${RED}ERROR: Node.js is required but not found. Install Node.js 18+.${RESET}"
    exit 1
  fi
}

ensure_reports_dir() {
  mkdir -p "${REPORT_DIR}/screenshots"
}

# ── Step 1: Unit tests (POM + Jest) ────────────────────────────────────────────

run_unit_tests() {
  log_step "Running unit tests (POM framework)..."
  cd "${PROJECT_ROOT}"

  # Collect Jest coverage and save summary
  if node_modules/.bin/jest \
      --testMatch "**/Exercise_4/tests/unit/**/*.test.js" \
      --coverage \
      --coverageReporters json-summary text \
      --coverageDirectory Exercise_4/reports/coverage \
      --runInBand \
      --forceExit 2>&1; then

    # Copy coverage summary for dashboard
    if [ -f "Exercise_4/reports/coverage/coverage-summary.json" ]; then
      cp "Exercise_4/reports/coverage/coverage-summary.json" \
         "Exercise_4/reports/jest-coverage-summary.json"
    fi
    log_pass "Unit tests passed" "unit_tests"
  else
    log_fail "Unit tests failed" "unit_tests"
  fi
}

# ── Step 2: ESLint ─────────────────────────────────────────────────────────────

run_eslint() {
  log_step "Running ESLint code quality check..."
  cd "${PROJECT_ROOT}"

  if node Exercise_4/quality/eslint-report.js 2>&1; then
    log_pass "ESLint passed (0 errors)" "eslint"
  else
    log_warn "ESLint reported issues (see reports/eslint-report.json)" "eslint"
  fi
}

# ── Step 3: Complexity check ───────────────────────────────────────────────────

run_complexity() {
  log_step "Running cyclomatic complexity analysis..."
  cd "${PROJECT_ROOT}"

  if node Exercise_4/quality/complexity-check.js --threshold 10 2>&1; then
    log_pass "Complexity check passed (all functions <10)" "complexity"
  else
    log_fail "Complexity violations found (see reports/complexity-report.json)" "complexity"
  fi
}

# ── Step 4: OWASP ZAP security scan ───────────────────────────────────────────

run_zap_scan() {
  if [ "${SKIP_SECURITY}" = true ]; then
    log_skip "OWASP ZAP scan" "zap"
    return
  fi

  log_step "Running OWASP ZAP security scan..."
  cd "${PROJECT_ROOT}"

  if node Exercise_4/security/zap-scan.js 2>&1; then
    log_pass "ZAP scan passed (0 critical vulnerabilities)" "zap"
  else
    log_fail "ZAP scan found critical vulnerabilities (see reports/zap-security-report.json)" "zap"
  fi
}

# ── Step 5: Snyk dependency scan ──────────────────────────────────────────────

run_snyk_scan() {
  if [ "${SKIP_SECURITY}" = true ]; then
    log_skip "Snyk dependency scan" "snyk"
    return
  fi

  log_step "Running Snyk dependency vulnerability scan..."
  cd "${PROJECT_ROOT}"

  if node Exercise_4/security/snyk-scan.js 2>&1; then
    log_pass "Snyk scan passed (0 critical vulnerabilities)" "snyk"
  else
    log_fail "Snyk found critical vulnerabilities (see reports/snyk-security-report.json)" "snyk"
  fi
}

# ── Step 6: k6 performance tests ──────────────────────────────────────────────

run_performance() {
  if [ "${SKIP_PERFORMANCE}" = true ]; then
    log_skip "k6 performance tests" "performance"
    return
  fi

  log_step "Running k6 performance tests..."

  if ! command -v k6 &>/dev/null; then
    log_warn "k6 not installed – performance tests skipped. Install: brew install k6" "performance"
    return
  fi

  cd "${PROJECT_ROOT}"
  local k6_args=(
    "run"
    "--out" "json=Exercise_4/reports/k6-raw.json"
    "--env" "APP_URL=${APP_URL:-http://localhost:3000}"
    "--env" "VIRTUAL_USERS=${VIRTUAL_USERS:-10}"
    "--env" "DURATION=${DURATION:-30s}"
    "Exercise_4/performance/checkout-load.js"
  )

  if k6 "${k6_args[@]}" 2>&1; then
    log_pass "k6 performance tests passed (p95 <500ms, error rate <1%)" "performance"
  else
    log_fail "k6 performance tests failed thresholds (see reports/k6-summary.json)" "performance"
  fi
}

# ── Step 7: Generate quality dashboard ────────────────────────────────────────

run_dashboard() {
  log_step "Generating quality dashboard..."
  cd "${PROJECT_ROOT}"

  if node Exercise_4/reports/dashboard.js 2>&1; then
    log_pass "Dashboard generated: Exercise_4/reports/qa-dashboard.html" "dashboard"
  else
    log_warn "Dashboard generation encountered issues" "dashboard"
  fi
}

# ── Final summary ──────────────────────────────────────────────────────────────

print_summary() {
  local END_TIME
  END_TIME=$(date +%s)
  local ELAPSED=$(( END_TIME - START_TIME ))

  echo ""
  echo -e "${BOLD}================================================================${RESET}"
  echo -e "${BOLD}  QA SUITE EXECUTION SUMMARY${RESET}"
  echo -e "${BOLD}================================================================${RESET}"
  echo -e "  Total time: ${ELAPSED}s"
  echo ""

  local step_labels=(
    "unit_tests:Unit Tests (POM + Coverage)"
    "eslint:ESLint Code Quality"
    "complexity:Complexity Check"
    "zap:OWASP ZAP Security Scan"
    "snyk:Snyk Dependency Scan"
    "performance:k6 Performance Tests"
    "dashboard:QA Dashboard Generation"
  )

  for entry in "${step_labels[@]}"; do
    local key="${entry%%:*}"
    local label="${entry#*:}"
    local result="${STEP_RESULTS[$key]:-UNKNOWN}"
    case "$result" in
      PASS)    echo -e "  ${GREEN}✔${RESET}  ${label}" ;;
      FAIL)    echo -e "  ${RED}✘${RESET}  ${label}" ;;
      SKIP)    echo -e "  ${YELLOW}⏭${RESET}  ${label} (skipped)" ;;
      WARN)    echo -e "  ${YELLOW}⚠${RESET}  ${label} (warnings)" ;;
      UNKNOWN) echo -e "  ${YELLOW}—${RESET}  ${label} (not run)" ;;
    esac
  done

  echo ""
  echo -e "${BOLD}================================================================${RESET}"
  if [ "${OVERALL_PASSED}" = true ]; then
    echo -e "  ${GREEN}${BOLD}✔  ALL QUALITY GATES PASSED${RESET}"
  else
    echo -e "  ${RED}${BOLD}✘  QUALITY GATES FAILED${RESET}"
  fi
  echo -e "${BOLD}================================================================${RESET}"
  echo ""
  echo -e "  Reports: ${PROJECT_ROOT}/Exercise_4/reports/"
  echo -e "  Dashboard: Exercise_4/reports/qa-dashboard.html"
  echo ""

  # Quality metrics targets summary
  echo -e "${BOLD}  Quality Metrics Targets:${RESET}"
  echo -e "  ┌─────────────────────────────────────────┐"
  echo -e "  │  Test Coverage        target: ≥80%      │"
  echo -e "  │  Code Complexity      target: <10        │"
  echo -e "  │  Security (Critical)  target: 0          │"
  echo -e "  │  Response Time (p95)  target: <500ms     │"
  echo -e "  │  Error Rate           target: <1%        │"
  echo -e "  └─────────────────────────────────────────┘"
  echo ""

  if [ "${CI_MODE}" = true ] && [ "${OVERALL_PASSED}" = false ]; then
    exit 1
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────────

main() {
  log_header "MODULE 8 – EXERCISE 4: COMPLETE QA AUTOMATION SUITE"
  echo -e "  Target: ${APP_URL:-http://localhost:3000}"
  echo -e "  Skip security:    ${SKIP_SECURITY}"
  echo -e "  Skip performance: ${SKIP_PERFORMANCE}"
  echo -e "  CI mode:          ${CI_MODE}"

  require_node
  ensure_reports_dir

  run_unit_tests
  run_eslint
  run_complexity
  run_zap_scan
  run_snyk_scan
  run_performance
  run_dashboard

  print_summary
}

main
