# Campus Internship & Placement Recruitment Portal

A full-stack Next.js 14 (App Router) campus recruitment and internship management platform powered by a polyglot persistence architecture:
- **MySQL 8.0**: ACID-compliant relational data, triggers, stored procedures, tier-lock constraints, and views.
- **Neo4j**: Graph database for peer-based collaborative filtering recommendations and student saved bookmarks.
- **Redis**: High-performance in-memory cache with 60-second TTL for student opportunity queries with event-driven invalidation.

---

## Prerequisites

- **Node.js** (v18.17+ or v20+)
- **MySQL Server 8.0+** running on `127.0.0.1:3306`
- **Neo4j 5+** running on `bolt://127.0.0.1:7687`
- **Redis 7+** (via Docker or native service) running on `127.0.0.1:6379`

---

## 1. Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

Ensure the connection variables match your environment:
```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=internship_recruitment_db

SESSION_SECRET=change-this-to-any-long-random-text

REDIS_URL=redis://127.0.0.1:6379

NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
```

---

## 2. MySQL Database Setup

Execute the schema, routines, and seed data scripts in order:

```powershell
# From the placement-portal directory:
mysql -u root -p -e "source db/01_schema.sql"
mysql -u root -p -e "source db/02_routines.sql"
mysql -u root -p -e "source db/03_seed.sql"
mysql -u root -p -e "source db/04_advanced_queries.sql"
```

---

## 3. Redis Setup

Start Redis using Docker Compose:

```powershell
docker compose up -d
```

*(Alternatively, run `redis-server` locally on port 6379).*

---

## 4. Neo4j Graph Setup & Sync

1. Start your Neo4j DBMS instance (listening on port 7687).
2. Run the graph synchronization script to project MySQL data into Neo4j:

```powershell
node --env-file=.env.local scripts/sync_neo4j.mjs
```

This builds uniqueness constraints on `Student(id)` and `Opportunity(id)` and syncs:
- `(:Student {id, name, cgpa, branch})`
- `(:Opportunity {id, title, tier, type, company, open})`
- `(:Student)-[:APPLIED {status}]->(:Opportunity)`

---

## 5. Next.js Application Setup & Development

Install dependencies and start the Next.js development server:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Demo Accounts

All demo accounts share the password: **`demo123`**

- **Placement Officer**: `officer`
- **Students**: `student1` through `student200`
- **Recruiters**: `recruiter1` through `recruiter32`
