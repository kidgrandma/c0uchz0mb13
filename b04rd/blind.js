// INTERNET OLYMPICS 2 - Blind Box Board Logic

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    updateDoc, 
    deleteDoc,
    setDoc,
    addDoc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyDJ8uiR2qEUfXIuFEO21-40668WNpOdj2w",
    authDomain: "c0uchz0mb13.firebaseapp.com",
    projectId: "c0uchz0mb13",
    storageBucket: "c0uchz0mb13.firebasestorage.app",
    messagingSenderId: "1051521591004",
    appId: "1:1051521591004:web:1301f129fc0f3032f6f619",
    measurementId: "G-6BNDYZQRPE"
};

// Initialize Firebase
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
    
    // Export for admin panel
    window.db = db;
    window.setDoc = setDoc;
    window.doc = doc;
    window.getDoc = getDoc;
} catch (error) {
    console.error('Failed to initialize Firebase:', error);
}

// ============================================
// GAME STATE
// ============================================

// Only 5 boxes are available
const AVAILABLE_BOXES = ['christmas-1', 'coke-1', 'energy-1', 'mart-1', 'sports-1'];

// Labubu mapping for the 5 available boxes (excluding mega)
const LABUBU_MAPPING = {
    'christmas-1': { 
        name: 'Drunk Labubu', 
        image: 'labubu-sports-drunk.png',
        teamChallenge: 'Take a team shot together',
        teamPoints: 5000,
        individualChallenge: 'Drink contest - last one standing wins',
        individualPoints: 1000
    },
    'coke-1': { 
        name: 'Heart Labubu', 
        image: 'labubu-sports-heart.png',
        teamChallenge: 'Group hug for 30 seconds',
        teamPoints: 5000,
        individualChallenge: 'Compliment battle - most creative wins',
        individualPoints: 1000
    },
    'energy-1': { 
        name: 'Life Labubu', 
        image: 'labubu-sports-life.png',
        teamChallenge: 'Share your life philosophy in 30 seconds',
        teamPoints: 5000,
        individualChallenge: 'Existential debate - convince us life has meaning',
        individualPoints: 1000
    },
    'mart-1': { 
        name: 'Turkey Labubu', 
        image: 'labubu-sports-turkey.png',
        teamChallenge: 'Do the turkey dance together',
        teamPoints: 5000,
        individualChallenge: 'Best turkey impression wins',
        individualPoints: 1000
    },
    'sports-1': { 
        name: 'Bully Labubu', 
        image: 'labubu-bully.png',
        teamChallenge: 'Roast the other teams (keep it friendly)',
        teamPoints: 5000,
        individualChallenge: 'Insult battle - funniest burn wins',
        individualPoints: 1000,
        cardType: 'bully',
        specialMessage: 'chaos mode activated. prepare for trouble.'
    }
};

let gameState = {
    boxes: {},
    teams: {
        team1: { points: 0, dolls: [] },
        team2: { points: 0, dolls: [] }
    },
    currentUser: null,
    currentTeam: null,
    currentTurn: null,
    selectedBox: null,
    gameActive: true  // Set to true by default now
};

// ============================================
// AUTHENTICATION
// ============================================

window.hashPassword = async function(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

window.ADMIN_PASSWORD_HASH = 'f44d66d49ae0e7b1c90914f8a4276d0db4e419f43864750ddaf65ca177c88bf4';

window.createSessionToken = function() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return btoa(`${timestamp}-${random}-${window.ADMIN_PASSWORD_HASH.substring(0, 8)}`);
}

// ============================================
// INITIALIZE GAME
// ============================================

async function initializeGame() {
    // No login required - everyone can access
    gameState.gameActive = true;

    // Set up box click handlers - only for available boxes
    document.querySelectorAll('.blind-box').forEach(box => {
        const boxId = box.dataset.boxId;
        
        if (AVAILABLE_BOXES.includes(boxId)) {
            box.addEventListener('click', handleBoxClick);
        } else {
            // Mark unavailable boxes
            box.classList.add('unavailable');
            box.style.opacity = '0.3';
            box.style.cursor = 'not-allowed';
        }
    });

    // Initialize available boxes in Firebase
    await initializeAvailableBoxes();

    // Load game state from Firebase
    await loadGameState();

    // Set up real-time listeners
    setupRealtimeListeners();
}

// ============================================
// INITIALIZE AVAILABLE BOXES
// ============================================

async function initializeAvailableBoxes() {
    for (const boxId of AVAILABLE_BOXES) {
        const boxData = LABUBU_MAPPING[boxId];
        
        try {
            // Check if box already exists
            const boxDoc = await getDoc(doc(db, 'blindBoxes', boxId));
            
            if (!boxDoc.exists()) {
                // Create box with default data
                await setDoc(doc(db, 'blindBoxes', boxId), {
                    ...boxData,
                    status: 'available',
                    createdAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error(`Error initializing box ${boxId}:`, error);
        }
    }
}

// ============================================
// BOX SELECTION
// ============================================

function handleBoxClick(e) {
    const box = e.currentTarget;
    const boxId = box.dataset.boxId;
    
    // Only allow clicks on available boxes
    if (!AVAILABLE_BOXES.includes(boxId)) {
        return;
    }
    
    // Check if box already opened
    if (box.classList.contains('opened')) {
        return;
    }
    
    // Mark as selected
    document.querySelectorAll('.blind-box').forEach(b => b.classList.remove('selected'));
    box.classList.add('selected');
    gameState.selectedBox = boxId;
    
    // Play select sound
    const selectSound = document.getElementById('selectSound');
    if (selectSound) selectSound.play();
    
    // Update Firebase with selection
    updateBoxSelection(boxId);
    
    // Show waiting modal
    document.getElementById('waitingModal').style.display = 'block';
}

async function updateBoxSelection(boxId) {
    try {
        await setDoc(doc(db, 'gameState', 'current'), {
            selectedBox: boxId,
            selectedAt: new Date().toISOString(),
            status: 'waiting_for_reveal'
        }, { merge: true });
    } catch (error) {
        console.error('Error updating selection:', error);
    }
}

// ============================================
// REVEAL HANDLING (Triggered by Moderator)
// ============================================

async function revealBox(boxId, boxData) {
    // Hide waiting modal
    document.getElementById('waitingModal').style.display = 'none';
    
    // Play reveal sound
    const revealSound = document.getElementById('revealSound');
    if (revealSound) revealSound.play();
    
    // Check for special cards
    if (boxData.cardType === 'bully') {
        showSpecialCard('bully', boxData);
        return;
    }
    
    // Show normal reveal
    const modal = document.getElementById('revealModal');
    
    // Use data from Firebase or fallback to defaults
    const dollData = boxData || LABUBU_MAPPING[boxId] || { 
        name: 'Mystery Labubu', 
        image: 'placeholder.png' 
    };
    
    document.getElementById('revealedDoll').src = `/assets/b04rd/${dollData.image}`;
    document.getElementById('dollName').textContent = dollData.name || dollData.labubuName;
    document.getElementById('teamPoints').textContent = `$${dollData.teamPoints || 5000}`;
    document.getElementById('individualPoints').textContent = `$${dollData.individualPoints || 1000}`;
    
    // Set up button handlers
    document.getElementById('teamBtn').onclick = () => selectChallenge('team', dollData);
    document.getElementById('individualBtn').onclick = () => selectChallenge('individual', dollData);
    
    modal.style.display = 'block';
}

function showSpecialCard(type, boxData) {
    const modal = document.getElementById('specialModal');
    const specialSound = document.getElementById('specialSound');
    if (specialSound) specialSound.play();
    
    if (type === 'bully') {
        document.getElementById('specialImage').src = '/assets/b04rd/labubu-bully.png';
        document.getElementById('specialTitle').textContent = 'LABUBU BULLY';
        document.getElementById('specialText').textContent = boxData.specialMessage || 'chaos mode activated. prepare for trouble.';
    }
    
    modal.style.display = 'block';
}

async function selectChallenge(type, boxData) {
    const points = type === 'team' ? boxData.teamPoints : boxData.individualPoints;
    
    // Update Firebase
    await setDoc(doc(db, 'gameState', 'current'), {
        challengeSelected: type,
        pointsAwarded: points,
        completedAt: new Date().toISOString(),
        status: 'completed'
    }, { merge: true });
    
    // Note: Teams will need to be updated manually by admin since no login
    
    // Mark box as opened
    document.querySelector(`[data-box-id="${gameState.selectedBox}"]`).classList.add('opened');
    
    // Close modal
    document.getElementById('revealModal').style.display = 'none';
}

async function updateTeamPoints(team, points) {
    const teamRef = doc(db, 'teams', team);
    const teamDoc = await getDoc(teamRef);
    const currentPoints = teamDoc.exists() ? teamDoc.data().points || 0 : 0;
    
    await setDoc(teamRef, {
        points: currentPoints + points,
        lastUpdated: new Date().toISOString()
    }, { merge: true });
}

// ============================================
// FIREBASE LISTENERS
// ============================================

async function loadGameState() {
    try {
        // Load current game state
        const gameStateDoc = await getDoc(doc(db, 'gameState', 'current'));
        if (gameStateDoc.exists()) {
            const data = gameStateDoc.data();
            gameState.currentTurn = data.currentTurn;
            gameState.gameActive = data.gameActive || false;
            updateTurnIndicator();
        }
        
        // Load boxes - only available ones
        for (const boxId of AVAILABLE_BOXES) {
            const boxDoc = await getDoc(doc(db, 'blindBoxes', boxId));
            if (boxDoc.exists()) {
                gameState.boxes[boxId] = boxDoc.data();
                const boxEl = document.querySelector(`[data-box-id="${boxId}"]`);
                if (boxEl && boxDoc.data().status === 'opened') {
                    boxEl.classList.add('opened');
                    if (boxDoc.data().claimedBy) {
                        boxEl.classList.add(`claimed-${boxDoc.data().claimedBy}`);
                    }
                }
            }
        }
        
        // Load teams
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        teamsSnapshot.forEach((doc) => {
            if (gameState.teams[doc.id]) {
                gameState.teams[doc.id] = doc.data();
            }
        });
        
        updateTeamScores();
    } catch (error) {
        console.error('Error loading game state:', error);
    }
}

window.loadGameState = loadGameState; // Export for admin panel

function setupRealtimeListeners() {
    // Listen to game state changes
    onSnapshot(doc(db, 'gameState', 'current'), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            
            // Update turn
            if (data.currentTurn !== gameState.currentTurn) {
                gameState.currentTurn = data.currentTurn;
                updateTurnIndicator();
            }
            
            // Handle reveal trigger from moderator
            if (data.status === 'revealing' && data.selectedBox === gameState.selectedBox) {
                const boxData = gameState.boxes[data.selectedBox] || {};
                revealBox(data.selectedBox, boxData);
            }
            
            gameState.gameActive = data.gameActive || false;
        }
    });
    
    // Listen to box changes - only for available boxes
    AVAILABLE_BOXES.forEach(boxId => {
        onSnapshot(doc(db, 'blindBoxes', boxId), (doc) => {
            if (doc.exists()) {
                gameState.boxes[boxId] = doc.data();
                
                // Update visual state
                const boxEl = document.querySelector(`[data-box-id="${boxId}"]`);
                if (boxEl) {
                    if (doc.data().status === 'opened') {
                        boxEl.classList.add('opened');
                        if (doc.data().claimedBy) {
                            boxEl.classList.add(`claimed-${doc.data().claimedBy}`);
                        }
                    }
                }
            }
        });
    });
    
    // Listen to team changes
    onSnapshot(collection(db, 'teams'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified' || change.type === 'added') {
                if (gameState.teams[change.doc.id]) {
                    gameState.teams[change.doc.id] = change.doc.data();
                }
            }
        });
        updateTeamScores();
    });
}

// ============================================
// UI UPDATES
// ============================================

function updateTurnIndicator() {
    const indicator = document.getElementById('currentTurn');
    if (gameState.currentTurn) {
        indicator.textContent = `${gameState.currentTurn.toUpperCase()} TURN`;
        indicator.parentElement.className = `turn-indicator ${gameState.currentTurn}`;
    } else {
        indicator.textContent = 'waiting to start...';
        indicator.parentElement.className = 'turn-indicator';
    }
}

function updateTeamScores() {
    ['team1', 'team2'].forEach((team, index) => {
        const teamData = gameState.teams[team];
        const scoreEl = document.querySelectorAll('.team-points')[index];
        if (scoreEl) {
            scoreEl.textContent = teamData.points || 0;
        }
    });
}

// ============================================
// MODAL CONTROLS
// ============================================

window.closeReveal = function() {
    document.getElementById('revealModal').style.display = 'none';
}

window.confirmSpecial = function() {
    document.getElementById('specialModal').style.display = 'none';
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

window.resetBoard = async function() {
    if (!confirm('reset all boxes?')) return;
    
    const batch = [];
    
    // Only reset available boxes
    for (const boxId of AVAILABLE_BOXES) {
        batch.push(updateDoc(doc(db, 'blindBoxes', boxId), {
            status: 'available',
            claimedBy: '',
            challengeSelected: ''
        }));
    }
    
    await Promise.all(batch);
    location.reload();
}

window.clearTeamScores = async function() {
    if (!confirm('clear all team scores?')) return;
    
    const teams = ['team1', 'team2'];
    const batch = [];
    
    for (const team of teams) {
        batch.push(setDoc(doc(db, 'teams', team), {
            points: 0,
            dolls: [],
            lastUpdated: new Date().toISOString()
        }));
    }
    
    await Promise.all(batch);
    alert('Team scores cleared');
}

window.exportGameState = function() {
    const exportData = {
        timestamp: new Date().toISOString(),
        boxes: gameState.boxes,
        teams: gameState.teams,
        currentTurn: gameState.currentTurn,
        gameActive: gameState.gameActive
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `game-state-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

window.loadBoxData = async function(boxId) {
    try {
        const boxDoc = await getDoc(doc(db, 'blindBoxes', boxId));
        if (boxDoc.exists()) {
            const data = boxDoc.data();
            
            // Populate form fields if they exist
            if (document.getElementById('labubuName')) {
                document.getElementById('labubuName').value = data.labubuName || data.name || '';
            }
            if (document.getElementById('imagePath')) {
                document.getElementById('imagePath').value = data.imagePath || data.image || '';
            }
            if (document.getElementById('teamChallenge')) {
                document.getElementById('teamChallenge').value = data.teamChallenge || '';
            }
            if (document.getElementById('teamPoints')) {
                document.getElementById('teamPoints').value = data.teamPoints || 5000;
            }
            if (document.getElementById('individualChallenge')) {
                document.getElementById('individualChallenge').value = data.individualChallenge || '';
            }
            if (document.getElementById('individualPoints')) {
                document.getElementById('individualPoints').value = data.individualPoints || 1000;
            }
            if (document.getElementById('cardType')) {
                document.getElementById('cardType').value = data.cardType || 'regular';
            }
            if (document.getElementById('specialMessage')) {
                document.getElementById('specialMessage').value = data.specialMessage || '';
            }
            if (document.getElementById('boxStatus')) {
                document.getElementById('boxStatus').value = data.status || 'available';
            }
            if (document.getElementById('claimedBy')) {
                document.getElementById('claimedBy').value = data.claimedBy || '';
            }
        }
    } catch (error) {
        console.error('Error loading box data:', error);
    }
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const isAdmin = window.location.pathname.includes('blind-b0ss');
    
    if (isAdmin) {
        // Admin panel
        const session = localStorage.getItem('blind_boss_session');
        if (!session) {
            document.getElementById('authModal').style.display = 'block';
        } else {
            document.getElementById('authModal').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'grid';
            window.initializeAdmin();
        }
    } else {
        // Game board
        initializeGame();
    }
});