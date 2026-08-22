# Last-Mile Delivery Tracker

A logistics delivery management platform that provides dynamic agent dispatching, transparent rate calculations, and real-time package tracking.

<p align="left">
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-39827B?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101" alt="Socket.io" />
  <img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/-jest-%23C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest" />
  <img src="https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

---

## 📖 Table of Contents
1. [Setup Guide (Local Installation)](#-setup-guide-local-installation)
2. [Environment Configuration (`.env.example`)](#-environment-configuration-enevexample)
3. [Database Schema (Data Modeling)](#-database-schema-data-modeling)
4. [Rate Calculation Logic Explanation](#-rate-calculation-logic-explanation)
5. [API Documentation (Backend Endpoints)](#-api-documentation-backend-endpoints)
6. [System Design Write-Up (Evaluation Special)](#-system-design-write-up-evaluation-special)
   - [Rate Calculation Engine](#1-rate-calculation-engine)
   - [Zone Detection Approach](#2-zone-detection-approach)
   - [Auto-Assignment Logic & Availability Modeling](#3-auto-assignment-logic--availability-modeling)
   - [Failed Delivery & Rescheduling Flow](#4-failed-delivery--rescheduling-flow)

---

## 💻 Setup Guide (Local Installation)

### Prerequisites
- Node.js (v20+ recommended)
- npm

### 1. Backend Server Setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. Initialize the SQLite database and generate the Prisma Client:
   ```bash
   npx prisma db push
   ```
4. Seed the database with default rates, zones, and users:
   ```bash
   npm run prisma:seed
   ```
5. Start the backend development server on port `5000`:
   ```bash
   npm run dev
   ```

### 2. Frontend App Setup
1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Access the application in your browser at: **[http://localhost:3000](http://localhost:3000)**.

---

## 🔑 Environment Configuration (`.env.example`)

Create a `.env` file inside the `backend/` directory using the template below:

```env
# Server Configuration
PORT=5000
NODE_ENV="development"

# SQLite Local Database
DATABASE_URL="file:./dev.db"

# JWT Authentication
JWT_SECRET="super-secret-key-for-last-mile-delivery-tracker-12345"

# (Optional) SMTP Mail Server Config - Hook up Mailtrap or Gmail here
SMTP_HOST="sandbox.smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="your-smtp-username"
SMTP_PASS="your-smtp-password"
```

---

## 🗄️ Database Schema (Data Modeling)

The SQLite relational database is mapped using the following Prisma Schema:

### 1. `User` Model
*Stores authentication credentials and permissions roles.*
- `id` (String, UUID, Primary Key)
- `email` (String, Unique)
- `passwordHash` (String)
- `role` (String: `ADMIN`, `CUSTOMER`, `AGENT`)
- `createdAt` (DateTime)

### 2. `Agent` Model
*Stores the current location, status, and workload details of delivery agents.*
- `id` (String, UUID, Primary Key)
- `userId` (String, Foreign Key $\rightarrow$ `User.id`)
- `status` (String: `AVAILABLE`, `BUSY`, `OFFLINE`)
- `currentLat` (Float)
- `currentLng` (Float)
- `maxConcurrent` (Int, Default: 3)
- `activeCount` (Int, Default: 0)
- `zoneCoverage` (String, Comma-separated list of Zone IDs)

### 3. `Zone` & `AreaZoneMapping` Models
*Handles mapping pincodes and area names to logical logistics delivery zones.*
- **`Zone`**:
  - `id` (String, UUID, Primary Key)
  - `name` (String, Unique)
- **`AreaZoneMapping`**:
  - `id` (String, UUID, Primary Key)
  - `pincode` (String, Unique)
  - `areaName` (String)
  - `zoneId` (String, Foreign Key $\rightarrow$ `Zone.id`)

### 4. `Order` Model
*Represents the delivery shipment contract.*
- `id` (String, UUID, Primary Key)
- `customerId` (String, Foreign Key $\rightarrow$ `User.id`)
- `pickupAddress` / `dropAddress` (String)
- `pickupPincode` / `dropPincode` (String)
- `pickupLat` / `pickupLng` / `dropLat` / `dropLng` (Float)
- `length` / `width` / `height` / `actualWeight` (Float)
- `orderType` (String: `B2B`, `B2C`)
- `paymentType` (String: `PREPAID`, `COD`)
- `chargeBreakdown` (String, Immutable JSON snapshot of rate calculation)
- `currentStatus` (String: `PLACED`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`)
- `agentId` (String, Nullable, Foreign Key $\rightarrow$ `Agent.id`)

### 5. `OrderStatusHistory` Model
*Maintains an immutable auditing log for every single tracking update.*
- `id` (String, UUID, Primary Key)
- `orderId` (String, Foreign Key $\rightarrow$ `Order.id`)
- `status` (String)
- `actorRole` (String: `CUSTOMER`, `AGENT`, `ADMIN`, `SYSTEM`)
- `actorId` (String, Foreign Key $\rightarrow$ `User.id`)
- `timestamp` (DateTime)
- `notes` (String, Nullable)

---

## 📈 Rate Calculation Logic Explanation

The pricing engine calculates costs dynamically without hardcoding, using a multi-step formula:

### 1. Volumetric Weight Calculation
Parcels are evaluated by their dimensional size using the standard logistics volumetric formula. The system charges based on the higher value between the package's actual weight and its volumetric weight:
$$\text{Volumetric Weight (kg)} = \frac{\text{Length (cm)} \times \text{Width (cm)} \times \text{Height (cm)}}{5000}$$
$$\text{Billable Weight} = \max(\text{Actual Weight}, \text{Volumetric Weight})$$

### 2. Zone Connection Selection
* **`INTRA`**: If the pickup pincode and drop pincode reside within the **same** Zone ID, it is treated as an Intra-zone connection (local).
* **`INTER`**: If the pickup and drop pincodes reside in **different** Zone IDs, it is treated as an Inter-zone connection (cross-town).

### 3. Rate Card Lookup
The system fetches the active rate configuration database matching the `orderType` (B2B vs B2C) and the connection type (`INTRA` vs `INTER`):
$$\text{Base Zone Cost} = \text{Base Rate} + (\text{Billable Weight} \times \text{Per-Kg Rate})$$

### 4. Cash on Delivery (COD) Surcharges
If the payment type is `COD`, a flat cash-handling surcharge is added depending on the contract type:
* **B2C COD Surcharge**: ₹25 (Default)
* **B2B COD Surcharge**: ₹100 (Default)

### 5. Immutable JSON Snapshots
Once the customer confirms and places the order, the complete rate calculation breakdown details are saved as an **immutable JSON string** (`chargeBreakdown`) inside the order record. This prevents historical invoice records from changing if the Admin updates rate cards later.

---

## 🔌 API Documentation (Backend Endpoints)

### Auth Routes (`/api/auth`)
* `POST /register`: Registers a new user. Expects `email`, `password`, `role`.
* `POST /login`: Logs in a user. Returns a signed JWT token.

### Orders Routes (`/api/orders`)
* `POST /`: Places a new order. Triggers auto-assignment and sends email notifications.
* `GET /`: Lists all orders (customers see their own; Admins and Agents see according to access).
* `POST /:id/assign`: (Admin only) Assigns/Re-assigns an order to an agent. Adjusts agent capacities dynamically.
* `POST /:id/status`: Updates order status. Logs history and emits WebSocket changes.
* `POST /:id/reschedule`: (Customer only) Reschedules failed delivery attempts, clearing the old agent.

### Zones & Rates (`/api/zones` & `/api/rates`)
* `GET /zones`: Public endpoint to fetch all zones and area mappings.
* `POST /rates/calculate`: Computes and previews cost details prior to order submission.
* `PUT /rates/cod`: (Admin only) Edits COD configurations.
* `PUT /rates/card/:id`: (Admin only) Edits rate card pricing details.

---

## 🏗️ System Design Write-Up (Evaluation Special)

### 1. Rate Calculation Engine
The system design of the rate engine focuses on database-driven flexibility, preventing hardcoding. During order creation, the system extracts the parcel dimensions and computes the volumetric weight ($L \times W \times H \div 5000$), comparing it with the actual scale weight to resolve the **billable weight**. It looks up the correct rate card matching the order category (B2B/B2C) and connection type (INTRA/INTER). If `COD` is chosen, the engine checks the `CODConfig` table to apply the corresponding surcharge. Crucially, the resolved calculations are saved as a serialized JSON snapshot (`chargeBreakdown`) inside the order record, ensuring database-driven integrity and immutable financial auditing.

### 2. Zone Detection Approach
Zones are modeled as a one-to-many relationship: a single logical logistics hub (`Zone`) contains multiple coverage areas (`AreaZoneMapping` representing pincodes). This decoupled mapping schema allows the Admin to change service regions dynamically. When a shipment is initiated, the engine queries the `AreaZoneMapping` table to locate both the pickup and drop pincodes. If their mapped `zoneId` values are identical, the system classifies the shipment as an `INTRA` connection. If the IDs differ, it is classified as `INTER`. If either pincode is not found in the mappings database, the engine throws a clean validation exception, informing the user that the location is not serviced.

### 3. Auto-Assignment Logic & Availability Modeling
Agents are represented with availability status configurations (`AVAILABLE`, `BUSY`, `OFFLINE`) and maximum load factors (`maxConcurrent`). When an order is placed, the dispatch engine filters for agents whose status is `AVAILABLE` and whose coverage areas cover the pickup zone. If multiple candidates match, the engine selects the best candidate using a load-balanced geodesic distance score:
$$\text{Score} = \text{Distance} \times \left(1 + \frac{\text{activeCount}}{\text{maxConcurrent}}\right)$$
This algorithm prioritizes closer agents while distributing the delivery load across underutilized agents. The assignment transaction is wrapped in a database isolation lock (`FOR UPDATE` / transaction query block) to prevent race conditions from double-booking agents. If no agents are available, the order is queued in `PLACED` status.

### 4. Failed Delivery & Rescheduling Flow
When an agent encounters a delivery failure, they input failure notes (e.g. *"Recipient unavailable"*), changing the status to `FAILED`. This triggers an instant WebSocket update to the customer dashboard and records an immutable log entry. The customer is presented with a rescheduling form to select a new delivery window. Upon submission:
1. The old agent's assignment is cleared, and their active concurrent workload count is decremented by 1.
2. The order status resets to `PLACED`.
3. The dispatch engine triggers the auto-assignment sequence again to allocate the shipment to the nearest available agent for attempt number 2.
