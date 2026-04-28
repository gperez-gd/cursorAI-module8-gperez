================================================================================
Exercise 1: Generate Test Cases for E-Commerce Checkout
================================================================================

Core Prompt:
Generate comprehensive test cases for an e-commerce checkout process. Include test 
cases for adding items to cart, applying discount codes, payment processing, order 
confirmation, and email notifications. Cover positive scenarios, negative scenarios, 
edge cases (empty cart, invalid payment), and security scenarios (payment data 
validation, SQL injection prevention).


Expected Deliverables:
 - 30+ test cases across all categories
 - Positive test cases (successful checkout flow)
 - Negative test cases (payment failures, invalid codes)
 - Edge cases (cart limits, concurrent purchases)
 - Security test cases (PCI compliance, data validation)
 - Automated test scripts in Jest or pytest
 - Test data generation strategy

Acceptance Criteria:
 - All critical checkout paths covered
 - Payment security validated
 - Error handling tested
 - Test scripts executable and passing


================================================================================
Exercise 2: API Test Suite Generation
================================================================================
Objective: Generate automated API test suite for a REST API.

Core Prompt:
Generate a comprehensive API test suite for a REST API with endpoints for user 
management, product catalog, and orders. Include tests for GET, POST, PUT, DELETE 
operations. Test authentication, authorization, input validation, error responses, 
rate limiting, and performance (response time under 500ms).

Test Categories to Include:
 - Authentication tests (valid/invalid tokens)
 - Authorization tests (role-based access)
 - CRUD operation tests
 - Input validation tests
 - Error handling tests (404, 400, 500)
 - Performance tests (response time)
 - Rate limiting tests

================================================================================
Exercise 3: Optimize Your CI/CD Pipeline
================================================================================
Analyze this GitHub Actions workflow @module8-project/.github/workflows/ci-cd.yml and optimize it. Add dependency caching, 
split tests into parallel jobs, add security scanning (Snyk, npm audit), implement 
Docker layer caching, add deployment health checks, and set up Slack notifications 
for failures. Target: reduce pipeline time by 50%.

================================================================================
Exercise 4: Build a Complete QA System
================================================================================
Objective: Implement a comprehensive QA automation system for the project.

Core Prompt:
Create a complete QA automation system with test automation framework using Page 
Object Model, automated code quality checks with ESLint/Pylint, security scanning 
with OWASP ZAP and Snyk, performance testing with k6, quality dashboard with metrics 
visualization, and automated report generation. Include scripts to run all checks.

Deliverables:
 - Test automation framework (Page Object Model)
 - Code quality automation (linting, complexity)
 - Security scanning automation
 - Performance testing scripts
 - Quality dashboard (HTML report)
 - Master execution script
 - Documentation for running QA suite

Quality Metrics to Track:
 - Test coverage (target: 80%+)
 - Code complexity (target: <10)
 - Security vulnerabilities (target: 0 critical)
 - Response time (target: <500ms)
 - Error rate (target: <1%)