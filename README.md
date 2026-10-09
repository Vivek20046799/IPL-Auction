# 🏏 IPL Auction Arena

An interactive, real-time multiplayer **IPL Mega Auction** simulation platform built with Node.js, Express, Socket.IO, and SQLite. Experience the thrill of bidding wars, franchise purse management, squad building, and real-time live auction rooms.

---

## ✨ Features

- **⚡ Real-Time Multiplayer Bidding**: Powered by Socket.IO with sub-second synchronization across all connected clients.
- **🛡️ 10 Official IPL Franchises**: MI, CSK, RCB, KKR, DC, PBKS, RR, SRH, LSG, and GT with official logos and color themes.
- **📊 70+ Verified Player Pool**: Ingested directly from accurate IPL 2026 dataset featuring base prices, ratings (batting & bowling), overseas status, and roles.
- **⏱️ Anti-Sniping Dynamic Timer**: Auto-resets or extends timer when late bids are placed, preventing last-second sniping.
- **💰 Smart Bid Increments**: Tiered bid scaling:
  - `< ₹5.0 Cr`: +₹0.25 Cr
  - `₹5.0 Cr - ₹10.0 Cr`: +₹0.50 Cr
  - `> ₹10.0 Cr`: +₹1.00 Cr
- **🔒 Purse & Overseas Roster Rules**: Strict validation on team budget (₹100 Cr default) and foreign player quotas.
- **💾 SQLite Persistence**: Auto-saves rooms, participants, bidding audit logs, and squad acquisitions to SQLite so sessions survive server restarts and reconnections.
- **🎨 Modern Dark UI / UX**: Immersive arena interface with team podiums, live activity feeds, visual effects, and sound triggers.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Database**: SQLite3 (`sqlite3`)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, Socket.IO Client
- **Audio Engine**: Web Audio API Sound Effects

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 1. Clone the Repository
```bash
git clone https://github.com/Vivek20046799/IPL-Auction.git
cd IPL-Auction
```

### 2. Install Dependencies
```bash
cd starter
npm install
```

### 3. Start the Server
```bash
npm start
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📁 Project Structure

```
├── IPL_AUCTION_ARENA_HACKATHON_GUIDE.md  # Hackathon problem statement & guidelines
├── README.md                             # Project documentation
├── assets/                               # Media and logos
├── ipl2026_ai_auction_database_accurate.csv # Curated player dataset
└── starter/
    ├── database.js                       # SQLite schema & persistence helpers
    ├── package.json                      # Project dependencies & scripts
    ├── server.js                         # Express & Socket.IO auction engine
    └── public/
        ├── app.js                        # Client-side Socket.IO & UI logic
        ├── index.html                    # Arena layout & modals
        ├── style.css                     # Premium dark theme styling
        └── assets/                       # Client assets and franchise logos
```

---

## 📜 License

This project is licensed under the MIT License.
