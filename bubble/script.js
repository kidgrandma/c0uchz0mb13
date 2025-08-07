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
        this.victoryAchieved = false;
        this.gameEndTime = null;
        this.unlockShown = false;
        this.labubuKilled = 0;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                ('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0);

this.isTouch = ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (navigator.msMaxTouchPoints > 0);
        
        
        this.deviceDifficulty = {
            desktop: {
                spawnRate: 450,  
                targetScore: 1000,
                speedMultiplier: 1.4,
                lifespanMultiplier: 1,
                pointsMultiplier: 1,
                bonusRate: 0.4
            },
            mobile: {
                spawnRate: 500,  
                targetScore: 1200,
                speedMultiplier: 1.3, 
                lifespanMultiplier: 0.85, 
                pointsMultiplier: 0.8, 
                bonusRate: 0.18  
            }
        };
        
        // Apply device-specific settings
        const settings = this.isMobile ? this.deviceDifficulty.mobile : this.deviceDifficulty.desktop;
        this.spawnRate = settings.spawnRate;
        this.targetScore = settings.targetScore;
        this.speedMultiplier = settings.speedMultiplier;
        this.lifespanMultiplier = settings.lifespanMultiplier;
        this.pointsMultiplier = settings.pointsMultiplier;
        this.bonusRate = settings.bonusRate;
        
        this.lifespan = { 
            min: 2200 * this.lifespanMultiplier, 
            max: 3800 * this.lifespanMultiplier 
        };
        
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
      this.burnSound = document.getElementById('burnSound');

        
        this.preventDoubleTapZoom();
    }
    
    preventDoubleTapZoom() {
        let lastTouchEnd = 0;
        this.gameContainer.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
                e.stopPropagation();
            }
            lastTouchEnd = now;
        }, { passive: false });
        
        this.gameContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        document.addEventListener('gesturechange', (e) => {
            e.preventDefault();
        }, { passive: false });
        this.gameContainer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.handleStartClick());
        this.muteButton.addEventListener('click', () => this.toggleSound());
        
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
              this.burnSound = document.getElementById('burnSound');
        if (this.burnSound) this.burnSound.volume = 0.9;
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
        
        this.enableAudio();
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

    playBubbleSound() {
        if (this.soundEnabled && this.bubblePopSound) {
            try {
                this.bubblePopSound.currentTime = 0;
                this.bubblePopSound.volume = 0.4 + Math.random() * 0.2; 
                this.bubblePopSound.play().catch(e => {
                });
            } catch (e) {
                console.log('Bubble sound error:', e);
            }
        }
    }

    startGame() {
        document.body.classList.add('game-active');
        this.startScreen.style.display = 'none';
        
        if (this.isMobile) {
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.height = '100%';
            document.body.style.overflow = 'hidden';
            window.scrollTo(0, 0);
        }
        
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
        this.mobileIndicatorAdded = false;
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
                this.endGame(this.victoryAchieved);
            }
        }, 1000);
        this.spawnTimer = setInterval(() => {
            if (this.gameRunning) {
                this.createLabubu();
            }
        }, this.spawnRate);
    }

    createInitialLabubus() {
        const initialCount = this.isMobile ? 3 : 4;
        for (let i = 0; i < initialCount; i++) {
            setTimeout(() => this.createLabubu(), i * 200);
        }
    }

    showCountdown(callback) {
        const countdownDiv = document.createElement('div');
        countdownDiv.className = 'countdown-number';
        countdownDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: ${this.isMobile ? '100px' : '120px'};
            color: #ff3366;
            font-weight: 900;
            text-shadow: 0 0 40px #ff3366, 0 0 80px #00ffcc, 3px 3px 0 #000;
            z-index: 1000;
            font-family: 'Metal Mania', cursive;
            animation: countdownPulse 1s ease-in-out;
        `;
        
        this.gameContainer.appendChild(countdownDiv);
        
        if (this.isMobile) {
            const warningDiv = document.createElement('div');
            warningDiv.style.cssText = `
                position: absolute;
                top: 65%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 16px;
                color: #00ffcc;
                text-align: center;
                z-index: 1000;
                font-family: 'Orbitron', monospace;
                text-transform: uppercase;
                animation: fadeIn 0.5s ease-in;
            `;
            warningDiv.textContent = 'MOBILE MODE: 1200 PTS TO WIN!';
            this.gameContainer.appendChild(warningDiv);
            setTimeout(() => {
                if (warningDiv.parentNode) warningDiv.remove();
            }, 3500);
        }
        
        let count = 3;
        countdownDiv.textContent = count;
        
        const countInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownDiv.textContent = count;
                countdownDiv.style.animation = 'none';
                void countdownDiv.offsetHeight;
                countdownDiv.style.animation = 'countdownPulse 1s ease-in-out';
            } else if (count === 0) {
                countdownDiv.textContent = 'KILL!';
                countdownDiv.style.color = '#00ffcc';
                countdownDiv.style.fontSize = this.isMobile ? '120px' : '140px';
                countdownDiv.style.textShadow = '0 0 60px #00ffcc, 0 0 120px #ff3366, 4px 4px 0 #000';
                countdownDiv.style.animation = 'killPulse 1s ease-out forwards';
            } else {
                clearInterval(countInterval);
                setTimeout(() => {
                    if (countdownDiv.parentNode) countdownDiv.remove();
                    callback();
                }, 100);
            }
        }, 1000);
    }

    updateScreenEffects() {
        document.body.classList.remove('flash-warning', 'flash-critical');
        
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
        
        const isBonus = Math.random() < this.bonusRate;
        
        if (isBonus) {
            labubu.classList.add('labubu-bonus');
            labubu.dataset.type = 'secret';
        } else {
            const goodType = Math.floor(Math.random() * 3) + 1;
            labubu.classList.add(`labubu-good-${goodType}`);
            const basePoints = Math.floor(Math.random() * 80) + 25;
            const points = Math.floor(basePoints * this.pointsMultiplier);
            labubu.dataset.points = points;
            labubu.dataset.type = 'good';
        }
        
        const sizeRoll = Math.random();
        let baseSize;
        
        if (sizeRoll < 0.2) {
            baseSize = Math.min(window.innerWidth, window.innerHeight) * (this.isMobile ? 0.10 : 0.11);
        } else if (sizeRoll < 0.7) {
            baseSize = Math.min(window.innerWidth, window.innerHeight) * (this.isMobile ? 0.13 : 0.14);
        } else {
            baseSize = Math.min(window.innerWidth, window.innerHeight) * (this.isMobile ? 0.16 : 0.18);
        }
        
        const size = baseSize + Math.random() * (baseSize * 0.3);
        const finalSize = Math.max(this.isMobile ? 55 : 65, Math.min(size, 170));
        labubu.style.width = finalSize + 'px';
        labubu.style.height = finalSize + 'px';
        
        const maxX = window.innerWidth - finalSize;
        const maxY = window.innerHeight - finalSize;
        labubu.style.left = Math.max(0, Math.random() * maxX) + 'px';
        labubu.style.top = Math.max(0, Math.random() * maxY) + 'px';
        const handlePop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (labubu.classList.contains('popping')) return;
    
    this.popLabubu(labubu);
};

labubu.addEventListener('click', handlePop);

        if (this.isTouch) {
    labubu.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (labubu.classList.contains('popping')) return;
        
        this.popLabubu(labubu);
    }, { passive: false });
    
    labubu.addEventListener('touchmove', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });
    
    labubu.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });
} else {
    labubu.addEventListener('click', (e) => {
        e.stopPropagation();
        if (labubu.classList.contains('popping')) return;
        this.popLabubu(labubu);
    });
}
        
        this.gameContainer.appendChild(labubu);
        this.labubus.push(labubu);
        
        this.playBubbleSound();
        
        this.addMovement(labubu);
        
        const lifespan = this.lifespan.min + Math.random() * (this.lifespan.max - this.lifespan.min);
        setTimeout(() => {
            if (labubu.parentNode && this.gameRunning) {
                this.removeLabubu(labubu);
            }
        }, lifespan);
    }

    handleLabubuTap(e, labubu) {
        if (e.touches && e.touches.length > 1) {
            return; 
        }
        
        const now = Date.now();
        if (this.isMobile && (now - this.lastTapTime) < 50) { 
            return; 
        }
        this.lastTapTime = now;
        
        const touchId = e.touches ? e.touches[0].identifier : 'mouse';
        if (this.activeTouches.has(touchId)) {
            return;
        }
        
        this.activeTouches.add(touchId);
        setTimeout(() => this.activeTouches.delete(touchId), 100); 
        
        this.popLabubu(labubu);
    }

    addMovement(labubu) {
        let dx = (Math.random() - 0.5) * 4 * this.baseSpeed; 
        let dy = (Math.random() - 0.5) * 4 * this.baseSpeed;
        
        const moveInterval = this.isMobile ? 40 : 30;  
        
        labubu.moveInterval = setInterval(() => {
            if (!labubu.parentNode || !this.gameRunning) {
                clearInterval(labubu.moveInterval);
                return;
            }
            
            let currentX = parseFloat(labubu.style.left) || 0;
            let currentY = parseFloat(labubu.style.top) || 0;
            const labubuSize = parseFloat(labubu.style.width) || 55;
            
            const changeChance = this.isMobile ? 0.02 : 0.04;
            if (Math.random() < changeChance) {
                dx = (Math.random() - 0.5) * 4 * this.baseSpeed;
                dy = (Math.random() - 0.5) * 4 * this.baseSpeed;
            }
            
            // Bounce off walls
            if (currentX <= 0 || currentX >= window.innerWidth - labubuSize) dx = -dx;
            if (currentY <= 0 || currentY >= window.innerHeight - labubuSize) dy = -dy;
            
            labubu.style.left = Math.max(0, Math.min(window.innerWidth - labubuSize, currentX + dx)) + 'px';
            labubu.style.top = Math.max(0, Math.min(window.innerHeight - labubuSize, currentY + dy)) + 'px';
        }, moveInterval);
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
            const basePoints = Math.floor(Math.random() * 100) + 25;
            const adjustedPoints = Math.floor(basePoints * this.pointsMultiplier);
            const isWin = Math.random() < 0.4; 
            
            if (isWin) {
                scoreChange = adjustedPoints * 2;
                this.score += scoreChange;
                this.playSound(this.doubleSound);
            } else {
                scoreChange = adjustedPoints;
                this.score = Math.max(0, this.score - scoreChange);
                isPositive = false;
                this.playSound(this.debitSound);
            }
        }
        this.labubuKilled++;
        
        this.updateDisplay();
        labubu.classList.add('popping');
        this.createFloatingScore(labubu, scoreChange, isPositive);
        this.removeLabubu(labubu);
    }

    removeLabubu(labubu) {
        if (labubu.moveInterval) {
            clearInterval(labubu.moveInterval);
        }
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
        
        const progress = Math.min(100, Math.round((this.score / this.targetScore) * 100));
        this.progressElement.textContent = progress + '%';
        if (this.score >= this.targetScore && !this.unlockShown) {
    this.unlockShown = true;
    if (this.burnSound && this.soundEnabled) {
        this.playSound(this.burnSound);
    }
    const unlockMsg = document.createElement('div');
    unlockMsg.className = 'countdown-number'; 
    unlockMsg.textContent = 'SUCCESS!';

    unlockMsg.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: ${this.isMobile ? '100px' : '120px'};
        color: #00ffcc;
        font-weight: 900;
        text-shadow: 0 0 40px #ff3366, 0 0 80px #00ffcc, 3px 3px 0 #000;
        z-index: 1000;
        font-family: 'Metal Mania', cursive;
        animation: killPulse 1.5s ease-out forwards;
    `;

    this.gameContainer.appendChild(unlockMsg);

    setTimeout(() => {
        if (unlockMsg.parentNode) unlockMsg.remove();
    }, 1500);
}
        
        // Add mobile indicator if on mobile
        if (this.isMobile && !this.mobileIndicatorAdded) {
            this.mobileIndicatorAdded = true;
            const goalDiv = document.getElementById('goal');
            const targetDiv = goalDiv.querySelector('div:first-child');
            targetDiv.textContent = `TARGET: ${this.targetScore} PTS (MOBILE)`;
        }
        if (this.score >= this.targetScore) {
            this.victoryAchieved = true; 
}
    }
    

    async endGame(victory = false) {
        this.gameRunning = false;
        this.gameEndTime = Date.now();
        const gameTime = Math.round((this.gameEndTime - this.gameStartTime) / 1000);
        
        document.body.classList.remove('game-active', 'flash-warning', 'flash-critical');
        clearInterval(this.gameTimer);
        clearInterval(this.spawnTimer);
        document.body.className = '';
        
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.overflow = '';
        
        if (this.bgMusic) this.bgMusic.pause();
        if (this.countdownSound) this.countdownSound.pause();
        
        if (victory) {
            this.playSound(this.winnerSong);
        } else {
            this.playSound(this.loserSong);
        }
        
        this.labubus.forEach(labubu => this.removeLabubu(labubu));
        this.labubus = [];
        
        const gameData = {
            handle: this.playerHandle,
            score: this.score,
            time: gameTime,
            victory: victory,
            timestamp: this.gameEndTime,
            device: this.isMobile ? 'mobile' : 'desktop',
            targetScore: this.targetScore
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
                device: gameData.device,
                targetScore: gameData.targetScore,
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
        
        const targetScore = this.targetScore;
        const remainingPoints = targetScore - this.score;
        
        if (victory) {
            const deviceNote = this.isMobile ? ' ON MOBILE MODE!' : '';
            resultMessage = `🔪🔥 OH HELLLL YA${deviceNote}! 🔥🔪<br><br>
        `;
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
        } else if (this.score >= targetScore * 0.8) {
            resultMessage = `🎱 so close! just ${remainingPoints} more points needed!<br><br>
                keep burnin' ! 🍄`;
            resultEmoji = '😤 ALMOST 😤';
        } else if (this.score >= targetScore * 0.6) {
            resultMessage = `🍜 try being generally problematic<br><br>
                practice makes perfect! 👽`;
            resultEmoji = '🍓 BASIC 🍓';
        } else {
            resultMessage = `☃️ ooof! sucks 2 suck but u can burn again!<br><br>`;
            resultEmoji = '💀 LAME 💀';
        }
        const newStartScreen = document.createElement('div');
        newStartScreen.id = 'startScreen';
        newStartScreen.style.display = 'flex';
        newStartScreen.innerHTML = `
            <div class="brand">worksucks.net presents</div>
            <h1>Labubu Witch Hunt</h1>
            <h2 class="${victory ? 'victory-subtitle' : 'defeat-subtitle'}">${resultEmoji}</h2>
            
            <div class="results-container">
                <div class="results-left">
                    <div class="result-image ${imageClass}"></div>
                    
                    <div class="score-highlight ${victory ? 'victory' : ''}">
                        ${this.score} PTS IN ${gameTime}S!
                        ${this.isMobile ? '<br>(MOBILE MODE)' : ''}
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
                const deviceIcon = score.device === 'mobile' ? '📱' : '💻';
                
                html += `
                    <div class="leaderboard-entry ${victoryClass}" style="${highlightStyle}">
                        <span class="leaderboard-rank">${trophy}${rank}</span>
                        <span class="leaderboard-handle">${deviceIcon} ${score.handle}${isCurrentPlayer ? ' (you)' : ''}</span>
                        <span class="leaderboard-score">${score.score}</span>
                    </div>
                `;
            });
        }
        
        leaderboardElement.innerHTML = html;
    
}
}

window.addEventListener('load', () => {
    new LabubuWitchHunt();
});

window.addEventListener('resize', () => {
});