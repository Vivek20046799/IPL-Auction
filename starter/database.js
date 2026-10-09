const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ipl_auction.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Helper for promise-based query runs
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize SQLite Tables
async function initDatabase() {
  await run(`PRAGMA foreign_keys = ON;`);
  
  // 1. Players Master Table
  await run(`
    CREATE TABLE IF NOT EXISTS players (
      player_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      short_name TEXT,
      nationality TEXT,
      primary_role TEXT,
      is_overseas INTEGER DEFAULT 0,
      base_price REAL DEFAULT 1.0,
      batting_rating INTEGER DEFAULT 60,
      bowling_rating INTEGER DEFAULT 60,
      image TEXT,
      raw_json TEXT
    );
  `);

  // 2. Rooms Table
  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_code TEXT PRIMARY KEY,
      host_email TEXT,
      host_socket_id TEXT,
      status TEXT DEFAULT 'LOBBY',
      current_index INTEGER DEFAULT 0,
      current_bid REAL DEFAULT 0,
      highest_bidder TEXT,
      next_bid REAL DEFAULT 0,
      timer INTEGER DEFAULT 10,
      auction_queue_json TEXT,
      manual_selection_json TEXT,
      activity_log_json TEXT,
      config_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Try adding config_json & manual_selection_json if table existed without them
  try {
    await run(`ALTER TABLE rooms ADD COLUMN config_json TEXT;`);
  } catch (e) {}
  try {
    await run(`ALTER TABLE rooms ADD COLUMN manual_selection_json TEXT;`);
  } catch (e) {}

  // 3. Franchises (Teams in Rooms)
  await run(`
    CREATE TABLE IF NOT EXISTS franchises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      team_code TEXT NOT NULL,
      team_name TEXT NOT NULL,
      color TEXT,
      logo TEXT,
      purse REAL DEFAULT 100.0,
      overseas_count INTEGER DEFAULT 0,
      claimed_by TEXT,
      claimed_email TEXT,
      UNIQUE(room_code, team_code)
    );
  `);

  // 4. Participants / Sessions Table
  await run(`
    CREATE TABLE IF NOT EXISTS participants (
      session_token TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      team_code TEXT NOT NULL,
      is_host INTEGER DEFAULT 0,
      last_socket_id TEXT,
      last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Squad Members Table (Bought Players)
  await run(`
    CREATE TABLE IF NOT EXISTS squad_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      team_code TEXT NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      role TEXT,
      nationality TEXT,
      is_overseas INTEGER DEFAULT 0,
      sold_price REAL NOT NULL,
      batting_rating INTEGER,
      bowling_rating INTEGER,
      image TEXT,
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Bids History Log Table
  await run(`
    CREATE TABLE IF NOT EXISTS bids_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      player_id TEXT,
      player_name TEXT,
      team_code TEXT NOT NULL,
      team_name TEXT,
      bid_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[SQL DATABASE] SQLite initialized with tables: players, rooms, franchises, participants, squad_members, bids_log');
}

// Save CSV players dataset into SQLite
async function seedPlayers(players) {
  const insertStmt = `
    INSERT OR REPLACE INTO players (
      player_id, full_name, short_name, nationality, primary_role,
      is_overseas, base_price, batting_rating, bowling_rating, image, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  for (const p of players) {
    await run(insertStmt, [
      p.id,
      p.name,
      p.shortName || p.name,
      p.nationality || 'India',
      p.role || 'All-Rounder',
      p.isOverseas ? 1 : 0,
      p.basePrice || 1.0,
      p.battingRating || 60,
      p.bowlingRating || 60,
      p.image || '',
      JSON.stringify(p)
    ]);
  }
}

// Get all players from SQLite master
async function getAllPlayersFromDB() {
  const rows = await all(`SELECT * FROM players ORDER BY full_name ASC`);
  return rows.map(r => ({
    id: r.player_id,
    name: r.full_name,
    shortName: r.short_name || r.full_name,
    nationality: r.nationality,
    role: r.primary_role,
    isOverseas: Boolean(r.is_overseas),
    basePrice: r.base_price,
    battingRating: r.batting_rating,
    bowlingRating: r.bowling_rating,
    image: r.image
  }));
}

// Save / Update Room State
async function saveRoomState(room) {
  if (!room || !room.code) return;

  const queueJson = JSON.stringify(room.auctionQueue || []);
  const manualSelectionJson = JSON.stringify(room.manualSelection || []);
  const logJson = JSON.stringify(room.activityLog || []);
  const configJson = JSON.stringify(room.config || {
    teamBudget: 100.0,
    maxPlayersPerTeam: 25,
    maxForeignPerTeam: 4,
    poolSize: 70
  });

  await run(`
    INSERT INTO rooms (
      room_code, host_email, host_socket_id, status, current_index,
      current_bid, highest_bidder, next_bid, timer, auction_queue_json,
      manual_selection_json, activity_log_json, config_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(room_code) DO UPDATE SET
      host_socket_id = excluded.host_socket_id,
      status = excluded.status,
      current_index = excluded.current_index,
      current_bid = excluded.current_bid,
      highest_bidder = excluded.highest_bidder,
      next_bid = excluded.next_bid,
      timer = excluded.timer,
      auction_queue_json = excluded.auction_queue_json,
      manual_selection_json = excluded.manual_selection_json,
      activity_log_json = excluded.activity_log_json,
      config_json = excluded.config_json,
      updated_at = CURRENT_TIMESTAMP;
  `, [
    room.code,
    room.hostEmail || '',
    room.hostSocketId || '',
    room.status || 'LOBBY',
    room.currentIndex || 0,
    room.currentBid || 0,
    room.highestBidder || null,
    room.nextBid || 0,
    room.timer !== undefined ? room.timer : 10,
    queueJson,
    manualSelectionJson,
    logJson,
    configJson
  ]);

  // Save Franchises
  if (room.teams) {
    for (const code of Object.keys(room.teams)) {
      const t = room.teams[code];
      await run(`
        INSERT INTO franchises (
          room_code, team_code, team_name, color, logo, purse, overseas_count, claimed_by, claimed_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_code, team_code) DO UPDATE SET
          purse = excluded.purse,
          overseas_count = excluded.overseas_count,
          claimed_by = excluded.claimed_by,
          claimed_email = excluded.claimed_email;
      `, [
        room.code,
        t.code,
        t.name,
        t.color,
        t.logo,
        t.purse,
        t.overseasCount || 0,
        t.claimedBy || null,
        t.claimedEmail || null
      ]);
    }
  }
}

// Save Participant Session
async function saveParticipant({ sessionToken, roomCode, name, email, teamCode, isHost, socketId }) {
  await run(`
    INSERT INTO participants (
      session_token, room_code, name, email, team_code, is_host, last_socket_id, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_token) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      team_code = excluded.team_code,
      is_host = excluded.is_host,
      last_socket_id = excluded.last_socket_id,
      last_active_at = CURRENT_TIMESTAMP;
  `, [
    sessionToken,
    roomCode,
    name,
    email,
    teamCode,
    isHost ? 1 : 0,
    socketId
  ]);
}

// Get Participant By Token
async function getParticipantByToken(sessionToken) {
  if (!sessionToken) return null;
  return await get(`SELECT * FROM participants WHERE session_token = ?`, [sessionToken]);
}

// Get Participant By Email & Room
async function getParticipantByEmailAndRoom(email, roomCode) {
  if (!email || !roomCode) return null;
  return await get(`
    SELECT * FROM participants 
    WHERE LOWER(email) = LOWER(?) AND UPPER(room_code) = UPPER(?)
    ORDER BY last_active_at DESC LIMIT 1
  `, [email, roomCode]);
}

// Record Squad Purchase in SQL
async function recordPlayerSale(roomCode, teamCode, player, soldPrice) {
  await run(`
    INSERT INTO squad_members (
      room_code, team_code, player_id, player_name, role, nationality,
      is_overseas, sold_price, batting_rating, bowling_rating, image, acquired_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `, [
    roomCode,
    teamCode,
    player.id,
    player.name,
    player.role,
    player.nationality,
    player.isOverseas ? 1 : 0,
    soldPrice,
    player.battingRating,
    player.bowlingRating,
    player.image
  ]);
}

// Record Bid in SQL Log
async function recordBidLog({ roomCode, playerId, playerName, teamCode, teamName, bidAmount }) {
  await run(`
    INSERT INTO bids_log (
      room_code, player_id, player_name, team_code, team_name, bid_amount, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
  `, [
    roomCode,
    playerId || null,
    playerName || null,
    teamCode,
    teamName || teamCode,
    bidAmount
  ]);
}

// Load Full Room from SQL (for restoring state on restart/reconnect)
async function loadRoomFromDB(roomCode) {
  const roomRow = await get(`SELECT * FROM rooms WHERE room_code = ?`, [roomCode]);
  if (!roomRow) return null;

  const franchisesRows = await all(`SELECT * FROM franchises WHERE room_code = ?`, [roomCode]);
  const squadRows = await all(`SELECT * FROM squad_members WHERE room_code = ?`, [roomCode]);
  const participantsRows = await all(`SELECT * FROM participants WHERE room_code = ?`, [roomCode]);

  const teams = {};
  franchisesRows.forEach(f => {
    const teamSquad = squadRows
      .filter(s => s.team_code === f.team_code)
      .map(s => ({
        id: s.player_id,
        name: s.player_name,
        role: s.role,
        nationality: s.nationality,
        isOverseas: Boolean(s.is_overseas),
        soldPrice: s.sold_price,
        battingRating: s.batting_rating,
        bowlingRating: s.bowling_rating,
        image: s.image
      }));

    teams[f.team_code] = {
      code: f.team_code,
      name: f.team_name,
      color: f.color,
      logo: f.logo,
      purse: f.purse,
      overseasCount: f.overseas_count,
      claimedBy: f.claimed_by,
      claimedEmail: f.claimed_email,
      squad: teamSquad
    };
  });

  const participants = {};
  participantsRows.forEach(p => {
    if (p.last_socket_id) {
      participants[p.last_socket_id] = {
        name: p.name,
        email: p.email,
        teamCode: p.team_code,
        isHost: Boolean(p.is_host),
        sessionToken: p.session_token
      };
    }
  });

  let queue = [];
  try {
    queue = JSON.parse(roomRow.auction_queue_json || '[]');
  } catch (e) {
    queue = [];
  }

  let manualSelection = [];
  try {
    manualSelection = JSON.parse(roomRow.manual_selection_json || '[]');
  } catch (e) {
    manualSelection = [];
  }

  let activityLog = [];
  try {
    activityLog = JSON.parse(roomRow.activity_log_json || '[]');
  } catch (e) {
    activityLog = [];
  }

  let config = {
    teamBudget: 100.0,
    maxPlayersPerTeam: 25,
    maxForeignPerTeam: 4,
    poolSize: 70
  };
  try {
    if (roomRow.config_json) {
      config = JSON.parse(roomRow.config_json);
    }
  } catch (e) {}

  return {
    code: roomRow.room_code,
    hostEmail: roomRow.host_email,
    hostSocketId: roomRow.host_socket_id,
    status: roomRow.status,
    config,
    teams,
    participants,
    auctionQueue: queue,
    manualSelection,
    currentIndex: roomRow.current_index,
    currentBid: roomRow.current_bid,
    highestBidder: roomRow.highest_bidder,
    nextBid: roomRow.next_bid,
    timer: roomRow.timer,
    activityLog,
    timerInterval: null,
    transitionInterval: null
  };
}

// Load all active rooms on server start
async function loadAllRoomsFromDB() {
  const rows = await all(`SELECT room_code FROM rooms`);
  const roomMap = new Map();
  for (const row of rows) {
    const room = await loadRoomFromDB(row.room_code);
    if (room) {
      roomMap.set(room.code, room);
    }
  }
  return roomMap;
}

module.exports = {
  db,
  initDatabase,
  seedPlayers,
  getAllPlayersFromDB,
  saveRoomState,
  saveParticipant,
  getParticipantByToken,
  getParticipantByEmailAndRoom,
  recordPlayerSale,
  recordBidLog,
  loadRoomFromDB,
  loadAllRoomsFromDB
};
