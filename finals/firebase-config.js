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
  // Create a new game room
  async createGame(gameId) {
    const gameRef = doc(db, 'games', gameId);
    
    // Generate 200 folders
    const folders = [];
    for (let i = 0; i < 200; i++) {
      folders.push({
        id: i,
        icon: `icon-${Math.floor(Math.random() * 30) + 1}`,
        visible: true,
        type: 'safe'
      });
    }
    
    // Place 1 bomb randomly
    const bombIndex = Math.floor(Math.random() * 200);
    folders[bombIndex].type = 'bomb';
    
    // Place 15-20 viruses randomly
    const virusCount = Math.floor(Math.random() * 6) + 15;
    const usedIndices = [bombIndex];
    
    for (let i = 0; i < virusCount; i++) {
      let virusIndex;
      do {
        virusIndex = Math.floor(Math.random() * 200);
      } while (usedIndices.includes(virusIndex));
      
      folders[virusIndex].type = 'virus';
      usedIndices.push(virusIndex);
    }
    
    // Create game document
    const gameData = {
      status: 'waiting',
      players: {
        player1: {
          name: '',
          avatar: '',
          connected: false,
          joinedAt: null
        },
        player2: {
          name: '',
          avatar: '',
          connected: false,
          joinedAt: null
        }
      },
      currentTurn: 1,
      folders: folders,
      folderCount: 200,
      lastAction: {
        type: '',
        player: 0,
        folderId: 0,
        timestamp: null,
        result: ''
      },
      virusActive: false,
      spectators: 0,
      createdAt: serverTimestamp(),
      winner: null
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
    if (!folder.visible) {
      throw new Error('Folder already clicked!');
    }
    
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
        result: folder.type
      }
    };
    
    // Handle different folder types
    if (folder.type === 'bomb') {
      // Game over!
      updates.winner = playerId === 1 ? 2 : 1;
      updates.status = 'finished';
    } else if (folder.type === 'virus') {
      // Virus will eat 3 more folders
      updates.virusActive = true;
      
      // Get visible folders
      const visibleIndices = updatedFolders
        .map((f, i) => f.visible ? i : -1)
        .filter(i => i !== -1);
      
      // Randomly select 3 to eat
      const toEat = [];
      for (let i = 0; i < Math.min(3, visibleIndices.length); i++) {
        const randomIndex = Math.floor(Math.random() * visibleIndices.length);
        const folderIndex = visibleIndices.splice(randomIndex, 1)[0];
        toEat.push(folderIndex);
        updatedFolders[folderIndex] = { ...updatedFolders[folderIndex], visible: false };
      }
      
      updates.folders = updatedFolders;
      updates.lastAction.virusAte = toEat;
      
      // Check if all folders are gone
      const remainingCount = updatedFolders.filter(f => f.visible).length;
      if (remainingCount <= 0) {
        updates.winner = playerId === 1 ? 2 : 1;
        updates.status = 'finished';
      }
      
      // Clear virus active after delay
      setTimeout(async () => {
        await updateDoc(gameRef, { virusActive: false });
      }, 2000);
    }
    
    // Update folder count
    updates.folderCount = updatedFolders.filter(f => f.visible).length;
    
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

// Helper to generate game codes
export function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}