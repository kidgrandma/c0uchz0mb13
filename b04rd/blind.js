// blind.js - Life on the Line Game with Firebase

// Game State
const gameState = {
    team: null,
    userId: 'user_' + Math.random().toString(36).substr(2, 9),
    round: 1,
    isLifeOnLine: false,
    currentChoices: {},
    waitingForMatch: false,
    lastRevealTime: 0,
    lastWinnerTime: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Life on the Line - Initializing with Firebase...');
    
    // Start music on first click
    document.addEventListener('click', startMusic, { once: true });
    
    // Setup team selection
    setupTeamSelection();
    
    // Wait for Firebase to be ready
    setTimeout(() => {
        if (window.db) {
            console.log('Firebase ready, initializing listeners');
            initializeFirebaseListeners();
        } else {
            console.error('Firebase not initialized');
        }
    }, 1000);
});

// Start background music
function startMusic() {
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
        bgMusic.volume = 0.3;
        bgMusic.play().catch(err => console.log('Audio prevented:', err));
    }
}

// Team Selection
function setupTeamSelection() {
    const teamButtons = document.querySelectorAll('.team-btn');
    
    teamButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            gameState.team = btn.dataset.team;
            await selectTeam();
        });
    });
}

async function selectTeam() {
    // Hide modal & show game
    document.getElementById('teamModal').classList.remove('active');
    document.getElementById('gameBoard').classList.remove('hidden');
    
    // Set team display
    document.getElementById('yourTeam').textContent = `TEAM: ${gameState.team.toUpperCase()}`;
    
    // Register player in Firebase
    if (window.db) {
        const { doc, setDoc, serverTimestamp } = window.firebaseUtils;
        await setDoc(doc(window.db, 'players', gameState.userId), {
            team: gameState.team,
            joinedAt: serverTimestamp()
        });
    }
    
    // Check game state
    checkTurnOrder();
}

// Check turn order
async function checkTurnOrder() {
    if (!window.db) return;
    
    const { doc, getDoc, setDoc, serverTimestamp } = window.firebaseUtils;
    const gameDoc = await getDoc(doc(window.db, 'gameState', 'current'));
    
    if (!gameDoc.exists()) {
        // Initialize game if doesn't exist
        await setDoc(doc(window.db, 'gameState', 'current'), {
            currentTurn: 'angelbubu',
            round: 1,
            status: 'waiting',
            timestamp: serverTimestamp()
        });
        updateLifeStatus('angelbubu');
    } else {
        const gameData = gameDoc.data();
        updateLifeStatus(gameData.currentTurn);
    }
}

// Update life status display
function updateLifeStatus(turnTeam) {
    const lifeText = document.querySelector('.life-text');
    
    if (turnTeam === gameState.team) {
        gameState.isLifeOnLine = true;
        lifeText.textContent = '💀 YOUR LIFE IS ON THE LINE 💀';
        lifeText.className = 'life-text on-line';
        showStatus('Your life is on the line! Set your arrangement!');
    } else {
        gameState.isLifeOnLine = false;
        lifeText.textContent = '✨ GUESS THEIR ARRANGEMENT ✨';
        lifeText.className = 'life-text safe';
        showStatus('Try to match their arrangement!');
    }
}

// Submit choices
window.submitChoices = async function() {
    const pizzaCool = document.getElementById('pizzaCoolSelect').value;
    const pizzaLame = document.getElementById('pizzaLameSelect').value;
    const pizzaAnnoying = document.getElementById('pizzaAnnoyingSelect').value;
    
    // Validate
    if (!pizzaCool || !pizzaLame || !pizzaAnnoying) {
        showStatus('Select an action for each pizza!');
        return;
    }
    
    const choices = [pizzaCool, pizzaLame, pizzaAnnoying];
    const unique = new Set(choices);
    if (unique.size !== 3) {
        showStatus('Each action must be used exactly once!');
        return;
    }
    
    gameState.currentChoices = { pizzaCool, pizzaLame, pizzaAnnoying };
    
    if (!window.db) {
        showStatus('Firebase not connected!');
        return;
    }
    
    const { doc, setDoc, getDoc, updateDoc, serverTimestamp } = window.firebaseUtils;
    
    try {
        if (gameState.isLifeOnLine) {
            // Setting the arrangement
            await setDoc(doc(window.db, 'currentArrangement', 'active'), {
                arrangement: gameState.currentChoices,
                setBy: gameState.team,
                timestamp: serverTimestamp()
            });
            
            await updateDoc(doc(window.db, 'gameState', 'current'), {
                status: 'waiting_for_guess',
                setBy: gameState.team,
                arrangementSet: true
            });
            
            showWaitingScreen('Waiting for other team to guess...');
            showStatus('Arrangement set! Waiting for other team...');
            
        } else {
            // Making a guess - first check game state
            const gameDoc = await getDoc(doc(window.db, 'gameState', 'current'));
            const gameData = gameDoc.data();
            
            if (!gameData.arrangementSet || gameData.status !== 'waiting_for_guess') {
                showStatus('Waiting for other team to set their arrangement...');
                return;
            }
            
            // Get the arrangement
            const arrangementDoc = await getDoc(doc(window.db, 'currentArrangement', 'active'));
            
            if (!arrangementDoc.exists()) {
                showStatus('Arrangement not found. Please wait and try again.');
                return;
            }
            
            const arrangement = arrangementDoc.data().arrangement;
            
            // Log the guess
            await setDoc(doc(window.db, 'lastGuess', 'current'), {
                choices: gameState.currentChoices,
                team: gameState.team,
                timestamp: serverTimestamp()
            });
            
            // Check for match
            checkForMatch(gameState.currentChoices, arrangement);
        }
    } catch (error) {
        console.error('Error submitting choices:', error);
        showStatus('Error submitting. Please try again.');
    }
}

// Check if arrangements match
async function checkForMatch(guess, arrangement) {
    const match = guess.pizzaCool === arrangement.pizzaCool && 
                  guess.pizzaLame === arrangement.pizzaLame && 
                  guess.pizzaAnnoying === arrangement.pizzaAnnoying;
    
    const { doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp } = window.firebaseUtils;
    const gameDoc = await getDoc(doc(window.db, 'gameState', 'current'));
    const gameData = gameDoc.data();
    
    if (match) {
        // BATTLE MODE!
        await updateDoc(doc(window.db, 'gameState', 'current'), {
            status: 'battle',
            battleTeam: gameData.setBy
        });
        
        // Create battle alert
        await setDoc(doc(window.db, 'battleAlert', 'current'), {
            round: gameData.round,
            teamOnLine: gameData.setBy,
            arrangement: arrangement,
            timestamp: serverTimestamp()
        });
        
        if (gameData.setBy === gameState.team) {
            showBattleMode(true);
        } else {
            showWaitingScreen('BATTLE MODE! Other team is choosing challenge...');
        }
    } else {
        // No match - swap turns
        const newTurn = gameData.currentTurn === 'angelbubu' ? 'demonbubu' : 'angelbubu';
        
        await updateDoc(doc(window.db, 'gameState', 'current'), {
            currentTurn: newTurn,
            round: gameData.round + 1,
            status: 'waiting',
            setBy: null
        });
        
        // Clear arrangement
        await deleteDoc(doc(window.db, 'currentArrangement', 'active'));
        
        document.getElementById('roundNum').textContent = gameData.round + 1;
        showStatus(`NO MATCH! Turns swap - Round ${gameData.round + 1}`);
        
        resetForm();
        setTimeout(() => {
            updateLifeStatus(newTurn);
        }, 2000);
    }
}

// Show waiting screen
function showWaitingScreen(message) {
    document.getElementById('waitingMessage').textContent = message;
    document.getElementById('waitingScreen').classList.remove('hidden');
    document.querySelector('.selection-area').style.display = 'none';
}

// Hide waiting screen
function hideWaitingScreen() {
    document.getElementById('waitingScreen').classList.add('hidden');
    document.querySelector('.selection-area').style.display = 'block';
}

// Show battle mode
function showBattleMode(canChoose) {
    document.getElementById('battleMode').classList.remove('hidden');
    document.querySelector('.selection-area').style.display = 'none';
    
    if (!canChoose) {
        document.querySelector('.battle-text').textContent = 'Waiting for challenge selection...';
        document.querySelector('.challenge-pizzas').style.display = 'none';
    }
}

// Select challenge
window.selectChallenge = async function(pizzaType) {
    if (!window.db) return;
    
    const { doc, setDoc, getDoc, updateDoc, serverTimestamp } = window.firebaseUtils;
    const gameDoc = await getDoc(doc(window.db, 'gameState', 'current'));
    const gameData = gameDoc.data();
    
    // Store challenge selection
    await setDoc(doc(window.db, 'selectedChallenge', 'current'), {
        pizza: pizzaType,
        selectedBy: gameState.team,
        round: gameData.round,
        timestamp: serverTimestamp()
    });
    
    await updateDoc(doc(window.db, 'gameState', 'current'), {
        status: 'challenge_selected'
    });
    
    showStatus(`${pizzaType.toUpperCase()} PIZZA challenge selected! Waiting for admin...`);
    
    document.getElementById('battleMode').classList.add('hidden');
    showWaitingScreen('Challenge selected! Waiting for admin to reveal...');
}

// Show challenge card
function showChallengeCard(challengeData) {
    hideWaitingScreen();
    document.getElementById('battleMode').classList.add('hidden');
    
    const challengeDisplay = document.getElementById('challengeDisplay');
    challengeDisplay.classList.remove('hidden');
    
    const pizzaImages = {
        'cool': '../assets/b04rd/pizza-movie.png',
        'lame': '../assets/b04rd/pizza-music.png',
        'annoying': '../assets/b04rd/pizza-paizley.png'
    };
    
    document.getElementById('challengePizzaImg').src = pizzaImages[challengeData.pizza];
    document.getElementById('challengeAction').textContent = challengeData.action;
    document.getElementById('challengeText').textContent = challengeData.challengeText;
    
    showStatus('CHALLENGE REVEALED! Complete it to win!');
}

// Announce winner
async function announceWinner(winnerData) {
    document.getElementById('challengeDisplay').classList.add('hidden');
    
    const message = winnerData.winner === gameState.team ? 
        '🎉 YOU WON THE ROUND! 🎉' : 
        `💀 ${winnerData.winner.toUpperCase()} WINS THIS ROUND 💀`;
    
    showStatus(message);
    
    // Reset after 5 seconds
    setTimeout(() => {
        resetForNextRound();
    }, 5000);
}

// Reset for next round
async function resetForNextRound() {
    if (!window.db) return;
    
    const { doc, getDoc, updateDoc, deleteDoc } = window.firebaseUtils;
    const gameDoc = await getDoc(doc(window.db, 'gameState', 'current'));
    const gameData = gameDoc.data();
    
    const newTurn = gameData.currentTurn === 'angelbubu' ? 'demonbubu' : 'angelbubu';
    
    await updateDoc(doc(window.db, 'gameState', 'current'), {
        currentTurn: newTurn,
        round: gameData.round + 1,
        status: 'waiting',
        setBy: null,
        battleTeam: null,
        arrangementSet: false  // Reset this flag
    });
    
    // Clear all temporary data
    await deleteDoc(doc(window.db, 'battleAlert', 'current'));
    await deleteDoc(doc(window.db, 'selectedChallenge', 'current'));
    await deleteDoc(doc(window.db, 'challengeReveal', 'current'));
    await deleteDoc(doc(window.db, 'roundWinner', 'current'));
    await deleteDoc(doc(window.db, 'currentArrangement', 'active'));
    await deleteDoc(doc(window.db, 'lastGuess', 'current'));
    
    // Reset UI
    document.getElementById('battleMode').classList.add('hidden');
    document.getElementById('challengeDisplay').classList.add('hidden');
    hideWaitingScreen();
    resetForm();
    
    updateLifeStatus(newTurn);
}

// Initialize Firebase listeners
function initializeFirebaseListeners() {
    if (!window.db) return;
    
    const { onSnapshot, doc } = window.firebaseUtils;
    
    // Listen for game state changes
    onSnapshot(doc(window.db, 'gameState', 'current'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            document.getElementById('roundNum').textContent = data.round;
            
            // Update turn status
            if (data.currentTurn) {
                updateLifeStatus(data.currentTurn);
            }
            
            // Check for battle mode
            if (data.status === 'battle' && document.getElementById('battleMode').classList.contains('hidden')) {
                if (data.battleTeam === gameState.team) {
                    showBattleMode(true);
                } else {
                    showWaitingScreen('BATTLE MODE! Other team is choosing challenge...');
                }
            }
            
            // Check if waiting for guess - show message for guessing team
            if (data.status === 'waiting_for_guess' && !gameState.isLifeOnLine && data.setBy !== gameState.team) {
                hideWaitingScreen();
                showStatus('Other team has set their arrangement. Make your guess!');
            }
            
            // Update game state locally
            gameState.currentGameStatus = data.status;
            gameState.arrangementSetBy = data.setBy;
        }
    });
    
    // Listen for arrangement changes (for debugging)
    onSnapshot(doc(window.db, 'currentArrangement', 'active'), (snapshot) => {
        if (snapshot.exists()) {
            console.log('Arrangement exists:', snapshot.data());
        } else {
            console.log('No arrangement set');
        }
    });
    
    // Listen for challenge reveal
    onSnapshot(doc(window.db, 'challengeReveal', 'current'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.timestamp && data.timestamp.toMillis() > gameState.lastRevealTime) {
                gameState.lastRevealTime = data.timestamp.toMillis();
                showChallengeCard(data);
            }
        }
    });
    
    // Listen for winner announcement
    onSnapshot(doc(window.db, 'roundWinner', 'current'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.timestamp && data.timestamp.toMillis() > gameState.lastWinnerTime) {
                gameState.lastWinnerTime = data.timestamp.toMillis();
                announceWinner(data);
            }
        }
    });
}

// Reset form
function resetForm() {
    document.getElementById('pizzaCoolSelect').value = '';
    document.getElementById('pizzaLameSelect').value = '';
    document.getElementById('pizzaAnnoyingSelect').value = '';
}

// Show status message
function showStatus(message) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.classList.add('show');
    
    setTimeout(() => {
        statusEl.classList.remove('show');
    }, 3000);
}