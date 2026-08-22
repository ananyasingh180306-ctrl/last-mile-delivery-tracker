# Last-Mile Delivery Tracker

A logistics delivery management platform that provides dynamic agent dispatching, transparent rate calculations, and real-time package tracking.

---

## Technical Highlights

1. **Price Engine Correctness**: Supports B2B and B2C volumetric billing:
   $$\text{billable weight} = \max(\text{actual weight}, \frac{L \times B \times H}{5000})$$
   Calculations are saved as immutable JSON snapshots inside the order to prevent changes if rate cards are updated later.
2. **Zone Routing & Dynamic Pincodes**: Detects local vs cross-town deliveries (Intra-zone vs Inter-zone) based on area-pincode zone mapping. The customer dashboard dynamically loads active pincodes from the database rather than using hardcoded values.
3. **Real-time SMTP Email Notifications**: Integrated Nodemailer supporting real-world SMTP setups (such as Gmail App Passwords and Mailtrap sandboxes) to notify customers and agents of order status transitions, dispatches, and rescheduling.
4. **Capacity-Safe Re-assignment & Dispatching**: Dispatches agents using geodetic Haversine distance weighted by current capacity load factor:
   $$\text{score} = \text{distance} \times \left(1 + \frac{\text{activeCount}}{\text{maxConcurrent}}\right)$$
   Wrapped in a database transaction with `FOR UPDATE` row locking to prevent double-booking agents. Admins can manually re-assign active orders between agents, automatically releasing workload capacity from the old agent and transferring it to the new agent dynamically.
5. **Real-time Synchronization**: Powered by Socket.io, status changes push instant updates to the customer's timeline animations without polling.
6. **Append-Only Auditing**: Every state change is recorded in an immutable `OrderStatusHistory` table.
7. **Failed Attempt Rescheduling**: Failed deliveries trigger automated notifications. Customers can reschedule attempts, releasing the previous agent and queuing the order for new dispatch.

---

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: Prisma ORM (SQLite for zero-dependency local setup, PostgreSQL supported out-of-the-box)
- **Frontend**: React (Vite) + Tailwind CSS + Socket.io-client
- **Testing**: Jest unit tests

---

## Quick Start (Local Setup)

### Prerequisites
- Node.js (v20+ recommended)
- npm

### 1. Configure Database & Environment
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. (Optional) Configure **SMTP credentials** in `.env` to test real email notifications (leaves mock fallback on by default if omitted):
   ```env
   SMTP_HOST="sandbox.smtp.mailtrap.io"
   SMTP_PORT=2525
   SMTP_USER="your-smtp-username"
   SMTP_PASS="your-smtp-password"
   ```
4. Initialize the SQLite database and generate the Prisma Client:
   ```bash
   npx prisma db push
   ```
5. Seed the database with admin, customers, agents, zones, and rate configurations:
   ```bash
   npm run prisma:seed
   ```

### 2. Run the Backend API
Start the backend server on port `5000`:
```bash
npm run dev
```
Swagger API docs will be available at: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

### 3. Run the Frontend Dashboard
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Access the application at: [http://localhost:3000](http://localhost:3000)

---

## Running Unit Tests

Run the rate calculation engine Jest test suite:
```bash
cd backend
```
```bash
npm test
```
The test suite dynamically creates an isolated absolute test SQLite database, runs schema push, seeds rate parameters, runs billing scenarios, assertions, and cleans up the test files.

---

## Seed Credentials (Password: `123456`)

| Role | Username / Email | Details |
|---|---|---|
| **Admin** | `admin@lastmile.com` | Can manage zones, rates, override statuses, assign/re-assign agents, reset passwords, and register new delivery agent profiles. |
| **Customer** | `customer@gmail.com` | Can place orders (via dynamically loaded pincodes), view live tracking timelines, and reschedule failed deliveries. |
| **Agent 1** | `agent1@lastmile.com` | Covers Zone 1 & Zone 2. Located in Central Bangalore. |
| **Agent 2** | `agent2@lastmile.com` | Covers Zone 2 & Zone 3. Located in Indiranagar. |
| **Agent (Real Email)** | `ananya183singh@gmail.com` | Covers all 3 zones. Setup for real-time notification email testing. |

---

## Docker Compose Setup

Launch the full Postgres + Backend + Frontend stack in one click:
```bash
docker-compose up --build
```
- **Frontend URL**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`
- **Postgres Database Port**: `5432`
