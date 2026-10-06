const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

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

// 1. Ingest Player Dataset from CSV
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
    // Robust regex parsing for CSV values with commas
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const item = {};
    headers.forEach((h, i) => {
      item[h] = (values[i] || '').replace(/^"|"$/g, '').trim();
    });

    const isOverseas = (item.overseas || '').toLowerCase() === 'true';
    const fullName = item.full_name || `Player ${idx + 1}`;

    return {
      id: item.player_id || `P-${idx + 1}`,
      name: fullName,
      shortName: item.short_name || fullName,
      nationality: item.nationality || (isOverseas ? 'Overseas' : 'India'),
      role: item.primary_role || 'All-Rounder',
      isOverseas: isOverseas,
      basePrice: calculateBasePrice(item.expected_price),
      battingRating: Number(item.batting_rating) || 60,
      bowlingRating: Number(item.bowling_rating) || 60,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=1e293b&color=ffffff&size=256&format=png&bold=true`
    };
  });
}

const ALL_PLAYERS = loadDataset();
console.log(`[DATASET LOADED] ${ALL_PLAYERS.length} total players ingested.`);

// 2. Active Rooms Store
const rooms = new Map();

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
  // Strip interval reference before emitting
  const { timerInterval, ...safeState } = room;
  io.to(room.code).emit('room_update', safeState);
}

// 3. Socket.IO Events
io.on('connection', (socket) => {
  console.log(`[CONNECT] Socket connected: ${socket.id}`);

  // Create Room
  socket.on('create_room', ({ name, email, teamCode }) => {
    if (!name || !teamCode || !IPL_TEAMS[teamCode]) {
      return socket.emit('error_msg', 'Valid participant name, registration details, and IPL franchise are required.');
    }

    const roomCode = generateRoomCode();
    const newRoom = {
      code: roomCode,
      hostSocketId: socket.id,
      status: 'LOBBY',
      teams: {},
      participants: {},
      auctionQueue: [],
      currentIndex: 0,
      currentBid: 0,
      highestBidder: null,
      nextBid: 0,
      timer: 10,
      activityLog: [],
      timerInterval: null
    };

    // Initialize all 10 franchises
    Object.keys(IPL_TEAMS).forEach(code => {
      newRoom.teams[code] = {
        code,
        name: IPL_TEAMS[code].name,
        color: IPL_TEAMS[code].color,
        logo: IPL_TEAMS[code].logo,
        purse: 100.0,
        squad: [],
        overseasCount: 0,
        claimedBy: null
      };
    });

    // Claim selected team
    newRoom.teams[teamCode].claimedBy = name;
    newRoom.participants[socket.id] = { name, email: email || 'N/A', teamCode, isHost: true };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);
    socket.emit('joined_room', { roomCode, isHost: true, teamCode });
    broadcastRoom(newRoom);
    console.log(`[ROOM CREATED] ${roomCode} by ${name} (${teamCode}, ${email})`);
  });

  // Join Room
  socket.on('join_room', ({ roomCode, name, email, teamCode }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      return socket.emit('error_msg', `Auction room ${code} does not exist.`);
    }

    if (!name || !teamCode || !IPL_TEAMS[teamCode]) {
      return socket.emit('error_msg', 'Valid participant name, registration details, and IPL franchise are required.');
    }

    if (room.teams[teamCode].claimedBy && room.teams[teamCode].claimedBy !== name) {
      return socket.emit('error_msg', `${IPL_TEAMS[teamCode].name} has already been claimed.`);
    }

    room.teams[teamCode].claimedBy = name;
    room.participants[socket.id] = { name, email: email || 'N/A', teamCode, isHost: false };

    socket.join(code);
    socket.emit('joined_room', { roomCode: code, isHost: false, teamCode });
    broadcastRoom(room);
    console.log(`[ROOM JOINED] ${code}: ${name} (${email}) joined as ${teamCode}`);
  });

  // Host Selects Players for Auction
  socket.on('select_players', ({ roomCode, count }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    const size = Math.min(Math.max(Number(count) || 20, 5), ALL_PLAYERS.length);
    // Shuffle and pick
    const shuffled = [...ALL_PLAYERS].sort(() => 0.5 - Math.random());
    room.auctionQueue = shuffled.slice(0, size);

    room.activityLog.unshift(`Host queued ${room.auctionQueue.length} players for the auction.`);
    broadcastRoom(room);
  });

  // Host Starts Auction
  socket.on('start_auction', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.auctionQueue.length === 0) {
      // Auto-queue 30 players if host didn't select
      const shuffled = [...ALL_PLAYERS].sort(() => 0.5 - Math.random());
      room.auctionQueue = shuffled.slice(0, 30);
    }

    room.status = 'AUCTIONING';
    room.currentIndex = 0;
    startPlayerAuction(room);
  });

  // Place Bid
  socket.on('place_bid', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'AUCTIONING') return;

    const participant = room.participants[socket.id];
    if (!participant) return;

    const teamCode = participant.teamCode;
    const team = room.teams[teamCode];
    const currentPlayer = room.auctionQueue[room.currentIndex];
    if (!currentPlayer) return;

    const bidAmount = room.nextBid;

    // VALIDATION:
    if (room.highestBidder === teamCode) {
      return socket.emit('error_msg', 'Your team already holds the highest bid.');
    }
    if (team.purse < bidAmount) {
      return socket.emit('error_msg', `Insufficient purse! You have ₹${team.purse.toFixed(2)} Cr, bid requires ₹${bidAmount.toFixed(2)} Cr.`);
    }
    if (currentPlayer.isOverseas && team.overseasCount >= 4) {
      return socket.emit('error_msg', 'Overseas player limit reached! Max 4 overseas players allowed.');
    }

    // Accept Bid
    room.currentBid = bidAmount;
    room.highestBidder = teamCode;
    room.nextBid = calculateNextBid(room.currentBid, currentPlayer.basePrice);

    // Reset countdown timer to 10 seconds
    room.timer = 10;

    const logEntry = `${team.name} placed bid: ₹${bidAmount.toFixed(2)} Cr`;
    room.activityLog.unshift(logEntry);
    if (room.activityLog.length > 50) room.activityLog.pop();

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
    resolveCurrentPlayer(room, true); // Force unsold
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);
  });
});

function startPlayerAuction(room) {
  if (room.transitionInterval) clearInterval(room.transitionInterval);

  if (room.currentIndex >= room.auctionQueue.length) {
    room.status = 'COMPLETED';
    if (room.timerInterval) clearInterval(room.timerInterval);
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

function resolveCurrentPlayer(room, forceUnsold = false) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.transitionInterval) clearInterval(room.transitionInterval);

  const player = room.auctionQueue[room.currentIndex];
  if (!player) return;

  const isLastPlayer = room.currentIndex + 1 >= room.auctionQueue.length;

  if (room.highestBidder && !forceUnsold) {
    // SOLD
    const winningTeam = room.teams[room.highestBidder];
    winningTeam.purse = Number((winningTeam.purse - room.currentBid).toFixed(2));
    winningTeam.squad.push({
      ...player,
      soldPrice: room.currentBid
    });
    if (player.isOverseas) {
      winningTeam.overseasCount += 1;
    }

    const soldEvent = {
      status: 'SOLD',
      player,
      amount: room.currentBid,
      teamCode: winningTeam.code,
      teamName: winningTeam.name,
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
      secondsLeft: 3,
      isLastPlayer
    };

    room.activityLog.unshift(`[UNSOLD] ${player.name} went unsold.`);
    io.to(room.code).emit('player_resolved', unsoldEvent);
  }

  broadcastRoom(room);

  // Active 3-second countdown broadcast to all clients!
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

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`IPL AUCTION ARENA SERVER LIVE ON PORT ${PORT}`);
  console.log(`http://localhost:${PORT}`);
  console.log(`===============================================`);
});
