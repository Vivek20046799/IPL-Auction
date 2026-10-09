const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use(express.json());

// IPL Team Definitions (Solid Colors & Official Logos)
const IPL_TEAMS = {
  MI: { code: 'MI', name: 'Mumbai Indians', color: '#004BA0', logo: '/assets/logos/MI.png' },
  CSK: { code: 'CSK', name: 'Chennai Super Kings', color: '#FDB913', logo: '/assets/logos/CSK.png' },
  RCB: { code: 'RCB', name: 'Royal Challengers Bengaluru', color: '#2B2A29', logo: '/assets/logos/RCB.png' },
  KKR: { code: 'KKR', name: 'Kolkata Knight Riders', color: '#3A225D', logo: '/assets/logos/KKR.png' },
  DC: { code: 'DC', name: 'Delhi Capitals', color: '#00008B', logo: '/assets/logos/DC.png' },
  PBKS: { code: 'PBKS', name: 'Punjab Kings', color: '#DD1F2D', logo: '/assets/logos/PBKS.png' },
  RR: { code: 'RR', name: 'Rajasthan Royals', color: '#EA1A85', logo: '/assets/logos/RR.png' },
  SRH: { code: 'SRH', name: 'Sunrisers Hyderabad', color: '#F26522', logo: '/assets/logos/SRH.png' },
  LSG: { code: 'LSG', name: 'Lucknow Super Giants', color: '#0057E7', logo: '/assets/logos/LSG.png' },
  GT: { code: 'GT', name: 'Gujarat Titans', color: '#1B2133', logo: '/assets/logos/GT.png' }
};

// 1. Ingest Player Dataset from CSV (Full Names Only)
function calculateBasePrice(expectedPrice) {
  const val = Number(expectedPrice) || 100;
  if (val >= 200) return 2.0;
  if (val >= 150) return 1.5;
  if (val >= 100) return 1.0;
  return 0.5;
}

function loadDataset() {
  const candidatePaths = [
    path.join(__dirname, 'ipl2026_ai_auction_database_accurate.csv'),
    path.join(__dirname, '..', 'ipl2026_ai_auction_database_accurate.csv')
  ];

  let csvPath = candidatePaths.find(p => fs.existsSync(p));
  if (!csvPath) {
    console.error('CSV dataset file not found!');
    return [];
  }

  const raw = fs.readFileSync(csvPath, 'utf-8').trim();
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = headerLine.split(',').map(h => h.trim());

  return lines.map((line, idx) => {
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const item = {};
    headers.forEach((h, i) => {
      item[h] = (values[i] || '').replace(/^"|"$/g, '').trim();
    });

    const isOverseas = (item.overseas || '').toLowerCase() === 'true';
    const fullName = (item.full_name || `Player ${idx + 1}`).trim();

    return {
      id: item.player_id || `P-${idx + 1}`,
      name: fullName,
      fullName: fullName,
      shortName: item.short_name || fullName,
      nationality: item.nationality || (isOverseas ? 'Overseas' : 'India'),
      role: item.primary_role || 'All-Rounder',
      isOverseas: isOverseas,
      basePrice: calculateBasePrice(item.expected_price),
      battingRating: Number(item.batting_rating) || 60,
      bowlingRating: Number(item.bowling_rating) || 60,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0f172a&color=38bdf8&size=256&format=png&bold=true`
    };
  });
}

const ALL_PLAYERS = loadDataset();
console.log(`[DATASET LOADED] ${ALL_PLAYERS.length} total players ingested.`);

// REST API for Master Players
app.get('/api/players', (req, res) => {
  res.json(ALL_PLAYERS);
});

// 2. Active Rooms Store Backed by SQLite Database
let rooms = new Map();

// Helper to initialize and hydrate from SQLite
async function startServer() {
  await db.initDatabase();
  await db.seedPlayers(ALL_PLAYERS);
  rooms = await db.loadAllRoomsFromDB();
  console.log(`[SQL HYDRATION] Restored ${rooms.size} existing auction rooms from SQLite.`);

  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`IPL AUCTION ARENA SERVER LIVE ON PORT ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log(`===============================================`);
  });
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function calculateNextBid(currentBid, basePrice) {
  if (!currentBid || currentBid <= 0) return basePrice;
  const inc = currentBid < 5.0 ? 0.25 : (currentBid < 10.0 ? 0.50 : 1.00);
  return Number((currentBid + inc).toFixed(2));
}

function broadcastRoom(room) {
  const { timerInterval, transitionInterval, ...safeState } = room;
  io.to(room.code).emit('room_update', safeState);
}

// 3. Socket.IO Events
io.on('connection', (socket) => {
  console.log(`[CONNECT] Socket connected: ${socket.id}`);

  // Fetch Master Player Database
  socket.on('get_all_players', () => {
    socket.emit('all_players_data', ALL_PLAYERS);
  });

  // Reconnect / Restore Session from SQL
  socket.on('reconnect_session', async ({ sessionToken, roomCode, email }) => {
    try {
      let participant = null;
      if (sessionToken) {
        participant = await db.getParticipantByToken(sessionToken);
      }
      if (!participant && email && roomCode) {
        participant = await db.getParticipantByEmailAndRoom(email, roomCode);
      }

      if (!participant) {
        return socket.emit('session_not_found');
      }

      const code = participant.room_code;
      let room = rooms.get(code);

      if (!room) {
        room = await db.loadRoomFromDB(code);
        if (room) {
          rooms.set(code, room);
        }
      }

      if (!room) {
        return socket.emit('session_not_found');
      }

      const isHost = Boolean(participant.is_host);
      if (isHost) {
        room.hostSocketId = socket.id;
      }

      room.participants[socket.id] = {
        name: participant.name,
        email: participant.email,
        teamCode: participant.team_code,
        isHost: isHost,
        sessionToken: participant.session_token
      };

      await db.saveParticipant({
        sessionToken: participant.session_token,
        roomCode: code,
        name: participant.name,
        email: participant.email,
        teamCode: participant.team_code,
        isHost: isHost,
        socketId: socket.id
      });

      socket.join(code);

      socket.emit('joined_room', {
        roomCode: code,
        isHost: isHost,
        teamCode: participant.team_code,
        sessionToken: participant.session_token,
        name: participant.name,
        email: participant.email
      });

      broadcastRoom(room);
      console.log(`[SESSION RESTORED (SQL)] ${participant.name} (${participant.team_code}) reconnected to ${code}`);

      // If room is AUCTIONING and timer was paused while empty, resume timer
      if (room.status === 'AUCTIONING' && !room.timerInterval && !room.transitionInterval && room.currentIndex < room.auctionQueue.length) {
        resumePlayerAuction(room);
      }
    } catch (err) {
      console.error('[RECONNECT ERROR]', err);
      socket.emit('session_not_found');
    }
  });

  // Create Room with Custom Config
  socket.on('create_room', async ({ name, email, teamCode, config }) => {
    if (!name || !teamCode || !IPL_TEAMS[teamCode]) {
      return socket.emit('error_msg', 'Valid participant name, registration details, and IPL franchise are required.');
    }

    const roomCode = generateRoomCode();
    const sessionToken = crypto.randomUUID();

    const roomConfig = {
      teamBudget: Math.max(10, Number(config?.teamBudget) || 100.0),
      maxPlayersPerTeam: Math.max(5, Number(config?.maxPlayersPerTeam) || 25),
      maxForeignPerTeam: Math.max(1, Number(config?.maxForeignPerTeam) || 4),
      poolSize: Math.max(5, Number(config?.poolSize) || 70)
    };

    const newRoom = {
      code: roomCode,
      hostEmail: email,
      hostSocketId: socket.id,
      status: 'LOBBY',
      config: roomConfig,
      teams: {},
      participants: {},
      auctionQueue: [],
      manualSelection: [],
      currentIndex: 0,
      currentBid: 0,
      highestBidder: null,
      nextBid: 0,
      timer: 10,
      activityLog: [`Room ${roomCode} created with budget ₹${roomConfig.teamBudget} Cr, squad limit ${roomConfig.maxPlayersPerTeam}, foreign limit ${roomConfig.maxForeignPerTeam}.`],
      timerInterval: null,
      transitionInterval: null
    };

    // Initialize all 10 franchises with the configured budget
    Object.keys(IPL_TEAMS).forEach(code => {
      newRoom.teams[code] = {
        code,
        name: IPL_TEAMS[code].name,
        color: IPL_TEAMS[code].color,
        logo: IPL_TEAMS[code].logo,
        purse: roomConfig.teamBudget,
        squad: [],
        overseasCount: 0,
        claimedBy: null,
        claimedEmail: null
      };
    });

    // Claim selected team
    newRoom.teams[teamCode].claimedBy = name;
    newRoom.teams[teamCode].claimedEmail = email;
    newRoom.participants[socket.id] = { name, email: email || 'N/A', teamCode, isHost: true, sessionToken };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);

    // Save to SQL Database
    await db.saveRoomState(newRoom);
    await db.saveParticipant({
      sessionToken,
      roomCode,
      name,
      email: email || 'N/A',
      teamCode,
      isHost: true,
      socketId: socket.id
    });

    socket.emit('joined_room', { roomCode, isHost: true, teamCode, sessionToken, name, email });
    broadcastRoom(newRoom);
    console.log(`[ROOM CREATED (SQL)] ${roomCode} by ${name} (${teamCode}, Budget: ₹${roomConfig.teamBudget} Cr, Pool: ${roomConfig.poolSize})`);
  });

  // Join Room
  socket.on('join_room', async ({ roomCode, name, email, teamCode }) => {
    const code = (roomCode || '').toUpperCase().trim();
    let room = rooms.get(code);

    if (!room) {
      room = await db.loadRoomFromDB(code);
      if (room) {
        rooms.set(code, room);
      }
    }

    if (!room) {
      return socket.emit('error_msg', `Auction room ${code} does not exist.`);
    }

    if (!name || !teamCode || !IPL_TEAMS[teamCode]) {
      return socket.emit('error_msg', 'Valid participant name, registration details, and IPL franchise are required.');
    }

    const currentClaim = room.teams[teamCode].claimedBy;
    const currentEmail = room.teams[teamCode].claimedEmail;

    const isSameUser = currentClaim === name || (currentEmail && currentEmail.toLowerCase() === (email || '').toLowerCase());
    if (currentClaim && !isSameUser) {
      return socket.emit('error_msg', `${IPL_TEAMS[teamCode].name} has already been claimed by another participant.`);
    }

    const sessionToken = crypto.randomUUID();
    const isHost = (room.hostEmail && room.hostEmail.toLowerCase() === (email || '').toLowerCase()) || room.hostSocketId === socket.id;

    room.teams[teamCode].claimedBy = name;
    room.teams[teamCode].claimedEmail = email;
    room.participants[socket.id] = { name, email: email || 'N/A', teamCode, isHost, sessionToken };

    if (isHost) {
      room.hostSocketId = socket.id;
    }

    socket.join(code);

    await db.saveRoomState(room);
    await db.saveParticipant({
      sessionToken,
      roomCode: code,
      name,
      email: email || 'N/A',
      teamCode,
      isHost,
      socketId: socket.id
    });

    socket.emit('joined_room', { roomCode: code, isHost, teamCode, sessionToken, name, email });
    broadcastRoom(room);
    console.log(`[ROOM JOINED (SQL)] ${code}: ${name} (${email}) joined as ${teamCode}`);
  });

  // Host Updates Configuration
  socket.on('update_config', async ({ roomCode, config }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id || room.status !== 'LOBBY') return;

    const oldBudget = room.config.teamBudget;
    room.config.teamBudget = Math.max(10, Number(config.teamBudget) || room.config.teamBudget);
    room.config.maxPlayersPerTeam = Math.max(5, Number(config.maxPlayersPerTeam) || room.config.maxPlayersPerTeam);
    room.config.maxForeignPerTeam = Math.max(1, Number(config.maxForeignPerTeam) || room.config.maxForeignPerTeam);
    room.config.poolSize = Math.max(5, Number(config.poolSize) || room.config.poolSize);

    // If budget changed in lobby, adjust starting purses
    if (room.config.teamBudget !== oldBudget) {
      Object.keys(room.teams).forEach(code => {
        if (room.teams[code].squad.length === 0) {
          room.teams[code].purse = room.config.teamBudget;
        }
      });
    }

    room.activityLog.unshift(`Auction configured: Budget ₹${room.config.teamBudget} Cr | Squad Limit ${room.config.maxPlayersPerTeam} | Foreign Cap ${room.config.maxForeignPerTeam} | Pool ${room.config.poolSize}`);
    await db.saveRoomState(room);
    broadcastRoom(room);
  });

  // Host Saves Manually Selected Players
  socket.on('save_manual_players', async ({ roomCode, playerIds }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id || room.status !== 'LOBBY') return;

    if (!Array.isArray(playerIds)) return;

    const selectedList = [];
    playerIds.forEach(id => {
      const found = ALL_PLAYERS.find(p => p.id === id);
      if (found && !selectedList.some(p => p.id === id)) {
        selectedList.push(found);
      }
    });

    room.manualSelection = selectedList;
    room.config.poolSize = selectedList.length;
    room.activityLog.unshift(`Host manually selected ${selectedList.length} players for the auction pool.`);

    await db.saveRoomState(room);
    broadcastRoom(room);
  });

  // Host Shuffles Selected Players and Starts Auction
  socket.on('shuffle_and_start', async ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    if (!room.manualSelection || room.manualSelection.length === 0) {
      return socket.emit('error_msg', 'Please manually select players for the auction pool first.');
    }

    // Strictly shuffle ONLY the manually selected players!
    const shuffled = [...room.manualSelection].sort(() => 0.5 - Math.random());
    room.auctionQueue = shuffled;
    room.status = 'AUCTIONING';
    room.currentIndex = 0;

    room.activityLog.unshift(`Auction started with ${shuffled.length} randomly shuffled players.`);
    await db.saveRoomState(room);
    startPlayerAuction(room);
  });

  // Place Bid
  socket.on('place_bid', async ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'AUCTIONING') return;

    const participant = room.participants[socket.id];
    if (!participant) return;

    const teamCode = participant.teamCode;
    const team = room.teams[teamCode];
    const currentPlayer = room.auctionQueue[room.currentIndex];
    if (!currentPlayer) return;

    const bidAmount = room.nextBid;

    // VALIDATION RULES:
    if (room.highestBidder === teamCode) {
      return socket.emit('error_msg', 'Your team already holds the highest bid.');
    }
    if (team.purse < bidAmount) {
      return socket.emit('error_msg', `Insufficient purse! Remaining: ₹${team.purse.toFixed(2)} Cr, Bid: ₹${bidAmount.toFixed(2)} Cr.`);
    }
    if (team.squad.length >= (room.config.maxPlayersPerTeam || 25)) {
      return socket.emit('error_msg', `Squad player limit reached! Max ${room.config.maxPlayersPerTeam} players allowed per team.`);
    }
    if (currentPlayer.isOverseas && team.overseasCount >= (room.config.maxForeignPerTeam || 4)) {
      return socket.emit('error_msg', `Foreign player limit reached! Max ${room.config.maxForeignPerTeam} foreign players allowed.`);
    }

    // Accept Bid
    room.currentBid = bidAmount;
    room.highestBidder = teamCode;
    room.nextBid = calculateNextBid(room.currentBid, currentPlayer.basePrice);
    room.timer = 10;

    const logEntry = `${team.name} placed bid: ₹${bidAmount.toFixed(2)} Cr`;
    room.activityLog.unshift(logEntry);
    if (room.activityLog.length > 50) room.activityLog.pop();

    await db.recordBidLog({
      roomCode: room.code,
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      teamCode,
      teamName: team.name,
      bidAmount
    });
    await db.saveRoomState(room);

    io.to(room.code).emit('bid_placed', {
      teamCode,
      teamName: team.name,
      amount: bidAmount,
      nextBid: room.nextBid,
      timer: room.timer,
      playerName: currentPlayer.name
    });

    broadcastRoom(room);
  });

  // Host Skip / Next Player
  socket.on('skip_player', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;
    resolveCurrentPlayer(room, true);
  });

  // Host Toggle Pause / Resume
  socket.on('toggle_pause', async ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    if (room.status === 'AUCTIONING') {
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
        room.activityLog.unshift('Host paused the live auction timer.');
        await db.saveRoomState(room);
        broadcastRoom(room);
      } else {
        resumePlayerAuction(room);
        room.activityLog.unshift('Host resumed the live auction.');
        await db.saveRoomState(room);
        broadcastRoom(room);
      }
    }
  });

  // Leave Room
  socket.on('leave_room', async ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (room) {
      delete room.participants[socket.id];
      socket.leave(code);

      const activeSockets = io.sockets.adapter.rooms.get(code)?.size || 0;
      if (activeSockets === 0 || socket.id === room.hostSocketId) {
        pauseRoom(room);
        await db.saveRoomState(room);
        console.log(`[ROOM PAUSED (SQL)] Room ${code} paused because host/participants exited.`);
      } else {
        broadcastRoom(room);
      }
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);
    for (const [code, room] of rooms.entries()) {
      if (room.participants && room.participants[socket.id]) {
        delete room.participants[socket.id];
        const activeSockets = io.sockets.adapter.rooms.get(code)?.size || 0;
        if (activeSockets === 0) {
          pauseRoom(room);
          await db.saveRoomState(room);
          console.log(`[ROOM PAUSED (SQL)] Room ${code} paused as all participants disconnected.`);
        }
      }
    }
  });
});

function pauseRoom(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  if (room.transitionInterval) {
    clearInterval(room.transitionInterval);
    room.transitionInterval = null;
  }
}

function resumePlayerAuction(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.status !== 'AUCTIONING') return;

  room.timerInterval = setInterval(() => {
    if (room.status !== 'AUCTIONING') return;

    room.timer -= 1;
    io.to(room.code).emit('timer_tick', { timer: room.timer });

    if (room.timer <= 0) {
      clearInterval(room.timerInterval);
      resolveCurrentPlayer(room);
    }
  }, 1000);
}

async function startPlayerAuction(room) {
  if (room.transitionInterval) clearInterval(room.transitionInterval);

  if (room.currentIndex >= room.auctionQueue.length) {
    room.status = 'COMPLETED';
    if (room.timerInterval) clearInterval(room.timerInterval);
    await db.saveRoomState(room);
    io.to(room.code).emit('auction_completed');
    broadcastRoom(room);
    return;
  }

  const player = room.auctionQueue[room.currentIndex];
  room.currentBid = 0;
  room.highestBidder = null;
  room.nextBid = player.basePrice;
  room.timer = 10;

  room.activityLog.unshift(`Now Auctioning: ${player.name} (${player.role}, Base ₹${player.basePrice.toFixed(2)} Cr)`);

  await db.saveRoomState(room);

  io.to(room.code).emit('new_player', {
    player,
    basePrice: player.basePrice,
    nextBid: player.basePrice
  });

  broadcastRoom(room);

  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    if (room.status !== 'AUCTIONING') return;

    room.timer -= 1;
    io.to(room.code).emit('timer_tick', { timer: room.timer });

    if (room.timer <= 0) {
      clearInterval(room.timerInterval);
      resolveCurrentPlayer(room);
    }
  }, 1000);
}

async function resolveCurrentPlayer(room, forceUnsold = false) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.transitionInterval) clearInterval(room.transitionInterval);

  const player = room.auctionQueue[room.currentIndex];
  if (!player) return;

  const isLastPlayer = room.currentIndex + 1 >= room.auctionQueue.length;

  if (room.highestBidder && !forceUnsold) {
    // SOLD
    const winningTeam = room.teams[room.highestBidder];
    winningTeam.purse = Number((winningTeam.purse - room.currentBid).toFixed(2));
    const acquiredPlayer = {
      ...player,
      soldPrice: room.currentBid
    };
    winningTeam.squad.push(acquiredPlayer);

    if (player.isOverseas) {
      winningTeam.overseasCount += 1;
    }

    // Persist Sale in SQL Database
    await db.recordPlayerSale(room.code, winningTeam.code, acquiredPlayer, room.currentBid);

    const soldEvent = {
      status: 'SOLD',
      player,
      amount: room.currentBid,
      teamCode: winningTeam.code,
      teamName: winningTeam.name,
      teamLogo: winningTeam.logo,
      secondsLeft: 3,
      isLastPlayer
    };

    room.activityLog.unshift(`[SOLD] ${player.name} sold to ${winningTeam.name} for ₹${room.currentBid.toFixed(2)} Cr.`);
    io.to(room.code).emit('player_resolved', soldEvent);
  } else {
    // UNSOLD
    const unsoldEvent = {
      status: 'UNSOLD',
      player,
      amount: 0,
      teamCode: null,
      teamName: null,
      teamLogo: null,
      secondsLeft: 3,
      isLastPlayer
    };

    room.activityLog.unshift(`[UNSOLD] ${player.name} went unsold.`);
    io.to(room.code).emit('player_resolved', unsoldEvent);
  }

  // Persist updated room state in SQL
  await db.saveRoomState(room);
  broadcastRoom(room);

  // Active 3-second countdown broadcast to all clients
  let secondsRemaining = 3;
  room.transitionInterval = setInterval(() => {
    secondsRemaining -= 1;
    io.to(room.code).emit('transition_tick', { seconds: secondsRemaining, isLastPlayer });

    if (secondsRemaining <= 0) {
      clearInterval(room.transitionInterval);
      room.transitionInterval = null;
      room.currentIndex += 1;
      startPlayerAuction(room);
    }
  }, 1000);
}

// Start Server and SQL Database
startServer().catch(err => {
  console.error('[FATAL SERVER ERROR]', err);
});
