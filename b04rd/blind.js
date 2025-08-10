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
} catch (error) {
    console.error('Failed to initialize Firebase:', error);
}

// ============================================
// GAME STATE
// ============================================

let gameState = {
    boxes: {},
    teams: {
        team1: { points: 0, dolls: [] },
        team2: { points: 0, dolls: [] },
        team3: { points: 0, dolls: [] }
    },
    currentUser: null,
    currentTeam: null,
    currentTurn: null,
    selectedBox: null,
    gameActive: false
};

// Box to Doll Mapping
const dollMapping = {
    // Sports Collection
    'sports-1': { name: 'Baller Labubu', image: 'labubu-sports-baller.png' },
    'sports-2': { name: 'Drunk Labubu', image: 'labubu-sports-drunk.png' },
    'sports-3': { name: 'Heart Labubu', image: 'labubu-sports-heart.png' },
    'sports-4': { name: 'Life Labubu', image: 'labubu-sports-life.png' },
    'sports-5': { name: 'Turkey Labubu', image: 'labubu-sports-turkey.png' },
    
    // Add mappings for other collections as needed
    // These can be overridden by admin in Firebase
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
    // Check for login first
    const savedUser = sessionStorage.getItem('io2_user');
    if (!savedUser) {
        document.getElementById('loginModal').style.display = 'block';
        return;
    } else {
        gameState.currentUser = JSON.parse(savedUser);
        gameState.currentTeam = gameState.currentUser.team;
    }

    // Set up box click handlers
    document.querySelectorAll('.blind-box').forEach(box => {
        box.addEventListener('click', handleBoxClick);
    });

    // Load game state from Firebase
    await loadGameState();

    // Set up real-time listeners
    setupRealtimeListeners();
}

// ============================================
// BOX SELECTION
// ============================================

function handleBoxClick(e) {
    const box = e.currentTarget;
    const boxId = box.dataset.boxId;
    
    // Check if it's this team's turn
    if (!gameState.gameActive) {
        return;
    }
    
    if (gameState.currentTurn !== gameState.currentTeam) {
        alert(`not your turn. waiting for ${gameState.currentTurn || 'moderator to start'}`);
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
            selectedBy: gameState.currentTeam,
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
    } else if (boxData.cardType === 'mega') {
        showSpecialCard('mega', boxData);
        return;
    }
    
    // Show normal reveal
    const modal = document.getElementById('revealModal');
    const dollData = boxData.doll || dollMapping[boxId] || { name: 'Mystery Labubu', image: 'placeholder.png' };
    
    document.getElementById('revealedDoll').src = `/assets/b04rd/${dollData.image}`;
    document.getElementById('dollName').textContent = dollData.name;
    document.getElementById('teamPoints').textContent = `$${boxData.teamPoints || 5000}`;
    document.getElementById('individualPoints').textContent = `$${boxData.individualPoints || 1000}`;
    
    // Set up button handlers
    document.getElementById('teamBtn').onclick = () => selectChallenge('team', boxData);
    document.getElementById('individualBtn').onclick = () => selectChallenge('individual', boxData);
    
    modal.style.display = 'block';
}

function showSpecialCard(type, boxData) {
    const modal = document.getElementById('specialModal');
    const specialSound = document.getElementById('specialSound');
    if (specialSound) specialSound.play();
    
    if (type === 'mega') {
        document.getElementById('specialImage').src = '/assets/b04rd/labubu-mega.png';
        document.getElementById('specialTitle').textContent = 'MEGA BUBU';
        document.getElementById('specialText').textContent = boxData.specialMessage || 'the final boss has appeared. good luck.';
    } else {
        document.getElementById('specialImage').src = '/assets/b04rd/labubu-bully.png';
        document.getElementById('specialTitle').textContent = 'LABUBU BULLY';
        document.getElementById('specialText').textContent = boxData.specialMessage || 'chaos mode activated. prepare for trouble.';
    }
    
    modal.style.display = 'block';
}

async function selectChallenge(type, boxData) {
    // Only team members can select team challenges
    if (type === 'team' && !gameState.currentTeam) {
        alert('only team members can select team challenges');
        return;
    }
    
    const points = type === 'team' ? boxData.teamPoints : boxData.individualPoints;
    
    // Update Firebase
    await setDoc(doc(db, 'gameState', 'current'), {
        challengeSelected: type,
        pointsAwarded: points,
        completedAt: new Date().toISOString(),
        status: 'completed'
    }, { merge: true });
    
    // Update team points
    if (gameState.currentTeam) {
        await updateTeamPoints(gameState.currentTeam, points);
    }
    
    // Mark box as opened
    document.querySelector(`[data-box-id="${gameState.selectedBox}"]`).classList.add('opened', `claimed-${gameState.currentTeam}`);
    
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
        
        // Load boxes
        const boxesSnapshot = await getDocs(collection(db, 'blindBoxes'));
        boxesSnapshot.forEach((doc) => {
            gameState.boxes[doc.id] = doc.data();
            const boxEl = document.querySelector(`[data-box-id="${doc.id}"]`);
            if (boxEl && doc.data().status === 'opened') {
                boxEl.classList.add('opened');
                if (doc.data().claimedBy) {
                    boxEl.classList.add(`claimed-${doc.data().claimedBy}`);
                }
            }
        });
        
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
    
    // Listen to box changes
    onSnapshot(collection(db, 'blindBoxes'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified' || change.type === 'added') {
                gameState.boxes[change.doc.id] = change.doc.data();
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
    ['team1', 'team2', 'team3'].forEach((team, index) => {
        const teamData = gameState.teams[team];
        const scoreEl = document.querySelectorAll('.team-points')[index];
        if (scoreEl) {
            scoreEl.textContent = teamData.points || 0;
        }
    });
}

// ============================================
// LOGIN
// ============================================

window.login = async function() {
    const accessCode = document.getElementById('accessCode').value;
    
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let userFound = false;
        
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.accessCode === accessCode) {
                gameState.currentUser = userData;
                gameState.currentTeam = userData.team;
                userFound = true;
                
                // Save to session
                sessionStorage.setItem('io2_user', JSON.stringify(userData));
            }
        });
        
        if (userFound) {
            document.getElementById('loginModal').style.display = 'none';
            console.log(`logged in: ${gameState.currentUser.handle} (${gameState.currentTeam})`);
            await loadGameState();
            setupRealtimeListeners();
        } else {
            document.getElementById('loginError').textContent = 'wrong code. try again.';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('loginError').textContent = 'something broke. refresh.';
    }
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

window.initializeAdmin = async function() {
    // Generate editor grid with actual box images
    const editorGrid = document.getElementById('editorGrid');
    if (!editorGrid) return;
    
    let gridHTML = '';
    const collections = [
        { name: 'christmas', count: 5 },
        { name: 'coke', count: 5 },
        { name: 'energy', count: 5 },
        { name: 'mart', count: 5 },
        { name: 'sports', count: 5 }
    ];
    
    collections.forEach(collection => {
        for (let i = 1; i <= collection.count; i++) {
            const boxId = `${collection.name}-${i}`;
            gridHTML += `
                <div class="editor-box" id="edit-${boxId}" onclick="editBox('${boxId}')">
                    <img src="/assets/b04rd/labubu-box-${collection.name}.png" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
            `;
        }
    });
    
    editorGrid.innerHTML = gridHTML;
    
    // Load current state
    await loadGameState();
    updateAdminDisplay();
}

window.editBox = function(boxId) {
    window.currentEditingBox = boxId;
    document.getElementById('currentBoxId').textContent = boxId;
    document.getElementById('boxEditor').style.display = 'block';
    
    // Load box data
    const boxData = gameState.boxes[boxId] || {};
    const dollData = dollMapping[boxId] || {};
    
    document.getElementById('dollName').value = boxData.dollName || dollData.name || '';
    document.getElementById('dollImage').value = boxData.dollImage || dollData.image || '';
    document.getElementById('teamChallenge').value = boxData.teamChallenge || '';
    document.getElementById('teamPoints').value = boxData.teamPoints || 5000;
    document.getElementById('individualChallenge').value = boxData.individualChallenge || '';
    document.getElementById('individualPoints').value = boxData.individualPoints || 1000;
    document.getElementById('cardType').value = boxData.cardType || 'regular';
    document.getElementById('specialMessage').value = boxData.specialMessage || '';
    document.getElementById('boxStatus').value = boxData.status || 'available';
    
    // Show/hide special message field
    const specialField = document.getElementById('specialField');
    if (boxData.cardType === 'bully' || boxData.cardType === 'mega') {
        specialField.style.display = 'block';
    } else {
        specialField.style.display = 'none';
    }
}

window.saveBox = async function() {
    if (!window.currentEditingBox) return;
    
    const boxData = {
        dollName: document.getElementById('dollName').value,
        dollImage: document.getElementById('dollImage').value,
        teamChallenge: document.getElementById('teamChallenge').value,
        teamPoints: parseInt(document.getElementById('teamPoints').value),
        individualChallenge: document.getElementById('individualChallenge').value,
        individualPoints: parseInt(document.getElementById('individualPoints').value),
        cardType: document.getElementById('cardType').value,
        specialMessage: document.getElementById('specialMessage').value,
        status: document.getElementById('boxStatus').value,
        lastUpdated: new Date().toISOString()
    };
    
    try {
        await setDoc(doc(db, 'blindBoxes', window.currentEditingBox), boxData);
        
        // Update visual indicator
        const editorBox = document.getElementById(`edit-${window.currentEditingBox}`);
        if (boxData.cardType === 'bully') {
            editorBox.classList.add('has-bully');
        } else if (boxData.cardType === 'mega') {
            editorBox.classList.add('has-mega');
        }
        
        // Show save indicator
        document.getElementById('saveIndicator').style.display = 'block';
        setTimeout(() => {
            document.getElementById('saveIndicator').style.display = 'none';
        }, 2000);
        
        closeBoxEditor();
    } catch (error) {
        console.error('Error saving box:', error);
        alert('failed to save');
    }
}

window.closeBoxEditor = function() {
    document.getElementById('boxEditor').style.display = 'none';
    window.currentEditingBox = null;
}

window.setTurn = async function(team) {
    await setDoc(doc(db, 'gameState', 'current'), {
        currentTurn: team,
        gameActive: true,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

window.triggerReveal = async function() {
    await setDoc(doc(db, 'gameState', 'current'), {
        status: 'revealing',
        revealedAt: new Date().toISOString()
    }, { merge: true });
}

window.resetBoard = async function() {
    if (!confirm('reset all boxes?')) return;
    
    const batch = [];
    const boxesSnapshot = await getDocs(collection(db, 'blindBoxes'));
    
    boxesSnapshot.forEach((doc) => {
        batch.push(updateDoc(doc.ref, {
            status: 'available',
            claimedBy: '',
            challengeSelected: ''
        }));
    });
    
    await Promise.all(batch);
    location.reload();
}

function updateAdminDisplay() {
    // Update opened count
    const opened = Object.values(gameState.boxes).filter(b => b.status === 'opened').length;
    document.getElementById('boxesOpened').textContent = `${opened}/25`;
    
    // Update team scores
    document.getElementById('team1Score').textContent = gameState.teams.team1?.points || 0;
    document.getElementById('team2Score').textContent = gameState.teams.team2?.points || 0;
    document.getElementById('team3Score').textContent = gameState.teams.team3?.points || 0;
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