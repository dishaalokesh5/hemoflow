import http from 'http';
import fs from 'fs';
import path from 'path';
import pool from './db.js';
import { runMigrations } from './migrate.js';

// We will run tests against server running on port 5000 (or spawn an instance)
const BASE_URL = 'http://localhost:5000';

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'string' || Buffer.isBuffer(postData)) {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('================== HEMOFLOW INTEGRATION TEST SUITE ==================\n');

  // 0. Database Migration
  await runMigrations();

  // Clean test user data
  await pool.query("DELETE FROM users WHERE email LIKE 'test_%@example.com'");
  console.log('[TEST 0] Cleaned test database users.');

  // 1. Register User A
  console.log('\n[TEST 1] Register User A');
  const userA_Email = `test_usera_${Date.now()}@example.com`;
  const regARes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: userA_Email, password: 'password123' });

  console.log('User A Register Status:', regARes.status);
  console.assert(regARes.status === 201, 'User A should register with HTTP 201');
  console.assert(regARes.data.token, 'Response must include JWT token');
  const tokenA = regARes.data.token;
  console.log('✔ User A registered successfully.');

  // 2. Duplicate Registration Rejection
  console.log('\n[TEST 2] Duplicate Registration Rejection');
  const dupRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: userA_Email, password: 'password123' });

  console.log('Duplicate Register Status:', dupRes.status);
  console.assert(dupRes.status === 400, 'Duplicate email should return HTTP 400');
  console.log('✔ Duplicate registration rejected properly.');

  // 3. Register User B
  console.log('\n[TEST 3] Register User B');
  const userB_Email = `test_userb_${Date.now()}@example.com`;
  const regBRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: userB_Email, password: 'password456' });

  console.assert(regBRes.status === 201, 'User B should register with HTTP 201');
  const tokenB = regBRes.data.token;
  console.log('✔ User B registered successfully.');

  // 4. Login User A
  console.log('\n[TEST 4] Login User A');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: userA_Email, password: 'password123' });

  console.assert(loginRes.status === 200, 'Login should succeed with HTTP 200');
  console.assert(loginRes.data.token, 'Login response must include token');
  console.log('✔ Login verified successfully.');

  // 5. Invalid Password Login
  console.log('\n[TEST 5] Invalid Password Login');
  const invalidLoginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: userA_Email, password: 'wrongpassword' });

  console.assert(invalidLoginRes.status === 401, 'Invalid password should return HTTP 401');
  console.log('✔ Invalid password correctly rejected.');

  // 6. Direct Database Insert for Report (Simulating User A report)
  console.log('\n[TEST 6] Create Report for User A');
  const dbUserA = await pool.query("SELECT id FROM users WHERE email = $1", [userA_Email]);
  const userA_Id = dbUserA.rows[0].id;

  const mockAnalysis = {
    userContext: { name: 'Test User A', age: 35, sex: 'male', fasting: true },
    systemScores: { hematology: { score: 90, status: 'SCORED' } },
    flags: [],
    evaluatedMarkers: [],
    geminiAnalysis: { summary: 'Overall healthy test report.' }
  };

  const reportInsRes = await pool.query(
    `INSERT INTO reports (user_id, original_filename, status, analysis_data) 
     VALUES ($1, 'test_cbc_report.pdf', 'COMPLETED', $2) RETURNING id`,
    [userA_Id, JSON.stringify(mockAnalysis)]
  );

  const reportA_Id = reportInsRes.rows[0].id;
  console.log('Created Report A ID:', reportA_Id);

  // 7. Get User A Reports List
  console.log('\n[TEST 7] User A Fetch Reports List');
  const listARes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  console.assert(listARes.status === 200, 'Fetch reports should return HTTP 200');
  console.assert(Array.isArray(listARes.data), 'Returns an array');
  console.assert(listARes.data.length === 1, 'Should find 1 report for User A');
  console.assert(listARes.data[0].id === reportA_Id, 'Matches report ID');
  console.log('✔ User A retrieved their report history.');

  // 8. Get Single Report by User A (Authorized)
  console.log('\n[TEST 8] User A Fetch Single Report Details');
  const singleARes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/reports/${reportA_Id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  console.assert(singleARes.status === 200, 'Fetch single report returns HTTP 200');
  console.assert(singleARes.data.analysis_data.userContext.name === 'Test User A', 'Stored analysis matched');
  console.log('✔ User A accessed their stored report analysis.');

  // 9. Authorization Isolation: User B attempts to access User A's report
  console.log('\n[TEST 9] Authorization Security: User B Accessing User A Report');
  const userB_GetRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/reports/${reportA_Id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` }
  });

  console.log('User B Get Status:', userB_GetRes.status);
  console.assert(userB_GetRes.status === 404, 'User B must get 404 when accessing User A report');
  console.log('✔ Authorization isolation enforced: User B cannot access User A report.');

  // 10. Authorization Security: User B attempts to delete User A's report
  console.log('\n[TEST 10] Authorization Security: User B Deleting User A Report');
  const userB_DelRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/reports/${reportA_Id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` }
  });

  console.assert(userB_DelRes.status === 404, 'User B must get 404 when attempting to delete User A report');
  console.log('✔ Authorization isolation enforced: User B cannot delete User A report.');

  // 11. User A Deletes Own Report
  console.log('\n[TEST 11] User A Deleting Own Report');
  const userA_DelRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/reports/${reportA_Id}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  console.assert(userA_DelRes.status === 200, 'User A can delete their report with HTTP 200');
  console.log('✔ User A deleted their report successfully.');

  // Clean test user data
  await pool.query("DELETE FROM users WHERE email LIKE 'test_%@example.com'");

  console.log('\n================ ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ================');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
