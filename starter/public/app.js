// ==========================================================================
// IPL AUCTION ARENA - PRODUCTION APPLICATION LOGIC
// MATCHING VISUAL SPECIFICATIONS (SCREENSHOTS 1 & 2)
// FEATURES: MANUAL POOL BUILDER, POST-SELECTION SHUFFLE, CUSTOM LIMITS,
//           PARTICIPATING TEAMS ONLY, TEAM DRILLDOWN MODAL, SQL RESTORATION
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
let masterPlayers = [];
let selectedPlayerIds = new Set();
let activeRoleFilter = 'ALL';
let activeCountryFilter = 'ALL';
let currentSessionToken = localStorage.getItem('ipl_session_token') || null;
let currentRoomCode = localStorage.getItem('ipl_room_code') || null;
let myName = localStorage.getItem('ipl_user_name') || '';
let myEmail = localStorage.getItem('ipl_user_email') || '';
let myTeamCode = localStorage.getItem('ipl_team_code') || null;
let isHost = localStorage.getItem('ipl_is_host') === 'true';
let audioEnabled = localStorage.getItem('ipl_audio_enabled') !== 'false';
let currentRoomState = null;
let localTransitionTimer = null;

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
const btnLeaveRoom = document.getElementById('btn-leave-room');

// Navigation & Ticker
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const speakerStatusText = document.getElementById('speaker-status-text');
const navLiveBtn = document.getElementById('nav-live-btn');
const navRulesBtn = document.getElementById('nav-rules-btn');
const navSquadsBtn = document.getElementById('nav-squads-btn');
const teamsTickerBar = document.getElementById('teams-ticker-bar');
const tickerScroll = document.getElementById('ticker-scroll');

// View 1: Entry Elements
const inputName = document.getElementById('input-name');
const inputEmail = document.getElementById('input-email');
const inputRoomCode = document.getElementById('input-room-code');
const inputTeamBudget = document.getElementById('input-team-budget');
const inputMaxPlayers = document.getElementById('input-max-players');
const inputMaxForeign = document.getElementById('input-max-foreign');
const inputPoolSize = document.getElementById('input-pool-size');
const teamSelectorScroll = document.getElementById('team-selector-scroll');
const selectedTeamDisplay = document.getElementById('selected-team-display');
const checkRulesAgree = document.getElementById('check-rules-agree');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');

// View 2: Lobby Elements
const lobbyRoomCode = document.getElementById('lobby-room-code');
const lobbyTeamsScroll = document.getElementById('lobby-teams-scroll');
const lobbyConnectedCount = document.getElementById('lobby-connected-count');
const hostLobbyControls = document.getElementById('host-lobby-controls');
const guestWaitingMsg = document.getElementById('guest-waiting-msg');
const pillBudget = document.getElementById('pill-budget');
const pillSquad = document.getElementById('pill-squad');
const pillForeign = document.getElementById('pill-foreign');
const pillPool = document.getElementById('pill-pool');
const poolSelectionCount = document.getElementById('pool-selection-count');
const poolStatusMsg = document.getElementById('pool-status-msg');
const poolProgressFill = document.getElementById('pool-progress-fill');
const btnOpenPlayerPicker = document.getElementById('btn-open-player-picker');
const btnPickerCount = document.getElementById('btn-picker-count');
const btnShuffleStart = document.getElementById('btn-shuffle-start');

// View 3: Arena Elements (Screenshot 1)
const playerFirstName = document.getElementById('player-first-name');
const playerLastName = document.getElementById('player-last-name');
const playerRoleBadge = document.getElementById('player-role-badge');
const playerCountryBadge = document.getElementById('player-country-badge');
const playerOverseasTag = document.getElementById('player-overseas-tag');
const playerSetBadge = document.getElementById('player-set-badge');
const playerImg = document.getElementById('player-img');

const displayCurrentBid = document.getElementById('display-current-bid');
const leadingTeamLogo = document.getElementById('leading-team-logo');
const displayHighestBidder = document.getElementById('display-highest-bidder');

const myTeamLogo = document.getElementById('my-team-logo');
const myTeamNameDisplay = document.getElementById('my-team-name-display');
const myTeamSquadPill = document.getElementById('my-team-squad-pill');
const myTeamForeignPill = document.getElementById('my-team-foreign-pill');
const btnOpenMyStats = document.getElementById('btn-open-my-stats');
const displayMyPurse = document.getElementById('display-my-purse');
const btnPlaceBid = document.getElementById('btn-place-bid');
const btnBidAmount = document.getElementById('btn-bid-amount');
const bidStatusMessage = document.getElementById('bid-status-message');

const hostArenaControls = document.getElementById('host-arena-controls');
const btnSkipPlayer = document.getElementById('btn-skip-player');
const btnPauseAuction = document.getElementById('btn-pause-auction');
const btnEndAuction = document.getElementById('btn-end-auction');

const countdownDisplay = document.getElementById('countdown-display');
const countdownProgressLine = document.getElementById('countdown-progress-line');
const featuredSoldCard = document.getElementById('featured-sold-card');
const featuredSoldTeam = document.getElementById('featured-sold-team');
const featuredSoldPlayer = document.getElementById('featured-sold-player');
const featuredSoldPrice = document.getElementById('featured-sold-price');
const activityFeed = document.getElementById('activity-feed');

// View 4: Completed
const finalSquadsContainer = document.getElementById('final-squads-container');
const btnBackLobby = document.getElementById('btn-back-lobby');

// Modal 1: Player Picker Drawer
const playerPickerModal = document.getElementById('player-picker-modal');
const btnClosePicker = document.getElementById('btn-close-picker');
const pickerSelectedNum = document.getElementById('picker-selected-num');
const pickerTargetNum = document.getElementById('picker-target-num');
const pickerRemainingNeeded = document.getElementById('picker-remaining-needed');
const pickerSearchInput = document.getElementById('picker-search-input');
const pickerPlayersList = document.getElementById('picker-players-list');
const btnSelectTopN = document.getElementById('btn-select-top-n');
const lblQuickTopN = document.getElementById('lbl-quick-top-n');
const btnClearSelection = document.getElementById('btn-clear-selection');
const btnConfirmPool = document.getElementById('btn-confirm-pool');
const btnConfirmCount = document.getElementById('btn-confirm-count');
const pickerFooterInfo = document.getElementById('picker-footer-info');

// Modal 2: Team Stats Overview
const teamStatsModal = document.getElementById('team-stats-modal');
const btnCloseTeamModal = document.getElementById('btn-close-team-modal');
const btnCloseTeamFooter = document.getElementById('btn-close-team-footer');
const teamModalLogo = document.getElementById('team-modal-logo');
const teamModalName = document.getElementById('team-modal-name');
const teamModalClaimed = document.getElementById('team-modal-claimed');
const statSquadCount = document.getElementById('stat-squad-count');
const statForeignCount = document.getElementById('stat-foreign-count');
const statForeignRem = document.getElementById('stat-foreign-rem');
const statTotalSpent = document.getElementById('stat-total-spent');
const statRemainingBudget = document.getElementById('stat-remaining-budget');
const teamSquadTbody = document.getElementById('team-squad-tbody');
const teamSquadEmpty = document.getElementById('team-squad-empty');

// Modal 3: Resolution ("AUCTION UPDATE" - Screenshot 2)
const resolutionOverlay = document.getElementById('resolution-overlay');
const btnCloseResolution = document.getElementById('btn-close-resolution');
const resolutionPlayerImg = document.getElementById('resolution-player-img');
const resolutionPlayerRole = document.getElementById('resolution-player-role');
const resolutionPlayerName = document.getElementById('resolution-player-name');
const resolutionTeamLogo = document.getElementById('resolution-team-logo');
const resolutionTeamName = document.getElementById('resolution-team-name');
const resolutionTeamCode = document.getElementById('resolution-team-code');
const resolutionFinalPrice = document.getElementById('resolution-final-price');
const resolutionStamp = document.getElementById('resolution-stamp');
const resolutionCountdownNum = document.getElementById('resolution-countdown-num');
const btnNextPlayerNow = document.getElementById('btn-next-player-now');

// Modal 4: Rules Modal
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesAck = document.getElementById('btn-rules-ack');

// Pre-fill inputs if stored
if (myName && inputName) inputName.value = myName;
if (myEmail && inputEmail) inputEmail.value = myEmail;
if (currentRoomCode && inputRoomCode) inputRoomCode.value = currentRoomCode;

// Fetch Master Player Database
fetch('/api/players')
  .then(res => res.json())
  .then(data => {
    masterPlayers = data;
    console.log(`[CLIENT] Loaded ${masterPlayers.length} master players from database.`);
  })
  .catch(err => console.error('Error fetching players:', err));

// ---------------------------------------------------------------------------
// 1. SPEAKER TOGGLE (VOICE AUCTIONEER)
// ---------------------------------------------------------------------------
function updateSpeakerUI() {
  if (audioEnabled) {
    speakerStatusText.textContent = 'ON';
    toggleAudioBtn.classList.remove('muted');
  } else {
    speakerStatusText.textContent = 'OFF';
    toggleAudioBtn.classList.add('muted');
  }
  localStorage.setItem('ipl_audio_enabled', audioEnabled ? 'true' : 'false');
}

toggleAudioBtn.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  if (!audioEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  updateSpeakerUI();
  showNotification(audioEnabled ? 'Voice announcer enabled.' : 'Voice announcer muted.');
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
// 2. NAVIGATION & NOTIFICATIONS
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
    if (views[k]) views[k].classList.add('hidden');
  });
  if (views[targetViewKey]) {
    views[targetViewKey].classList.remove('hidden');
  }

  if (targetViewKey === 'arena' || targetViewKey === 'lobby') {
    teamsTickerBar.classList.remove('hidden');
  } else {
    teamsTickerBar.classList.add('hidden');
  }
}

navRulesBtn.addEventListener('click', () => rulesModal.classList.remove('hidden'));
btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
btnRulesAck.addEventListener('click', () => {
  rulesModal.classList.add('hidden');
  if (checkRulesAgree) checkRulesAgree.checked = true;
});

navSquadsBtn.addEventListener('click', () => {
  if (currentRoomState && currentRoomState.status === 'COMPLETED') {
    switchView('completed');
  } else if (currentRoomState) {
    openTeamStatsModal(myTeamCode);
  } else {
    showNotification('Join or create an auction room to view squads.');
  }
});

// ---------------------------------------------------------------------------
// 3. HORIZONTAL FRANCHISE SELECTOR
// ---------------------------------------------------------------------------
function renderTeamSelector() {
  if (!teamSelectorScroll) return;
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
      myTeamCode = code;
      localStorage.setItem('ipl_team_code', code);
      document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      if (selectedTeamDisplay) {
        selectedTeamDisplay.textContent = `SELECTED: ${t.name} (${code})`;
      }
    });

    teamSelectorScroll.appendChild(card);
  });

  if (myTeamCode && IPL_TEAMS[myTeamCode] && selectedTeamDisplay) {
    selectedTeamDisplay.textContent = `SELECTED: ${IPL_TEAMS[myTeamCode].name} (${myTeamCode})`;
  }
}
renderTeamSelector();

// ---------------------------------------------------------------------------
// 4. REGISTRATION, SESSION & SQL RECOVERY
// ---------------------------------------------------------------------------
function persistSession(data) {
  if (data.sessionToken) {
    currentSessionToken = data.sessionToken;
    localStorage.setItem('ipl_session_token', data.sessionToken);
  }
  if (data.roomCode) {
    currentRoomCode = data.roomCode;
    localStorage.setItem('ipl_room_code', data.roomCode);
  }
  if (data.name) {
    myName = data.name;
    localStorage.setItem('ipl_user_name', data.name);
  }
  if (data.email) {
    myEmail = data.email;
    localStorage.setItem('ipl_user_email', data.email);
  }
  if (data.teamCode) {
    myTeamCode = data.teamCode;
    localStorage.setItem('ipl_team_code', data.teamCode);
  }
  if (data.isHost !== undefined) {
    isHost = data.isHost;
    localStorage.setItem('ipl_is_host', data.isHost ? 'true' : 'false');
  }
}

function clearStoredSession() {
  currentSessionToken = null;
  currentRoomCode = null;
  isHost = false;
  localStorage.removeItem('ipl_session_token');
  localStorage.removeItem('ipl_room_code');
  localStorage.removeItem('ipl_is_host');
}

// Automatic Session Restore on Page Load
function attemptSessionRestore() {
  if (currentSessionToken || (myEmail && currentRoomCode)) {
    showNotification('Restoring auction session from database...');
    socket.emit('reconnect_session', {
      sessionToken: currentSessionToken,
      roomCode: currentRoomCode,
      email: myEmail
    });
  }
}

socket.on('connect', () => {
  attemptSessionRestore();
});

socket.on('session_not_found', () => {
  clearStoredSession();
  switchView('entry');
});

// Create Room with Custom Config
btnCreateRoom.addEventListener('click', () => {
  const name = inputName.value.trim();
  const email = inputEmail.value.trim();

  if (!name) return showNotification('Please enter your full participant name.');
  if (!email) return showNotification('Please enter your email or participant ID.');
  if (!myTeamCode) return showNotification('Please scroll and select an IPL franchise.');
  if (!checkRulesAgree.checked) return showNotification('Please review and agree to auction rules before proceeding.');

  const config = {
    teamBudget: Number(inputTeamBudget.value) || 100,
    maxPlayersPerTeam: Number(inputMaxPlayers.value) || 25,
    maxForeignPerTeam: Number(inputMaxForeign.value) || 4,
    poolSize: Number(inputPoolSize.value) || 70
  };

  myName = name;
  myEmail = email;
  socket.emit('create_room', { name, email, teamCode: myTeamCode, config });
});

// Join Existing Room
btnJoinRoom.addEventListener('click', () => {
  const name = inputName.value.trim();
  const email = inputEmail.value.trim();
  const roomCode = inputRoomCode.value.trim().toUpperCase();

  if (!name) return showNotification('Please enter your full participant name.');
  if (!email) return showNotification('Please enter your email or participant ID.');
  if (!myTeamCode) return showNotification('Please scroll and select an IPL franchise.');
  if (!roomCode || roomCode.length < 4) return showNotification('Please enter a valid 6-character room code.');
  if (!checkRulesAgree.checked) return showNotification('Please review and agree to auction rules before proceeding.');

  myName = name;
  myEmail = email;
  socket.emit('join_room', { roomCode, name, email, teamCode: myTeamCode });
});

socket.on('joined_room', (data) => {
  persistSession(data);

  displayRoomCode.textContent = currentRoomCode;
  roomCodeBadge.classList.remove('hidden');
  userInfoBadge.textContent = `${myName} (${myTeamCode})${isHost ? ' [HOST]' : ''}`;
  userInfoBadge.classList.remove('hidden');
  btnLeaveRoom.classList.remove('hidden');

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

  if (currentRoomState) {
    if (currentRoomState.status === 'AUCTIONING') {
      switchView('arena');
      renderArena(currentRoomState);
    } else if (currentRoomState.status === 'COMPLETED') {
      switchView('completed');
      renderCompleted(currentRoomState);
    } else {
      switchView('lobby');
      renderLobby(currentRoomState);
    }
  } else {
    switchView('lobby');
  }
});

socket.on('error_msg', (msg) => {
  showNotification(msg);
});

// Exit / Leave Room
if (btnLeaveRoom) {
  btnLeaveRoom.addEventListener('click', () => {
    if (confirm('Leave current room and return to registration? Your squad & bids remain saved.')) {
      if (currentRoomCode) {
        socket.emit('leave_room', { roomCode: currentRoomCode });
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (localTransitionTimer) {
        clearInterval(localTransitionTimer);
        localTransitionTimer = null;
      }
      if (resolutionOverlay) {
        resolutionOverlay.classList.add('hidden');
      }

      clearStoredSession();
      currentRoomState = null;

      roomCodeBadge.classList.add('hidden');
      userInfoBadge.classList.add('hidden');
      btnLeaveRoom.classList.add('hidden');
      teamsTickerBar.classList.add('hidden');

      switchView('entry');
      showNotification('Session exited. All franchise data & squads remain stored.');
    }
  });
}

// ---------------------------------------------------------------------------
// 5. LOBBY & MANUAL PLAYER POOL SELECTION
// ---------------------------------------------------------------------------
function renderLobby(room) {
  if (!room) return;
  const cfg = room.config || { teamBudget: 100, maxPlayersPerTeam: 25, maxForeignPerTeam: 4, poolSize: 70 };

  pillBudget.textContent = `Budget: ₹${cfg.teamBudget.toFixed(2)} Cr`;
  pillSquad.textContent = `Squad Limit: ${cfg.maxPlayersPerTeam}`;
  pillForeign.textContent = `Foreign Limit: ${cfg.maxForeignPerTeam}`;
  pillPool.textContent = `Target Pool: ${cfg.poolSize}`;
  lblQuickTopN.textContent = cfg.poolSize;

  // Render Connected Claimed Teams
  renderLobbyTeams(room.teams);

  // Sync selected player IDs if host
  const selectedCount = (room.manualSelection || []).length;
  if (room.manualSelection && room.manualSelection.length > 0) {
    selectedPlayerIds = new Set(room.manualSelection.map(p => p.id));
  }

  poolSelectionCount.textContent = `${selectedCount} / ${cfg.poolSize} Players Selected`;
  btnPickerCount.textContent = `${selectedCount}/${cfg.poolSize}`;

  const pct = Math.min(100, (selectedCount / cfg.poolSize) * 100);
  poolProgressFill.style.width = `${pct}%`;

  if (selectedCount === cfg.poolSize && cfg.poolSize > 0) {
    poolStatusMsg.textContent = `All ${cfg.poolSize} players selected! Ready to shuffle and start auction.`;
    poolStatusMsg.style.color = '#00f59b';
    btnShuffleStart.disabled = false;
  } else if (selectedCount > cfg.poolSize) {
    poolStatusMsg.textContent = `Too many selected (${selectedCount}/${cfg.poolSize}). Remove ${selectedCount - cfg.poolSize} players.`;
    poolStatusMsg.style.color = '#ef4444';
    btnShuffleStart.disabled = true;
  } else {
    poolStatusMsg.textContent = `Select ${cfg.poolSize - selectedCount} more players to complete the auction pool.`;
    poolStatusMsg.style.color = '#94a3b8';
    btnShuffleStart.disabled = true;
  }
}

function renderLobbyTeams(teams) {
  if (!lobbyTeamsScroll || !teams) return;
  lobbyTeamsScroll.innerHTML = '';
  let connected = 0;

  Object.keys(teams).forEach(code => {
    const t = teams[code];
    if (t.claimedBy) connected++;

    const box = document.createElement('div');
    box.className = `lobby-team-box ${t.claimedBy ? 'claimed' : ''}`;
    box.innerHTML = `
      <img src="${t.logo}" alt="${code}" style="width:32px; height:32px; object-fit:contain;" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
      <div>
        <div style="font-weight:900; font-size:0.85rem; color:#fff;">${t.name}</div>
        <div style="font-size:0.75rem; color:${t.claimedBy ? '#00f59b' : '#64748b'}; font-weight:800;">
          ${t.claimedBy ? `CLAIMED: ${t.claimedBy}` : 'UNCLAIMED'}
        </div>
      </div>
    `;
    lobbyTeamsScroll.appendChild(box);
  });

  if (lobbyConnectedCount) {
    lobbyConnectedCount.textContent = `${connected} franchise${connected === 1 ? '' : 's'} joined`;
  }
}

// Open Player Picker Drawer
btnOpenPlayerPicker.addEventListener('click', () => {
  openPlayerPickerModal();
});

function openPlayerPickerModal() {
  playerPickerModal.classList.remove('hidden');
  updatePickerHeader();
  renderPickerGrid();
}

btnClosePicker.addEventListener('click', () => {
  playerPickerModal.classList.add('hidden');
});

function updatePickerHeader() {
  const target = currentRoomState?.config?.poolSize || 70;
  const count = selectedPlayerIds.size;
  pickerSelectedNum.textContent = count;
  pickerTargetNum.textContent = target;
  btnConfirmCount.textContent = `${count}/${target}`;

  if (count === target) {
    pickerRemainingNeeded.textContent = 'Target reached! Ready to confirm.';
    pickerRemainingNeeded.style.color = '#00f59b';
    btnConfirmPool.disabled = false;
  } else if (count > target) {
    pickerRemainingNeeded.textContent = `${count - target} too many selected!`;
    pickerRemainingNeeded.style.color = '#ef4444';
    btnConfirmPool.disabled = true;
  } else {
    pickerRemainingNeeded.textContent = `${target - count} more needed`;
    pickerRemainingNeeded.style.color = '#94a3b8';
    btnConfirmPool.disabled = count === 0;
  }
}

// Role and Country Filter Tabs
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.parentElement;
    parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.role) activeRoleFilter = btn.dataset.role;
    if (btn.dataset.country) activeCountryFilter = btn.dataset.country;

    renderPickerGrid();
  });
});

pickerSearchInput.addEventListener('input', () => {
  renderPickerGrid();
});

function getFilteredPlayers() {
  const q = pickerSearchInput.value.trim().toLowerCase();
  return masterPlayers.filter(p => {
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.nationality && p.nationality.toLowerCase().includes(q));
    const matchesRole = activeRoleFilter === 'ALL' || (p.role && p.role.toUpperCase().includes(activeRoleFilter));
    let matchesCountry = true;
    if (activeCountryFilter === 'INDIAN') matchesCountry = !p.isOverseas;
    if (activeCountryFilter === 'OVERSEAS') matchesCountry = p.isOverseas;

    return matchesSearch && matchesRole && matchesCountry;
  });
}

function renderPickerGrid() {
  pickerPlayersList.innerHTML = '';
  const filtered = getFilteredPlayers();

  if (filtered.length === 0) {
    pickerPlayersList.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#64748b;">No players found matching current filters.</div>`;
    return;
  }

  filtered.forEach(p => {
    const isSelected = selectedPlayerIds.has(p.id);
    const card = document.createElement('div');
    card.className = `picker-player-card ${isSelected ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="picker-checkbox"></div>
      <img src="${p.image}" alt="${p.name}" class="picker-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=1e293b&color=ffffff&bold=true'" />
      <div class="picker-info">
        <div class="picker-name" title="${p.name}">${p.name}</div>
        <div class="picker-meta">
          <span>${p.role}</span> • <span>${p.isOverseas ? 'Foreign' : 'India'}</span> • <span>₹${p.basePrice.toFixed(2)}Cr</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      if (selectedPlayerIds.has(p.id)) {
        selectedPlayerIds.delete(p.id);
        card.classList.remove('selected');
      } else {
        selectedPlayerIds.add(p.id);
        card.classList.add('selected');
      }
      updatePickerHeader();
    });

    pickerPlayersList.appendChild(card);
  });
}

// Quick tools: Select Top N & Clear All
btnSelectTopN.addEventListener('click', () => {
  const target = currentRoomState?.config?.poolSize || 70;
  const filtered = getFilteredPlayers();
  filtered.slice(0, target).forEach(p => selectedPlayerIds.add(p.id));
  updatePickerHeader();
  renderPickerGrid();
});

btnClearSelection.addEventListener('click', () => {
  selectedPlayerIds.clear();
  updatePickerHeader();
  renderPickerGrid();
});

// Confirm Selection
btnConfirmPool.addEventListener('click', () => {
  const playerIds = Array.from(selectedPlayerIds);
  socket.emit('save_manual_players', { roomCode: currentRoomCode, playerIds });
  playerPickerModal.classList.add('hidden');
  showNotification(`Saved ${playerIds.length} players into the auction pool!`);
});

// Shuffle & Start Auction
btnShuffleStart.addEventListener('click', () => {
  if (selectedPlayerIds.size === 0) {
    return showNotification('Please manually select players before shuffling!');
  }
  socket.emit('shuffle_and_start', { roomCode: currentRoomCode });
});

// ---------------------------------------------------------------------------
// 6. TOP PARTICIPATING TEAMS TICKER & TEAM DRILLDOWN MODAL
// ---------------------------------------------------------------------------
function renderTeamsTicker(teams, highestBidder) {
  if (!tickerScroll || !teams) return;
  tickerScroll.innerHTML = '';

  const maxPlayers = currentRoomState?.config?.maxPlayersPerTeam || 25;
  const maxForeign = currentRoomState?.config?.maxForeignPerTeam || 4;

  // CRITICAL REQUIREMENT: ONLY SHOW PARTICIPATING / CLAIMED TEAMS!
  const participatingCodes = Object.keys(teams).filter(code => teams[code].claimedBy);

  // If no one claimed yet, fallback to all
  const codesToDisplay = participatingCodes.length > 0 ? participatingCodes : Object.keys(teams);

  codesToDisplay.forEach(code => {
    const t = teams[code];
    const isLead = highestBidder === code;
    const pill = document.createElement('div');
    pill.className = `ticker-team-pill ${isLead ? 'active-lead' : ''}`;
    const squadCount = t.squad ? t.squad.length : 0;
    const overseasCount = t.overseasCount || 0;

    pill.innerHTML = `
      <img src="${t.logo}" alt="${code}" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
      <span>${t.name}: ₹${t.purse.toFixed(1)}Cr (${squadCount}/${maxPlayers} | OS: ${overseasCount}/${maxForeign})</span>
    `;

    pill.addEventListener('click', () => {
      openTeamStatsModal(code);
    });

    tickerScroll.appendChild(pill);
  });
}

function openTeamStatsModal(teamCode) {
  if (!currentRoomState || !currentRoomState.teams) return;
  const team = currentRoomState.teams[teamCode] || currentRoomState.teams[myTeamCode];
  if (!team) return;

  const maxPlayers = currentRoomState.config?.maxPlayersPerTeam || 25;
  const maxForeign = currentRoomState.config?.maxForeignPerTeam || 4;
  const initialBudget = currentRoomState.config?.teamBudget || 100;
  const squad = team.squad || [];

  let totalSpent = squad.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
  totalSpent = Number(totalSpent.toFixed(2));
  const remainingSlots = Math.max(0, maxForeign - (team.overseasCount || 0));

  teamModalLogo.src = team.logo;
  teamModalName.textContent = team.name.toUpperCase();
  teamModalClaimed.textContent = team.claimedBy ? `CLAIMED BY: ${team.claimedBy.toUpperCase()}` : 'UNCLAIMED FRANCHISE';

  statSquadCount.textContent = `${squad.length} / ${maxPlayers}`;
  statForeignCount.textContent = `${team.overseasCount || 0} / ${maxForeign}`;
  statForeignRem.textContent = remainingSlots === 0 ? 'No foreign slots remaining' : `${remainingSlots} foreign slot${remainingSlots === 1 ? '' : 's'} remaining`;
  statTotalSpent.textContent = `₹${totalSpent.toFixed(2)} Cr`;
  statRemainingBudget.textContent = `₹${team.purse.toFixed(2)} Cr`;

  teamSquadTbody.innerHTML = '';
  if (squad.length === 0) {
    teamSquadEmpty.classList.remove('hidden');
  } else {
    teamSquadEmpty.classList.add('hidden');
    squad.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${idx + 1}</strong></td>
        <td><strong>${p.name}</strong></td>
        <td><span class="${p.isOverseas ? 'tag-foreign' : 'tag-country'}">${p.isOverseas ? 'Foreign' : 'Indian'}</span></td>
        <td><span class="tag-role">${p.role || 'All-Rounder'}</span></td>
        <td><strong class="text-accent">₹${(p.soldPrice || 0).toFixed(2)} Cr</strong></td>
      `;
      teamSquadTbody.appendChild(tr);
    });
  }

  teamStatsModal.classList.remove('hidden');
}

btnCloseTeamModal.addEventListener('click', () => teamStatsModal.classList.add('hidden'));
btnCloseTeamFooter.addEventListener('click', () => teamStatsModal.classList.add('hidden'));

if (btnOpenMyStats) {
  btnOpenMyStats.addEventListener('click', () => {
    openTeamStatsModal(myTeamCode);
  });
}

// ---------------------------------------------------------------------------
// 7. ARENA VIEW RENDERING (MATCHING SCREENSHOT 1)
// ---------------------------------------------------------------------------
function renderArena(room) {
  if (!room || !room.teams) return;

  const maxPlayers = room.config?.maxPlayersPerTeam || 25;
  const maxForeign = room.config?.maxForeignPerTeam || 4;
  const currentPlayer = (room.auctionQueue || [])[room.currentIndex];

  // 1. Current Player Showcase
  if (currentPlayer) {
    const nameParts = (currentPlayer.name || 'Player').split(' ');
    if (nameParts.length > 1) {
      playerFirstName.textContent = nameParts.slice(0, -1).join(' ').toUpperCase();
      playerLastName.textContent = nameParts[nameParts.length - 1].toUpperCase();
    } else {
      playerFirstName.textContent = '';
      playerLastName.textContent = currentPlayer.name.toUpperCase();
    }

    playerRoleBadge.textContent = (currentPlayer.role || 'ALL-ROUNDER').toUpperCase();
    playerCountryBadge.textContent = (currentPlayer.nationality || 'INDIA').toUpperCase();
    playerSetBadge.textContent = `SET ${room.currentIndex + 1}/${room.auctionQueue.length}`;
    playerImg.src = currentPlayer.image;

    if (currentPlayer.isOverseas) {
      playerOverseasTag.classList.remove('hidden');
    } else {
      playerOverseasTag.classList.add('hidden');
    }
  }

  // 2. Live Bid Section
  displayCurrentBid.textContent = room.currentBid > 0 ? `₹${room.currentBid.toFixed(2)} CR` : `₹${(room.nextBid || 2.0).toFixed(2)} CR (BASE)`;

  if (room.highestBidder && room.teams[room.highestBidder]) {
    const leader = room.teams[room.highestBidder];
    displayHighestBidder.textContent = leader.name.toUpperCase();
    leadingTeamLogo.src = leader.logo;
    leadingTeamLogo.style.display = 'block';
  } else {
    displayHighestBidder.textContent = 'BASE PRICE WAITING';
    leadingTeamLogo.style.display = 'none';
  }

  // 3. User's Franchise Controls
  const myTeam = room.teams[myTeamCode];
  if (myTeam) {
    myTeamLogo.src = myTeam.logo;
    myTeamNameDisplay.innerHTML = `${myTeam.name} <span class="online-dot"></span>`;
    myTeamSquadPill.textContent = `${myTeam.squad ? myTeam.squad.length : 0}/${maxPlayers}`;
    myTeamForeignPill.textContent = `Foreign: ${myTeam.overseasCount || 0}/${maxForeign}`;
    displayMyPurse.textContent = `₹${myTeam.purse.toFixed(2)} Cr`;
    btnBidAmount.textContent = `₹${room.nextBid.toFixed(2)} CR`;

    let canBid = true;
    let reason = '';

    if (room.highestBidder === myTeamCode) {
      canBid = false;
      reason = 'Your team holds the highest bid';
    } else if (myTeam.purse < room.nextBid) {
      canBid = false;
      reason = `Insufficient purse for ₹${room.nextBid.toFixed(2)} Cr bid`;
    } else if (myTeam.squad.length >= maxPlayers) {
      canBid = false;
      reason = `Squad player limit reached (${maxPlayers}/${maxPlayers})`;
    } else if (currentPlayer && currentPlayer.isOverseas && myTeam.overseasCount >= maxForeign) {
      canBid = false;
      reason = `Foreign player limit reached (${maxForeign}/${maxForeign})`;
    }

    btnPlaceBid.disabled = !canBid;
    bidStatusMessage.textContent = reason;
  }

  // 4. Host Controls
  if (isHost) {
    hostArenaControls.classList.remove('hidden');
    btnPauseAuction.textContent = room.timerInterval ? 'PAUSE' : 'RESUME';
  } else {
    hostArenaControls.classList.add('hidden');
  }

  // 5. Activity Feed
  activityFeed.innerHTML = '';
  (room.activityLog || []).forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = log;
    activityFeed.appendChild(entry);
  });
}

// Bidding and Host Actions
btnPlaceBid.addEventListener('click', () => {
  socket.emit('place_bid', { roomCode: currentRoomCode });
});

btnSkipPlayer.addEventListener('click', () => {
  socket.emit('skip_player', { roomCode: currentRoomCode });
});

btnPauseAuction.addEventListener('click', () => {
  socket.emit('toggle_pause', { roomCode: currentRoomCode });
});

btnEndAuction.addEventListener('click', () => {
  if (confirm('End auction and display final squads summary?')) {
    socket.emit('skip_player', { roomCode: currentRoomCode });
  }
});

btnBackLobby.addEventListener('click', () => {
  switchView('lobby');
});

// ---------------------------------------------------------------------------
// 8. REAL-TIME AUCTION EVENTS
// ---------------------------------------------------------------------------
socket.on('room_update', (room) => {
  if (!currentRoomCode || (room && room.code !== currentRoomCode)) return;
  currentRoomState = room;
  renderTeamsTicker(room.teams, room.highestBidder);

  if (room.status === 'LOBBY') {
    switchView('lobby');
    renderLobby(room);
  } else if (room.status === 'AUCTIONING') {
    switchView('arena');
    renderArena(room);
  } else if (room.status === 'COMPLETED') {
    switchView('completed');
    renderCompleted(room);
  }
});

socket.on('new_player', ({ player, basePrice }) => {
  if (!currentRoomCode) return;
  if (localTransitionTimer) {
    clearInterval(localTransitionTimer);
    localTransitionTimer = null;
  }
  resolutionOverlay.classList.add('hidden');
  countdownDisplay.textContent = '10s';
  countdownDisplay.style.color = '#ef4444';

  if (countdownProgressLine) {
    countdownProgressLine.style.width = '100%';
    countdownProgressLine.style.backgroundColor = '#ef4444';
  }

  speak(`Featured player: ${player.name}. Role: ${player.role}. Base price: ${basePrice} crore.`);
});

socket.on('bid_placed', ({ teamCode, teamName, amount, nextBid, playerName }) => {
  if (!currentRoomCode) return;
  displayCurrentBid.textContent = `₹${amount.toFixed(2)} CR`;
  displayHighestBidder.textContent = teamName.toUpperCase();
  btnBidAmount.textContent = `₹${nextBid.toFixed(2)} CR`;

  if (countdownProgressLine) {
    countdownProgressLine.style.width = '100%';
    countdownProgressLine.style.backgroundColor = '#ef4444';
  }

  speak(`${teamName} bids ${amount} crore.`);
});

socket.on('timer_tick', ({ timer }) => {
  if (!currentRoomCode) return;
  if (countdownDisplay) countdownDisplay.textContent = `${timer}s`;

  if (countdownProgressLine) {
    const pct = Math.max(0, Math.min(100, (timer / 10) * 100));
    countdownProgressLine.style.width = `${pct}%`;

    if (timer <= 3) {
      countdownProgressLine.style.backgroundColor = '#dc2626';
      if (countdownDisplay) countdownDisplay.style.color = '#dc2626';
    } else {
      countdownProgressLine.style.backgroundColor = '#ef4444';
      if (countdownDisplay) countdownDisplay.style.color = '#ef4444';
    }
  }
});

// Resolution Modal ("AUCTION UPDATE" - Screenshot 2)
socket.on('player_resolved', ({ status, player, amount, teamCode, teamName, teamLogo, secondsLeft, isLastPlayer }) => {
  if (!currentRoomCode) return;
  if (localTransitionTimer) {
    clearInterval(localTransitionTimer);
    localTransitionTimer = null;
  }

  // Update Activity Center Featured Banner (Screenshot 1)
  if (status === 'SOLD') {
    featuredSoldCard.classList.remove('hidden');
    featuredSoldTeam.textContent = teamName.toUpperCase();
    featuredSoldPlayer.textContent = player.name.toUpperCase();
    featuredSoldPrice.textContent = `₹${amount.toFixed(2)} Cr`;
  }

  // Render Resolution Modal (Screenshot 2)
  resolutionOverlay.classList.remove('hidden');
  resolutionPlayerImg.src = player.image;
  resolutionPlayerRole.textContent = (player.role || 'ALL-ROUNDER').toUpperCase();
  resolutionPlayerName.textContent = player.name;

  if (status === 'SOLD') {
    resolutionTeamName.textContent = teamName;
    resolutionTeamCode.textContent = teamCode || '';
    resolutionTeamLogo.src = teamLogo || (IPL_TEAMS[teamCode] ? IPL_TEAMS[teamCode].logo : '');
    resolutionTeamLogo.style.display = 'block';
    resolutionFinalPrice.textContent = `₹${amount.toFixed(2)} Cr`;
    resolutionStamp.className = 'resolution-stamp stamp-sold';
    resolutionStamp.textContent = 'SOLD';
    speak(`Sold! ${player.name} sold to ${teamName} for ${amount} crore.`);
  } else {
    resolutionTeamName.textContent = 'NO BIDDER';
    resolutionTeamCode.textContent = 'UNSOLD';
    resolutionTeamLogo.style.display = 'none';
    resolutionFinalPrice.textContent = `₹0.00 Cr`;
    resolutionStamp.className = 'resolution-stamp stamp-unsold';
    resolutionStamp.textContent = 'UNSOLD';
    speak(`${player.name} went unsold.`);
  }

  let count = Number(secondsLeft) || 3;
  resolutionCountdownNum.textContent = count;

  localTransitionTimer = setInterval(() => {
    count -= 1;
    if (resolutionCountdownNum) {
      resolutionCountdownNum.textContent = Math.max(0, count);
    }
    if (count <= 0) {
      clearInterval(localTransitionTimer);
      localTransitionTimer = null;
      resolutionOverlay.classList.add('hidden');
    }
  }, 1000);
});

btnCloseResolution.addEventListener('click', () => {
  resolutionOverlay.classList.add('hidden');
});

btnNextPlayerNow.addEventListener('click', () => {
  if (localTransitionTimer) {
    clearInterval(localTransitionTimer);
    localTransitionTimer = null;
  }
  resolutionOverlay.classList.add('hidden');
});

socket.on('transition_tick', ({ seconds, isLastPlayer }) => {
  if (!currentRoomCode) return;
  if (resolutionCountdownNum) {
    resolutionCountdownNum.textContent = Math.max(0, seconds);
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
  if (!currentRoomCode) return;
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
// 9. FINAL RESULTS DISPLAY
// ---------------------------------------------------------------------------
function renderCompleted(room) {
  if (!finalSquadsContainer || !room || !room.teams) return;
  finalSquadsContainer.innerHTML = '';
  const maxPlayers = room.config?.maxPlayersPerTeam || 25;
  const maxForeign = room.config?.maxForeignPerTeam || 4;

  Object.keys(room.teams).forEach(code => {
    const t = room.teams[code];
    const card = document.createElement('div');
    card.className = 'final-team-card';

    let squadHtml = '';
    const squad = t.squad || [];
    if (squad.length === 0) {
      squadHtml = '<li style="color:#64748b;">No players acquired</li>';
    } else {
      squad.forEach(p => {
        squadHtml += `
          <li>
            <span><strong>${p.name}</strong> (${p.role}${p.isOverseas ? ', Foreign' : ''})</span>
            <strong class="text-accent">₹${(p.soldPrice || 0).toFixed(2)} Cr</strong>
          </li>
        `;
      });
    }

    card.innerHTML = `
      <div class="final-team-header">
        <img src="${t.logo}" alt="${code}" onerror="this.src='https://ui-avatars.com/api/?name=${code}&background=1e293b&color=ffffff&bold=true'" />
        <div>
          <div style="font-weight:900; color:#fff;">${t.name}</div>
          <div style="font-size:0.75rem; color:#94a3b8;">
            Purse Left: ₹${t.purse.toFixed(2)} Cr | Squad: ${squad.length}/${maxPlayers} | Foreign: ${t.overseasCount || 0}/${maxForeign}
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
