# Hemoflow API Documentation

Welcome to the **Hemoflow REST API Specification**. This document provides detailed information on all available HTTP endpoints, authentication requirements, request/response formats, and error handling protocols.

---

## 1. Overview & Base Configuration

- **Base URL**: `http://localhost:5000/api`
- **Content-Type**: `application/json` (unless specified otherwise, e.g., `multipart/form-data` for file uploads)
- **CORS**: Enabled for frontend client integration.

---

## 2. Authentication

Hemoflow utilizes **JSON Web Tokens (JWT)** for stateless user session verification.

### Authentication Header Format
For protected endpoints, include the token in the HTTP `Authorization` request header:

```http
Authorization: Bearer <your_jwt_token>
```

---

## 3. Endpoints Reference

### A. Authentication Routes (`/api/auth`)

#### 1. Register User Account
Creates a new user account with hashed password storage (`bcrypt`).

- **Endpoint**: `POST /api/auth/register`
- **Authentication**: None Required
- **Request Body**:
```json
{
  "email": "patient@example.com",
  "password": "SecurePassword123"
}
```
- **Validation Rules**:
  - `email`: Must be a valid string containing `@`.
  - `password`: Must be a string with a minimum length of 6 characters.
- **Success Response** (`201 Created`):
```json
{
  "message": "Account created successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "user": {
    "id": 1,
    "email": "patient@example.com"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Duplicate email address or invalid payload formatting.
  - `500 Internal Server Error`: Server exception during user insertion.

---

#### 2. Authenticate User Login
Verifies user credentials and returns a JWT access token.

- **Endpoint**: `POST /api/auth/login`
- **Authentication**: None Required
- **Request Body**:
```json
{
  "email": "patient@example.com",
  "password": "SecurePassword123"
}
```
- **Success Response** (`200 OK`):
```json
{
  "message": "Logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "user": {
    "id": 1,
    "email": "patient@example.com"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Missing email or password fields.
  - `401 Unauthorized`: Invalid email or password credentials.

---

#### 3. Get Current User Profile
Retrieves the profile metadata for the currently authenticated session.

- **Endpoint**: `GET /api/auth/me`
- **Authentication**: Required (`Bearer <token>`)
- **Success Response** (`200 OK`):
```json
{
  "user": {
    "id": 1,
    "email": "patient@example.com",
    "created_at": "2026-08-25T12:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: Missing or expired token.
  - `404 Not Found`: Account no longer exists.

---

### B. Report Parsing & AI Analysis Route (`/api/analyze`)

#### Parse & Analyze Blood Report PDF
Uploads a diagnostic lab PDF report, extracts text coordinates deterministically, evaluates biomarker values against reference ranges, triggers Gemini AI clinical reasoning, and optionally persists results if authenticated.

- **Endpoint**: `POST /api/analyze`
- **Authentication**: Optional (`Bearer <token>`)
- **Content-Type**: `multipart/form-data`
- **Form Data Parameters**:
  | Parameter | Type | Required | Description |
  |---|---|---|---|
  | `pdf` | File | Yes | Diagnostic lab PDF report file (`.pdf`) |
  | `name` | String | No | Patient name (default: `"Anonymous"`) |
  | `age` | Number | No | Patient age |
  | `sex` | String | No | Patient biological sex (`"Male"`, `"Female"`, etc.) |
  | `fasting` | Boolean | No | Fasting state during test (`"true"` / `"false"`) |

- **Success Response** (`200 OK`):
```json
{
  "userContext": {
    "name": "Jane Doe",
    "age": 34,
    "sex": "Female",
    "fasting": true
  },
  "systemScores": {
    "Metabolic": { "score": 90, "status": "OPTIMAL" },
    "Lipid Profile": { "score": 75, "status": "MILD_DEVIATION" },
    "Hematology": { "score": 100, "status": "OPTIMAL" }
  },
  "flags": [
    {
      "name": "LDL Cholesterol",
      "value": 142,
      "unit": "mg/dL",
      "status": "HIGH",
      "range": { "low": 0, "high": 100 },
      "deviationPct": 42
    }
  ],
  "evaluatedMarkers": [ ... ],
  "geminiAnalysis": {
    "summary": "Mild elevation in LDL cholesterol observed...",
    "crossCorrelations": [ ... ],
    "recommendations": [ ... ]
  },
  "reportId": 12,
  "saved": true
}
```
- **Note on Non-Blocking Persistence**: If an authenticated request is submitted, Hemoflow automatically attempts to store the output in the database. If the DB store encounters an error, `saved: false` is returned, but the complete analysis object is never lost.

---

### C. Report Management Routes (`/api/reports`)

#### 1. List Historical Reports
Retrieves a list of all report metadata owned by the authenticated user, ordered newest first.

- **Endpoint**: `GET /api/reports`
- **Authentication**: Required (`Bearer <token>`)
- **Success Response** (`200 OK`):
```json
[
  {
    "id": 12,
    "original_filename": "blood_report_aug2026.pdf",
    "status": "COMPLETED",
    "created_at": "2026-08-25T14:30:00.000Z"
  },
  {
    "id": 8,
    "original_filename": "lab_report_jan2026.pdf",
    "status": "COMPLETED",
    "created_at": "2026-01-15T09:15:00.000Z"
  }
]
```

---

#### 2. Get Single Report Details
Fetches complete stored analysis data for a specific report ID.

- **Endpoint**: `GET /api/reports/:id`
- **Authentication**: Required (`Bearer <token>`)
- **Success Response** (`200 OK`):
```json
{
  "id": 12,
  "original_filename": "blood_report_aug2026.pdf",
  "status": "COMPLETED",
  "created_at": "2026-08-25T14:30:00.000Z",
  "analysis_data": {
    "userContext": { ... },
    "systemScores": { ... },
    "flags": [ ... ],
    "evaluatedMarkers": [ ... ],
    "geminiAnalysis": { ... }
  }
}
```
- **Error Responses**:
  - `404 Not Found`: Report does not exist or belongs to another user (owner isolation).

---

#### 3. Delete Historical Report
Permanently removes a report owned by the authenticated user.

- **Endpoint**: `DELETE /api/reports/:id`
- **Authentication**: Required (`Bearer <token>`)
- **Success Response** (`200 OK`):
```json
{
  "message": "Report deleted successfully.",
  "id": 12
}
```
- **Error Responses**:
  - `404 Not Found`: Report ID not found or user does not have owner permission to delete.

---

## 4. Error Handling Standard

All API errors return a standard JSON error envelope:

```json
{
  "error": "Descriptive human-readable error message."
}
```

### Standard HTTP Status Codes
| Status Code | Description |
|---|---|
| `200 OK` | Request processed successfully. |
| `201 Created` | Resource created successfully. |
| `400 Bad Request` | Invalid payload or missing parameters. |
| `401 Unauthorized` | Invalid, missing, or expired JWT token. |
| `404 Not Found` | Requested resource could not be found. |
| `500 Internal Server Error` | Unexpected server failure. |
