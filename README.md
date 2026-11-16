# 🌊 FloodSense AI — Intelligent National Flood Monitoring & Early Warning System

FloodSense AI is an enterprise-grade hydrological early warning, risk assessment, and disaster emergency response platform. Designed for incident commanders, civic authorities, disaster relief forces (NDRF/SDRF), and citizens, FloodSense AI combines multi-basin river telemetry, real-time IoT water level monitoring, 3D Digital Twin mesh simulations, automated multi-channel broadcasts, and statutory audit compliance reporting.

---

## ⚡ Key Capabilities & Modules

### 1. 🎛️ Tactical Incident Command Dashboard
- **Live Gauge Hydrographs & Threshold Monitoring:** Dynamic real-time water stage tracking against Warning and Critical danger boundaries.
- **AI Causal Reasoning Engine:** Basin saturation analysis, rainfall accumulation profiles, rate-of-rise calculus, and historical flood analogue pattern matching.
- **Quick Operator Triage:** One-click incident acknowledgment, escalation to NDRF/SDMA taskforces, and priority alert dispatch.

### 2. 🗺️ Interactive National Geospatial Command & Tactical Zones
- **Pan-India River Basin Mapping:** Interactive Leaflet GIS visualization featuring river stations across Brahmaputra, Ganges, Yamuna, Narmada, Godavari, Krishna, Teesta, and Jhelum.
- **Polygon Broadcast Tactical Zones:** Target evacuation zones and broadcast sirens directly to predefined river basin polygons and postal PIN code corridors.

### 3. 🌐 3D Digital Twin Simulation Mesh
- **Three.js WebGL Terrain Mesh:** Real-time 3D simulation with undulating wave dynamics, dynamic crest surge animation, contour elevations, and interactive 360° orbital camera controls.
- **Crest Runoff & Breach Projections:** Visual assessment of flood wave propagation over high-risk lowlands.

### 4. 🚨 Multi-River Alert Trigger & Emergency Broadcast Dispatch
- **Multi-Station Trigger Engine:** Manually or automatically trigger flood breaches across any river station with customizable water level stages and severity tiers.
- **Real-Time Push Notifications & Sirens:** Device push sirens and Web Push notifications dispatching instant alerts to downstream residents.

### 5. 👥 Citizen Safety & Relief Evacuation Portal
- **PIN Code Relocation Locator:** Persistent postal code search matching citizens to nearest relief camps, medical outposts, and shelter contacts.
- **Audible Siren Notification:** Browser-based emergency audio siren alert system triggered when water stages breach critical thresholds.

### 6. 📄 Official Statutory NDRF / CWC Compliance & Dossier Generator
- **Multi-Format Post-Disaster Dossiers:** Export statutory PDF audit reports with hydrograph logs, taskforce mobilization logs, shift notes, and CSV telemetry exports.

---

## 🏗️ Architecture & Tech Stack

- **Frontend:**
  - React 18 (Vite, HMR, Module Deduplication)
  - Three.js (3D WebGL Digital Twin Mesh)
  - Leaflet & React-Leaflet (Interactive Geospatial Maps)
  - Recharts (Hydrological time-series & stage hydrographs)
  - Lucide React (Tactical UI icons)
  - Tailwind CSS & Custom Glassmorphic Dark/Light Slate Themes
  - jsPDF & jspdf-autotable (Statutory Incident Report generation)
- **Backend:**
  - Node.js & Express.js (REST API & WebSockets)
  - Socket.io (5-second real-time IoT telemetry broadcast stream)
  - MongoDB & Mongoose (Hydrological telemetry, alerts, and audit logs)
  - Web Push & VAPID (Emergency citizen siren broadcasts)
  - Open-Meteo & External Hydrological Elevation/Weather APIs
  - Gemini AI & Deterministic Hydrological Fallback Engine

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ and npm
- MongoDB running locally (`mongodb://localhost:27017/floodsense`) or MongoDB Atlas URI

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Praveen-Suthar-08/FloodSense-AI.git
cd FloodSense-AI
npm install
npm --prefix client install
npm --prefix server install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `MONGODB_URI` points to your MongoDB instance:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/floodsense
JWT_SECRET=your_super_secret_jwt_key
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Seed Database
Seed baseline river stations, initial sensors, and default administrative accounts:
```bash
npm run seed
```

### 4. Run Development Environment
Start both the backend server and frontend client concurrently:
```bash
npm run dev
```
- **Web Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:4000](http://localhost:4000)

---

## 🔐 Default Administrative Credentials

The system comes pre-configured with the following role-based access accounts:

| Role | Username | Password | Access Privileges |
|---|---|---|---|
| **Incident Commander** | `commander` | `admin123` | Full Admin Access (Alert Triggers, Tactical Broadcasts, Calibration, PDF Audits) |
| **Emergency Dispatcher** | `dispatcher` | `admin123` | Broadcast & Dispatch Operations |
| **Field Official** | `official` | `admin123` | Telemetry & Incident View Only |

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `POST` | `/api/auth/login` | Operator authentication & JWT issuance |
| `GET` | `/api/locations` | Fetch all river monitoring stations |
| `GET` | `/api/alerts` | Active flood breaches and warning notifications |
| `POST` | `/api/alerts/trigger` | Trigger breach alert on target river station |
| `POST` | `/api/subscribe` | Register citizen browser push subscription |
| `POST` | `/api/alerts/broadcast` | Broadcast emergency siren to tactical zone |
| `GET` | `/api/reports/incidents` | Query post-disaster audit logs & telemetry |

---

## 🛡️ Disclaimer
*FloodSense AI is an informational decision-support and rapid response platform. For official life-safety evacuation orders, always follow directives issued by local disaster management authorities (NDRF, SDMA, CWC).*

---

## 📄 License
This project is licensed under the MIT License.
