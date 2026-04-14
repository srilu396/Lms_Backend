# LMS Backend
> A robust Learning Management System (LMS) Backend API built with Node.js and PostgreSQL.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Getting Started — Clone & Install](#getting-started--clone--install)
- [Folder Structure](#folder-structure)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [How to Test APIs](#how-to-test-apis)
- [Database & Migrations](#database--migrations)
- [Contributing](#contributing)
- [License](#license)

## Overview
LMS Backend is a comprehensive RESTful API designed to power Learning Management Systems. It handles core entities like courses, modules, lessons, assignments, quizzes, enrollments, students, and tutors. Built with performance and security in mind, it provides robust role-based access control, secure authentication, and a solid database foundation using Sequelize ORM.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-52B0E7?style=for-the-badge&logo=sequelize&logoColor=white)

## Prerequisites
- **Node.js**: >= 18.x
- **PostgreSQL**: >= 14.x
- **npm**: >= 8.x

## Getting Started — Clone & Install
```bash
# Clone the repository
git clone https://github.com/your-org/lms-backend.git
cd lms-backend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
```

## Environment Variables
Create a `.env` file in the root directory. Below are the typical environment variables required for the backend to run:

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | API Port | `3000` |
| `DB_HOST` | Database host URL | `127.0.0.1` |
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASS` | PostgreSQL password | `secret` |
| `DB_NAME` | Database name | `lms_db` |
| `JWT_SECRET` | Secret key for JWT tokens | `supersecretkey123` |

## Folder Structure
```text
LMS_Backend/
├── Course_API.postman_collection.json  # Exported Postman collection for API testing
├── package.json                        # Project dependencies and npm scripts
├── scripts/                            # Custom utility and DB syncing scripts
├── src/                                # Main application source code
│   ├── config/                         # Database and environment configurations
│   ├── controllers/                    # Route controllers (auth, course, quiz, etc.)
│   ├── db/                             # Database connection setup
│   ├── middlewares/                    # Express middlewares (auth, validation, error)
│   ├── migrations/                     # Sequelize migration files for DB schema
│   ├── models/                         # Sequelize database models
│   ├── routes/                         # Express API route definitions
│   ├── seeders/                        # Database seed files
│   ├── services/                       # Business logic and reusable service layers
│   ├── utils/                          # Helper functions and utilities
│   └── index.js                        # Application entry point
└── schema.sql                          # Raw SQL dump/schema
```

## Running the App

```bash
# Development (with nodemon auto-reload)
npm run dev

# Production start
npm start
```

## API Reference
The API is divided into multiple entities (auth, courses, quizzes, assignments, users, etc.). Below is a representative block of core operations.

### POST /api/auth/login
**Description:** Authenticates a user and returns a JWT token.
**Auth:** None
**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | The user's registered email |
| `password` | string | Yes | The user's secure password |

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@example.com", "password": "password123"}'
```
**Example Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6Ik...",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "role": "student"
  }
}
```

### GET /api/courses
**Description:** Retrieves a paginated list of available courses.
**Auth:** Bearer Token (Student/Admin)
**Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | No | Page number for pagination |
| `limit` | number | No | Items per page |

**Example Request:**
```bash
curl -X GET 'http://localhost:3000/api/courses?page=1&limit=10' \
  -H "Authorization: Bearer <your_jwt_token>"
```

## How to Test APIs
- **Postman:** Import the `Course_API.postman_collection.json` file found in the root of the workspace into Postman to explore and test the available course-related endpoints.
- **Health Check:** Ensure the server is running by hitting the root/ping endpoint.
  ```bash
  curl -X GET http://localhost:3000/
  ```

## Database & Migrations
This project uses Sequelize as its ORM. Ensure you have created your database in PostgreSQL before running migrations.

```bash
# Run all pending migrations
npm run migrate

# Rollback the last migration
npm run migrate:undo

# Run database synchronization/schema scripts (custom)
node scripts/sync_db.js
node scripts/sync-quiz-schema.js
```

## Contributing
1. Feature branches should be named descriptively: `feat/add-quiz-timer` or `fix/user-login`.
2. Follow Conventional Commits for commit messages (e.g., `feat: added bulk create for students`).
3. Ensure all tests and linting pass before opening a Pull Request.

## License
ISC License

Copyright (c) 2026

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.