// INTERNET OLYMPICS 2 — Blind Board Logic (Fixed Version)

// Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot,
  runTransaction, serverTimestamp, query, where
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyDJ8uiR2qEUfXIuFEO21-40668WNpOdj2w",
  authDomain: "c0uchz0mb13.firebaseapp.com",
  projectId: "c0uchz0mb13",
  storageBucket: "c0uchz0mb13.firebasestorage.app",
  messagingSenderId: "1051521591004",
  appId: "1:1051521591004:web:1301f129fc0f3032f6f619",
  measurementId: "G-6BNDYZQRPE"
};

let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  // expose for admin page
  window.db = db;
  window.doc = doc; window.collection = collection; window.getDoc = getDoc; window.getDocs = getDocs;
  window.setDoc = setDoc; window.updateDoc = updateDoc; window.onSnapshot = onSnapshot;
  window.runTransaction = runTransaction; window.serverTimestamp = serverTimestamp;
  console.log('Firebase initialized');
} catch (e) {
  console.error('Firebase init failed', e);
}

// ---------- Constants ----------
const AVAILABLE_BOXES = [
  'box-1','box-2','box-3','box-4','box-5',
  'box-6','box-7','box-8','box-9','box-10',
  'box-11','box-12','box-13','box-14','box-15',
  'box-16','box-17','box-18','box-19','box-20',
  'box-21','box-22','box-23','box-24','box-25'
];

// Mix of all images randomly distributed
const DEFAULTS = {
  'box-1': { 
    characterName:'Mystery Box 1', 
    imagePath:'glenbubu-1.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-2': { 
    characterName:'Mystery Box 2', 
    imagePath:'daft-tech.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-tech.mp3' 
  },
  'box-3': { 
    characterName:'Mystery Box 3', 
    imagePath:'glenbubu-2.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-4': { 
    characterName:'Mystery Box 4', 
    imagePath:'daft-harder.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-harder.mp3' 
  },
  'box-5': { 
    characterName:'Mystery Box 5', 
    imagePath:'glenbubu-3.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-6': { 
    characterName:'Mystery Box 6', 
    imagePath:'daft-5555.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-5555.mp3' 
  },
  'box-7': { 
    characterName:'Mystery Box 7', 
    imagePath:'glenbubu-1.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-8': { 
    characterName:'Mystery Box 8', 
    imagePath:'glenbubu-2.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-9': { 
    characterName:'Mystery Box 9', 
    imagePath:'daft-tech.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-tech.mp3' 
  },
  'box-10': { 
    characterName:'Mystery Box 10', 
    imagePath:'glenbubu-3.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-11': { 
    characterName:'Mystery Box 11', 
    imagePath:'daft-harder.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-harder.mp3' 
  },
  'box-12': { 
    characterName:'Mystery Box 12', 
    imagePath:'glenbubu-1.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-13': { 
    characterName:'MEGA CENTER', 
    imagePath:'daft-5555.png', 
    teamPoints:10000, 
    individualPoints:2000, 
    teamChallenge:'MEGA CHALLENGE', 
    individualChallenge:'MEGA 3v3 BATTLE', 
    cardType:'mega',
    specialMessage:'CENTER STAGE. DOUBLE POINTS. NO MERCY.',
    revealSound:'daft-5555.mp3' 
  },
  'box-14': { 
    characterName:'Mystery Box 14', 
    imagePath:'glenbubu-2.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-15': { 
    characterName:'Mystery Box 15', 
    imagePath:'glenbubu-3.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-16': { 
    characterName:'Mystery Box 16', 
    imagePath:'daft-tech.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-tech.mp3' 
  },
  'box-17': { 
    characterName:'Mystery Box 17', 
    imagePath:'glenbubu-1.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-18': { 
    characterName:'Mystery Box 18', 
    imagePath:'daft-harder.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-harder.mp3' 
  },
  'box-19': { 
    characterName:'Mystery Box 19', 
    imagePath:'glenbubu-2.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-20': { 
    characterName:'Mystery Box 20', 
    imagePath:'glenbubu-3.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-21': { 
    characterName:'Mystery Box 21', 
    imagePath:'daft-5555.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-5555.mp3' 
  },
  'box-22': { 
    characterName:'Mystery Box 22', 
    imagePath:'glenbubu-1.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-23': { 
    characterName:'Mystery Box 23', 
    imagePath:'daft-tech.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-tech.mp3' 
  },
  'box-24': { 
    characterName:'Mystery Box 24', 
    imagePath:'glenbubu-2.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'' 
  },
  'box-25': { 
    characterName:'Mystery Box 25', 
    imagePath:'daft-harder.png', 
    teamPoints:5000, 
    individualPoints:1000, 
    teamChallenge:'Team mission TBD', 
    individualChallenge:'3v3 mission TBD', 
    cardType:'regular',
    revealSound:'daft-harder.mp3' 
  }
};

// ---------- Local state ----------
const state = {
  boxes: {},
  currentUser: null,       // '@handle' or something; from access code record
  currentTeam: null,       // 'team-1' | 'team-2'
  currentTurn: null,       // from gameState/current
  selectedBox: null
};

// ---------- Access-code login ----------
const LOGIN_SOURCES = [
  { type:'docById', collection:'accessCodes', idIsCode:true },
  { type:'query',   collection:'players',    codeField:'accessCode' },
  { type:'query',   collection:'users',      codeField:'accessCode' },
  { type:'query',   collection:'userAccess', codeField:'accessCode' }
];

function normalizeTeam(v) {
  if (!v) return null;
  const s = String(v).toLowerCase().replace(/\s+/g,'').replace(/_/g,'-');
  if (['team1','team-1','hot','red','1'].includes(s)) return 'team-1';
  if (['team2','team-2','cold','blue','2'].includes(s)) return 'team-2';
  return null;
}

async function lookupAccessCode(code) {
  // try id match first
  try {
    const ref = doc(db, 'accessCodes', code);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id:snap.id, ...snap.data() };
  } catch {}
  // then query the listed collections
  for (const src of LOGIN_SOURCES.filter(s => s.type === 'query')) {
    try {
      const qRef = query(collection(db, src.collection), where(src.codeField, '==', code));
      const res = await getDocs(qRef);
      if (!res.empty) {
        const d = res.docs[0];
        return { id:d.id, ...d.data() };
      }
      // try lowercased mirror if present
      const lc = code.toLowerCase();
      const qRef2 = query(collection(db, src.collection), where(src.codeField + 'Lower', '==', lc));
      const res2 = await getDocs(qRef2);
      if (!res2.empty) {
        const d2 = res2.docs[0];
        return { id:d2.id, ...d2.data() };
      }
    } catch {}
  }
  return null;
}

window.login = async function login() {
  const input = document.getElementById('accessCode');
  const err = document.getElementById('loginError');
  if (!input || !err) return;

  err.textContent = '';
  const code = (input.value || '').trim();
  if (!code) { err.textContent = 'enter a code.'; return; }

  try {
    const match = await lookupAccessCode(code);
    if (!match) { err.textContent = 'invalid code.'; return; }

    const team = normalizeTeam(match.team ?? match.teamId ?? match.house);
    if (!team) { err.textContent = 'code found but no team assigned.'; return; }

    const user = match.user ?? match.handle ?? match.username ?? match.id ?? code;

    state.currentUser = user;
    state.currentTeam = team;
    localStorage.setItem('blind_user', JSON.stringify({ user, team }));

    await setDoc(doc(db, 'gameState', 'session-' + code), {
      user, team, lastSeen: serverTimestamp()
    }, { merge:true });

    document.getElementById('loginModal').style.display = 'none';
  } catch (e) {
    console.error(e);
    err.textContent = 'login failed.';
  }
};

// show login if needed on load
(function restoreLogin(){
  try {
    const raw = localStorage.getItem('blind_user');
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.user && s.team) {
        state.currentUser = s.user; state.currentTeam = s.team;
      } else {
        document.getElementById('loginModal').style.display = 'block';
      }
    } else {
      document.getElementById('loginModal').style.display = 'block';
    }
  } catch {
    document.getElementById('loginModal').style.display = 'block';
  }
})();

// ---------- Bootstrap ----------
document.addEventListener('DOMContentLoaded', async () => {
  wireBoxClicks();
  await ensureBoxes();
  await initialLoad();
  liveListeners();
});

function wireBoxClicks(){
  document.querySelectorAll('.blind-box').forEach(el => {
    const id = el.dataset.boxId;
    if (AVAILABLE_BOXES.includes(id)) {
      el.addEventListener('click', onBoxClick);
    } else {
      el.classList.add('unavailable');
    }
  });
}

// Create default docs if missing
async function ensureBoxes(){
  for (const id of AVAILABLE_BOXES) {
    const ref = doc(db, 'blindBoxes', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        status:'available',
        ...DEFAULTS[id],
        createdAt: serverTimestamp()
      });
    }
  }
}

async function initialLoad(){
  // game state
  const gs = await getDoc(doc(db, 'gameState', 'current'));
  if (gs.exists()) {
    const d = gs.data();
    state.currentTurn = d.currentTurn || null;
    updateTurnIndicator();
  }
  // scores
  const sc = await getDoc(doc(db, 'gameState', 'scores'));
  if (sc.exists()) {
    const s = sc.data();
    setScoreEl('team1Points', s.team1 || 0);
    setScoreEl('team2Points', s.team2 || 0);
  }
  // boxes
  for (const id of AVAILABLE_BOXES) {
    const b = await getDoc(doc(db, 'blindBoxes', id));
    if (b.exists()) {
      state.boxes[id] = b.data();
      paintBox(id, b.data());
    }
  }
}

function liveListeners(){
  // game state + reveal trigger
  onSnapshot(doc(db, 'gameState', 'current'), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();

    // Check for rejection
    if (d.rejectionMessage && d.status === 'waiting') {
      const modal = document.getElementById('rejectionModal');
      const msg = document.getElementById('rejectionMessage');
      if (modal && msg) {
        msg.textContent = d.rejectionMessage || 'Selection rejected. Try again.';
        modal.style.display = 'block';
      }
      // Clear the rejection message after showing
      setTimeout(() => {
        updateDoc(doc(db, 'gameState', 'current'), { 
          rejectionMessage: null 
        });
      }, 1000);
    }

    if (d.currentTurn !== state.currentTurn) {
      state.currentTurn = d.currentTurn || null;
      updateTurnIndicator();
    }
    
    if (d.status === 'revealing' && d.selectedBox) {
      const boxId = d.selectedBox;
      const revealData = d.revealData || state.boxes[boxId] || {};
      // Hide waiting modal first
      const wait = document.getElementById('waitingModal');
      if (wait) wait.style.display = 'none';
      revealFlow(boxId, revealData);
    }
  });

  // scores
  onSnapshot(doc(db, 'gameState', 'scores'), (snap) => {
    if (!snap.exists()) return;
    const s = snap.data();
    setScoreEl('team1Points', s.team1 || 0);
    setScoreEl('team2Points', s.team2 || 0);
  });

  // boxes
  AVAILABLE_BOXES.forEach(id => {
    onSnapshot(doc(db, 'blindBoxes', id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      state.boxes[id] = data;
      paintBox(id, data);
    });
  });
}

// ---------- UI helpers ----------
function setScoreEl(id, val){
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateTurnIndicator(){
  const el = document.getElementById('currentTurn');
  const wrap = el?.parentElement;
  if (!el || !wrap) return;
  if (state.currentTurn) {
    el.textContent = `${state.currentTurn === 'team-1' ? 'TEAM HOT' : 'TEAM COLD'} TURN`;
    wrap.className = `turn-indicator ${state.currentTurn}`;
  } else {
    el.textContent = 'waiting to start...';
    wrap.className = 'turn-indicator';
  }
}

function paintBox(id, data){
  const el = document.querySelector(`.blind-box[data-box-id="${id}"]`);
  if (!el) return;
  el.classList.remove('selected','opened','claimed-team-1','claimed-team-2','pending');
  const s = data.status || 'available';
  if (s === 'pending') el.classList.add('pending');
  if (s === 'opened' || s === 'in_challenge' || s === 'in-challenge' || s === 'claimed') el.classList.add('opened');
  if (data.claimedBy) el.classList.add(`claimed-${data.claimedBy}`);
}

// ---------- Box selection (transaction-safe) ----------
async function onBoxClick(evt){
  const el = evt.currentTarget;
  const boxId = el.dataset.boxId;

  // require login
  if (!state.currentTeam) {
    document.getElementById('loginModal').style.display = 'block';
    return;
  }
  
  // turn gate with user feedback
  if (state.currentTurn && state.currentTurn !== state.currentTeam) {
    const modal = document.getElementById('turnWarningModal');
    const msg = document.getElementById('turnWarningMessage');
    if (modal && msg) {
      msg.textContent = `It's ${state.currentTurn === 'team-1' ? 'TEAM HOT' : 'TEAM COLD'}'s turn!`;
      modal.style.display = 'block';
    }
    return;
  }

  try {
    await runTransaction(db, async (tx) => {
      const boxRef = doc(db, 'blindBoxes', boxId);
      const gsRef  = doc(db, 'gameState', 'current');

      const [boxSnap, gsSnap] = await Promise.all([tx.get(boxRef), tx.get(gsRef)]);
      if (!boxSnap.exists()) throw new Error('missing box');
      const box = boxSnap.data();
      const gs = gsSnap.exists() ? gsSnap.data() : {};

      if (box.status && box.status !== 'available') throw new Error('not available');
      if (gs.currentTurn && gs.currentTurn !== state.currentTeam) throw new Error('not your turn');

      tx.update(boxRef, {
        status:'pending',
        selectedBy: state.currentUser || 'anonymous',
        selectedTeam: state.currentTeam || null,
        selectedAt: serverTimestamp()
      });
      tx.set(gsRef, {
        selectedBox: boxId,
        status:'waiting_for_reveal',
        lastUpdated: serverTimestamp()
      }, { merge:true });
    });

    // mark local + modal
    document.querySelectorAll('.blind-box').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');

    // Stop background music
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
      bgMusic.pause();
    }

    // Play selection sound
    const snd = document.getElementById('selectSound'); 
    if (snd) snd.play();
    
    // Show waiting modal and play waiting sound
    document.getElementById('waitingModal').style.display = 'block';
    const waitingSound = document.getElementById('waitingSound');
    if (waitingSound) {
      waitingSound.loop = true;
      waitingSound.volume = 0.5;
      waitingSound.play().catch(e => console.log('Waiting sound blocked'));
    }
    
    state.selectedBox = boxId;
  } catch (e) {
    // race or gate fail
    console.warn('select failed:', e.message);
    if (e.message === 'not available') {
      alert('This box has already been selected!');
    }
  }
}

// ---------- Reveal + challenge flow ----------
async function revealFlow(boxId, boxData){
  // Stop waiting sound
  const waitingSound = document.getElementById('waitingSound');
  if (waitingSound) {
    waitingSound.pause();
    waitingSound.currentTime = 0;
  }
  
  // Merge with defaults if needed
  const fullData = {
    ...DEFAULTS[boxId],
    ...boxData
  };

  // ensure opened
  try {
    await updateDoc(doc(db, 'blindBoxes', boxId), { 
      status:'opened', 
      openedAt: serverTimestamp() 
    });
  } catch {}

  // Check for special cards
  if (fullData.cardType === 'bully') {
    const specialSound = document.getElementById('specialSound'); 
    if (specialSound) specialSound.play();
    const img = document.getElementById('specialImage');
    const title = document.getElementById('specialTitle');
    const text = document.getElementById('specialText');
    if (img) img.src = `/assets/b04rd/${fullData.imagePath || 'glenbubu-2.png'}`;
    if (title) title.textContent = fullData.characterName || fullData.labubuName || 'SPECIAL CARD';
    if (text) text.textContent = fullData.specialMessage || 'chaos mode activated. prepare for trouble.';
    document.getElementById('specialModal').style.display = 'block';
    
    // Override the global function
    window.confirmSpecial = () => {
      document.getElementById('specialModal').style.display = 'none';
      showRevealModal(boxId, fullData);
    };
    return;
  }
  
  if (fullData.cardType === 'mega') {
    const specialSound = document.getElementById('specialSound'); 
    if (specialSound) specialSound.play();
    const img = document.getElementById('megaImage');
    const text = document.getElementById('megaText');
    if (img) img.src = `/assets/b04rd/${fullData.imagePath || 'glenbubu-3.png'}`;
    if (text) text.textContent = fullData.specialMessage || 'double or nothing. all points x2. no mercy.';
    document.getElementById('megaModal').style.display = 'block';
    
    // Override the global function
    window.confirmMega = () => {
      document.getElementById('megaModal').style.display = 'none';
      // Double the points for mega
      fullData.teamPoints = (fullData.teamPoints || 5000) * 2;
      fullData.individualPoints = (fullData.individualPoints || 1000) * 2;
      showRevealModal(boxId, fullData);
    };
    return;
  }

  showRevealModal(boxId, fullData);
}

function showRevealModal(boxId, boxData){
  state.selectedBox = boxId;

  const d = {
    characterName: boxData.characterName || boxData.labubuName || 'Mystery Box',
    imagePath:  boxData.imagePath || 'glenbubu-2.png',
    teamPoints: boxData.teamPoints ?? 5000,
    individualPoints: boxData.individualPoints ?? 1000,
    teamChallenge: boxData.teamChallenge || 'Team challenge',
    individualChallenge: boxData.individualChallenge || '3v3 battle',
    revealSound: boxData.revealSound || ''
  };

  // Play custom reveal sound or default
  if (d.revealSound) {
    // Try to play the custom sound
    let customSound = null;
    if (d.revealSound === 'daft-tech.mp3') customSound = document.getElementById('daftTechSound');
    else if (d.revealSound === 'daft-harder.mp3') customSound = document.getElementById('daftHarderSound');
    else if (d.revealSound === 'daft-5555.mp3') customSound = document.getElementById('daft5555Sound');
    
    if (customSound) {
      customSound.play();
    } else {
      const revealSound = document.getElementById('revealSound');
      if (revealSound) revealSound.play();
    }
  } else {
    const revealSound = document.getElementById('revealSound');
    if (revealSound) revealSound.play();
  }
  
  const img = document.getElementById('revealedDoll'); 
  if (img) img.src = `/assets/b04rd/${d.imagePath}`;
  
  const name = document.getElementById('dollName'); 
  if (name) name.textContent = d.characterName;
  
  const tp = document.getElementById('teamPoints'); 
  if (tp) tp.textContent = `${d.teamPoints} pts`;
  
  const ip = document.getElementById('individualPoints'); 
  if (ip) ip.textContent = `${d.individualPoints} pts`;

  // wire choice buttons
  const teamBtn = document.getElementById('teamBtn');
  const indBtn  = document.getElementById('individualBtn');
  if (teamBtn) teamBtn.onclick = () => openChallengeDetails('team', d, boxId);
  if (indBtn)  indBtn.onclick  = () => openChallengeDetails('individual', d, boxId);

  document.getElementById('revealModal').style.display = 'block';
}

function openChallengeDetails(kind, d, boxId){
  document.getElementById('revealModal').style.display = 'none';
  const title = document.getElementById('challengeType');
  const desc  = document.getElementById('challengeDescription');
  const pts   = document.getElementById('challengePointsValue');

  if (title) title.textContent = kind === 'team' ? 'Team Challenge' : '3v3 Battle';
  if (desc)  desc.textContent  = kind === 'team' ? d.teamChallenge : d.individualChallenge;
  const points = kind === 'team' ? d.teamPoints : d.individualPoints;
  if (pts) pts.textContent = points;

  // Play the reveal sound again when showing challenge details
  if (d.revealSound) {
    // Try to play the custom sound
    let customSound = null;
    if (d.revealSound === 'daft-tech.mp3') customSound = document.getElementById('daftTechSound');
    else if (d.revealSound === 'daft-harder.mp3') customSound = document.getElementById('daftHarderSound');
    else if (d.revealSound === 'daft-5555.mp3') customSound = document.getElementById('daft5555Sound');
    
    if (customSound) {
      customSound.currentTime = 0; // Reset to start
      customSound.play();
    }
  }

  // Override the global function
  window.confirmChallenge = async () => {
    document.getElementById('challengeDetailsModal').style.display = 'none';
    await updateDoc(doc(db, 'blindBoxes', boxId), {
      status:'in-challenge',
      challengeType: kind,
      points,
      challengedBy: state.currentTeam || null,
      lastUpdated: serverTimestamp()
    });
    await setDoc(doc(db, 'gameState', 'current'), {
      status:'in-challenge',
      selectedBox: boxId,
      challengeSelected: kind,
      lastUpdated: serverTimestamp()
    }, { merge:true });
    
    // Resume background music after challenge is accepted
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic && bgMusic.paused) {
      bgMusic.volume = 0.3;
      bgMusic.play().catch(e => console.log('Music resume blocked'));
    }
  };

  document.getElementById('challengeDetailsModal').style.display = 'block';
}

// ---------- Modal close helpers ----------
window.closeReveal = () => { 
  const m = document.getElementById('revealModal'); 
  if (m) m.style.display = 'none'; 
};
window.closeChallengeDetails = () => { 
  const m = document.getElementById('challengeDetailsModal'); 
  if (m) m.style.display = 'none'; 
};
window.closeRejection = () => { 
  const m = document.getElementById('rejectionModal'); 
  if (m) m.style.display = 'none'; 
};
window.closeTurnWarning = () => { 
  const m = document.getElementById('turnWarningModal'); 
  if (m) m.style.display = 'none'; 
};

// ---------- Admin auth helpers (used by blind-b0ss.html) ----------
window.hashPassword = async function(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
};
window.ADMIN_PASSWORD_HASH = 'f44d66d49ae0e7b1c90914f8a4276d0db4e419f43864750ddaf65ca177c88bf4';
window.createSessionToken = function(){
  const ts = Date.now(); 
  const r = Math.random().toString(36).slice(2);
  return btoa(`${ts}-${r}-${window.ADMIN_PASSWORD_HASH.slice(0,8)}`);
};
window.validateSession = function(token){
  try {
    const dec = atob(token); 
    const parts = dec.split('-');
    if (parts.length !== 3) return false;
    const ts = parseInt(parts[0],10);
    if (Date.now() - ts > 24*60*60*1000) return false;
    return parts[2] === window.ADMIN_PASSWORD_HASH.slice(0,8);
  } catch { 
    return false; 
  }
};