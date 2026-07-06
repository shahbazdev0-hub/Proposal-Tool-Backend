# Commission Tracker — Backend

REST API for the Commission Tracker application. Built with **NestJS 11**, **MongoDB Atlas**, and **JWT authentication**.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (Node.js) |
| Language | TypeScript |
| Database | MongoDB Atlas (Mongoose ODM) |
| Auth | JWT (passport-jwt) |
| Validation | class-validator / class-transformer |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string — generate with command below |
| `JWT_EXPIRES_IN` | Token lifetime e.g. `8h` |
| `CORS_ORIGIN` | Frontend URL e.g. `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Email for the first admin account |
| `SEED_ADMIN_PASSWORD` | Password for the first admin account |
| `SEED_ADMIN_NAME` | Display name for the first admin account |

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 3. Run the development server

```bash
npm run start:dev
```

API is available at `http://localhost:4000/api`

### 4. Seed the database

Create the first Admin account (run once):
```bash
npm run seed
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled production build |
| `npm run seed` | Create first Admin account (idempotent) |
| `npm run seed:test` | Seed test users and sample sales |
| `npm run lint` | ESLint |

## Project Structure

```
src/
├── auth/           # JWT login, strategy, guards
├── users/          # User CRUD, role management
├── sales/          # Sale creation, commission engine
├── packages/       # Product packages (Supreme / Homewater)
├── adders/         # Add-on options for packages
├── financiers/     # Financing options
├── dashboard/      # Per-role commission aggregations
├── payroll/        # Payroll export (date-filtered)
├── common/         # Shared guards, decorators, enums
├── config/         # ENV validation & config factory
└── seed/           # Database seed scripts
```

## API Endpoints

All routes are prefixed with `/api`.

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Get JWT token |
| GET | `/users` | Admin, Ops | List all users |
| POST | `/users` | Admin | Create user |
| PATCH | `/users/:id` | Admin | Update user |
| GET | `/dashboard/me` | All | Personal commission summary |
| GET | `/sales` | Admin, Ops | List all sales |
| POST | `/sales` | Rep | Submit a sale |
| GET | `/packages` | All | List products |
| GET | `/payroll` | Admin | Payroll export |

## Roles

| Role | Description |
|---|---|
| `admin` | Full access, sees Nick's override field |
| `ops` | Read-only across all data |
| `rep` | Submits sales, sees own dashboard |
| `recruiter` | Sees own + downline commissions |
| `teamlead` | Sees own + downline commissions |
| `regional` | Sees own + downline commissions |
| `partner` | Sees own + downline commissions |

## Production Deployment (PM2)

```bash
npm run build
pm2 start dist/main.js --name commission-tracker-api
```
