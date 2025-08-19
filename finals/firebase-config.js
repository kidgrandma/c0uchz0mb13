// firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc, 
  onSnapshot,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDJ8uiR2qEUfXIuFEO2l-40668WNpQdj2w",
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

// Game functions
export const GameManager = {
  // Generate game code
  generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // Create a new game room
  async createGame(gameId) {
    const gameRef = doc(db, 'games', gameId);
    
    // Generate 60 folders
    const folders = [];
    for (let i = 0; i < 60; i++) {
      folders.push({
        id: i,
        icon: `icon-${Math.floor(Math.random() * 30) + 1}`,
        visible: true,
        type: 'safe'
      });
    }
    
    // Place 1 BSOD (Blue Screen of Death) randomly
    const bsodIndex = Math.floor(Math.random() * 60);
    folders[bsodIndex].type = 'bsod';
    console.log('BSOD placed at index:', bsodIndex); // Debug log
    
    // Place 8-10 viruses randomly
    const virusCount = Math.floor(Math.random() * 3) + 8;
    const usedIndices = [bsodIndex];
    
    for (let i = 0; i < virusCount; i++) {
      let virusIndex;
      do {
        virusIndex = Math.floor(Math.random() * 60);
      } while (usedIndices.includes(virusIndex));
      
      folders[virusIndex].type = 'virus';
      usedIndices.push(virusIndex);
    }
    
    // Place 1-2 antivirus folders (rare power-ups)
    const antivirusCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < antivirusCount; i++) {
      let antivirusIndex;
      do {
        antivirusIndex = Math.floor(Math.random() * 60);
      } while (usedIndices.includes(antivirusIndex));
      
      folders[antivirusIndex].type = 'antivirus';
      usedIndices.push(antivirusIndex);
    }
    
    // Create game document
    const gameData = {
      status: 'waiting',
      players: {
        player1: {
          name: '',
          avatar: '',
          connected: false,
          joinedAt: null,
          immunityClicks: 0
        },
        player2: {
          name: '',
          avatar: '',
          connected: false,
          joinedAt: null,
          immunityClicks: 0
        }
      },
      currentTurn: 1,
      folders: folders,
      folderCount: 60,
      lastAction: {
        type: '',
        player: 0,
        folderId: 0,
        timestamp: null,
        result: '',
        virusAte: []
      },
      virusActive: false,
      spectators: 0,
      createdAt: serverTimestamp(),
      winner: null,
      gameEvents: [],
      tournamentMatch: null // Track if this is a tournament game
    };
    
    await setDoc(gameRef, gameData);
    return gameData;
  },
  
  // Join game as player
  async joinGame(gameId, playerNum, playerName, avatar) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const updates = {};
    updates[`players.player${playerNum}.name`] = playerName;
    updates[`players.player${playerNum}.avatar`] = avatar;
    updates[`players.player${playerNum}.connected`] = true;
    updates[`players.player${playerNum}.joinedAt`] = serverTimestamp();
    
    // Check if both players joined
    const gameData = gameDoc.data();
    const otherPlayer = playerNum === 1 ? gameData.players.player2 : gameData.players.player1;
    
    if (otherPlayer.connected) {
      updates.status = 'playing';
      // Add game start event
      updates.gameEvents = [...(gameData.gameEvents || []), {
        type: 'game_start',
        timestamp: Date.now(),
        message: '1v1. 60 folders. Unknown Viruses. 1 Blue screen o Death.'
      }];
    }
    
    await updateDoc(gameRef, updates);
  },
  
  // Click folder
  async clickFolder(gameId, folderId, playerId) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    const gameData = gameDoc.data();
    
    // Validate turn
    if (gameData.currentTurn !== playerId) {
      throw new Error('Not your turn!');
    }
    
    const folder = gameData.folders[folderId];
    if (!folder || !folder.visible) {
      throw new Error('Folder already clicked or invalid!');
    }
    
    console.log('Clicking folder:', folderId, 'Type:', folder.type); // Debug log
    
    // Create a copy of folders array
    const updatedFolders = [...gameData.folders];
    updatedFolders[folderId] = { ...folder, visible: false };
    
    // Build updates object
    const updates = {
      folders: updatedFolders,
      lastAction: {
        type: 'click',
        player: playerId,
        folderId: folderId,
        timestamp: serverTimestamp(),
        result: folder.type,
        virusAte: []
      }
    };
    
    // Get player info for events
    const playerName = gameData.players[`player${playerId}`].name;
    const events = [...(gameData.gameEvents || [])];
    
    // Handle immunity
    const hasImmunity = gameData.players[`player${playerId}`].immunityClicks > 0;
    
    // Handle different folder types
    if (folder.type === 'bsod') {
      if (hasImmunity) {
        // Player has immunity - BSOD relocates!
        console.log('BSOD clicked with immunity - relocating!');
        
        // Find all empty (non-visible) folder indices
        const emptyIndices = updatedFolders
          .map((f, i) => !f.visible ? i : -1)
          .filter(i => i !== -1);
        
        if (emptyIndices.length > 0) {
          // Pick random empty slot for BSOD
          const newBsodIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          
          // Move BSOD to new location
          updatedFolders[newBsodIndex] = {
            ...updatedFolders[newBsodIndex],
            type: 'bsod',
            visible: true
          };
          
          // Current folder becomes safe
          updatedFolders[folderId].type = 'safe';
          
          events.push({
            type: 'bsod_relocated',
            timestamp: Date.now(),
            message: `BASED SCREEN OF DEATH DISCOVERED - ANTI-VIRUS ACTIVATED - MOVING MOVING MOVING`
          });
          
          // Remove immunity
          updates[`players.player${playerId}.immunityClicks`] = 0;
          
          // Trigger special animation flag
          updates.bsodRelocating = true;
          setTimeout(async () => {
            await updateDoc(gameRef, { bsodRelocating: false });
          }, 3000);
        } else {
          // No empty slots - player must die
          updates.winner = playerId === 1 ? 2 : 1;
          updates.status = 'finished';
          events.push({
            type: 'bsod',
            timestamp: Date.now(),
            message: `${playerName} HIT THE BLUE SCREEN OF DEATH! NO ESCAPE! BIG BIG BIG RIP!`
          });
        }
      } else {
        // No immunity - instant death
        updates.winner = playerId === 1 ? 2 : 1;
        updates.status = 'finished';
        events.push({
          type: 'bsod',
          timestamp: Date.now(),
          message: `${playerName} HIT THE BLUE SCREEN OF DEATH! BIG BIG BIG RIP!`
        });
        console.log('BSOD HIT! Winner:', updates.winner);
      }
    } else if (folder.type === 'virus') {
      // Virus will eat 3-6 more folders
      updates.virusActive = true;
      const eatCount = Math.floor(Math.random() * 4) + 3; // 3-6 folders
      
      // Get visible folders (excluding BSOD from being eaten)
      const visibleIndices = updatedFolders
        .map((f, i) => (f.visible && f.type !== 'bsod') ? i : -1)
        .filter(i => i !== -1);
      
      // Randomly select folders to eat
      const toEat = [];
      for (let i = 0; i < Math.min(eatCount, visibleIndices.length); i++) {
        const randomIndex = Math.floor(Math.random() * visibleIndices.length);
        const folderIndex = visibleIndices.splice(randomIndex, 1)[0];
        toEat.push(folderIndex);
        updatedFolders[folderIndex] = { ...updatedFolders[folderIndex], visible: false };
      }
      
      updates.folders = updatedFolders;
      updates.lastAction.virusAte = toEat;
      
      events.push({
        type: 'virus',
        timestamp: Date.now(),
        message: `VIRUS FOUND. ${toEat.length} folders fucced.`
      });
      
      // Check if all folders are gone or only BSOD remains
      const remainingFolders = updatedFolders.filter(f => f.visible);
      const remainingCount = remainingFolders.length;
      
      if (remainingCount <= 0) {
        updates.winner = playerId === 1 ? 2 : 1;
        updates.status = 'finished';
        events.push({
          type: 'game_end',
          timestamp: Date.now(),
          message: 'All folders consumed. Game over by attrition.'
        });
      } else if (remainingCount === 1 && remainingFolders[0].type === 'bsod') {
        // If only BSOD remains, current player must click it and loses
        console.log('Only BSOD remains - game will end on next click');
      }
      
      // Clear virus active after delay
      setTimeout(async () => {
        await updateDoc(gameRef, { virusActive: false });
      }, 2000);
    } else if (folder.type === 'antivirus') {
      // Antivirus folder - grants immunity (reduced to 1 click)
      updates[`players.player${playerId}.immunityClicks`] = 1;
      events.push({
        type: 'antivirus',
        timestamp: Date.now(),
        message: `${playerName} found ANTIVIRUS! 1 click of immunity granted.`
      });
    } else {
      // Safe folder
      events.push({
        type: 'safe',
        timestamp: Date.now(),
        message: getRandomCommentary(updatedFolders.filter(f => f.visible).length)
      });
    }
    
    // Update folder count
    updates.folderCount = updatedFolders.filter(f => f.visible).length;
    
    // Add commentary based on folder count
    if (updates.folderCount < 30 && updates.folderCount > 15) {
      events.push({
        type: 'commentary',
        timestamp: Date.now(),
        message: 'It\'s getting real weird.'
      });
    } else if (updates.folderCount <= 15 && updates.folderCount > 8) {
      events.push({
        type: 'commentary',
        timestamp: Date.now(),
        message: 'Can someone just d13?'
      });
    } else if (updates.folderCount <= 8) {
      events.push({
        type: 'commentary',
        timestamp: Date.now(),
        message: 'Biiiig RIP.'
      });
    }
    
    updates.gameEvents = events;
    
    // Handle immunity deduction for non-BSOD clicks
    if (hasImmunity && folder.type !== 'bsod') {
      updates[`players.player${playerId}.immunityClicks`] = 
        gameData.players[`player${playerId}`].immunityClicks - 1;
    }
    
    // Switch turns (unless game over)
    if (!updates.winner) {
      updates.currentTurn = playerId === 1 ? 2 : 1;
    }
    
    await updateDoc(gameRef, updates);
  },
  
  // Add spectator
  async addSpectator(gameId) {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      spectators: increment(1)
    });
  },
  
  // Remove spectator
  async removeSpectator(gameId) {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      spectators: increment(-1)
    });
  },
  
  // Listen to game changes
  subscribeToGame(gameId, callback) {
    const gameRef = doc(db, 'games', gameId);
    return onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      } else {
        // Game doesn't exist (deleted)
        callback(null);
      }
    });
  },
  
  // Get all active games (for admin)
  async getActiveGames() {
    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, where('status', 'in', ['waiting', 'playing']));
    const snapshot = await getDocs(q);
    
    const games = [];
    snapshot.forEach((doc) => {
      games.push({ id: doc.id, ...doc.data() });
    });
    
    return games;
  },
  
  // Get all games (for admin)
  subscribeToAllGames(callback) {
    const gamesRef = collection(db, 'games');
    return onSnapshot(gamesRef, (snapshot) => {
      const games = [];
      snapshot.forEach((doc) => {
        games.push({ id: doc.id, ...doc.data() });
      });
      callback(games);
    });
  }
};

// Helper for random commentary
function getRandomCommentary(folderCount) {
  if (folderCount > 50) {
    const options = [
      "Don't fuck it up. Yet.",
      "R U FEELING SAFE AND SECURE?",
      "FAFO"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (folderCount > 30) {
    const options = [
      "It's getting real weird.",
      "R we there yet?",
      "It's cold."
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (folderCount > 15) {
    const options = [
      "Hurrrryyyyyy",
      "Can someone just d13?",
      "It's gonna come 4 u"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else if (folderCount > 8) {
    const options = [
      "I think we're just happy it'll be over soon.",
      "Did u buy a lotto ticket this week?",
      "Do you think labubu's really want a rave?"
    ];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    const options = [
      "One of you is disassociating",
      "Sometimes it's hot in McDonalds. Sometimes it's not.",
      "Biiiig RIP."
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
}