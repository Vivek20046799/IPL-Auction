// ==========================================================================
// IPL AUCTION ARENA - CLIENT APPLICATION (CRICBUZZ VIBRANT SANS EDITION)
// CONSTRAINTS: STRICTLY ZERO EMOJIS, ZERO GRADIENTS, NATIVE TTS
// FEATURES: SPEAKER TOGGLE, RULES BRIEFING, PROGRESS LINE, SCROLLABLE TEAMS
// ==========================================================================

const socket = io();

// Pre-configured IPL Teams
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

// Application State
let currentRoomCode = null;
let myName = '';
let myEmail = '';
let myTeamCode = null;
let isHost = false;
let audioEnabled = true;
let currentRoomState = null;

// DOM Elements
const views = {
  entry: document.getElementById('view-entry'),
  lobby: document.getElementById('view-lobby'),
  arena: document.getElementById('view-arena'),
  completed: document.getElementById('view-completed')
};

const notifyBar = document.getElementById('notification-bar');
const roomCodeBadge = document.getElementById('room-code-badge');
const displayRoomCode = document.getElementById('display-room-code');
const userInfoBadge = document.getElementById('user-info-badge');

// Speaker Toggle Elements
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const speakerStatusText = document.getElementById('speaker-status-text');

// Navigation & Ticker
const navRulesBtn = document.getElementById('nav-rules-btn');
const navSquadsBtn = document.getElementById('nav-squads-btn');
const teamsTickerBar = document.getElementById('teams-ticker-bar');
const tickerScroll = document.getElementById('ticker-scroll');

// View 1: Entry
const inputName = document.getElementById('input-name');
const inputEmail = document.getElementById('input-email');
const inputRoomCode = document.getElementById('input-room-code');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const teamSelectorScroll = document.getElementById('team-selector-scroll');
const selectedTeamDisplay = document.getElementById('selected-team-display');
const checkRulesAgree = document.getElementById('check-rules-agree');

// View 2: Lobby
const lobbyRoomCode = document.getElementById('lobby-room-code');
const lobbyTeamsScroll = document.getElementById('lobby-teams-scroll');
const hostLobbyControls = document.getElementById('host-lobby-controls');
const guestWaitingMsg = document.getElementById('guest-waiting-msg');
const selectPoolSize = document.getElementById('select-pool-size');
const btnRandomQueue = document.getElementById('btn-random-queue');
const btnStartAuction = document.getElementById('btn-start-auction');
const queueStatusText = document.getElementById('queue-status-text');

// View 3: Arena
const arenaTeamsList = document.getElementById('arena-teams-list');
const countdownDisplay = document.getElementById('countdown-display');
const countdownProgressLine = document.getElementById('countdown-progress-line');
const playerImg = document.getElementById('player-img');
const playerName = document.getElementById('player-name');
const playerNationality = document.getElementById('player-nationality');
const playerRoleBadge = document.getElementById('player-role-badge');
const playerOverseasBadge = document.getElementById('player-overseas-badge');
const playerRoleStat = document.getElementById('player-role-stat');
const playerBattingStat = document.getElementById('player-batting-stat');
const playerBowlingStat = document.getElementById('player-bowling-stat');
const playerBasePrice = document.getElementById('player-base-price');

const displayCurrentBid = document.getElementById('display-current-bid');
const displayHighestBidder = document.getElementById('display-highest-bidder');
const displayNextBid = document.getElementById('display-next-bid');
const displayMyPurse = document.getElementById('display-my-purse');
const btnPlaceBid = document.getElementById('btn-place-bid');
const btnBidAmount = document.getElementById('btn-bid-amount');
const bidStatusMessage = document.getElementById('bid-status-message');

const activityFeed = document.getElementById('activity-feed');
const hostArenaControls = document.getElementById('host-arena-controls');
const btnSkipPlayer = document.getElementById('btn-skip-player');

// Resolution Modal Overlay
const resolutionOverlay = document.getElementById('resolution-overlay');
const resolutionModal = document.getElementById('resolution-modal');
const resolutionTag = document.getElementById('resolution-tag');
const resolutionPlayerName = document.getElementById('resolution-player-name');
const resolutionDetails = document.getElementById('resolution-details');

// Rules Modal
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesAck = document.getElementById('btn-rules-ack');

// View 4: Completed
const finalSquadsContainer = document.getElementById('final-squads-container');
const btnBackLobby = document.getElementById('btn-back-lobby');

// ---------------------------------------------------------------------------
// 1. SPEAKER OPTION TOGGLE (Turn Off / On Voice Auctioneer)
// ---------------------------------------------------------------------------
function updateSpeakerUI() {
  if (audioEnabled) {
    speakerStatusText.textContent = 'ON';
    toggleAudioBtn.classList.remove('muted');
  } else {
    speakerStatusText.textContent = 'OFF';
    toggleAudioBtn.classList.add('muted');
  }
}

toggleAudioBtn.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  if (!audioEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  updateSpeakerUI();
  showNotification(audioEnabled ? 'Voice auctioneer enabled.' : 'Voice auctioneer muted.');
});
updateSpeakerUI();

function speak(text) {
  if (!audioEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// 2. RULES MODAL CONTROLS
// ---------------------------------------------------------------------------
navRulesBtn.addEventListener('click', () => {
  rulesModal.classList.remove('hidden');
});

btnCloseRules.addEventListener('click', () => {
  rulesModal.classList.add('hidden');
});

btnRulesAck.addEventListener('click', () => {
  rulesModal.classList.add('hidden');
  checkRulesAgree.checked = true;
});

navSquadsBtn.addEventListener('click', () => {
  if (currentRoomState && currentRoomState.status === 'COMPLETED') {
    switchView('completed');
  } else {
    showNotification('Final squads will be available once the auction completes.');
  }
});

// ---------------------------------------------------------------------------
// 3. NOTIFICATIONS & VIEW SWITCHING
// ---------------------------------------------------------------------------
function showNotification(msg) {
  notifyBar.textContent = msg;
  notifyBar.classList.remove('hidden');
  setTimeout(() => {
    notifyBar.classList.add('hidden');
  }, 4000);
}

function switchView(targetViewKey) {
  Object.keys(views).forEach(k => {
    views[k].classList.add('hidden');
  });
  views[targetViewKey].classList.remove('hidden');

  if (targetViewKey === 'arena' || targetViewKey === 'lobby') {
    teamsTickerBar.classList.remove('hidden');
  } else {
    teamsTickerBar.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// 4. SUBTLE HORIZONTAL TEAM SELECTOR (NO SCROLL BUTTONS)
// ---------------------------------------------------------------------------
function renderTeamSelector() {
  teamSelectorScroll.innerHTML = '';
  Object.keys(IPL_TEAMS).forEach(code => {
    const t = IPL_TEAMS[code];
    const card = document.createElement('div');
    card.className = `team-card ${myTeamCode === code ? 'selected' : ''}`;
    card.id = `select-team-${code}`;

    card.innerHTML = `
      <img src="${t.logo}" alt="${code}" class="team-logo-img" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
      <div class="team-code-lbl">${code}</div>
      <div class="team-status-lbl">SELECT</div>
    `;

    card.addEventListener('click', () => {
      if (card.classList.contains('disabled')) return;
      myTeamCode = code;
      document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTeamDisplay.textContent = `SELECTED: ${t.name} (${code})`;
    });

    teamSelectorScroll.appendChild(card);
  });
}
renderTeamSelector();

// ---------------------------------------------------------------------------
// 5. REGISTRATION & ROOM JOIN ACTIONS
// ---------------------------------------------------------------------------
btnCreateRoom.addEventListener('click', () => {
  const name = inputName.value.trim();
  const email = inputEmail.value.trim();

  if (!name) return showNotification('Please enter your full participant name.');
  if (!email) return showNotification('Please enter your email or participant ID.');
  if (!myTeamCode) return showNotification('Please scroll and select an IPL franchise.');
  if (!checkRulesAgree.checked) return showNotification('Please review and agree to the auction rules before proceeding.');

  myName = name;
  myEmail = email;
  socket.emit('create_room', { name, email, teamCode: myTeamCode });
});

btnJoinRoom.addEventListener('click', () => {
  const name = inputName.value.trim();
  const email = inputEmail.value.trim();
  const roomCode = inputRoomCode.value.trim().toUpperCase();

  if (!name) return showNotification('Please enter your full participant name.');
  if (!email) return showNotification('Please enter your email or participant ID.');
  if (!myTeamCode) return showNotification('Please scroll and select an IPL franchise.');
  if (!roomCode || roomCode.length < 4) return showNotification('Please enter a valid 6-character room code.');
  if (!checkRulesAgree.checked) return showNotification('Please review and agree to the auction rules before proceeding.');

  myName = name;
  myEmail = email;
  socket.emit('join_room', { roomCode, name, email, teamCode: myTeamCode });
});

socket.on('joined_room', (data) => {
  currentRoomCode = data.roomCode;
  isHost = data.isHost;
  myTeamCode = data.teamCode;

  displayRoomCode.textContent = currentRoomCode;
  roomCodeBadge.classList.remove('hidden');
  userInfoBadge.textContent = `${myName} (${myTeamCode})${isHost ? ' [HOST]' : ''}`;
  userInfoBadge.classList.remove('hidden');

  lobbyRoomCode.textContent = currentRoomCode;

  if (isHost) {
    hostLobbyControls.classList.remove('hidden');
    guestWaitingMsg.classList.add('hidden');
    hostArenaControls.classList.remove('hidden');
  } else {
    hostLobbyControls.classList.add('hidden');
    guestWaitingMsg.classList.remove('hidden');
    hostArenaControls.classList.add('hidden');
  }

  switchView('lobby');
});

socket.on('error_msg', (msg) => {
  showNotification(msg);
});

// ---------------------------------------------------------------------------
// 6. LOBBY INTERACTIONS & TICKER
// ---------------------------------------------------------------------------
btnRandomQueue.addEventListener('click', () => {
  const count = selectPoolSize.value;
  socket.emit('select_players', { roomCode: currentRoomCode, count });
});

btnStartAuction.addEventListener('click', () => {
  socket.emit('start_auction', { roomCode: currentRoomCode });
});

btnSkipPlayer.addEventListener('click', () => {
  socket.emit('skip_player', { roomCode: currentRoomCode });
});

btnPlaceBid.addEventListener('click', () => {
  socket.emit('place_bid', { roomCode: currentRoomCode });
});

btnBackLobby.addEventListener('click', () => {
  switchView('lobby');
});

// ---------------------------------------------------------------------------
// 7. ROOM STATE SYNC & CRICBUZZ MATCH TICKER
// ---------------------------------------------------------------------------
socket.on('room_update', (room) => {
  currentRoomState = room;
  renderTeamsTicker(room.teams, room.highestBidder);

  if (room.status === 'LOBBY') {
    switchView('lobby');
    renderLobbyTeams(room.teams);
    if (room.auctionQueue && room.auctionQueue.length > 0) {
      queueStatusText.textContent = `READY: ${room.auctionQueue.length} players selected for auction.`;
    }
  } else if (room.status === 'AUCTIONING') {
    switchView('arena');
    renderArena(room);
  } else if (room.status === 'COMPLETED') {
    switchView('completed');
    renderCompleted(room);
  }
});

function renderTeamsTicker(teams, highestBidder) {
  tickerScroll.innerHTML = '';
  Object.keys(teams).forEach(code => {
    const t = teams[code];
    const pill = document.createElement('div');
    const isLead = highestBidder === code;
    pill.className = `ticker-team-pill ${isLead ? 'active-lead' : ''}`;
    pill.innerHTML = `
      <img src="${t.logo}" alt="${code}" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
      <span>${code}: ₹${t.purse.toFixed(1)}Cr (${t.squad.length})</span>
    `;
    tickerScroll.appendChild(pill);
  });
}

function renderLobbyTeams(teams) {
  lobbyTeamsScroll.innerHTML = '';
  Object.keys(teams).forEach(code => {
    const t = teams[code];
    const box = document.createElement('div');
    box.className = `lobby-team-box ${t.claimedBy ? 'claimed' : ''}`;
    box.innerHTML = `
      <img src="${t.logo}" alt="${code}" style="width:32px; height:32px; object-fit:contain;" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
      <div>
        <div style="font-weight:900; font-size:0.85rem;">${t.name}</div>
        <div style="font-size:0.75rem; color:${t.claimedBy ? '#22c55e' : '#64748b'}; font-weight:800;">
          ${t.claimedBy ? `CLAIMED: ${t.claimedBy}` : 'UNCLAIMED'}
        </div>
      </div>
    `;
    lobbyTeamsScroll.appendChild(box);
  });
}

// ---------------------------------------------------------------------------
// 8. ARENA RENDERING & SCROLLABLE TEAMS
// ---------------------------------------------------------------------------
function renderArena(room) {
  // 1. Teams & Purses Column (Scrollable List)
  arenaTeamsList.innerHTML = '';
  Object.keys(room.teams).forEach(code => {
    const t = room.teams[code];
    const isTopBidder = room.highestBidder === code;
    const row = document.createElement('div');
    row.className = `team-purse-row ${isTopBidder ? 'active-bidder' : ''}`;

    row.innerHTML = `
      <img src="${t.logo}" alt="${code}" class="team-purse-logo" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
      <div class="team-purse-info">
        <div class="team-purse-name">${code} ${isTopBidder ? '[LEADER]' : ''}</div>
        <div class="team-purse-amount">Purse: ₹${t.purse.toFixed(2)} Cr</div>
        <div class="team-purse-squad">Squad: ${t.squad.length} (OS: ${t.overseasCount}/4)</div>
      </div>
    `;
    arenaTeamsList.appendChild(row);
  });

  // 2. Current Player Card
  const currentPlayer = room.auctionQueue[room.currentIndex];
  if (currentPlayer) {
    playerName.textContent = currentPlayer.name.toUpperCase();
    playerNationality.textContent = `${currentPlayer.nationality.toUpperCase()} • ${currentPlayer.role.toUpperCase()}`;
    playerRoleBadge.textContent = currentPlayer.role.toUpperCase();
    playerRoleStat.textContent = currentPlayer.role.toUpperCase();
    playerBattingStat.textContent = currentPlayer.battingRating;
    playerBowlingStat.textContent = currentPlayer.bowlingRating;
    playerBasePrice.textContent = `₹${currentPlayer.basePrice.toFixed(2)} Cr`;
    playerImg.src = currentPlayer.image;

    if (currentPlayer.isOverseas) {
      playerOverseasBadge.classList.remove('hidden');
    } else {
      playerOverseasBadge.classList.add('hidden');
    }
  }

  // 3. Bid Indicators
  displayCurrentBid.textContent = room.currentBid > 0 ? `₹${room.currentBid.toFixed(2)} Cr` : 'NO BIDS';
  displayHighestBidder.textContent = room.highestBidder
    ? `HELD BY: ${room.teams[room.highestBidder].name.toUpperCase()}`
    : 'BASE PRICE WAITING';

  displayNextBid.textContent = `₹${room.nextBid.toFixed(2)} Cr`;
  btnBidAmount.textContent = `₹${room.nextBid.toFixed(2)} Cr`;

  const myTeam = room.teams[myTeamCode];
  if (myTeam) {
    displayMyPurse.textContent = `YOUR PURSE: ₹${myTeam.purse.toFixed(2)} Cr`;

    let canBid = true;
    let reason = '';

    if (room.highestBidder === myTeamCode) {
      canBid = false;
      reason = 'You are the highest bidder';
    } else if (myTeam.purse < room.nextBid) {
      canBid = false;
      reason = 'Insufficient purse for next bid';
    } else if (currentPlayer && currentPlayer.isOverseas && myTeam.overseasCount >= 4) {
      canBid = false;
      reason = 'Overseas player limit reached (4/4)';
    }

    btnPlaceBid.disabled = !canBid;
    bidStatusMessage.textContent = reason;
  }

  // 4. Activity Logs
  activityFeed.innerHTML = '';
  (room.activityLog || []).forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = log;
    activityFeed.appendChild(entry);
  });
}

// ---------------------------------------------------------------------------
// 9. REAL-TIME AUCTION EVENTS & DECREASING COUNTDOWN LINE
// ---------------------------------------------------------------------------
let localTransitionTimer = null;
const resolutionTimerMsg = document.getElementById('resolution-timer-msg');
const resolutionCountdownNum = document.getElementById('resolution-countdown-num');

socket.on('new_player', ({ player, basePrice }) => {
  if (localTransitionTimer) {
    clearInterval(localTransitionTimer);
    localTransitionTimer = null;
  }
  resolutionOverlay.classList.add('hidden');
  countdownDisplay.textContent = '10s';
  countdownDisplay.style.color = '#cb202d';

  if (countdownProgressLine) {
    countdownProgressLine.style.width = '100%';
    countdownProgressLine.style.backgroundColor = '#cb202d';
  }

  speak(`New player: ${player.name}. Role: ${player.role}. Base price: ${basePrice} crore.`);
});

socket.on('bid_placed', ({ teamCode, teamName, amount, nextBid }) => {
  displayCurrentBid.textContent = `₹${amount.toFixed(2)} Cr`;
  displayHighestBidder.textContent = `HELD BY: ${teamName.toUpperCase()}`;
  displayNextBid.textContent = `₹${nextBid.toFixed(2)} Cr`;
  btnBidAmount.textContent = `₹${nextBid.toFixed(2)} Cr`;

  // Reset countdown line to 100% on valid bid
  if (countdownProgressLine) {
    countdownProgressLine.style.width = '100%';
    countdownProgressLine.style.backgroundColor = '#cb202d';
  }

  speak(`${teamName} bids ${amount} crore.`);
});

socket.on('timer_tick', ({ timer }) => {
  countdownDisplay.textContent = `${timer}s`;

  // Decreasing animated countdown line
  if (countdownProgressLine) {
    const pct = Math.max(0, Math.min(100, (timer / 10) * 100));
    countdownProgressLine.style.width = `${pct}%`;

    if (timer <= 3) {
      countdownProgressLine.style.backgroundColor = '#ef4444';
      countdownDisplay.style.color = '#ef4444';
    } else {
      countdownProgressLine.style.backgroundColor = '#cb202d';
      countdownDisplay.style.color = '#cb202d';
    }
  }
});

socket.on('player_resolved', ({ status, player, amount, teamName, secondsLeft, isLastPlayer }) => {
  if (localTransitionTimer) {
    clearInterval(localTransitionTimer);
    localTransitionTimer = null;
  }

  resolutionOverlay.classList.remove('hidden');
  resolutionModal.className = `resolution-card ${status.toLowerCase()}`;
  resolutionTag.textContent = status;
  resolutionPlayerName.textContent = player.name.toUpperCase();

  let count = Number(secondsLeft) || 3;
  const label = isLastPlayer ? 'AUCTION FINISHING IN' : 'NEXT PLAYER IN';
  if (resolutionTimerMsg) {
    resolutionTimerMsg.innerHTML = `${label} <span id="resolution-countdown-num">${count}</span>s...`;
  }

  // Active client-side countdown ticking down 3, 2, 1, 0 dynamically every second
  localTransitionTimer = setInterval(() => {
    count -= 1;
    const countElem = document.getElementById('resolution-countdown-num');
    if (countElem) {
      countElem.textContent = Math.max(0, count);
    }
    if (count <= 0) {
      clearInterval(localTransitionTimer);
      localTransitionTimer = null;
      resolutionOverlay.classList.add('hidden');
    }
  }, 1000);

  if (status === 'SOLD') {
    resolutionDetails.innerHTML = `PRICE: ₹${amount.toFixed(2)} CRORE<br/>SOLD TO: ${teamName.toUpperCase()}`;
    speak(`Sold! ${player.name} sold to ${teamName} for ${amount} crore.`);
  } else {
    resolutionDetails.innerHTML = `NO VALID BIDS<br/>PLAYER GOES UNSOLD`;
    speak(`${player.name} went unsold.`);
  }
});

// Real-time server sync tick for transition countdown
socket.on('transition_tick', ({ seconds, isLastPlayer }) => {
  const countElem = document.getElementById('resolution-countdown-num');
  if (countElem) {
    countElem.textContent = Math.max(0, seconds);
  }
  if (seconds <= 0) {
    if (localTransitionTimer) {
      clearInterval(localTransitionTimer);
      localTransitionTimer = null;
    }
    resolutionOverlay.classList.add('hidden');
  }
});

socket.on('auction_completed', () => {
  if (localTransitionTimer) {
    clearInterval(localTransitionTimer);
    localTransitionTimer = null;
  }
  resolutionOverlay.classList.add('hidden');
  switchView('completed');
  if (currentRoomState) {
    renderCompleted(currentRoomState);
  }
});

// ---------------------------------------------------------------------------
// 10. FINAL RESULTS DISPLAY
// ---------------------------------------------------------------------------
function renderCompleted(room) {
  finalSquadsContainer.innerHTML = '';
  Object.keys(room.teams).forEach(code => {
    const t = room.teams[code];
    const card = document.createElement('div');
    card.className = 'final-team-card';

    let squadHtml = '';
    if (t.squad.length === 0) {
      squadHtml = '<li style="color:#64748b;">No players purchased</li>';
    } else {
      t.squad.forEach(p => {
        squadHtml += `
          <li>
            <span>${p.name} (${p.role}${p.isOverseas ? ', OS' : ''})</span>
            <strong>₹${p.soldPrice.toFixed(2)} Cr</strong>
          </li>
        `;
      });
    }

    card.innerHTML = `
      <div class="final-team-header">
        <img src="${t.logo}" alt="${code}" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
        <div>
          <div style="font-weight:900;">${t.name}</div>
          <div style="font-size:0.75rem; color:#94a3b8;">
            Purse Left: ₹${t.purse.toFixed(2)} Cr | OS: ${t.overseasCount}/4
          </div>
        </div>
      </div>
      <ul class="final-squad-list">
        ${squadHtml}
      </ul>
    `;

    finalSquadsContainer.appendChild(card);
  });
}
