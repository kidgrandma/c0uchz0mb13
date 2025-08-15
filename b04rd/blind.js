// blind.js - Life on the Line Game Logic

// Game State
const gameState = {
    team: null,
    round: 1,
    isLifeOnLine: false,
    currentChoices: {},
    waitingForMatch: false
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Life on the Line - Initializing...');
    
    // Start music on first click
    document.addEventListener('click', startMusic, { once: true });
    
    // Setup team selection
    setupTeamSelection();
    
    // Check for updates every 500ms
    setInterval(checkGameState, 500);
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
        btn.addEventListener('click', () => {
            gameState.team = btn.dataset.team;
            selectTeam();
        });
    });
}

function selectTeam() {
    // Hide modal & show game
    document.getElementById('teamModal').classList.remove('active');
    document.getElementById('gameBoard').classList.remove('hidden');
    
    // Set team display
    document.getElementById('yourTeam').textContent = `TEAM: ${gameState.team.toUpperCase()}`;
    
    // Check who goes first
    checkTurnOrder();
}

// Check turn order
function checkTurnOrder() {
    const gameData = JSON.parse(localStorage.getItem('gameData') || '{}');
    
    // If no game started, angel goes first (life on line)
    if (!gameData.currentTurn) {
        gameData.currentTurn = 'angelbubu';
        gameData.round = 1;
        gameData.status = 'waiting';
        localStorage.setItem('gameData', JSON.stringify(gameData));
    }
    
    updateLifeStatus(gameData.currentTurn);
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
window.submitChoices = function() {
    const pizzaCool = document.getElementById('pizzaCoolSelect').value;
    const pizzaLame = document.getElementById('pizzaLameSelect').value;
    const pizzaAnnoying = document.getElementById('pizzaAnnoyingSelect').value;
    
    // Validate all selected and unique
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
    
    // Store choices
    gameState.currentChoices = { 
        pizzaCool: pizzaCool, 
        pizzaLame: pizzaLame, 
        pizzaAnnoying: pizzaAnnoying 
    };
    
    // Get game data
    const gameData = JSON.parse(localStorage.getItem('gameData') || '{}');
    
    if (gameState.isLifeOnLine) {
        // Setting the arrangement
        gameData.currentArrangement = gameState.currentChoices;
        gameData.setBy = gameState.team;
        gameData.status = 'waiting_for_guess';
        localStorage.setItem('gameData', JSON.stringify(gameData));
        
        // Show waiting screen
        showWaitingScreen('Waiting for other team to guess...');
    } else {
        // Making a guess
        // Store the guess for admin to see
        localStorage.setItem('lastGuess', JSON.stringify({
            team: gameState.team,
            choices: gameState.currentChoices,
            timestamp: Date.now()
        }));
        
        checkForMatch(gameState.currentChoices, gameData.currentArrangement);
    }
}

// Check if arrangements match
function checkForMatch(guess, arrangement) {
    if (!arrangement || !arrangement.pizzaCool) {
        showStatus('Error: No arrangement set yet!');
        return;
    }
    
    const match = guess.pizzaCool === arrangement.pizzaCool && 
                  guess.pizzaLame === arrangement.pizzaLame && 
                  guess.pizzaAnnoying === arrangement.pizzaAnnoying;
    
    const gameData = JSON.parse(localStorage.getItem('gameData') || '{}');
    
    if (match) {
        // BATTLE MODE!
        gameData.status = 'battle';
        gameData.battleTeam = gameData.setBy; // Team whose life was on line chooses
        localStorage.setItem('gameData', JSON.stringify(gameData));
        
        // Notify admin
        const battleAlert = {
            type: 'BATTLE',
            round: gameData.round,
            teamOnLine: gameData.setBy,
            arrangement: arrangement,
            timestamp: Date.now()
        };
        localStorage.setItem('battleAlert', JSON.stringify(battleAlert));
        
        // Show battle mode
        if (gameData.battleTeam === gameState.team) {
            showBattleMode(true);
        } else {
            showWaitingScreen('BATTLE MODE! Other team is choosing challenge...');
        }
    } else {
        // No match - swap turns
        gameData.currentTurn = gameData.currentTurn === 'angelbubu' ? 'demonbubu' : 'angelbubu';
        gameData.round++;
        gameData.status = 'waiting';
        gameData.currentArrangement = null;
        gameData.setBy = null;
        localStorage.setItem('gameData', JSON.stringify(gameData));
        
        // Update round
        document.getElementById('roundNum').textContent = gameData.round;
        
        // Show result
        showStatus(`NO MATCH! Turns swap - Round ${gameData.round}`);
        
        // Reset form
        resetForm();
        
        // Update life status
        setTimeout(() => {
            updateLifeStatus(gameData.currentTurn);
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
window.selectChallenge = function(pizzaType) {
    const gameData = JSON.parse(localStorage.getItem('gameData') || '{}');
    
    // Store challenge selection
    const challenge = {
        pizza: pizzaType,
        selectedBy: gameState.team,
        round: gameData.round,
        timestamp: Date.now()
    };
    
    localStorage.setItem('selectedChallenge', JSON.stringify(challenge));
    
    // Update game status
    gameData.status = 'challenge_selected';
    localStorage.setItem('gameData', JSON.stringify(gameData));
    
    showStatus(`${pizzaType.toUpperCase()} PIZZA challenge selected! Waiting for admin...`);
    
    // Hide battle mode
    document.getElementById('battleMode').classList.add('hidden');
    showWaitingScreen('Challenge selected! Waiting for admin to reveal...');
}

// Check game state (runs every 500ms)
function checkGameState() {
    const gameData = JSON.parse(localStorage.getItem('gameData') || '{}');
    
    // Update round display
    if (gameData.round) {
        document.getElementById('roundNum').textContent = gameData.round;
    }
    
    // Check for battle mode
    if (gameData.status === 'battle' && document.getElementById('battleMode').classList.contains('hidden')) {
        if (gameData.battleTeam === gameState.team) {
            showBattleMode(true);
        } else {
            showWaitingScreen('BATTLE MODE! Other team is choosing challenge...');
        }
    }
    
    // Check if other team has set arrangement
    if (gameData.status === 'waiting_for_guess' && !gameState.isLifeOnLine && gameData.setBy !== gameState.team) {
        hideWaitingScreen();
    }
    
    // Check for challenge reveal from admin
    const challengeReveal = JSON.parse(localStorage.getItem('challengeReveal') || '{}');
    if (challengeReveal.timestamp && challengeReveal.timestamp > gameState.lastRevealTime) {
        gameState.lastRevealTime = challengeReveal.timestamp;
        showChallengeCard(challengeReveal);
    }
    
    // Check for winner announcement
    const winnerData = JSON.parse(localStorage.getItem('roundWinner') || '{}');
    if (winnerData.timestamp && winnerData.timestamp > gameState.lastWinnerTime) {
        gameState.lastWinnerTime = winnerData.timestamp;
        announceWinner(winnerData);
    }
}

// Show challenge card
function showChallengeCard(challengeData) {
    hideWaitingScreen();
    document.getElementById('battleMode').classList.add('hidden');
    
    const challengeDisplay = document.getElementById('challengeDisplay');
    challengeDisplay.classList.remove('hidden');
    
    // Set pizza image
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
function announceWinner(winnerData) {
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
function resetForNextRound() {
    const gameData = JSON.parse(localStorage.getItem('gameData') || '{}');
    
    // Alternate turns
    gameData.currentTurn = gameData.currentTurn === 'angelbubu' ? 'demonbubu' : 'angelbubu';
    gameData.round++;
    gameData.status = 'waiting';
    gameData.currentArrangement = null;
    gameData.setBy = null;
    gameData.battleTeam = null;
    
    localStorage.setItem('gameData', JSON.stringify(gameData));
    
    // Clear battle/challenge data
    localStorage.removeItem('battleAlert');
    localStorage.removeItem('selectedChallenge');
    localStorage.removeItem('challengeReveal');
    localStorage.removeItem('roundWinner');
    
    // Reset UI
    document.getElementById('battleMode').classList.add('hidden');
    document.getElementById('challengeDisplay').classList.add('hidden');
    hideWaitingScreen();
    resetForm();
    
    // Update turn
    updateLifeStatus(gameData.currentTurn);
}

// Reset form
function resetForm() {
    document.getElementById('pizzaCoolSelect').value = '';
    document.getElementById('pizzaLameSelect').value = '';
    document.getElementById('pizzaAnnoyingSelect').value = '';
}

// Add to game state
gameState.lastRevealTime = 0;
gameState.lastWinnerTime = 0;

// Reset game
function resetGame() {
    const gameData = JSON.parse(localStorage.getItem('gameData') || '{}');
    
    // Keep alternating turns
    gameData.currentTurn = gameData.currentTurn === 'angelbubu' ? 'demonbubu' : 'angelbubu';
    gameData.round++;
    gameData.status = 'waiting';
    gameData.currentArrangement = null;
    gameData.setBy = null;
    gameData.battleTeam = null;
    
    localStorage.setItem('gameData', JSON.stringify(gameData));
    
    // Clear battle alert
    localStorage.removeItem('battleAlert');
    localStorage.removeItem('selectedChallenge');
    
    // Reset UI
    document.getElementById('battleMode').classList.add('hidden');
    hideWaitingScreen();
    resetForm();
    
    // Update turn
    updateLifeStatus(gameData.currentTurn);
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