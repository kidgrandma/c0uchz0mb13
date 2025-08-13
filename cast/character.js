// character.js - INTERNET OLYMPICS 2 Character Portal

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    updateDoc,
    addDoc,
    onSnapshot,
    query,
    where,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Firebase Configuration
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

// Tool Icon Mapping
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

// Character App Module
const CharacterApp = {
    // State
    state: {
        currentUser: null,
        allUsers: [],
        tools: [],
        cart: {},
        draggedCD: null,
        listeners: [],
        touchItem: null,
        touchOffset: null
    },

    // Initialize
    init() {
        console.log('Initializing Character Portal...');
        this.setupEventListeners();
        this.checkAutoLogin();
    },

    // Setup Event Listeners
    setupEventListeners() {
        // Enter key on login
        const accessInput = document.getElementById('accessInput');
        if (accessInput) {
            accessInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.validateAccess();
                }
            });
        }

        // Portal drag events
        const portal = document.getElementById('portal');
        if (portal) {
            portal.addEventListener('dragover', (e) => {
                e.preventDefault();
                portal.classList.add('drag-over');
            });

            portal.addEventListener('dragleave', () => {
                portal.classList.remove('drag-over');
            });

            portal.addEventListener('drop', (e) => {
                e.preventDefault();
                portal.classList.remove('drag-over');
                
                if (this.state.draggedCD) {
                    const userId = this.state.draggedCD.dataset.userId;
                    const user = this.state.allUsers.find(u => u.id === userId);
                    if (user) {
                        this.showPlayerDetails(user);
                        this.playSound('popOpen');
                    }
                }
            });
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.state.listeners.forEach(unsub => unsub());
        });
    },

    // Access Validation
    async validateAccess() {
        const input = document.getElementById('accessInput');
        const code = input.value.trim().toUpperCase();
        
        if (!code) {
            this.showError('enter something first');
            return;
        }

        try {
            const userDoc = await getDoc(doc(db, 'users', code));
            
            if (!userDoc.exists()) {
                this.showError('wrong code. dm the mod');
                return;
            }

            const userData = userDoc.data();
            
            if (userData.status === 'blocked') {
                this.showError('ur blocked 🚫');
                return;
            }

            this.state.currentUser = { id: code, ...userData };
            sessionStorage.setItem('accessCode', code);
            
            this.enterGame();
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('something broke. try again');
        }
    },

    showError(msg) {
        const errorEl = document.getElementById('errorMsg');
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 3000);
    },

    // Enter Game
    async enterGame() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameView').style.display = 'block';
        
        // Start music softly
        const music = document.getElementById('bgMusic');
        music.volume = 0.05;
        music.play().catch(() => {});
        
        await this.loadAllData();
        this.setupRealtimeListeners();
        
        this.showToast(`welcome @${this.state.currentUser.handle || this.state.currentUser.id}! drag CDs to the portal`);
    },

    // Load Data
    async loadAllData() {
        // Load users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        this.state.allUsers = [];
        
        usersSnapshot.forEach(doc => {
            const userData = { id: doc.id, ...doc.data() };
            this.state.allUsers.push(userData);
        });
        
        // Load ONLY team wallets for the score display
        const teamWalletsDoc = await getDoc(doc(db, 'gameState', 'teamWallets'));
        let hotTotal = 0;
        let coldTotal = 0;
        
        if (teamWalletsDoc.exists()) {
            const wallets = teamWalletsDoc.data();
            hotTotal = wallets.HOT || 0;
            coldTotal = wallets.COLD || 0;
        }
        
        // Display ONLY team wallet totals (not individual points)
        document.getElementById('hotScore').textContent = hotTotal;
        document.getElementById('coldScore').textContent = coldTotal;
        // Update duplicate ticker items for seamless loop
        const hotScore2 = document.getElementById('hotScore2');
        const coldScore2 = document.getElementById('coldScore2');
        if (hotScore2) hotScore2.textContent = hotTotal;
        if (coldScore2) coldScore2.textContent = coldTotal;
        
        // Load tools
        const toolsSnapshot = await getDocs(collection(db, 'tools'));
        this.state.tools = [];
        toolsSnapshot.forEach(doc => {
            this.state.tools.push({ id: doc.id, ...doc.data() });
        });
        
        this.renderCDs();
    },

    // Render CDs
    renderCDs() {
        const container = document.getElementById('cdContainer');
        container.innerHTML = '';
        
        // Only show users with characters
        const playersWithChars = this.state.allUsers.filter(u => u.characterId);
        
        playersWithChars.forEach((user, index) => {
            const cd = document.createElement('div');
            cd.className = 'cd-disc';
            cd.draggable = true;
            cd.dataset.userId = user.id;
            
            // Add team class
            if (user.team) {
                cd.classList.add(`team-${user.team.toLowerCase()}`);
            }
            
            // Add dead class
            if (user.status === 'dead') {
                cd.classList.add('dead');
            }
            
            // Random position
            const x = 5 + Math.random() * 80;
            const y = 5 + Math.random() * 80;
            cd.style.left = `${x}%`;
            cd.style.top = `${y}%`;
            
            // Random rotation
            cd.style.transform = `rotate(${-30 + Math.random() * 60}deg)`;
            
            // CD image
            const img = document.createElement('img');
            img.src = `../assets/cast/cast-members/${user.characterId}-disc.png`;
            img.onerror = () => { img.src = '../assets/cast/default-disc.png'; };
            cd.appendChild(img);
            
            // Drag events
            cd.addEventListener('dragstart', (e) => this.handleDragStart(e));
            cd.addEventListener('dragend', (e) => this.handleDragEnd(e));
            
            // Touch events for mobile
            cd.addEventListener('touchstart', (e) => this.handleTouchStart(e), {passive: false});
            cd.addEventListener('touchmove', (e) => this.handleTouchMove(e), {passive: false});
            cd.addEventListener('touchend', (e) => this.handleTouchEnd(e), {passive: false});
            
            container.appendChild(cd);
        });
    },

    // Drag and Drop Handlers
    handleDragStart(e) {
        this.state.draggedCD = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        // Store original position
        this.state.originalPosition = {
            left: e.target.style.left,
            top: e.target.style.top
        };
    },

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        
        // Check if it was dropped on portal
        const portal = document.getElementById('portal');
        const rect = portal.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            // Dropped on portal - place at new random position
            const container = document.getElementById('cdContainer');
            const newX = 5 + Math.random() * 80;
            const newY = 5 + Math.random() * 80;
            e.target.style.left = `${newX}%`;
            e.target.style.top = `${newY}%`;
        } else {
            // Not on portal - return to original position
            if (this.state.originalPosition) {
                e.target.style.transition = 'all 0.3s ease';
                e.target.style.left = this.state.originalPosition.left;
                e.target.style.top = this.state.originalPosition.top;
                
                setTimeout(() => {
                    e.target.style.transition = '';
                }, 300);
            }
        }
        
        portal.classList.remove('drag-over');
        this.state.draggedCD = null;
        this.state.originalPosition = null;
    },

    // Touch Handlers for Mobile
    handleTouchStart(e) {
        const cd = e.target.closest('.cd-disc');
        if (!cd) return;
        
        this.state.touchItem = cd;
        const touch = e.touches[0];
        const rect = cd.getBoundingClientRect();
        
        this.state.touchOffset = {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
        
        this.state.originalPosition = {
            left: cd.style.left,
            top: cd.style.top
        };
        
        // Make it draggable
        cd.style.position = 'fixed';
        cd.style.zIndex = '9999';
        cd.classList.add('dragging');
        cd.style.left = (touch.clientX - this.state.touchOffset.x) + 'px';
        cd.style.top = (touch.clientY - this.state.touchOffset.y) + 'px';
        
        e.preventDefault();
    },

    handleTouchMove(e) {
        if (!this.state.touchItem) return;
        
        const touch = e.touches[0];
        this.state.touchItem.style.left = (touch.clientX - this.state.touchOffset.x) + 'px';
        this.state.touchItem.style.top = (touch.clientY - this.state.touchOffset.y) + 'px';
        
        // Check if over portal
        const portal = document.getElementById('portal');
        const portalRect = portal.getBoundingClientRect();
        
        if (touch.clientX >= portalRect.left && 
            touch.clientX <= portalRect.right && 
            touch.clientY >= portalRect.top && 
            touch.clientY <= portalRect.bottom) {
            portal.classList.add('drag-over');
        } else {
            portal.classList.remove('drag-over');
        }
        
        e.preventDefault();
    },

    handleTouchEnd(e) {
        if (!this.state.touchItem) return;
        
        const touch = e.changedTouches[0];
        const portal = document.getElementById('portal');
        const portalRect = portal.getBoundingClientRect();
        
        let dropSuccessful = false;
        
        // Check if dropped on portal
        if (touch.clientX >= portalRect.left && 
            touch.clientX <= portalRect.right && 
            touch.clientY >= portalRect.top && 
            touch.clientY <= portalRect.bottom) {
            const userId = this.state.touchItem.dataset.userId;
            const user = this.state.allUsers.find(u => u.id === userId);
            if (user) {
                this.showPlayerDetails(user);
                this.playSound('popOpen');
                dropSuccessful = true;
            }
        }
        
        // Clean up
        portal.classList.remove('drag-over');
        this.state.touchItem.classList.remove('dragging');
        
        // Return to original position
        this.state.touchItem.style.position = 'absolute';
        this.state.touchItem.style.zIndex = '';
        
        if (!dropSuccessful) {
            // Return to original position smoothly
            this.state.touchItem.style.transition = 'all 0.3s ease';
            this.state.touchItem.style.left = this.state.originalPosition.left;
            this.state.touchItem.style.top = this.state.originalPosition.top;
            
            setTimeout(() => {
                if (this.state.touchItem) {
                    this.state.touchItem.style.transition = '';
                }
            }, 300);
        } else {
            // Place at new random position after successful drop
            const container = document.getElementById('cdContainer');
            const x = 5 + Math.random() * 80;
            const y = 5 + Math.random() * 80;
            this.state.touchItem.style.left = `${x}%`;
            this.state.touchItem.style.top = `${y}%`;
        }
        
        this.state.touchItem = null;
        this.state.touchOffset = null;
        this.state.originalPosition = null;
    },

    // Show Player Details
    showPlayerDetails(user) {
        const popup = document.getElementById('playerPopup');
        const portal = document.getElementById('portal');
        
        // Change portal to closed state (CD loaded)
        portal.classList.add('closed');
        
        document.getElementById('popupTitle').textContent = `@${user.handle || user.id}`;
        document.getElementById('popupHandle').textContent = `@${user.handle || user.id}`;
        document.getElementById('popupCharacter').textContent = user.characterName || '-';
        document.getElementById('popupTeam').textContent = user.team || 'none';
        document.getElementById('popupTeam').className = user.team ? `team-${user.team.toLowerCase()}` : '';
        document.getElementById('popupStatus').textContent = (user.status || 'active').toUpperCase();
        document.getElementById('popupStatus').style.color = 
            user.status === 'dead' ? '#ff0000' : 
            user.status === 'blocked' ? '#ff00ff' : '#00cc00';
        document.getElementById('popupIndPoints').textContent = user.individualPoints || 0;
        
        const disc = document.getElementById('popupDisc');
        disc.src = user.characterId ? 
            `../assets/cast/cast-members/${user.characterId}-disc.png` : 
            '../assets/cast/default-disc.png';
        disc.onerror = () => { disc.src = '../assets/cast/default-disc.png'; };
        
        popup.classList.add('active');
        
        // Reopen portal after a delay
        setTimeout(() => {
            portal.classList.remove('closed');
        }, 1500);
    },

    closePopup() {
        document.getElementById('playerPopup').classList.remove('active');
        this.playSound('popClose');
    },

    // Profile Modal
    async showMyProfile() {
        // Refresh user data
        const userDoc = await getDoc(doc(db, 'users', this.state.currentUser.id));
        if (userDoc.exists()) {
            this.state.currentUser = { id: this.state.currentUser.id, ...userDoc.data() };
        }
        
        const user = this.state.currentUser;
        
        document.getElementById('profileTitle').textContent = `@${user.handle || user.id}'s stuff`;
        
        // Mod message
        if (user.moderatorNote) {
            document.getElementById('modMessage').style.display = 'block';
            document.getElementById('modMessageText').textContent = user.moderatorNote;
        } else {
            document.getElementById('modMessage').style.display = 'none';
        }
        
        // Character info
        const disc = document.getElementById('profileDisc');
        disc.src = user.characterId ? 
            `../assets/cast/cast-members/${user.characterId}-disc.png` : 
            '../assets/cast/default-disc.png';
        disc.onerror = () => { disc.src = '../assets/cast/default-disc.png'; };
        
        document.getElementById('profileCharName').textContent = user.characterName || 'none';
        document.getElementById('profileShow').textContent = user.characterShow || '-';
        document.getElementById('profileTeam').textContent = user.team || 'none';
        document.getElementById('profileTeam').className = user.team ? `team-${user.team.toLowerCase()}` : '';
        document.getElementById('profileIndPts').textContent = user.individualPoints || 0;
        
        // Credits
        const credits = user.credits || 0;
        const creditsEl = document.getElementById('creditsDisplay');
        creditsEl.textContent = `credits: ${credits}`;
        creditsEl.className = credits < 0 ? 'credits-display negative' : 'credits-display';
        
        // Tools
        this.displayTools(user.tools || []);
        
        document.getElementById('profileModal').classList.add('active');
        this.playSound('popOpen');
    },

    displayTools(tools) {
        const grid = document.getElementById('weaponsGrid');
        
        if (!tools || tools.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666;">no tools yet. grab some!</div>';
            return;
        }
        
        // Group by name
        const grouped = {};
        tools.forEach(tool => {
            const name = tool.name || 'Unknown';
            if (!grouped[name]) {
                grouped[name] = { available: 0, used: 0, name: name };
            }
            if (tool.status === 'used') {
                grouped[name].used++;
            } else {
                grouped[name].available++;
            }
        });
        
        grid.innerHTML = Object.entries(grouped).map(([name, data]) => {
            const total = data.available + data.used;
            const allUsed = data.used === total;
            
            return `
                <div class="weapon-item ${allUsed ? 'used' : ''}">
                    <div class="weapon-icon">
                        <img src="../assets/cast/${getToolIcon(name)}" 
                             onerror="this.src='../assets/cast/default-tool.png'">
                        ${total > 1 ? `<span class="weapon-count">${total}</span>` : ''}
                        ${allUsed ? '<span class="weapon-status">USED</span>' : ''}
                    </div>
                    <div class="weapon-name">${name}</div>
                </div>
            `;
        }).join('');
    },

    closeProfile() {
        document.getElementById('profileModal').classList.remove('active');
        this.playSound('popClose');
    },

    // Shop
    async openShop() {
        const credits = this.state.currentUser.credits || 0;
        document.getElementById('shopCredits').textContent = `ur credits: ${credits}`;
        
        const grid = document.getElementById('shopGrid');
        const visibleTools = this.state.tools.filter(w => w.visible !== false);
        
        this.state.cart = {};
        
        grid.innerHTML = visibleTools.map(tool => {
            const owned = (this.state.currentUser.tools || []).some(t => 
                t.name === tool.name && t.status !== 'used'
            );
            
            return `
                <div class="shop-item ${owned ? 'owned' : ''}" 
                     data-tool-id="${tool.id}"
                     data-tool-name="${tool.name}"
                     data-tool-icon="${getToolIcon(tool.name)}"
                     data-price="${tool.price || 0}">
                    <div class="weapon-icon">
                        <img src="../assets/cast/${getToolIcon(tool.name)}" 
                             onerror="this.src='../assets/cast/default-tool.png'">
                    </div>
                    <div class="weapon-name">${tool.name}</div>
                    <div class="shop-price">${owned ? 'OWNED' : `${tool.price || 0} credits`}</div>
                    ${tool.description ? `<div class="shop-desc">${tool.description}</div>` : ''}
                </div>
            `;
        }).join('');
        
        // Add click handlers
        grid.querySelectorAll('.shop-item:not(.owned)').forEach(item => {
            item.addEventListener('click', () => this.toggleCartItem(item));
        });
        
        this.updateCartTotal();
        
        document.getElementById('shopModal').classList.add('active');
    },

    toggleCartItem(element) {
        const toolId = element.dataset.toolId;
        const toolName = element.dataset.toolName;
        const toolIcon = element.dataset.toolIcon;
        const price = parseInt(element.dataset.price) || 0;
        
        if (!this.state.cart[toolId]) {
            this.state.cart[toolId] = { 
                name: toolName, 
                icon: toolIcon,
                count: 1, 
                price: price 
            };
            element.classList.add('in-cart');
            
            // Add badge
            const badge = document.createElement('div');
            badge.className = 'cart-badge';
            badge.textContent = '1';
            element.appendChild(badge);
        } else {
            this.state.cart[toolId].count++;
            element.querySelector('.cart-badge').textContent = this.state.cart[toolId].count;
        }
        
        this.updateCartTotal();
    },

    updateCartTotal() {
        const total = Object.values(this.state.cart).reduce((sum, item) => 
            sum + (item.count * item.price), 0);
        
        const credits = this.state.currentUser.credits || 0;
        const cartEl = document.getElementById('cartTotal');
        
        if (total > credits) {
            cartEl.innerHTML = `total: ${total} credits<br><small style="color: red;">need ${total - credits} more! send funds to unlock</small>`;
        } else {
            cartEl.textContent = `total: ${total} credits`;
        }
    },

    clearCart() {
        this.state.cart = {};
        document.querySelectorAll('.shop-item').forEach(item => {
            item.classList.remove('in-cart');
            const badge = item.querySelector('.cart-badge');
            if (badge) badge.remove();
        });
        this.updateCartTotal();
    },

    async checkout() {
        if (Object.keys(this.state.cart).length === 0) {
            this.showToast('pick something first');
            return;
        }
        
        const total = Object.values(this.state.cart).reduce((sum, item) => 
            sum + (item.count * item.price), 0);
        const credits = this.state.currentUser.credits || 0;
        
        // Create tools array for pending selection
        const tools = [];
        Object.entries(this.state.cart).forEach(([toolId, data]) => {
            for (let i = 0; i < data.count; i++) {
                tools.push({
                    toolId: toolId,
                    name: data.name,
                    icon: data.icon,
                    price: data.price
                });
            }
        });
        
        const pendingData = {
            userId: this.state.currentUser.id,
            handle: this.state.currentUser.handle || this.state.currentUser.id,
            tools: tools,
            totalCost: total,
            creditsNeeded: Math.max(0, total - credits),
            timestamp: new Date().toISOString(),
            type: 'tools_purchase',
            status: 'pending'
        };
        
        await addDoc(collection(db, 'pendingApprovals'), pendingData);
        
        document.getElementById('successMsg').style.display = 'block';
        this.state.cart = {};
        
        setTimeout(() => {
            this.closeShop();
            if (total > credits) {
                this.showToast(`request sent! send ${total - credits} credits to unlock`);
            } else {
                this.showToast('request sent! wait for approval');
            }
        }, 2000);
    },

    closeShop() {
        document.getElementById('shopModal').classList.remove('active');
        document.getElementById('successMsg').style.display = 'none';
        this.playSound('popClose');
    },

    // Leaderboard - UPDATED TO SHOW TOP 5 WITH TEAM COLORS
    showLeaderboard() {
        const sortedUsers = [...this.state.allUsers]
            .filter(u => u.characterId && u.status !== 'blocked')
            .sort((a, b) => (b.individualPoints || 0) - (a.individualPoints || 0));
        
        const tbody = document.getElementById('leaderboardBody');
        
        // Get current user's rank for highlighting
        const currentUserRank = sortedUsers.findIndex(u => u.id === this.state.currentUser.id) + 1;
        
        // Show only top 5
        const top5Users = sortedUsers.slice(0, 5);
        
        tbody.innerHTML = top5Users.map((user, index) => {
            const rank = index + 1;
            const isCurrentUser = user.id === this.state.currentUser.id;
            
            // Determine row class based on team
            let rowClass = '';
            if (isCurrentUser) {
                rowClass = 'current-user';
            } else if (user.team === 'HOT') {
                rowClass = 'row-hot';
            } else if (user.team === 'COLD') {
                rowClass = 'row-cold';
            }
            
            return `
                <tr class="${rowClass}">
                    <td style="padding: 8px; font-weight: bold; font-size: 14px;">${rank}</td>
                    <td style="padding: 8px; font-weight: ${isCurrentUser ? 'bold' : 'normal'};">@${user.handle || user.id}</td>
                    <td style="padding: 8px;">
                        <span class="team-${user.team ? user.team.toLowerCase() : ''}">${user.team || '-'}</span>
                    </td>
                    <td style="padding: 8px; font-weight: bold;">${user.individualPoints || 0}</td>
                </tr>
            `;
        }).join('');
        
        // If current user is not in top 5, add a note at the bottom
        if (currentUserRank > 5 && currentUserRank > 0) {
            tbody.innerHTML += `
                <tr>
                    <td colspan="4" style="padding: 10px; text-align: center; font-style: italic; color: #666;">
                        ur rank: #${currentUserRank} with ${this.state.currentUser.individualPoints || 0} points
                    </td>
                </tr>
            `;
        }
        
        document.getElementById('leaderboardModal').classList.add('active');
        this.playSound('popOpen');
    },

    closeLeaderboard() {
        document.getElementById('leaderboardModal').classList.remove('active');
        this.playSound('popClose');
    },

    // Realtime Listeners
    setupRealtimeListeners() {
        // Listen to current user changes
        const unsubUser = onSnapshot(doc(db, 'users', this.state.currentUser.id), (doc) => {
            if (doc.exists()) {
                const newData = doc.data();
                const oldData = this.state.currentUser;
                
                // Check for changes
                if (oldData.moderatorNote !== newData.moderatorNote && newData.moderatorNote) {
                    this.showToast('📬 new message from mod!');
                }
                
                if (oldData.status !== newData.status) {
                    if (newData.status === 'dead') {
                        this.showToast('💀 ur dead now');
                    } else if (newData.status === 'blocked') {
                        this.showToast('🚫 ur blocked');
                        setTimeout(() => {
                            window.location.reload();
                        }, 3000);
                    }
                }
                
                if (oldData.credits !== newData.credits) {
                    if (newData.credits > oldData.credits) {
                        this.showToast(`💰 received ${newData.credits - oldData.credits} credits!`);
                    }
                }
                
                this.state.currentUser = { id: this.state.currentUser.id, ...newData };
            }
        });
        
        // Listen to all users for leaderboard updates
        const unsubUsers = onSnapshot(collection(db, 'users'), () => {
            this.loadAllData();
        });
        
        this.state.listeners.push(unsubUser, unsubUsers);
    },

    // Utilities
    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    playSound(soundId) {
        const audio = document.getElementById(soundId);
        if (audio) {
            audio.currentTime = 0;
            audio.volume = 0.3;
            audio.play().catch(() => {});
        }
    },

    // Auto-login Check
    checkAutoLogin() {
        const savedCode = sessionStorage.getItem('accessCode');
        if (savedCode) {
            document.getElementById('accessInput').value = savedCode;
            this.validateAccess();
        }
    }
};

// Make CharacterApp globally accessible
window.CharacterApp = CharacterApp;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    CharacterApp.init();
});