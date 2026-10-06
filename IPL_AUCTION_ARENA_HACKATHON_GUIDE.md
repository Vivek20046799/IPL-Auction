# IPL Auction Arena — 1-Hour Individual Hackathon

### Problem Statement & Solo Developer Implementation Guide (Cricbuzz Edition)

---

## 1. Challenge Overview

Build a **real-time, multi-user IPL auction web application** within **60 minutes**. Multiple users must be able to join the same auction room using a 6-character room code, select an IPL franchise, review and agree to auction rules, and participate in competitive, real-time player bidding with an automated countdown timer, purse tracking, squad limits, and a live Cricbuzz-style broadcast layout.

This is an **individual developer challenge**. You are competing solo. The **only starting input provided** is the local player dataset: `ipl2026_ai_auction_database_accurate.csv`.

```text
DATASET (CSV)
      |
REGISTRATION (Name, Email/ID, Rules Agreement)
      |
SCROLLABLE TEAM SELECTION (1 Team per User)
      |
CREATE / JOIN ROOM (6-Character Code)
      |
AUCTION LOBBY (Live Ticker Strip)
      |
HOST PICKS PLAYERS (e.g. Random 30)
      |
RANDOM SHUFFLE
      |
CRICBUZZ 3-COLUMN BIDDING ARENA
      |
10s TIMER (Resets on Bid)
      |
SPEAKER TOGGLE (Voice Auctioneer Mute/Unmute)
      |
SOLD / UNSOLD TRANSITIONS
      |
PURSE & OVERSEAS SQUAD LIMITS
      |
FINAL SQUADS SUMMARY
```

---

## 2. Strict Aesthetic & Cricbuzz Design Directives

The application must capture the clean, high-contrast, television-grade sports journalism look of **Cricbuzz**:

1. **CRICBUZZ SOLID COLOR PALETTE (ZERO GRADIENTS)**:
   - **Header Bar**: Solid `#009270` (Cricbuzz Deep Green)
   - **Header Dark Accent**: Solid `#026b52`
   - **Live Match / Status Indicator**: Solid `#cb202d` (Live Red)
   - **Canvas Background**: Solid `#121619` (Dark Sports Canvas)
   - **Card / Surface**: Solid `#1c2227` (Dark Elevated Surface)
   - **Secondary Surface**: Solid `#151a1e` (Ticker / Inset Background)
   - **Borders / Dividers**: Solid 1px `#2a3238`
   - **Primary Action (Bid / Start)**: Solid `#009270` (Hover: `#007a5e`)
   - **Text Main**: Solid `#f1f5f9` | **Text Muted**: Solid `#94a3b8`
   - **STRICTLY ZERO GRADIENTS**: No `linear-gradient(...)`, `radial-gradient(...)`, or gradient borders.

2. **STRICTLY ZERO EMOJIS**:
   - Do **NOT** use emojis anywhere in the user interface, buttons, badges, notifications, or logs.
   - Use crisp uppercase typographic tags and badges instead:
     - `[SOLD]` instead of trophy or gavel emojis
     - `[UNSOLD]` instead of cross emojis
     - `[OVERSEAS]` instead of airplane or globe emojis
     - `LIVE BID` instead of flame or bell emojis
     - `SPEAKER: ON` / `SPEAKER: OFF` instead of speaker emojis

3. **SPEAKER TOGGLE OPTION (VOICE AUCTIONEER)**:
   - Provide a prominent, persistent speaker toggle button in the header (`SPEAKER: ON / OFF`).
   - When clicked, immediately mutes or enables the browser's speech synthesis, stops any active audio utterances, and updates button state visually.

4. **REGISTRATION & RULES BRIEFING BEFORE BIDDING**:
   - Participants must enter their **Full Name** and **Email / Participant ID**.
   - Before joining or creating a room, participants must be presented with the **Auction Rules Briefing**:
     - Starting Purse: ₹100.00 Cr
     - Overseas Limit: Max 4 overseas players per franchise
     - Countdown Timer: 10s countdown, resets on valid bid
     - Bid Increment Tiers: Below ₹5 Cr (+₹0.25 Cr), ₹5–10 Cr (+₹0.50 Cr), Above ₹10 Cr (+₹1.00 Cr)
     - Fair Bidding: Host bids as an equal participant
   - A mandatory confirmation checkbox (`"I have read, understood, and agree to the IPL Auction Arena rules"`) ensures every participant understands before proceeding.

5. **SCROLLABLE FRANCHISE SELECTION & TICKER**:
   - **Entry Screen**: A horizontal scrollable strip (`overflow-x: auto`) with `< SCROLL` and `SCROLL >` buttons so all 10 franchises do not crowd the viewport. Users scroll smoothly to select.
   - **Live Ticker**: A Cricbuzz-style horizontal franchise strip across the top displaying team codes, live purses, and squad counts.
   - **Arena Left Column**: A compact, vertically scrollable list (`overflow-y: auto`) for all franchise purses and leader statuses.

6. **VERIFIED IPL TEAM ASSETS**:
   Use the following pre-configured team data object containing official solid franchise colors and direct image URLs:

```javascript
const IPL_TEAMS = {
  MI: {
    code: 'MI',
    name: 'Mumbai Indians',
    color: '#004BA0',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/250px-Mumbai_Indians_Logo.svg.png',
    localLogo: '/assets/logos/MI.png'
  },
  CSK: {
    code: 'CSK',
    name: 'Chennai Super Kings',
    color: '#FDB913',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/250px-Chennai_Super_Kings_Logo.svg.png',
    localLogo: '/assets/logos/CSK.png'
  },
  RCB: {
    code: 'RCB',
    name: 'Royal Challengers Bengaluru',
    color: '#2B2A29',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Royal_Challengers_Bengaluru_Logo.svg/250px-Royal_Challengers_Bengaluru_Logo.svg.png',
    localLogo: '/assets/logos/RCB.png'
  },
  KKR: {
    code: 'KKR',
    name: 'Kolkata Knight Riders',
    color: '#3A225D',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/250px-Kolkata_Knight_Riders_Logo.svg.png',
    localLogo: '/assets/logos/KKR.png'
  },
  DC: {
    code: 'DC',
    name: 'Delhi Capitals',
    color: '#00008B',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Delhi_Capitals.svg/250px-Delhi_Capitals.svg.png',
    localLogo: '/assets/logos/DC.png'
  },
  PBKS: {
    code: 'PBKS',
    name: 'Punjab Kings',
    color: '#DD1F2D',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/250px-Punjab_Kings_Logo.svg.png',
    localLogo: '/assets/logos/PBKS.png'
  },
  RR: {
    code: 'RR',
    name: 'Rajasthan Royals',
    color: '#EA1A85',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/This_is_the_logo_for_Rajasthan_Royals%2C_a_cricket_team_playing_in_the_Indian_Premier_League_%28IPL%29.svg/250px-This_is_the_logo_for_Rajasthan_Royals%2C_a_cricket_team_playing_in_the_Indian_Premier_League_%28IPL%29.svg.png',
    localLogo: '/assets/logos/RR.png'
  },
  SRH: {
    code: 'SRH',
    name: 'Sunrisers Hyderabad',
    color: '#F26522',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Sunrisers_Hyderabad_Logo.svg/250px-Sunrisers_Hyderabad_Logo.svg.png',
    localLogo: '/assets/logos/SRH.png'
  },
  LSG: {
    code: 'LSG',
    name: 'Lucknow Super Giants',
    color: '#0057E7',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/34/Lucknow_Super_Giants_Logo.svg/250px-Lucknow_Super_Giants_Logo.svg.png',
    localLogo: '/assets/logos/LSG.png'
  },
  GT: {
    code: 'GT',
    name: 'Gujarat Titans',
    color: '#1B2133',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/250px-Gujarat_Titans_Logo.svg.png',
    localLogo: '/assets/logos/GT.png'
  }
};
```

---

## 3. Dataset Anatomy & Fast Ingestion

The dataset `ipl2026_ai_auction_database_accurate.csv` contains **162 cricket players** with 76 columns.

### Essential Columns to Map

| CSV Column | Type | Example | Usage in App |
| :--- | :--- | :--- | :--- |
| `player_id` | String | `164a08d8-4e04-5d9b...` | Unique identifier |
| `full_name` | String | `Pat Cummins` | Player title & announcer |
| `nationality` | String | `Australia`, `India` | Country badge |
| `primary_role` | String | `Bowler`, `Batsman`, `All-Rounder`, `Wicket-Keeper` | Role badge |
| `overseas` | String | `"True"`, `"False"` | Overseas squad limit check |
| `expected_price`| Number | `225`, `165`, `96` | Base price derivation |
| `batting_rating`| Number | `92` (0–100) | Stat on player scorecard |
| `bowling_rating`| Number | `70` (0–100) | Stat on player scorecard |

### Base Price Derivation Formula
```javascript
function calculateBasePrice(expectedPrice) {
  const val = Number(expectedPrice) || 100;
  if (val >= 200) return 2.0;
  if (val >= 150) return 1.5;
  if (val >= 100) return 1.0;
  return 0.5;
}
```

### Player Photo Fallback
```javascript
function getPlayerImage(fullName) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=1e293b&color=ffffff&size=256&format=png&bold=true`;
}
```

---

## 4. Room & Identity System

### Participant Registration Model
- Fields: `name` (Full Name), `email` (Email or Participant ID), `teamCode` (Franchise).
- No passwords, emails, OAuth, or sessions.
- Room State Object:
```javascript
const room = {
  code: "CIKZI5",
  hostSocketId: "socket_123",
  status: "LOBBY", // "LOBBY" | "AUCTIONING" | "PAUSED" | "COMPLETED"
  participants: {
    "socket_123": { name: "Rahul Sharma", email: "rahul@example.com", teamCode: "MI", isHost: true }
  },
  teams: {
    MI: { purse: 100.0, squad: [], overseasCount: 0, claimedBy: "Rahul Sharma" }
    // ...
  },
  auctionQueue: [],
  currentIndex: 0,
  currentBid: 0.0,
  highestBidder: null,
  nextBid: 2.0,
  timer: 10,
  activityLog: []
};
```

---

## 5. Auction Rules Engine

### 1. Host is a Regular Bidder
The room creator is the host (can start auction, pause, or skip), but **is also a regular participating team** and bids under identical rules. The host cannot manually buy players.

### 2. Player Selection & Shuffle
- Host specifies how many players should be auctioned (e.g., 15, 30, or 50).
- Option: `[SELECT RANDOM PLAYERS]` automatically samples from the 162-player dataset.
- The selected players **must be randomly shuffled** using Fisher-Yates shuffle.

### 3. Bid Increments
- First bid: Player's `basePrice`.
- Subsequent bids:
  - If current bid `< ₹5.00 Cr`: increment is `+₹0.25 Cr`
  - If current bid `₹5.00 Cr – ₹10.00 Cr`: increment is `+₹0.50 Cr`
  - If current bid `> ₹10.00 Cr`: increment is `+₹1.00 Cr`

### 4. Bid Validation
Reject bids if:
1. `bidderTeam === highestBidder` (cannot bid against yourself).
2. `team.purse < nextBidPrice` (insufficient funds).
3. `player.isOverseas && team.overseasCount >= 4` (overseas quota exceeded).
4. `timer <= 0` or player already marked SOLD/UNSOLD.

### 5. 10-Second Countdown & Dynamic Reset
- When a player appears, start timer at `10` seconds.
- **Every valid bid resets the timer back to 10 seconds**.
- When timer reaches `0`:
  - If `highestBidder` exists: mark **SOLD**.
    - Deduct `currentBid` from winning team's purse.
    - Append player to team's squad.
    - If `player.isOverseas`, increment `team.overseasCount`.
  - If no bids: mark **UNSOLD**.
  - Show status for **3.5 seconds**, then advance to `currentIndex + 1`.

---

## 6. UI Wireframes & Layout Specs (Cricbuzz Edition)

### Screen A: Registration & Scrollable Franchise Selector
```text
+-------------------------------------------------------------------------+
| [IPL] AUCTION   LIVE AUCTION   RULES   SQUADS    [SPEAKER: ON]  ROOM: - |
+-------------------------------------------------------------------------+
| REGISTRATION                                                            |
| IPL AUCTION ARENA PARTICIPANT REGISTRATION                              |
|                                                                         |
| FULL NAME: [ Rahul Sharma        ]   EMAIL/ID: [ rahul@example.com    ] |
|                                                                         |
| SELECT IPL FRANCHISE (SCROLL HORIZONTALLY):         [< SCROLL] [SCROLL>]|
| +----------+  +----------+  +----------+  +----------+  +----------+    |
| | [MI]     |  | [CSK]    |  | [RCB]    |  | [KKR]    |  | [DC]     |    |
| | SELECTED |  | SELECT   |  | CLAIMED  |  | SELECT   |  | SELECT   |    |
| +----------+  +----------+  +----------+  +----------+  +----------+    |
|                                                                         |
| MANDATORY AUCTION RULES BRIEFING:                                       |
| - Purse: 100.00 Cr per team                                             |
| - Overseas Cap: Max 4 overseas players                                  |
| - 10s Timer resets on every valid bid                                   |
| [X] I have read, understood, and agree to the auction rules.            |
|                                                                         |
| [ CREATE ROOM AS HOST ]    |    ROOM CODE: [ ______ ]  [ JOIN ]         |
+-------------------------------------------------------------------------+
```

### Screen B: Main Auction Arena (Cricbuzz 3-Column Broadcast Layout)
```text
+-----------------------------------------------------------------------------------------+
| [IPL] AUCTION   LIVE AUCTION   RULES   SQUADS    [SPEAKER: ON]  ROOM: MCTQUT            |
+-----------------------------------------------------------------------------------------+
| FRANCHISES (SCROLL): [MI: 98.5Cr (1)]  [CSK: 100Cr (0)]  [RCB: 100Cr (0)]  [KKR: 100Cr] |
+------------------------+---------------------------------------+------------------------+
| FRANCHISES (SCROLL)    | LIVE PLAYER BIDDING         TIME: 08s | AUCTION FEED (LIVE)    |
|                        +---------------------------------------+                        |
| [MI LOGO] MI [LEADER]  |         +-------------------+         | 10:24:02 CSK bid 2.25  |
| Purse: 94.50 Cr        |         |   PLAYER IMAGE    |         | 10:24:05 MI bid 2.50   |
| Squad: 2 (OS: 1/4)     |         |   (Solid Border)  |         | 10:24:08 CSK bid 2.75  |
|                        |         +-------------------+         |                        |
| [CSK LOGO] CSK         |  PAT CUMMINS                          | ---------------------- |
| Purse: 88.00 Cr        |  AUSTRALIA • BOWLER                   | AUCTIONEER ACTIONS     |
| Squad: 3 (OS: 2/4)     |  TAG: [OVERSEAS]                      | [ SKIP PLAYER / UNSOLD]|
|                        |                                       |                        |
| [RCB LOGO] RCB         |  BAT: 56 | BOWL: 70 | BASE: 2.00 Cr   |                        |
| Purse: 100.00 Cr       +---------------------------------------+                        |
| Squad: 0 (OS: 0/4)     | CURRENT BID: 2.75 Cr (CSK)            |                        |
|                        | NEXT BID:    3.00 Cr                  |                        |
| [Scroll for 7 more...] |                                       |                        |
|                        | [ SUBMIT BID: 3.00 Cr ]               |                        |
+------------------------+---------------------------------------+------------------------+
```

---

## 7. Voice Auctioneer & Speaker Toggle

Use browser `speechSynthesis` with an instantaneous mute check:

```javascript
let audioEnabled = true;

function toggleSpeaker() {
  audioEnabled = !audioEnabled;
  if (!audioEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function announce(text) {
  if (!audioEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}
```

---

## 8. Exact 60-Minute Implementation Roadmap

| Minute Window | Focus Area | Deliverables |
| :--- | :--- | :--- |
| **00:00 – 10:00** | **Setup & Data Ingestion** | Ingest CSV dataset; serve static files; verify 10 team logo assets. |
| **10:00 – 25:00** | **Registration, Rules & Lobby** | Name/Email inputs; Rules agreement checkbox; horizontal scrollable team strip; room joining. |
| **25:00 – 40:00** | **Bidding Arena & Queue** | 3-column Cricbuzz broadcast arena; live ticker strip; bid submission socket broadcast. |
| **40:00 – 50:00** | **Server Timer & Rules** | 10s countdown timer with bid reset; purse deduction; overseas quota check (max 4); SOLD/UNSOLD banners. |
| **50:00 – 60:00** | **Speaker Toggle & Testing** | Voice auctioneer with speaker mute toggle; final squads view; multi-tab live demo. |

---

## 9. Scoring & Judging Rubric (100 Points Total)

| Category | Weight | Evaluation Criteria |
| :--- | :---: | :--- |
| **Real-Time Bidding & Sync** | **30 Pts** | Instant bid broadcast across tabs; zero desynchronization; highest bidder updates live. |
| **Auction Rules & Business Logic**| **25 Pts** | Purse deduction; overseas player limit (max 4); rules briefing agreement; timer reset on bid. |
| **End-to-End User Flow** | **20 Pts** | Registration &rarr; Rules Briefing &rarr; Lobby &rarr; Random Selection &rarr; Live Arena &rarr; Final Squads. |
| **Cricbuzz UI & Constraints** | **15 Pts** | Cricbuzz green header; dark sports theme; solid colors (no gradients); zero emojis; scrollable teams. |
| **Speaker Toggle & Polish** | **10 Pts** | Functional voice announcer with quick speaker mute toggle; audio cues on sold/unsold. |
