import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc,
    query,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class LabubuWitchHunt {
    constructor() {
        this.db = db;
        this.score = 0;
        this.timeLeft = 15;
        this.gameRunning = false;
        this.labubus = [];
        this.baseSpeed = 1;
        this.soundEnabled = false;
        this.musicStarted = false;
        this.countdownPlayed = false;
        this.playerHandle = '';
        this.gameStartTime = null;
        this.gameEndTime = null;
        
        // Game settings
        this.spawnRate = 400;
        this.speedMultiplier = 1.4;
        this.bonusRate = 0.15;
        this.lifespan = { min: 2200, max: 3800 };
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupAudio();
    }

    initializeElements() {
        this.gameContainer = document.getElementById('gameContainer');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.progressElement = document.getElementById('progress');
        this.startScreen = document.getElementById('startScreen');
        this.startButton = document.getElementById('startButton');
        this.muteButton = document.getElementById('muteButton');
        this.handleInput = document.getElementById('handleInput');
        this.playerInfo = document.getElementById('playerInfo');
        this.playerHandleDisplay = document.getElementById('playerHandle');
        
        // Audio elements
        this.bgMusic = document.getElementById('bgMusic');
        this.bubblePopSound = document.getElementById('bubblePopSound');
        this.creditSound = document.getElementById('creditSound');
        this.doubleSound = document.getElementById('doubleSound');
        this.debitSound = document.getElementById('debitSound');
        this.winnerSong = document.getElementById('winnerSong');
        this.loserSong = document.getElementById('loserSong');
        this.startGameSound = document.getElementById('startGameSound');
        this.countdownSound = document.getElementById('countdownSound');
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.handleStartClick());
        this.muteButton.addEventListener('click', () => this.toggleSound());
        
        // Enter key support for start
        this.handleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleStartClick();
            }
        });
    }

    setupAudio() {
        try {
            this.bgMusic.volume = 0.4;
            this.bubblePopSound.volume = 0.6;
            this.creditSound.volume = 0.7;
            this.doubleSound.volume = 0.8;
            this.debitSound.volume = 0.8;
            this.winnerSong.volume = 0.9;
            this.loserSong.volume = 0.9;
            this.startGameSound.volume = 0.9;
            this.countdownSound.volume = 1.0;
        } catch (e) {
            console.log('Audio initialization warning:', e);
        }
        
        this.muteButton.textContent = '🔇';
    }

    handleStartClick() {
        const handle = this.handleInput.value.trim();
        if (!handle) {
            this.handleInput.style.animation = 'shake 0.5s';
            setTimeout(() => {
                this.handleInput.style.animation = '';
            }, 500);
            return;
        }
        
        this.playerHandle = handle.toUpperCase();
        this.playerHandleDisplay.textContent = this.playerHandle;
        this.playerInfo.style.display = 'block';
        
        if (!this.musicStarted) {
            this.enableAudio();
        }
        this.startGame();
    }

    enableAudio() {
        this.soundEnabled = true;
        this.musicStarted = true;
        this.muteButton.textContent = '🔊';
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.muteButton.textContent = this.soundEnabled ? '🔊' : '🔇';
        
        if (this.soundEnabled && this.gameRunning) {
            this.playSound(this.bgMusic, true);
        } else {
            this.bgMusic.pause();
            this.countdownSound.pause();
        }
    }

    playSound(audio, isBackground = false) {
        if (this.soundEnabled && audio) {
            try {
                if (!isBackground) {
                    audio.currentTime = 0;
                }
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log('Audio play failed:', error);
                    });
                }
            } catch (e) {
                console.log('Audio error:', e);
            }
        }
    }

    startGame() {
        document.body.classList.add('game-active');
        this.startScreen.style.display = 'none';
        
        if (this.soundEnabled) {
            this.playSound(this.startGameSound);
        }
        
        this.showCountdown(() => {
            this.initializeGameState();
            this.startGameTimers();
            this.createInitialLabubus();
        });
    }

    initializeGameState() {
        this.gameRunning = true;
        this.score = 0;
        this.timeLeft = 15;
        this.labubus = [];
        this.baseSpeed = 1;
        this.countdownPlayed = false;
        this.gameStartTime = Date.now();
        document.body.className = 'game-active';
        this.updateDisplay();
        
        if (this.soundEnabled) {
            this.playSound(this.bgMusic, true);
        }
    }

    startGameTimers() {
        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            this.updateScreenEffects();
            this.updateLabubuSpeed();
            
            if (this.timeLeft === 4 && !this.countdownPlayed) {
                this.countdownPlayed = true;
                this.playSound(this.countdownSound);
            }
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);

        this.spawnTimer = setInterval(() => {
            if (this.gameRunning) {
                this.createLabubu();
            }
        }, this.spawnRate);
    }

    createInitialLabubus() {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => this.createLabubu(), i * 150);
        }
    }

    showCountdown(callback) {
        const countdownDiv = document.createElement('div');
        countdownDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 100px;
            color: #ff3366;
            font-weight: 900;
            text-shadow: 0 0 40px #ff3366, 0 0 80px #00ffcc;
            z-index: 1000;
            font-family: 'Metal Mania', cursive;
            animation: countdownPulse 1s ease-in-out;
        `;
        
        this.gameContainer.appendChild(countdownDiv);
        
        let count = 3;
        countdownDiv.textContent = count;
        
        const countInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownDiv.textContent = count;
                countdownDiv.style.animation = 'none';
                setTimeout(() => {
                    countdownDiv.style.animation = 'countdownPulse 1s ease-in-out';
                }, 10);
            } else {
                countdownDiv.textContent = 'KILL!';
                countdownDiv.style.color = '#00ffcc';
                setTimeout(() => {
                    countdownDiv.remove();
                    callback();
                }, 400);
                clearInterval(countInterval);
            }
        }, 800);
    }

    updateScreenEffects() {
        // Remove existing flash classes
        document.body.classList.remove('flash-warning', 'flash-critical');
        
        // Add appropriate flash class based on time
        if (this.timeLeft <= 3) {
            document.body.classList.add('flash-critical');
        } else if (this.timeLeft <= 6) {
            document.body.classList.add('flash-warning');
        }
    }

    updateLabubuSpeed() {
        this.baseSpeed = (1 + (15 - this.timeLeft) * 0.4) * this.speedMultiplier;
        
        this.labubus.forEach(labubu => {
            if (labubu.moveInterval) {
                clearInterval(labubu.moveInterval);
                this.addMovement(labubu);
            }
        });
    }

    createLabubu() {
        const labubu = document.createElement('div');
        labubu.className = 'labubu';
        
        this.playSound(this.bubblePopSound);
        
        const isBonus = Math.random() < this.bonusRate;
        
        if (isBonus) {
            labubu.classList.add('labubu-bonus');
            labubu.dataset.type = 'secret';
        } else {
            const goodType = Math.floor(Math.random() * 3) + 1;
            labubu.classList.add(`labubu-good-${goodType}`);
            const points = Math.floor(Math.random() * 80) + 25;
            labubu.dataset.points = points;
            labubu.dataset.type = 'good';
        }
        
        // Size and position
        const baseSize = Math.min(window.innerWidth, window.innerHeight) * 0.12;
        const size = baseSize + Math.random() * (baseSize * 0.3);
        const finalSize = Math.max(60, size);
        labubu.style.width = finalSize + 'px';
        labubu.style.height = finalSize + 'px';
        
        const maxX = window.innerWidth - finalSize;
        const maxY = window.innerHeight - finalSize;
        labubu.style.left = Math.max(0, Math.random() * maxX) + 'px';
        labubu.style.top = Math.max(0, Math.random() * maxY) + 'px';
        
        // Event listeners
        labubu.addEventListener('click', (e) => this.popLabubu(e.target));
        labubu.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.popLabubu(e.target);
        }, { passive: false });
        
        this.addMovement(labubu);
        
        // Auto-removal after lifespan
        const lifespan = this.lifespan.min + Math.random() * (this.lifespan.max - this.lifespan.min);
        setTimeout(() => {
            if (labubu.parentNode && this.gameRunning) {
                this.removeLabubu(labubu);
            }
        }, lifespan);
        
        this.gameContainer.appendChild(labubu);
        this.labubus.push(labubu);
    }

    addMovement(labubu) {
        let dx = (Math.random() - 0.5) * 6 * this.baseSpeed;
        let dy = (Math.random() - 0.5) * 6 * this.baseSpeed;
        
        labubu.moveInterval = setInterval(() => {
            if (!labubu.parentNode || !this.gameRunning) {
                clearInterval(labubu.moveInterval);
                return;
            }
            
            let currentX = parseFloat(labubu.style.left) || 0;
            let currentY = parseFloat(labubu.style.top) || 0;
            const labubuSize = parseFloat(labubu.style.width) || 55;
            
            // Random direction changes
            if (Math.random() < 0.04) {
                dx = (Math.random() - 0.5) * 6 * this.baseSpeed;
                dy = (Math.random() - 0.5) * 6 * this.baseSpeed;
            }
            
            // Bounce off walls
            if (currentX <= 0 || currentX >= window.innerWidth - labubuSize) dx = -dx;
            if (currentY <= 0 || currentY >= window.innerHeight - labubuSize) dy = -dy;
            
            labubu.style.left = Math.max(0, Math.min(window.innerWidth - labubuSize, currentX + dx)) + 'px';
            labubu.style.top = Math.max(0, Math.min(window.innerHeight - labubuSize, currentY + dy)) + 'px';
        }, 30);
    }

    popLabubu(labubu) {
        if (!this.gameRunning || labubu.classList.contains('popping')) return;
        
        let scoreChange = 0;
        let isPositive = true;
        
        if (labubu.dataset.type === 'good') {
            scoreChange = parseInt(labubu.dataset.points);
            this.score += scoreChange;
            this.playSound(this.creditSound);
        } else if (labubu.dataset.type === 'secret') {
            // Generate base points like a normal labubu (25-125)
            const basePoints = Math.floor(Math.random() * 100) + 25;
            const isWin = Math.random() < 0.5;
            
            if (isWin) {
                // Positive: 2x the base points
                scoreChange = basePoints * 2;
                this.score += scoreChange;
                this.playSound(this.doubleSound);
            } else {
                // Negative: lose the base points
                scoreChange = basePoints;
                this.score = Math.max(0, this.score - scoreChange);
                isPositive = false;
                this.playSound(this.debitSound);
            }
        }
        
        this.updateDisplay();
        labubu.classList.add('popping');
        this.createFloatingScore(labubu, scoreChange, isPositive);
        this.removeLabubu(labubu);
    }

    removeLabubu(labubu) {
        if (labubu.moveInterval) clearInterval(labubu.moveInterval);
        setTimeout(() => {
            if (labubu.parentNode) labubu.remove();
        }, 300);
        this.labubus = this.labubus.filter(l => l !== labubu);
    }

    createFloatingScore(labubu, points, isPositive) {
        const floatingScore = document.createElement('div');
        floatingScore.className = 'floating-score ' + (isPositive ? 'positive-score' : 'negative-score');
        floatingScore.textContent = (isPositive ? '+' : '-') + Math.abs(points);
        
        const rect = labubu.getBoundingClientRect();
        floatingScore.style.left = rect.left + rect.width/2 + 'px';
        floatingScore.style.top = rect.top + rect.height/2 + 'px';
        
        this.gameContainer.appendChild(floatingScore);
        
        setTimeout(() => {
            if (floatingScore.parentNode) {
                floatingScore.remove();
            }
        }, 1800);
    }

    updateDisplay() {
        this.scoreElement.textContent = this.score;
        this.timerElement.textContent = this.timeLeft;
        
        const progress = Math.min(100, Math.round((this.score / 1000) * 100));
        this.progressElement.textContent = progress + '%';
        
        if (this.score >= 1000 && this.gameRunning) {
            this.endGame(true);
        }
    }

    async endGame(victory = false) {
        this.gameRunning = false;
        this.gameEndTime = Date.now();
        const gameTime = Math.round((this.gameEndTime - this.gameStartTime) / 1000);
        
        // Cleanup
        document.body.classList.remove('game-active');
        clearInterval(this.gameTimer);
        clearInterval(this.spawnTimer);
        document.body.className = '';
        
        if (this.bgMusic) this.bgMusic.pause();
        if (this.countdownSound) this.countdownSound.pause();
        
        // Play result sound
        if (victory) {
            this.playSound(this.winnerSong);
        } else {
            this.playSound(this.loserSong);
        }
        
        // Clean up labubus
        this.labubus.forEach(labubu => this.removeLabubu(labubu));
        this.labubus = [];
        
        // Save score
        const gameData = {
            handle: this.playerHandle,
            score: this.score,
            time: gameTime,
            victory: victory,
            timestamp: this.gameEndTime
        };
        
        await this.saveScore(gameData);
        await this.showResults(victory, gameTime);
    }

    async saveScore(gameData) {
        try {
            await addDoc(collection(this.db, 'labubu-scores'), {
                handle: gameData.handle,
                score: gameData.score,
                time: gameData.time,
                victory: gameData.victory,
                timestamp: gameData.timestamp,
                dateCreated: new Date().toISOString()
            });
            console.log('Score saved successfully');
        } catch (error) {
            console.error('Error saving score:', error);
        }
    }

    async showResults(victory, gameTime) {
        let resultMessage, resultEmoji, linksHtml = '';
        let imageClass = victory ? 'victory' : 'defeat';
        
        if (victory) {
            resultMessage = `🔪🔥 OH HELLLL YA! 🔥🔪<br><br>
                <strong style="color: #ff3366;">PLAY INTERNET OLYMPICS 4 FREEEEEE</strong><br>
                📸 Screenshot this & send to @kidgrandma on instagram<br>
                your score has been saved to the leaderboard.`;
            resultEmoji = '🔥 VICTORY 🔥';
            linksHtml = `
                <div class="victory-links">
                    <a href="https://instagram.com/kidgrandma" target="_blank" class="victory-link">
                        🔥 DM @kidgrandma 🔥
                    </a>
                    <a href="../index.html" class="victory-link">
                        🔪 continue  🔪
                    </a>
                </div>
            `;
        } else if (this.score >= 800) {
            resultMessage = `🎱 so close! just ${1000 - this.score} more points needed!<br><br>
                keep burnin' ! 🍄`;
            resultEmoji = '💿 RUH ROH 💿';
        } else if (this.score >= 600) {
            resultMessage = `🍜 try being generally problematic<br><br>
                practice makes perfect! 👽`;
            resultEmoji = '🍓 basic 🍓';
        } else {
            resultMessage = `☃️ ooof! sucks 2 suck but u can burn again!<br><br>`;
            resultEmoji = '🔥 LAME 🔥';
        }
        
        // Create new results screen
        const newStartScreen = document.createElement('div');
        newStartScreen.id = 'startScreen';
        newStartScreen.style.display = 'flex';
        newStartScreen.innerHTML = `
            <div class="brand">worksucks.net presents</div>
            <h1 class="${victory ? 'victory' : ''}">${resultEmoji}</h1>
            
            <div class="results-container">
                <div class="results-left">
                    <div class="result-image ${imageClass}"></div>
                    
                    <div class="score-highlight ${victory ? 'victory' : ''}">
                        ${this.score} PTS IN ${15 - this.timeLeft}S!
                    </div>
                    <div class="player-name-highlight">PLAYER: ${this.playerHandle}</div>
                    
                    <div class="instructions">
                        ${resultMessage}
                    </div>
                    
                    ${linksHtml}
                    <button class="action-button" onclick="location.reload()">PLAY AGAIN</button>
                </div>
                
                <div class="results-right">
                    <div class="leaderboard-section">
                        <div class="leaderboard-title">🔪🔥 TOP KILLAZ 🔥🔪</div>
                        <div id="finalLeaderboard">Loading leaderboard...</div>
                    </div>
                </div>
            </div>
        `;
        
        this.startScreen.remove();
        this.gameContainer.appendChild(newStartScreen);
        this.startScreen = newStartScreen;
        
        // Load and display leaderboard
        await this.loadAndDisplayLeaderboard();
    }

    async loadAndDisplayLeaderboard() {
        try {
            const q = query(
                collection(this.db, 'labubu-scores'),
                orderBy('score', 'desc'),
                limit(10)
            );
            
            const querySnapshot = await getDocs(q);
            const scores = [];
            
            querySnapshot.forEach((doc) => {
                scores.push(doc.data());
            });
            
            this.displayLeaderboardResults(scores);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            const leaderboardElement = document.getElementById('finalLeaderboard');
            if (leaderboardElement) {
                leaderboardElement.innerHTML = '<div style="color: #ff3366; text-align: center;">error loading leaderboard</div>';
            }
        }
    }

    displayLeaderboardResults(scores) {
        const leaderboardElement = document.getElementById('finalLeaderboard');
        if (!leaderboardElement) return;
        
        let html = '';
        if (scores.length === 0) {
            html = '<div style="text-align: center; color: #00ffcc;">no scores yet - you were the first killaz!</div>';
        } else {
            scores.forEach((score, index) => {
                const rank = index + 1;
                const victoryClass = score.victory ? 'victory' : '';
                const trophy = rank === 1 ? '🎱' : rank === 2 ? '🥚' : rank === 3 ? '🐛' : '';
                const isCurrentPlayer = score.handle === this.playerHandle && Math.abs(score.timestamp - this.gameEndTime) < 5000;
                const highlightStyle = isCurrentPlayer ? 'background: linear-gradient(135deg, rgba(255, 51, 102, 0.3), rgba(0,0,0,0.5)); border: 2px solid #ff3366;' : '';
                
                html += `
                    <div class="leaderboard-entry ${victoryClass}" style="${highlightStyle}">
                        <span class="leaderboard-rank">${trophy}${rank}</span>
                        <span class="leaderboard-handle">${score.handle}${isCurrentPlayer ? ' (you)' : ''}</span>
                        <span class="leaderboard-score">${score.score}</span>
                    </div>
                `;
            });
        }
        
        leaderboardElement.innerHTML = html;
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new LabubuWitchHunt();
});

// Handle window resize
window.addEventListener('resize', () => {
    // Game adapts automatically due to responsive CSS
});