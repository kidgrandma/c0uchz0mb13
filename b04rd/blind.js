// blind.js - Firebase Integration

// Game State
const gameState = {
    team: null,
    score: 0,
    activeRequests: new Map(),
    completedChallenges: new Set(),
    userId: null,
    isAdmin: false
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Blind Box Game Initializing...');
    
    // Generate unique user ID
    gameState.userId = 'user_' + Math.random().toString(36).substr(2, 9);
});

// Intro Modal Functions
window.closeIntro = function() {
    document.getElementById('introModal').classList.remove('active');
    document.getElementById('teamModal').classList.add('active');
}

window.startExperience = function() {
    // Start background music on first interaction
    const bgMusic = document.getElementById('bgMusic');
    bgMusic.volume = 0.3;
    bgMusic.play().catch(err => console.log('Audio autoplay prevented:', err));
    
    // Close intro and show team selection
    closeIntro();
}

// Initialize Firebase when ready
function initFirebase() {
    if (!window.db) {
        console.error('Firebase not initialized');
        return;
    }
    
    // Listen for challenge requests (admin)
    if (gameState.isAdmin) {
        listenForRequests();
    }
    
    // Listen for responses
    listenForResponses();
    
    // Listen for score updates
    listenForScores();
}

// Team Selection
function setupTeamSelection() {
    const teamButtons = document.querySelectorAll('.team-btn');
    
    teamButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const team = btn.dataset.team;
            selectTeam(team);
        });
    });
}

function selectTeam(team) {
    gameState.team = team;
    
    // Hide modal
    document.getElementById('teamModal').classList.remove('active');
    
    // Show game board
    document.getElementById('gameBoard').classList.remove('hidden');
    
    // Update team display
    const teamDisplay = document.getElementById('teamName');
    teamDisplay.textContent = `Team ${team.charAt(0).toUpperCase() + team.slice(1)}`;
    teamDisplay.className = `team-display ${team}`;
    
    // Setup can interactions
    setupCanInteractions();
    
    // Initialize Firebase after team selection
    initFirebase();
    
    // Update team in Firebase
    if (window.db) {
        const { doc, setDoc, serverTimestamp } = window.firebaseUtils;
        setDoc(doc(window.db, 'b04rd_players', gameState.userId), {
            team: team,
            score: 0,
            timestamp: serverTimestamp()
        }, { merge: true });
    }
}

// Can Interactions
function setupCanInteractions() {
    const canWrappers = document.querySelectorAll('.can-wrapper');
    
    canWrappers.forEach(wrapper => {
        const canCard = wrapper.querySelector('.can-card');
        const canName = wrapper.dataset.can;
        
        canCard.addEventListener('click', (e) => {
            if (canCard.classList.contains('locked')) {
                showStatus('This challenge is locked. Waiting for approval...');
                return;
            }
            
            if (canCard.classList.contains('flipped')) {
                return;
            }
            
            if (gameState.completedChallenges.has(canName)) {
                showStatus('This challenge has already been completed!');
                return;
            }
            
            // Show points selector
            showPointsSelector(wrapper, canName);
        });
    });
}

function showPointsSelector(wrapper, canName) {
    const selector = wrapper.querySelector('.points-selector');
    selector.classList.remove('hidden');
    
    const pointButtons = selector.querySelectorAll('.points-btn');
    
    pointButtons.forEach(btn => {
        btn.onclick = () => {
            const points = parseInt(btn.dataset.points);
            requestChallenge(canName, points, wrapper);
            selector.classList.add('hidden');
        };
    });
    
    // Hide selector if clicked outside
    setTimeout(() => {
        document.addEventListener('click', function hideSelector(e) {
            if (!wrapper.contains(e.target)) {
                selector.classList.add('hidden');
                document.removeEventListener('click', hideSelector);
            }
        });
    }, 100);
}

// Firebase Functions
async function requestChallenge(canName, points, wrapper) {
    if (!window.db) {
        console.error('Firebase not initialized');
        return;
    }
    
    const canCard = wrapper.querySelector('.can-card');
    canCard.classList.add('locked');
    
    const { doc, setDoc, serverTimestamp } = window.firebaseUtils;
    
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    try {
        // Send request to Firebase
        await setDoc(doc(window.db, 'b04rd_requests', requestId), {
            id: requestId,
            team: gameState.team,
            can: canName,
            points: points,
            userId: gameState.userId,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // Store request info
        gameState.activeRequests.set(requestId, {
            can: canName,
            points: points,
            wrapper: wrapper
        });
        
        showStatus(`Requesting ${canName} challenge for ${points.toLocaleString()} points...`);
    } catch (error) {
        console.error('Error sending request:', error);
        canCard.classList.remove('locked');
        showStatus('Error sending request. Please try again.');
    }
}

function listenForResponses() {
    if (!window.db) return;
    
    const { collection, query, onSnapshot } = window.firebaseUtils;
    
    // Listen for responses to our requests
    const q = query(collection(window.db, 'b04rd_responses'));
    
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                if (data.userId === gameState.userId) {
                    handleChallengeResponse(data);
                }
            }
        });
    });
}

function handleChallengeResponse(data) {
    const request = gameState.activeRequests.get(data.requestId);
    if (!request) return;
    
    const wrapper = request.wrapper;
    const canCard = wrapper.querySelector('.can-card');
    
    if (data.approved) {
        // Flip the card
        canCard.classList.remove('locked');
        canCard.classList.add('flipped');
        
        // Update challenge text
        const challengeText = wrapper.querySelector('.challenge-text');
        challengeText.textContent = data.challenge || 'Complete the challenge to earn your points!';
        
        // Show complete button
        const completeBtn = wrapper.querySelector('.complete-btn');
        completeBtn.classList.remove('hidden');
        completeBtn.onclick = () => completeChallenge(request.can, request.points);
        
        showStatus(`Challenge approved! ${request.points.toLocaleString()} points available!`);
    } else {
        // Unlock the card
        canCard.classList.remove('locked');
        showStatus('Challenge request denied. Try again or choose another box.');
    }
    
    // Clean up request
    gameState.activeRequests.delete(data.requestId);
}

async function completeChallenge(canName, points) {
    // Mark as completed
    gameState.completedChallenges.add(canName);
    
    // Update score
    gameState.score += points;
    document.getElementById('teamScore').textContent = gameState.score.toLocaleString();
    
    // Update Firebase
    if (window.db) {
        const { doc, setDoc, serverTimestamp } = window.firebaseUtils;
        
        // Update player score
        await setDoc(doc(window.db, 'b04rd_players', gameState.userId), {
            score: gameState.score,
            lastUpdate: serverTimestamp()
        }, { merge: true });
        
        // Log completion
        await setDoc(doc(window.db, 'b04rd_completions', `${gameState.userId}_${canName}`), {
            team: gameState.team,
            can: canName,
            points: points,
            userId: gameState.userId,
            timestamp: serverTimestamp()
        });
    }
    
    // Visual feedback
    const wrapper = document.querySelector(`[data-can="${canName}"]`);
    const canCard = wrapper.querySelector('.can-card');
    canCard.style.opacity = '0.5';
    
    showStatus(`Challenge completed! +${points.toLocaleString()} points!`);
    
    // Celebration animation
    celebrateCompletion();
}

function listenForScores() {
    if (!window.db) return;
    
    const { collection, onSnapshot } = window.firebaseUtils;
    
    // Listen for all player scores
    onSnapshot(collection(window.db, 'b04rd_players'), (snapshot) => {
        let hotScore = 0;
        let coldScore = 0;
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.team === 'hot') {
                hotScore += data.score || 0;
            } else if (data.team === 'cold') {
                coldScore += data.score || 0;
            }
        });
        
        // Update display if we have team scores element
        updateTeamScores(hotScore, coldScore);
    });
}

function updateTeamScores(hotScore, coldScore) {
    // This would update a global scoreboard if you add one
    console.log(`Team Hot: ${hotScore}, Team Cold: ${coldScore}`);
}

// UI Helpers
function showStatus(message) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.classList.add('show');
    
    setTimeout(() => {
        statusEl.classList.remove('show');
    }, 3000);
}

function celebrateCompletion() {
    // Create confetti effect
    const colors = ['#ff6b6b', '#4facfe', '#56ab2f', '#667eea', '#ffd93d'];
    
    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        confetti.style.zIndex = '9999';
        document.body.appendChild(confetti);
        
        // Animate
        confetti.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translateY(${window.innerHeight + 20}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration: 2000 + Math.random() * 1000,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }).onfinish = () => confetti.remove();
    }
}

// Initialize team selection when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    setupTeamSelection();
});