// character.js - PLAYPEN STYLE WITH DRAG & DROP
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    query,
    where,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Firebase configuration (keeping your existing)
const firebaseConfig = {
    apiKey: "AIzaSyDJ8uiR2qEUfXIuFEO21-40668WNpOdj2w",
    authDomain: "c0uchz0mb13.firebaseapp.com",
    projectId: "c0uchz0mb13",
    storageBucket: "c0uchz0mb13.firebasestorage.app",
    messagingSenderId: "1051521591004",
    appId: "1:1051521591004:web:1301f129fc0f3032f6f619",
    measurementId: "G-6BNDYZQRPE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global state
const state = {
    currentUser: null,
    currentAccessCode: null,
    allUsers: [],
    cart: {},
    draggedPlayer: null,
    draggedElement: null,
    dragOffset: null,
    teamTotals: { HOT: 0, COLD: 0 },
    lastModNote: null
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('Initializing Playpen...');
    setupEventListeners();
    loadRandomBackground();
    
    // Try to restore session
    const savedCode = sessionStorage.getItem('accessCode');
    if (savedCode) {
        await attemptAutoLogin(savedCode);
    }
}

// Load random background (from companies.html)
function loadRandomBackground() {
    const backgrounds = [
        { file: 'game-bg-1.jpg', weight: 3 },
        { file: 'game-bg-2.jpg', weight: 3 },
        { file: 'game-bg-3.jpg', weight: 2 },
        { file: 'game-bg-4.jpg', weight: 1 },
        { file: 'game-bg-5.jpg', weight: 1 }
    ];
    
    const totalWeight = backgrounds.reduce((sum, bg) => sum + bg.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedBg = backgrounds[0].file;
    
    for (const bg of backgrounds) {
        random -= bg.weight;
        if (random <= 0) {
            selectedBg = bg.file;
            break;
        }
    }
    
    const liminalBg = document.querySelector('.liminal-bg');
    if (liminalBg) {
        liminalBg.style.backgroundImage = `url('../assets/backgrounds/${selectedBg}')`;
    }
}

// Event Listeners
function setupEventListeners() {
    // Login
    const validateBtn = document.getElementById('validateCodeBtn');
    const codeInput = document.getElementById('accessCodeInput');
    
    if (validateBtn) {
        validateBtn.addEventListener('click', validateAccessCode);
    }
    
    if (codeInput) {
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validateAccessCode();
        });
    }
    
    // Navigation
    document.getElementById('rulesBtn')?.addEventListener('click', () => {
        showToast('rules coming soon... or not');
    });
    
    // Profile & Shop
    document.getElementById('myProfileBtn')?.addEventListener('click', showMyProfile);
    document.getElementById('weaponsShopBtn')?.addEventListener('click', openWeaponsShop);
    
    // Modal controls
    document.getElementById('closeProfileBtn')?.addEventListener('click', closeProfileModal);
    document.getElementById('closeWeaponsBtn')?.addEventListener('click', closeWeaponsModal);
    
    // Weapons shop
    document.getElementById('getMoreWeaponsBtn')?.addEventListener('click', openWeaponsShop);
    document.getElementById('checkoutWeaponsBtn')?.addEventListener('click', checkoutWeapons);
    document.getElementById('cancelShopBtn')?.addEventListener('click', closeWeaponsModal);
    
    // Setup zones
    setupZones();
}

// Setup drop zones
function setupZones() {
    const zones = document.querySelectorAll('.zone');
    
    zones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
    });
    
    // Playpen container for dragging back
    const playpen = document.getElementById('playpenContainer');
    if (playpen) {
        playpen.addEventListener('dragover', handleDragOver);
        playpen.addEventListener('drop', handleDropToPlaypen);
    }
}

// Authentication (keeping your existing)
async function validateAccessCode() {
    const input = document.getElementById('accessCodeInput');
    const code = input.value.trim().toUpperCase();
    
    if (!code) {
        showError('type something first');
        return;
    }
    
    console.log('Validating code:', code);
    
    try {
        const userDoc = await getDoc(doc(db, 'users', code));
        
        if (!userDoc.exists()) {
            showError('wrong code. dm the mod if ur lost');
            return;
        }
        
        const userData = userDoc.data();
        
        if (userData.status === 'blocked') {
            showError('ur blocked 🚫 talk 2 the mod');
            return;
        }
        
        if (userData.status === 'dead') {
            showToast('ur dead but u can still watch 💀');
        }
        
        state.currentUser = { id: code, ...userData };
        state.currentAccessCode = code;
        sessionStorage.setItem('accessCode', code);
        
        console.log('Login successful:', state.currentUser);
        await enterLeaderboard();
        
    } catch (error) {
        console.error('Login error:', error);
        showError('something broke. try again');
    }
}

async function attemptAutoLogin(code) {
    try {
        const userDoc = await getDoc(doc(db, 'users', code));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.status !== 'blocked') {
                state.currentUser = { id: code, ...userData };
                state.currentAccessCode = code;
                await enterLeaderboard();
            }
        }
    } catch (error) {
        console.error('Auto-login failed:', error);
        sessionStorage.clear();
    }
}

// Enter Leaderboard
async function enterLeaderboard() {
    document.getElementById('accessScreen').style.display = 'none';
    document.getElementById('leaderboardView').style.display = 'block';
    
    // Start music (soft)
    const music = document.getElementById('bgMusic');
    if (music) {
        music.volume = 0.2;
        music.play().catch(() => {
            document.addEventListener('click', () => {
                music.play().catch(() => {});
            }, { once: true });
        });
    }
    
    await loadAllPlayers();
    setupRealtimeListeners();
    
    showNotification(`ur in! welcome back @${state.currentUser.handle || state.currentUser.id}`);
}

// Load all players and render as cards
async function loadAllPlayers() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        state.allUsers = [];
        
        let hotTotal = 0;
        let coldTotal = 0;
        
        snapshot.forEach(doc => {
            const userData = { id: doc.id, ...doc.data() };
            state.allUsers.push(userData);
            
            // Calculate team totals (using $ prefix like companies)
            const totalPoints = (userData.individualPoints || 0) + (userData.teamPoints || 0);
            if (userData.team === 'HOT') {
                hotTotal += totalPoints;
            } else if (userData.team === 'COLD') {
                coldTotal += totalPoints;
            }
        });
        
        // Update team scores with $ prefix
        document.getElementById('hotPoints').textContent = `$${hotTotal}`;
        document.getElementById('coldPoints').textContent = `$${coldTotal}`;
        state.teamTotals = { HOT: hotTotal, COLD: coldTotal };
        
        // Render player cards
        renderPlayers();
        
    } catch (error) {
        console.error('Error loading players:', error);
        showToast('error loading players');
    }
}

// Create player card (styled like founder cards)
function createPlayerCard(player, isInZone = false) {
    const teamClass = player.team ? `team-${player.team.toLowerCase()}` : '';
    const deadClass = player.status === 'dead' ? 'dead' : '';
    const style = isInZone ? '' : `style="transform: rotate(${-15 + Math.random() * 30}deg);"`;
    
    // Get character image path
    const imagePath = player.characterId ? 
        `../assets/cast/cast-members/${player.characterId}-disc.png` : 
        '../assets/cast/default-disc.png';
    
    return `
        <div class="player-card ${teamClass} ${deadClass}" 
             data-player="${player.id}"
             draggable="true"
             ${style}>
            <div class="player-card-inner">
                <img src="${imagePath}" 
                     alt="${player.characterName || player.handle}" 
                     class="player-image"
                     onerror="this.src='../assets/cast/default-disc.png'">
                <div class="player-name">${player.handle || player.id}</div>
            </div>
        </div>
    `;
}

// Render players with scattered positions
function renderPlayers() {
    const container = document.getElementById('playpenContainer');
    const isMobile = window.innerWidth <= 768;
    
    container.innerHTML = '';
    
    // Filter for players with characters
    const playersWithCharacters = state.allUsers.filter(user => user.characterId);
    
    if (playersWithCharacters.length === 0) {
        container.innerHTML = '<div class="loading">No players yet...</div>';
        return;
    }
    
    playersWithCharacters.forEach((player, index) => {
        const card = document.createElement('div');
        card.innerHTML = createPlayerCard(player);
        const playerEl = card.firstElementChild;
        
        // Position cards randomly
        const x = 5 + (Math.random() * 85);
        const y = 5 + (Math.random() * 85);
        playerEl.style.left = `${x}%`;
        playerEl.style.top = `${y}%`;
        
        container.appendChild(playerEl);
    });
    
    // Add drag event listeners
    addDragListeners();
    
    // Add touch event support for mobile
    if (isMobile) {
        addTouchListeners();
    }
}

// Drag and Drop functionality
function addDragListeners() {
    const cards = document.querySelectorAll('.player-card');
    
    cards.forEach(card => {
        card.removeEventListener('dragstart', handleDragStart);
        card.removeEventListener('dragend', handleDragEnd);
        card.removeEventListener('click', handlePlayerClick);
        
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('click', handlePlayerClick);
        
        card.setAttribute('draggable', 'true');
    });
}

function handleDragStart(e) {
    const playerId = e.currentTarget.dataset.player;
    state.draggedPlayer = playerId;
    state.draggedElement = e.currentTarget;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    
    const rect = e.currentTarget.getBoundingClientRect();
    state.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    state.draggedPlayer = null;
    state.draggedElement = null;
    state.dragOffset = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.currentTarget.classList.contains('zone')) {
        e.currentTarget.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    if (e.currentTarget.classList.contains('zone')) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (!state.draggedPlayer) return;
    
    const zoneId = e.currentTarget.id;
    const player = state.allUsers.find(p => p.id === state.draggedPlayer);
    
    if (player) {
        if (zoneId === 'irsZone') {
            showPlayerDetails(player);
            showToast(`Checking ${player.handle}'s stats... 📊`);
        } else if (zoneId === 'weaponsZone') {
            if (player.id === state.currentAccessCode) {
                openWeaponsShop();
            } else {
                showToast('u can only shop for urself');
            }
        }
    }
}

function handleDropToPlaypen(e) {
    e.preventDefault();
    
    if (!state.draggedElement || !state.draggedPlayer) return;
    
    const playpen = document.getElementById('playpenContainer');
    const rect = playpen.getBoundingClientRect();
    
    let x = e.clientX - rect.left - (state.dragOffset?.x || 50);
    let y = e.clientY - rect.top - (state.dragOffset?.y || 60);
    
    x = Math.max(0, Math.min(x, rect.width - 100));
    y = Math.max(0, Math.min(y, rect.height - 120));
    
    state.draggedElement.style.left = x + 'px';
    state.draggedElement.style.top = y + 'px';
    
    const rotation = -15 + Math.random() * 30;
    state.draggedElement.style.transform = `rotate(${rotation}deg)`;
}

function handlePlayerClick(e) {
    const playerId = e.currentTarget.dataset.player;
    const player = state.allUsers.find(p => p.id === playerId);
    if (player) {
        showPlayerDetails(player);
    }
}

// Add touch support for mobile
function addTouchListeners() {
    const cards = document.querySelectorAll('.player-card');
    
    cards.forEach(card => {
        let touchItem = null;
        let touchOffset = null;
        let activeCard = null;
        
        card.addEventListener('touchstart', (e) => {
            touchItem = e.currentTarget;
            activeCard = e.currentTarget;
            const touch = e.touches[0];
            const rect = touchItem.getBoundingClientRect();
            touchOffset = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            touchItem.classList.add('dragging');
            e.preventDefault();
        }, {passive: false});
        
        card.addEventListener('touchmove', (e) => {
            if (!touchItem) return;
            const touch = e.touches[0];
            const playpen = document.getElementById('playpenContainer');
            const rect = playpen.getBoundingClientRect();
            
            let x = touch.clientX - rect.left - touchOffset.x;
            let y = touch.clientY - rect.top - touchOffset.y;
            
            x = Math.max(0, Math.min(x, rect.width - 80));
            y = Math.max(0, Math.min(y, rect.height - 100));
            
            touchItem.style.left = x + 'px';
            touchItem.style.top = y + 'px';
            touchItem.style.transform = 'scale(1.1) rotate(0deg)';
            e.preventDefault();
        }, {passive: false});
        
        card.addEventListener('touchend', (e) => {
            if (!touchItem) return;
            
            touchItem.classList.remove('dragging');
            const rotation = -15 + Math.random() * 30;
            touchItem.style.transform = `rotate(${rotation}deg)`;
            
            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            
            // Check if dropped on a zone
            if (elementBelow) {
                const zone = elementBelow.closest('.zone');
                if (zone) {
                    const playerId = activeCard.dataset.player;
                    const player = state.allUsers.find(p => p.id === playerId);
                    
                    if (player) {
                        if (zone.id === 'irsZone') {
                            showPlayerDetails(player);
                            showToast(`Checking ${player.handle}'s stats... 📊`);
                        } else if (zone.id === 'weaponsZone') {
                            if (player.id === state.currentAccessCode) {
                                openWeaponsShop();
                            } else {
                                showToast('u can only shop for urself');
                            }
                        }
                    }
                }
            }
            
            touchItem = null;
            touchOffset = null;
            activeCard = null;
        }, {passive: false});
    });
}

// Show player details popup (styled like companies)
function showPlayerDetails(player) {
    const details = document.getElementById('playerDetails');
    if (!details) return;
    
    // Update player image
    const imagePath = player.characterId ? 
        `../assets/cast/cast-members/${player.characterId}-disc.png` : 
        '../assets/cast/default-disc.png';
    
    document.getElementById('detailsImage').src = imagePath;
    document.getElementById('detailsImage').onerror = function() { 
        this.src = '../assets/cast/default-disc.png'; 
    };
    
    // Update player info
    document.getElementById('detailsName').textContent = player.characterName || 'Unknown';
    document.getElementById('detailsHandle').textContent = `@${player.handle || player.id}`;
    document.getElementById('detailsWealth').textContent = 
        `${((player.individualPoints || 0) + (player.teamPoints || 0)).toLocaleString()}`;
    
    // Update stats
    document.getElementById('detailsTeam').textContent = player.team || 'None';
    document.getElementById('detailsTeam').className = player.team ? 
        `team-${player.team.toLowerCase()}` : '';
    
    document.getElementById('detailsStatus').textContent = 
        (player.status || 'active').toUpperCase();
    document.getElementById('detailsStatus').style.color = 
        player.status === 'dead' ? '#ff0000' : 
        player.status === 'blocked' ? '#ff00ff' : '#00cc00';
    
    document.getElementById('detailsIndPoints').textContent = player.individualPoints || 0;
    document.getElementById('detailsTeamPoints').textContent = player.teamPoints || 0;
    
    details.classList.add('active');
}

// Close details popup
function closeDetails() {
    const detailsPopup = document.getElementById('playerDetails');
    if (detailsPopup) {
        detailsPopup.classList.remove('active');
    }
}

// Make closeDetails global for onclick
window.closeDetails = closeDetails;

// Show My Profile (keeping your existing)
async function showMyProfile() {
    // Refresh user data first
    try {
        const userDoc = await getDoc(doc(db, 'users', state.currentAccessCode));
        if (userDoc.exists()) {
            state.currentUser = { id: state.currentAccessCode, ...userDoc.data() };
        }
    } catch (error) {
        console.error('Error refreshing user data:', error);
    }
    
    const user = state.currentUser;
    
    // Update modal title
    document.getElementById('modalTitle').textContent = `@${user.handle || user.id}'s stuff`;
    
    // Check for moderator message
    const modMsg = document.getElementById('modMessage');
    if (user.moderatorNote) {
        modMsg.style.display = 'block';
        document.getElementById('modMessageText').textContent = user.moderatorNote;
    } else {
        modMsg.style.display = 'none';
    }
    
    // Profile disc
    const profileDisc = document.getElementById('profileDisc');
    if (user.characterId) {
        profileDisc.innerHTML = `
            <img src="../assets/cast/cast-members/${user.characterId}-disc.png" 
                 alt="${user.characterName}"
                 onerror="this.src='../assets/cast/default-disc.png'">
        `;
    } else {
        profileDisc.innerHTML = '<div class="no-character">no character yet</div>';
    }
    
    // Profile info
    document.getElementById('profileHandle').textContent = `@${user.handle || user.id}`;
    document.getElementById('characterName').textContent = user.characterName || 'none';
    document.getElementById('characterShow').textContent = user.characterShow || '-';
    
    // Team badge
    const teamBadge = document.getElementById('teamBadge');
    teamBadge.textContent = user.team || 'none';
    teamBadge.className = `team-badge ${user.team ? `team-${user.team.toLowerCase()}` : ''}`;
    
    // Status badge
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = (user.status || 'active').toUpperCase();
    statusBadge.className = `status-badge status-${(user.status || 'active').toLowerCase()}`;
    
    // Points
    document.getElementById('indPoints').textContent = user.individualPoints || 0;
    document.getElementById('teamPoints').textContent = user.teamPoints || 0;
    
    // Calculate credits
    const credits = calculateCredits(user.transactions || []);
    const creditsEl = document.getElementById('creditsDisplay');
    creditsEl.textContent = credits;
    creditsEl.className = credits < 0 ? 'credits negative' : 'credits';
    
    // Show owned weapons
    displayOwnedWeapons(user.tools || []);
    
    // Show modal
    document.getElementById('profileModal').style.display = 'flex';
}

// Calculate credits from transactions (keeping your existing)
function calculateCredits(transactions) {
    return transactions.reduce((total, t) => {
        if (t.type === 'payment' || t.type === 'gift' || t.type === 'refund') {
            return total + (t.amount || 0);
        } else if (t.type === 'purchase') {
            return total - (t.amount || 0);
        } else if (t.type === 'adjustment') {
            return total + (t.amount || 0);
        }
        return total;
    }, 0);
}

// Display owned weapons (keeping your existing)
function displayOwnedWeapons(tools) {
    const grid = document.getElementById('ownedWeapons');
    if (!grid) return;
    
    if (!tools || tools.length === 0) {
        grid.innerHTML = '<p class="no-weapons">no weapons yet. get some!</p>';
        return;
    }
    
    // Group tools by name and status
    const toolGroups = {};
    tools.forEach(tool => {
        const key = tool.name || 'Unknown';
        if (!toolGroups[key]) {
            toolGroups[key] = { 
                available: 0, 
                used: 0, 
                pending: 0,
                blocked: 0
            };
        }
        
        const status = tool.status || 'available';
        if (status === 'used') {
            toolGroups[key].used++;
        } else if (status === 'pending') {
            toolGroups[key].pending++;
        } else if (status === 'blocked') {
            toolGroups[key].blocked++;
        } else {
            toolGroups[key].available++;
        }
    });
    
    grid.innerHTML = Object.entries(toolGroups).map(([name, counts]) => {
        const total = counts.available + counts.used + counts.pending + counts.blocked;
        const allUsed = counts.used === total;
        const hasAvailable = counts.available > 0;
        
        return `
            <div class="weapon-item ${allUsed ? 'used' : ''}">
                <div class="weapon-icon">
                    <img src="../assets/cast/${getToolIcon(name)}" 
                         alt="${name}"
                         onerror="this.src='../assets/cast/default-tool.png'">
                    ${total > 1 ? `<span class="weapon-count">${total}</span>` : ''}
                    ${allUsed ? '<span class="weapon-status">USED</span>' : 
                      !hasAvailable ? '<span class="weapon-status">PENDING</span>' : ''}
                </div>
                <div class="weapon-name">${name}</div>
            </div>
        `;
    }).join('');
}

// Get tool icon filename (keeping your existing)
function getToolIcon(toolName) {
    const iconMap = {
        'GAME PASS': 'game-pass.png',
        'LABUBU VOODOO': 'labubu-voodoo.png',
        'KOOL-AID KILLA': 'kool-aid-life.png',
        'MY GIRL\'S GLASSES': 'glasses-see.png',
        'H4CK3D AF': 'anon-hack.png',
        'BLESSED BEYBLADE': 'blessed-beyblade.png',
        'INVISIBLE INK': 'invisible-ink.png',
        'TIME MACHINE': 'time-machine.png',
        'LUCKY DICE': 'lucky-dice.png'
    };
    
    return iconMap[toolName] || 'default-tool.png';
}

// Open Weapons Shop (keeping your existing)
async function openWeaponsShop() {
    try {
        const snapshot = await getDocs(collection(db, 'tools'));
        const tools = [];
        
        snapshot.forEach(doc => {
            const toolData = doc.data();
            if (toolData.visible !== false) {
                tools.push({ id: doc.id, ...toolData });
            }
        });
        
        tools.sort((a, b) => (a.price || 0) - (b.price || 0));
        
        const credits = calculateCredits(state.currentUser.transactions || []);
        document.getElementById('shopCredits').textContent = credits;
        
        const grid = document.getElementById('weaponsShopGrid');
        grid.innerHTML = tools.map(tool => {
            const owned = (state.currentUser.tools || []).some(t => 
                t.name === tool.name && t.status !== 'used'
            );
            
            return `
                <div class="shop-weapon ${owned ? 'owned' : ''}" 
                     data-tool-id="${tool.id}"
                     data-tool-name="${tool.name}"
                     data-price="${tool.price || 0}">
                    <div class="weapon-icon">
                        <img src="../assets/cast/${getToolIcon(tool.name)}" 
                             alt="${tool.name}"
                             onerror="this.src='../assets/cast/default-tool.png'">
                    </div>
                    <div class="weapon-name">${tool.name}</div>
                    <div class="weapon-price">${owned ? 'OWNED' : (tool.price || 0) + ' credits'}</div>
                    ${tool.description ? `<div class="weapon-desc">${tool.description}</div>` : ''}
                    ${state.cart[tool.id] ? `<div class="in-cart">×${state.cart[tool.id].count}</div>` : ''}
                </div>
            `;
        }).join('');
        
        grid.querySelectorAll('.shop-weapon:not(.owned)').forEach(el => {
            el.addEventListener('click', () => toggleCartItem(el));
        });
        
        state.cart = {};
        updateCartTotal();
        
        document.getElementById('weaponsModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error loading weapons shop:', error);
        showToast('shop broke. try again');
    }
}

// Cart management (keeping your existing)
function toggleCartItem(element) {
    const toolId = element.dataset.toolId;
    const toolName = element.dataset.toolName;
    const price = parseInt(element.dataset.price) || 0;
    
    if (!state.cart[toolId]) {
        state.cart[toolId] = { 
            name: toolName,
            count: 1, 
            price: price 
        };
    } else {
        state.cart[toolId].count++;
    }
    
    let cartBadge = element.querySelector('.in-cart');
    if (!cartBadge) {
        cartBadge = document.createElement('div');
        cartBadge.className = 'in-cart';
        element.appendChild(cartBadge);
    }
    cartBadge.textContent = `×${state.cart[toolId].count}`;
    
    updateCartTotal();
}

function updateCartTotal() {
    const total = Object.values(state.cart).reduce((sum, item) => 
        sum + (item.count * item.price), 0);
    
    document.getElementById('cartTotal').textContent = total;
    
    const credits = calculateCredits(state.currentUser.transactions || []);
    const cartMsg = document.getElementById('cartMessage');
    
    if (total > credits) {
        const difference = total - credits;
        cartMsg.textContent = `need ${difference} more credits! send funds to unlock`;
        cartMsg.style.display = 'block';
    } else if (total > 0) {
        cartMsg.textContent = 'u have enough credits!';
        cartMsg.style.display = 'block';
    } else {
        cartMsg.style.display = 'none';
    }
}

// Checkout weapons (keeping your existing)
async function checkoutWeapons() {
    const cartItems = Object.entries(state.cart);
    if (cartItems.length === 0) {
        showToast('cart empty. click some weapons first');
        return;
    }
    
    const total = Object.values(state.cart).reduce((sum, item) => 
        sum + (item.count * item.price), 0);
    const credits = calculateCredits(state.currentUser.transactions || []);
    
    try {
        const pendingData = {
            userId: state.currentAccessCode,
            handle: state.currentUser.handle || state.currentAccessCode,
            items: state.cart,
            totalCost: total,
            creditsAvailable: credits,
            needsPayment: total > credits ? total - credits : 0,
            type: 'weapon_purchase',
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        
        await addDoc(collection(db, 'pendingSelections'), pendingData);
        
        document.getElementById('checkoutSuccess').style.display = 'block';
        state.cart = {};
        
        setTimeout(() => {
            closeWeaponsModal();
            if (total > credits) {
                showToast(`request sent! send ${total - credits} credits to unlock`);
            } else {
                showToast('request sent! wait 4 mod approval');
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting request:', error);
        showToast('failed. try again');
    }
}

// Modal controls
function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

function closeWeaponsModal() {
    document.getElementById('weaponsModal').style.display = 'none';
    document.getElementById('checkoutSuccess').style.display = 'none';
    state.cart = {};
}

// Real-time listeners (keeping your existing)
function setupRealtimeListeners() {
    if (state.currentAccessCode) {
        onSnapshot(doc(db, 'users', state.currentAccessCode), (doc) => {
            if (doc.exists()) {
                const newData = doc.data();
                const oldData = state.currentUser;
                
                state.currentUser = { id: state.currentAccessCode, ...newData };
                
                if (newData.moderatorNote && newData.moderatorNote !== state.lastModNote) {
                    state.lastModNote = newData.moderatorNote;
                    showToast('📬 new message from mod! check ur profile');
                }
                
                if (oldData && oldData.status !== newData.status) {
                    if (newData.status === 'dead') {
                        showToast('💀 ur dead now. rip');
                    } else if (newData.status === 'blocked') {
                        showToast('🚫 ur blocked. talk 2 mod');
                    }
                }
                
                if (oldData && oldData.team !== newData.team) {
                    showToast(`ur on team ${newData.team} now!`);
                }
            }
        });
    }
    
    onSnapshot(collection(db, 'users'), (snapshot) => {
        const changes = snapshot.docChanges();
        if (changes.length > 0) {
            console.log('Users updated, refreshing leaderboard...');
            loadAllPlayers();
        }
    });
    
    if (state.currentAccessCode) {
        const pendingQuery = query(
            collection(db, 'pendingSelections'),
            where('userId', '==', state.currentAccessCode)
        );
        
        onSnapshot(pendingQuery, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified') {
                    const data = change.doc.data();
                    if (data.status === 'approved') {
                        showToast('✨ weapons approved! check ur profile');
                    } else if (data.status === 'rejected') {
                        showToast('❌ weapons rejected. talk 2 mod');
                    }
                }
            });
        });
    }
}

// Utilities
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.style.display = 'block';
    
    if (state.toastTimeout) {
        clearTimeout(state.toastTimeout);
    }
    
    state.toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.display = 'none';
        }
    }, 3000);
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (!errorEl) return;
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 3000);
}

// Handle resize
window.addEventListener('resize', () => {
    renderPlayers();
});

// Handle ESC key to close popups
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeDetails();
    }
});

// Export for debugging
window.gameState = state;
window.refreshLeaderboard = loadAllPlayers;

console.log('Playpen initialized! Drag player cards to zones to interact.');