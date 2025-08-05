// admin.js - INTERNET OLYMPICS 2 Admin Panel

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
// CONFIGURATION
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_PASSWORD = 'olympics2024';

const TRANSACTION_TYPES = {
    PAYMENT: 'payment',
    PURCHASE: 'purchase',
    ADJUSTMENT: 'adjustment',
    REFUND: 'refund',
    GIFT: 'gift'
};

const POINT_MULTIPLIERS = {
    standard: 1,
    double: 2,
    super: 5,
    bonus: 3
};

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    openWindows: new Set(),
    minimizedWindows: new Set(),
    allCharacters: [],
    allUsers: [],
    allTools: [],
    editingUser: null,
    editingTool: null,
    activeTab: 'info'
};

// ============================================
// UTILITIES
// ============================================

const utils = {
    calculateCredit(transactions = []) {
        return transactions.reduce((balance, t) => {
            if (['payment', 'refund', 'gift'].includes(t.type)) {
                return balance + (t.amount || 0);
            } else if (t.type === 'purchase') {
                return balance - (t.amount || 0);
            } else if (t.type === 'adjustment') {
                return balance + (t.amount || 0);
            }
            return balance;
        }, 0);
    },

    formatHandle(handle) {
        if (!handle) return 'no-handle';
        return handle.startsWith('@') ? handle : `@${handle}`;
    },

    getUserDisplay(user) {
        return `@${user.handle || user.id}`;
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    getElement(id) {
        return document.getElementById(id);
    },

    hideModal(modalId) {
        utils.getElement(modalId).style.display = 'none';
    },

    showModal(modalId) {
        utils.getElement(modalId).style.display = 'block';
    },

    clearForm(formIds) {
        formIds.forEach(id => {
            const el = utils.getElement(id);
            if (el) el.value = el.tagName === 'SELECT' ? '' : '';
        });
    }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        utils.getElement('loginWindow').style.display = 'none';
        utils.getElement('adminPanel').style.display = 'block';
        initializeAdmin();
    }
    
    initializeClock();
    initializeWindowDragging();
    
    // Login enter key
    utils.getElement('adminPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminLogin();
    });
});

function initializeClock() {
    const updateClock = () => {
        const clock = utils.getElement('clock');
        if (clock) {
            clock.textContent = new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    };
    updateClock();
    setInterval(updateClock, 60000);
}

async function initializeAdmin() {
    await Promise.all([
        dataManager.loadCharacters(),
        dataManager.loadTools(),
        dataManager.loadUsers()
    ]);
    setupRealtimeListeners();
    windowManager.open('dashboard');
}

// ============================================
// AUTH MANAGEMENT
// ============================================

window.adminLogin = function() {
    const password = utils.getElement('adminPassword').value;
    
    if (password === ADMIN_PASSWORD) {
        localStorage.setItem('adminLoggedIn', 'true');
        utils.getElement('loginWindow').style.display = 'none';
        utils.getElement('adminPanel').style.display = 'block';
        utils.showToast('welcome back. let\'s make something weird. 🐳');
        initializeAdmin();
    } else {
        const errorEl = utils.getElement('loginError');
        errorEl.style.display = 'block';
        setTimeout(() => errorEl.style.display = 'none', 3000);
    }
};

window.adminLogout = function() {
    if (confirm('really? you\'re leaving?')) {
        localStorage.removeItem('adminLoggedIn');
        location.reload();
    }
};

// ============================================
// WINDOW MANAGEMENT
// ============================================

const windowManager = {
    open(windowId) {
        const windowEl = utils.getElement(`window-${windowId}`);
        if (!windowEl) return;
        
        if (state.minimizedWindows.has(windowId)) {
            state.minimizedWindows.delete(windowId);
            this.updateMinimizedBar();
        }
        
        windowEl.style.display = 'block';
        state.openWindows.add(windowId);
        
        if (!windowEl.style.left) {
            const offset = state.openWindows.size * 30;
            windowEl.style.left = `${100 + offset}px`;
            windowEl.style.top = `${50 + offset}px`;
        }
        
        this.bringToFront(windowEl);
        displays.load(windowId);
    },

    close(windowId) {
        const windowEl = utils.getElement(`window-${windowId}`);
        if (windowEl) {
            windowEl.style.display = 'none';
            state.openWindows.delete(windowId);
            state.minimizedWindows.delete(windowId);
            this.updateMinimizedBar();
        }
    },

    minimize(windowId) {
        const windowEl = utils.getElement(`window-${windowId}`);
        if (windowEl) {
            windowEl.style.display = 'none';
            state.minimizedWindows.add(windowId);
            this.updateMinimizedBar();
        }
    },

    maximize(windowId) {
        const windowEl = utils.getElement(`window-${windowId}`);
        if (windowEl) windowEl.classList.toggle('maximized');
    },

    updateMinimizedBar() {
        const bar = utils.getElement('minimizedBar');
        bar.innerHTML = '';
        
        state.minimizedWindows.forEach(windowId => {
            const btn = document.createElement('div');
            btn.className = 'minimized-window';
            btn.textContent = windowId;
            btn.onclick = () => this.open(windowId);
            bar.appendChild(btn);
        });
    },

    bringToFront(windowEl) {
        document.querySelectorAll('.window').forEach(w => w.style.zIndex = '100');
        windowEl.style.zIndex = '200';
    }
};

// Window manager global functions
window.openWindow = (id) => windowManager.open(id);
window.closeWindow = (id) => windowManager.close(id);
window.minimizeWindow = (id) => windowManager.minimize(id);
window.maximizeWindow = (id) => windowManager.maximize(id);

function initializeWindowDragging() {
    let draggedWindow = null;
    let offset = { x: 0, y: 0 };
    
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-header') && !e.target.closest('button')) {
            const windowEl = e.target.closest('.window');
            if (windowEl?.classList.contains('draggable')) {
                draggedWindow = windowEl;
                const rect = windowEl.getBoundingClientRect();
                offset.x = e.clientX - rect.left;
                offset.y = e.clientY - rect.top;
                windowManager.bringToFront(windowEl);
            }
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (draggedWindow && !draggedWindow.classList.contains('maximized')) {
            draggedWindow.style.left = `${e.clientX - offset.x}px`;
            draggedWindow.style.top = `${e.clientY - offset.y}px`;
        }
    });
    
    document.addEventListener('mouseup', () => draggedWindow = null);
}

// ============================================
// DATA MANAGEMENT
// ============================================

const dataManager = {
    async loadCharacters() {
        const snapshot = await getDocs(collection(db, 'characters'));
        state.allCharacters = [];
        snapshot.forEach(doc => {
            state.allCharacters.push({ id: doc.id, ...doc.data() });
        });
    },

    async loadTools() {
        const snapshot = await getDocs(collection(db, 'tools'));
        state.allTools = [];
        snapshot.forEach(doc => {
            state.allTools.push({ id: doc.id, ...doc.data() });
        });
        state.allTools.sort((a, b) => a.price - b.price);
    },

    async loadUsers() {
        const snapshot = await getDocs(collection(db, 'users'));
        state.allUsers = [];
        snapshot.forEach(doc => {
            state.allUsers.push({ id: doc.id, ...doc.data() });
        });
        state.allUsers.sort((a, b) => (a.handle || a.id).localeCompare(b.handle || b.id));
    }
};

// ============================================
// DISPLAY FUNCTIONS
// ============================================

const displays = {
    load(windowId) {
        const loaders = {
            dashboard: () => this.dashboard(),
            users: () => this.users(),
            characters: () => this.characters(),
            tools: () => this.tools(),
            teams: () => this.teams(),
            money: () => this.money(),
            points: () => this.points(),
            pending: () => this.pending()
        };
        
        if (loaders[windowId]) loaders[windowId]();
    },

    async dashboard() {
        try {
            let stats = {
                total: state.allUsers.length,
                active: 0,
                revenue: 0,
                credit: 0,
                pending: 0,
                points: 0
            };
            
            const recentActivity = [];
            
            state.allUsers.forEach(user => {
                if (user.status === 'active') stats.active++;
                
                const credit = utils.calculateCredit(user.transactions);
                
                user.transactions?.forEach(t => {
                    if (t.type === 'payment') stats.revenue += t.amount || 0;
                });
                
                if (credit > 0) stats.credit += credit;
                else if (credit < 0) stats.pending += Math.abs(credit);
                
                stats.points += (user.individualPoints || 0);
                
                recentActivity.push({
                    handle: user.handle,
                    code: user.id,
                    timestamp: user.createdAt || new Date().toISOString()
                });
            });
            
            // Update stats
            Object.entries({
                totalUsers: stats.total,
                activeUsers: stats.active,
                totalRevenue: stats.revenue,
                totalCredit: stats.credit,
                totalPending: stats.pending,
                totalPoints: stats.points
            }).forEach(([id, value]) => {
                utils.getElement(id).textContent = value;
            });
            
            // Recent activity
            const activityList = utils.getElement('activityList');
            recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            activityList.innerHTML = recentActivity.length === 0 ? 
                '<p style="color: #666;">nothing happening yet...</p>' :
                recentActivity.slice(0, 5).map(user => `
                    <div style="padding: 8px; border-bottom: 1px solid #D4D0C8;">
                        <strong>${utils.formatHandle(user.handle)}</strong>
                        <span style="color: #999; font-size: 10px;">(${user.code})</span>
                        <span style="float: right; color: #666;">
                            ${new Date(user.timestamp).toLocaleDateString()}
                        </span>
                    </div>
                `).join('');
                
        } catch (error) {
            console.error('Error loading dashboard:', error);
            utils.showToast('error loading dashboard');
        }
    },

    users() {
        const tbody = utils.getElement('usersTableBody');
        
        if (state.allUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10">no players yet. waiting... 🐰</td></tr>';
            return;
        }
        
        tbody.innerHTML = state.allUsers.map(user => {
            const credit = utils.calculateCredit(user.transactions);
            const toolsDisplay = templates.toolsList(user.tools);
            
            return `
                <tr>
                    <td><strong>${utils.formatHandle(user.handle)}</strong></td>
                    <td style="color: #666; font-size: 10px;">${user.id}</td>
                    <td>${user.characterName || 'none'}</td>
                    <td>${user.status || 'active'}</td>
                    <td>${user.team || 'none'}</td>
                    <td style="color: ${credit >= 0 ? '#4D9938' : '#D04545'}; font-weight: bold;">
                        ${credit}
                    </td>
                    <td>${user.individualPoints || 0}</td>
                    <td>${user.teamPoints || 0}</td>
                    <td>${toolsDisplay}</td>
                    <td>
                        <button class="button small" onclick="userActions.edit('${user.id}')">edit</button>
                        <button class="button small warning" onclick="userActions.delete('${user.id}')">remove</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    characters() {
        const grid = utils.getElement('charactersGrid');
        let available = 0, taken = 0;
        
        grid.innerHTML = state.allCharacters.map(char => {
            char.available ? available++ : taken++;
            
            return `
                <div class="character-card ${!char.available ? 'taken' : ''}">
                    <div class="character-name">${char.name}</div>
                    <div class="character-show">${char.show}</div>
                    <div class="character-status ${char.available ? 'available' : 'taken'}">
                        ${char.available ? 'available' : `taken by ${utils.formatHandle(char.ownerId)}`}
                    </div>
                </div>
            `;
        }).join('');
        
        utils.getElement('availableChars').textContent = available;
        utils.getElement('takenChars').textContent = taken;
    },

    tools() {
        const toolsList = utils.getElement('toolsList');
        
        if (state.allTools.length === 0) {
            toolsList.innerHTML = '<p style="text-align: center; color: #666;">no tools yet. make some weird stuff. 🪤</p>';
            return;
        }
        
        toolsList.innerHTML = state.allTools.map(tool => templates.toolItem(tool)).join('');
    },

    async teams() {
        const standings = utils.getElement('teamsStandings');
        standings.innerHTML = '<p>loading teams...</p>';
        
        const teams = {
            cable: { name: 'team cable 📺', members: [], points: 0 },
            milk: { name: 'team milk 🥛', members: [], points: 0 },
            unassigned: { name: 'unassigned', members: [], points: 0 }
        };
        
        state.allUsers.forEach(user => {
            const teamKey = user.team || 'unassigned';
            if (teams[teamKey]) {
                teams[teamKey].members.push(user);
                if (teamKey !== 'unassigned') {
                    teams[teamKey].points += (user.teamPoints || 0);
                }
            }
        });
        
        const sortedTeams = Object.entries(teams)
            .filter(([key]) => key !== 'unassigned')
            .sort((a, b) => b[1].points - a[1].points);
        sortedTeams.push(['unassigned', teams.unassigned]);
        
        standings.innerHTML = sortedTeams.map(([key, team], index) => 
            templates.teamStanding(team, index === 0 && team.points > 0 && key !== 'unassigned')
        ).join('');
    },

    async money() {
        let collected = 0, pending = 0, gifted = 0;
        const pendingPlayers = [];
        
        state.allUsers.forEach(user => {
            const credit = utils.calculateCredit(user.transactions);
            
            user.transactions?.forEach(t => {
                if (t.type === 'payment') collected += t.amount || 0;
                else if (t.type === 'gift') gifted += t.amount || 0;
            });
            
            if (credit < 0) {
                pending += Math.abs(credit);
                pendingPlayers.push({
                    handle: user.handle,
                    code: user.id,
                    amount: Math.abs(credit)
                });
            }
        });
        
        utils.getElement('totalCollected').textContent = collected;
        utils.getElement('totalPendingAmount').textContent = pending;
        utils.getElement('totalGifted').textContent = gifted;
        
        const pendingDiv = utils.getElement('pendingPaymentsList');
        pendingDiv.innerHTML = pendingPlayers.length === 0 ?
            '<p style="text-align: center; color: #666;">everyone\'s good! 🧧</p>' :
            pendingPlayers.map(p => `
                <div style="padding: 10px; background: #FFF8DC; border: 1px solid #DAA520; margin-bottom: 8px;">
                    <strong>${utils.formatHandle(p.handle || p.code)}</strong>
                    <span style="float: right; color: #D04545; font-weight: bold;">needs ${p.amount} credits</span>
                </div>
            `).join('');
    },

    async points() {
        // Leaderboard
        const leaderboard = state.allUsers
            .filter(u => u.individualPoints > 0)
            .sort((a, b) => b.individualPoints - a.individualPoints)
            .slice(0, 10);
        
        const leaderboardDiv = utils.getElement('pointsLeaderboard');
        leaderboardDiv.innerHTML = leaderboard.length === 0 ?
            '<p style="text-align: center; color: #666;">no points awarded yet</p>' :
            '<h3>top players:</h3>' + leaderboard.map((user, i) => 
                templates.leaderboardItem(user, i)
            ).join('');
        
        // Points activity
        const allPointsHistory = [];
        state.allUsers.forEach(user => {
            user.pointsHistory?.forEach(p => {
                allPointsHistory.push({ ...p, handle: user.handle || user.id });
            });
        });
        
        allPointsHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const activityLog = utils.getElement('pointsActivityLog');
        activityLog.innerHTML = allPointsHistory.length === 0 ?
            '<p style="color: #666;">no points activity yet</p>' :
            allPointsHistory.slice(0, 10).map(p => `
                <div class="points-log-item ${p.type}">
                    <strong>${utils.formatHandle(p.handle)}</strong> got ${p.amount} ${p.type} points
                    ${p.reason ? `for "${p.reason}"` : ''}
                    <span style="float: right; color: #666; font-size: 10px;">
                        ${new Date(p.timestamp).toLocaleDateString()}
                    </span>
                </div>
            `).join('');
    },

    async pending() {
        const pendingList = utils.getElement('pendingList');
        pendingList.innerHTML = '<p>loading pending requests...</p>';
        
        try {
            const snapshot = await getDocs(collection(db, 'pendingSelections'));
            const pendingCount = utils.getElement('pendingCount');
            
            if (snapshot.empty) {
                pendingCount.textContent = '0';
                pendingList.innerHTML = '<p style="text-align: center; color: #666;">no pending requests. everyone\'s good! 🧧</p>';
                return;
            }
            
            pendingCount.textContent = snapshot.size;
            const requests = [];
            
            snapshot.forEach(doc => {
                requests.push({ id: doc.id, ...doc.data() });
            });
            
            requests.sort((a, b) => 
                new Date(b.submittedAt || b.timestamp) - new Date(a.submittedAt || a.timestamp)
            );
            
            pendingList.innerHTML = requests.map(req => templates.pendingRequest(req)).join('');
            
        } catch (error) {
            console.error('Error loading pending:', error);
            pendingList.innerHTML = '<p style="color: #D04545;">error loading pending requests</p>';
        }
    }
};

// ============================================
// TEMPLATES
// ============================================

const templates = {
    toolsList(tools = []) {
        if (!tools || tools.length === 0) return 'none';
        
        const toolCounts = {};
        tools.forEach(tool => {
            const key = `${tool.name}:${tool.used ? 'used' : 'active'}`;
            toolCounts[key] = (toolCounts[key] || 0) + 1;
        });
        
        return Object.entries(toolCounts).map(([key, count]) => {
            const [name, status] = key.split(':');
            return `<span class="tool-tag ${status === 'used' ? 'used' : ''}">${name}${count > 1 ? ` x${count}` : ''}</span>`;
        }).join('');
    },

    toolItem(tool) {
        const isHidden = tool.visible === false;
        return `
            <div class="tool-item ${isHidden ? 'hidden' : ''}">
                ${tool.icon ? `<img src="../assets/cast/${tool.icon}" class="tool-icon" onerror="this.style.display='none'">` : ''}
                <div class="tool-info">
                    <div class="tool-name">${tool.name} ${isHidden ? '(hidden)' : ''}</div>
                    <div class="tool-price">${tool.price} credits</div>
                    ${tool.description ? `<div class="tool-description">${tool.description}</div>` : ''}
                </div>
                <div>
                    <button class="button small" onclick="toolActions.edit('${tool.id}')">edit</button>
                    <button class="button small" onclick="toolActions.toggleVisibility('${tool.id}')">${isHidden ? 'show' : 'hide'}</button>
                    <button class="button small warning" onclick="toolActions.delete('${tool.id}')">delete</button>
                </div>
            </div>
        `;
    },

    teamStanding(team, isLeading) {
        return `
            <div style="margin-bottom: 20px; padding: 15px; background: white; border: 2px solid ${isLeading ? '#FFD700' : '#B5B5B5'};">
                <h3>${isLeading ? '👑 ' : ''}${team.name} ${team.points ? `(${team.points} points)` : ''}</h3>
                ${team.members.length === 0 ? 
                    '<p style="color: #666;">no members yet</p>' :
                    team.members.map(member => `
                        <div style="padding: 8px; border-bottom: 1px solid #D4D0C8;">
                            <strong>${utils.formatHandle(member.handle || member.id)}</strong>
                            ${member.characterName ? ` - ${member.characterName}` : ''}
                            <span style="float: right;">
                                ind: ${member.individualPoints || 0} | team: ${member.teamPoints || 0}
                            </span>
                        </div>
                    `).join('')
                }
            </div>
        `;
    },

    leaderboardItem(user, index) {
        return `
            <div class="leaderboard-item ${index === 0 ? 'first' : ''}">
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-player">${utils.formatHandle(user.handle || user.id)}</span>
                <span class="leaderboard-score">${user.individualPoints} pts</span>
            </div>
        `;
    },

    pendingRequest(req) {
        let toolsCost = 0;
        let toolsList = 'none';
        
        if (req.tools?.length > 0) {
            toolsCost = req.tools.reduce((sum, tool) => sum + (tool.price * (tool.quantity || 1)), 0);
            toolsList = req.tools.map(t => 
                `${t.name}${t.quantity > 1 ? ` x${t.quantity}` : ''} (${t.price * (t.quantity || 1)} credits)`
            ).join(', ');
        }
        
        const totalCost = 25 + toolsCost; // 25 for character
        const creditsNeeded = totalCost - (req.currentCredit || 0);
        
        return `
            <div class="pending-request">
                <div class="pending-request-header">
                    <strong>${utils.formatHandle(req.handle)}</strong>
                    <span style="color: #666; font-size: 11px;">
                        ${new Date(req.submittedAt || req.timestamp).toLocaleString()}
                    </span>
                </div>
                <div class="pending-request-info">
                    <div class="info-row">
                        <span class="label">access code:</span>
                        <span class="value" style="font-size: 10px; color: #666;">${req.accessCode}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">character:</span>
                        <span class="value">${req.characterName || 'none selected'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">tools requested:</span>
                        <span class="value">${toolsList}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">needs to send:</span>
                        <span class="value" style="color: ${creditsNeeded > 0 ? '#D04545' : '#4D9938'};">
                            ${creditsNeeded > 0 ? creditsNeeded + ' credits' : 'fully funded!'}
                        </span>
                    </div>
                </div>
                <div class="pending-request-actions">
                    <button class="button primary" onclick="pendingActions.approve('${req.id}')">approve 🐳</button>
                    <button class="button" onclick="pendingActions.markPaid('${req.id}', ${creditsNeeded})">mark as paid</button>
                    <button class="button warning" onclick="pendingActions.reject('${req.id}')">reject</button>
                </div>
            </div>
        `;
    }
};

// ============================================
// USER ACTIONS
// ============================================

const userActions = {
    async create() {
        const accessCode = utils.getElement('newAccessCode').value.toUpperCase();
        const handle = utils.getElement('newHandle').value;
        
        if (!accessCode || !handle) {
            utils.showToast('need access code and @handle');
            return;
        }
        
        try {
            const existingUser = await getDoc(doc(db, 'users', accessCode));
            if (existingUser.exists()) {
                utils.showToast('that code already exists');
                return;
            }
            
            const characterId = utils.getElement('newCharacter').value;
            const initialCredits = parseFloat(utils.getElement('newPayment').value) || 0;
            
            const transactions = initialCredits > 0 ? [{
                type: TRANSACTION_TYPES.PAYMENT,
                amount: initialCredits,
                description: 'initial credits',
                timestamp: new Date().toISOString(),
                addedBy: 'admin'
            }] : [];
            
            const userData = {
                handle: handle.replace('@', ''),
                email: utils.getElement('newEmail').value || '',
                status: 'active',
                team: utils.getElement('newTeam').value || '',
                createdAt: new Date().toISOString(),
                characterId: '',
                characterName: '',
                tools: [],
                transactions: transactions,
                credit: utils.calculateCredit(transactions),
                moderatorNote: utils.getElement('newUserNote').value || '',
                individualPoints: 0,
                teamPoints: 0,
                pointsHistory: []
            };
            
            if (characterId) {
                const charDoc = await getDoc(doc(db, 'characters', characterId));
                if (charDoc.exists() && charDoc.data().available) {
                    userData.characterId = characterId;
                    userData.characterName = charDoc.data().name;
                    
                    await updateDoc(doc(db, 'characters', characterId), {
                        available: false,
                        ownerId: handle
                    });
                }
            }
            
            await setDoc(doc(db, 'users', accessCode), userData);
            
            utils.showToast(`${utils.formatHandle(userData.handle)} joined the game 🐳`);
            utils.hideModal('createUserDialog');
            utils.clearForm(['newAccessCode', 'newHandle', 'newEmail', 'newCharacter', 'newTeam', 'newPayment', 'newUserNote']);
            
            await dataManager.loadUsers();
            displays.users();
            
        } catch (error) {
            console.error('Error creating user:', error);
            utils.showToast('error creating player');
        }
    },

    async edit(userId) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) {
                utils.showToast('player not found');
                return;
            }
            
            const userData = userDoc.data();
            state.editingUser = userId;
            
            utils.getElement('editUserHandle').textContent = utils.formatHandle(userData.handle);
            utils.getElement('editUserId').value = userId;
            utils.getElement('editHandle').value = userData.handle || '';
            utils.getElement('editStatus').value = userData.status || 'active';
            utils.getElement('editTeam').value = userData.team || '';
            
            // Load character dropdown
            const charSelect = utils.getElement('editCharacter');
            charSelect.innerHTML = '<option value="">-- none --</option>' +
                state.allCharacters.map(char => {
                    const isCurrent = char.id === userData.characterId;
                    const isAvailable = char.available;
                    
                    return `<option value="${char.id}" 
                            ${!isCurrent && !isAvailable ? 'disabled' : ''}
                            ${isCurrent ? 'selected' : ''}>
                        ${char.name} ${isCurrent ? '(current)' : isAvailable ? `(${char.show})` : '(taken)'}
                    </option>`;
                }).join('');
            
            // Load other tabs
            userTabLoaders.credits(userId);
            userTabLoaders.tools(userId);
            userTabLoaders.points(userId);
            
            const previousNotes = utils.getElement('previousNotes');
            previousNotes.innerHTML = userData.moderatorNote ?
                `<div style="padding: 8px; background: #F5F5F5; border: 1px solid #D4D0C8; margin-bottom: 10px;">"${userData.moderatorNote}"</div>` :
                '<p style="color: #666;">no previous notes</p>';
            
            utils.showModal('editUserDialog');
            switchEditTab('info');
            
        } catch (error) {
            console.error('Error loading user:', error);
            utils.showToast('error loading player');
        }
    },

    async save() {
        if (!state.editingUser) return;
        
        try {
            const userId = state.editingUser;
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.data();
            
            const updates = {
                handle: utils.getElement('editHandle').value,
                status: utils.getElement('editStatus').value,
                team: utils.getElement('editTeam').value
            };
            
            const newCharacterId = utils.getElement('editCharacter').value;
            if (newCharacterId !== userData.characterId) {
                if (userData.characterId) {
                    await updateDoc(doc(db, 'characters', userData.characterId), {
                        available: true,
                        ownerId: ''
                    });
                }
                
                if (newCharacterId) {
                    const charDoc = await getDoc(doc(db, 'characters', newCharacterId));
                    if (charDoc.exists()) {
                        updates.characterId = newCharacterId;
                        updates.characterName = charDoc.data().name;
                        
                        await updateDoc(doc(db, 'characters', newCharacterId), {
                            available: false,
                            ownerId: updates.handle || userId
                        });
                    }
                } else {
                    updates.characterId = '';
                    updates.characterName = '';
                }
            }
            
            const newMessage = utils.getElement('editUserMessage').value;
            if (newMessage) updates.moderatorNote = newMessage;
            
            await updateDoc(doc(db, 'users', userId), updates);
            
            utils.showToast('saved changes 💽');
            utils.hideModal('editUserDialog');
            
            await Promise.all([dataManager.loadUsers(), dataManager.loadCharacters()]);
            displays.users();
            
        } catch (error) {
            console.error('Error saving user:', error);
            utils.showToast('error saving');
        }
    },

    async delete(userId) {
        const user = state.allUsers.find(u => u.id === userId);
        const displayName = user ? utils.formatHandle(user.handle) : userId;
        
        if (!confirm(`remove ${displayName}? this can't be undone.`)) return;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.data();
            
            if (userData.characterId) {
                await updateDoc(doc(db, 'characters', userData.characterId), {
                    available: true,
                    ownerId: ''
                });
            }
            
            await deleteDoc(doc(db, 'users', userId));
            
            utils.showToast(`${displayName} removed`);
            await Promise.all([dataManager.loadUsers(), dataManager.loadCharacters()]);
            displays.users();
            
        } catch (error) {
            console.error('Error deleting user:', error);
            utils.showToast('error removing player');
        }
    }
};

// User tab loaders
const userTabLoaders = {
    async credits(userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        const transactions = userData.transactions || [];
        const credit = utils.calculateCredit(transactions);
        
        const creditDisplay = utils.getElement('userCreditDisplay');
        creditDisplay.textContent = `current credits: ${credit}`;
        creditDisplay.className = `credit-display ${credit > 0 ? 'credit-positive' : credit < 0 ? 'credit-negative' : 'credit-zero'}`;
        
        const historyDiv = utils.getElement('userTransactionHistory');
        historyDiv.innerHTML = transactions.length === 0 ?
            '<p style="color: #666; text-align: center;">no transactions yet</p>' :
            transactions.slice().reverse().map(t => {
                const isPositive = t.type !== 'purchase';
                return `
                    <div class="transaction-item ${t.type}">
                        <div>
                            <strong>${t.type === 'gift' ? '🎁 gift' : t.type}</strong><br>
                            <small>${t.description || ''}</small>
                        </div>
                        <div style="text-align: right;">
                            <strong>${isPositive ? '+' : '-'}${Math.abs(t.amount)}</strong><br>
                            <small>${new Date(t.timestamp).toLocaleDateString()}</small>
                        </div>
                    </div>
                `;
            }).join('');
    },

    async tools(userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        const userTools = userData.tools || [];
        
        // Group tools by name
        const toolGroups = {};
        userTools.forEach((tool, index) => {
            if (!toolGroups[tool.name]) {
                toolGroups[tool.name] = { name: tool.name, price: tool.price, active: [], used: [] };
            }
            toolGroups[tool.name][tool.used ? 'used' : 'active'].push(index);
        });
        
        const userToolsList = utils.getElement('userToolsList');
        userToolsList.innerHTML = Object.keys(toolGroups).length === 0 ?
            '<p style="color: #666;">no tools yet</p>' :
            '<h4>owned tools:</h4>' + Object.values(toolGroups).map(group => `
                <div class="user-tool-item">
                    <div class="tool-info">
                        <div class="tool-name">${group.name}</div>
                        ${group.active.length > 0 ? `
                            <div style="margin-top: 4px;">
                                <span class="quantity-display">active: ${group.active.length}</span>
                                <button class="button small" onclick="toolHelpers.markUsed('${group.active[0]}')">mark 1 used</button>
                            </div>
                        ` : ''}
                        ${group.used.length > 0 ? `
                            <div style="margin-top: 4px;">
                                <span class="quantity-display" style="color: #999;">used: ${group.used.length}</span>
                                <button class="button small" onclick="toolHelpers.restore('${group.used[0]}')">restore 1</button>
                            </div>
                        ` : ''}
                    </div>
                    <button class="button small warning" onclick="toolHelpers.removeAll('${group.name}')">remove all</button>
                </div>
            `).join('');
        
        // Available tools to give
        const credit = utils.calculateCredit(userData.transactions);
        const availableToolsList = utils.getElement('availableToolsList');
        availableToolsList.innerHTML = state.allTools
            .filter(tool => tool.visible !== false)
            .map(tool => {
                const canAfford = credit >= tool.price;
                return `
                    <div class="tool-item">
                        <div class="tool-info">
                            <div class="tool-name">${tool.name}</div>
                            <div class="tool-price">${tool.price} credits</div>
                        </div>
                        <div class="user-tool-controls">
                            <input type="number" id="toolQty-${tool.id}" value="1" min="1" max="10" style="width: 50px;">
                            <button class="button small ${canAfford ? '' : 'disabled'}" 
                                    onclick="toolHelpers.give('${tool.id}')"
                                    ${canAfford ? '' : 'disabled'}>
                                give
                            </button>
                            <button class="button small special" onclick="toolHelpers.giveFree('${tool.id}')">🎁</button>
                        </div>
                    </div>
                `;
            }).join('');
    },

    async points(userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        
        utils.getElement('userIndPoints').textContent = userData.individualPoints || 0;
        utils.getElement('userTeamPoints').textContent = userData.teamPoints || 0;
        
        const historyDiv = utils.getElement('userPointsHistory');
        const pointsHistory = userData.pointsHistory || [];
        
        historyDiv.innerHTML = pointsHistory.length === 0 ?
            '<p style="color: #666; text-align: center;">no points yet</p>' :
            pointsHistory.slice().reverse().map(p => `
                <div class="points-log-item ${p.type}">
                    <div>
                        <strong>${p.amount} ${p.type} points</strong>
                        ${p.target ? ` (${p.target})` : ''}<br>
                        <small>${p.reason || ''}</small>
                    </div>
                    <div style="text-align: right;">
                        <small>${new Date(p.timestamp).toLocaleDateString()}</small>
                    </div>
                </div>
            `).join('');
    }
};

// ============================================
// TOOL ACTIONS
// ============================================

const toolActions = {
    async save() {
        const toolId = utils.getElement('editingToolId').value;
        const name = utils.getElement('toolName').value.toUpperCase();
        const price = parseInt(utils.getElement('toolPrice').value);
        
        if (!name || !price) {
            utils.showToast('need name and price');
            return;
        }
        
        try {
            const toolData = {
                name: name,
                price: price,
                icon: utils.getElement('toolIcon').value || '',
                description: utils.getElement('toolDescription').value || '',
                visible: utils.getElement('toolVisible').value === 'true'
            };
            
            if (toolId) {
                await updateDoc(doc(db, 'tools', toolId), toolData);
                utils.showToast(`updated ${name}`);
            } else {
                toolData.createdAt = new Date().toISOString();
                await addDoc(collection(db, 'tools'), toolData);
                utils.showToast(`created ${name} 🪤`);
            }
            
            utils.hideModal('toolDialog');
            await dataManager.loadTools();
            displays.tools();
            
        } catch (error) {
            console.error('Error saving tool:', error);
            utils.showToast('error saving tool');
        }
    },

    edit(toolId) {
        const tool = state.allTools.find(t => t.id === toolId);
        if (!tool) return;
        
        utils.getElement('toolDialogTitle').textContent = '🔧 Edit Tool';
        utils.getElement('editingToolId').value = toolId;
        utils.getElement('toolName').value = tool.name;
        utils.getElement('toolPrice').value = tool.price;
        utils.getElement('toolIcon').value = tool.icon || '';
        utils.getElement('toolDescription').value = tool.description || '';
        utils.getElement('toolVisible').value = tool.visible === false ? 'false' : 'true';
        utils.showModal('toolDialog');
    },

    async toggleVisibility(toolId) {
        const tool = state.allTools.find(t => t.id === toolId);
        if (!tool) return;
        
        try {
            await updateDoc(doc(db, 'tools', toolId), {
                visible: tool.visible === false ? true : false
            });
            
            utils.showToast(tool.visible === false ? 'tool shown' : 'tool hidden');
            await dataManager.loadTools();
            displays.tools();
        } catch (error) {
            console.error('Error toggling tool:', error);
        }
    },

    async delete(toolId) {
        if (!confirm('delete this tool?')) return;
        
        try {
            await deleteDoc(doc(db, 'tools', toolId));
            utils.showToast('tool deleted');
            await dataManager.loadTools();
            displays.tools();
        } catch (error) {
            console.error('Error deleting tool:', error);
        }
    }
};

// Tool helpers for user editing
const toolHelpers = {
    async markUsed(toolIndex) {
        if (!state.editingUser) return;
        
        const userDoc = await getDoc(doc(db, 'users', state.editingUser));
        const tools = userDoc.data().tools || [];
        
        if (tools[toolIndex]) {
            tools[toolIndex].used = true;
            await updateDoc(doc(db, 'users', state.editingUser), { tools });
            userTabLoaders.tools(state.editingUser);
            utils.showToast('tool marked as used');
        }
    },

    async restore(toolIndex) {
        if (!state.editingUser) return;
        
        const userDoc = await getDoc(doc(db, 'users', state.editingUser));
        const tools = userDoc.data().tools || [];
        
        if (tools[toolIndex]) {
            tools[toolIndex].used = false;
            await updateDoc(doc(db, 'users', state.editingUser), { tools });
            userTabLoaders.tools(state.editingUser);
            utils.showToast('tool restored');
        }
    },

    async removeAll(toolName) {
        if (!state.editingUser) return;
        if (!confirm(`remove all ${toolName} from this player?`)) return;
        
        const userDoc = await getDoc(doc(db, 'users', state.editingUser));
        const tools = userDoc.data().tools?.filter(t => t.name !== toolName) || [];
        
        await updateDoc(doc(db, 'users', state.editingUser), { tools });
        userTabLoaders.tools(state.editingUser);
        utils.showToast(`removed all ${toolName}`);
    },

    async give(toolId) {
        if (!state.editingUser) return;
        
        const quantity = parseInt(utils.getElement(`toolQty-${toolId}`).value) || 1;
        const tool = state.allTools.find(t => t.id === toolId);
        if (!tool) return;
        
        const userDoc = await getDoc(doc(db, 'users', state.editingUser));
        const userData = userDoc.data();
        const tools = userData.tools || [];
        const transactions = userData.transactions || [];
        
        const totalCost = tool.price * quantity;
        const currentCredit = utils.calculateCredit(transactions);
        
        if (currentCredit < totalCost) {
            utils.showToast('not enough credits');
            return;
        }
        
        for (let i = 0; i < quantity; i++) {
            tools.push({ name: tool.name, price: tool.price, used: false });
        }
        
        transactions.push({
            type: TRANSACTION_TYPES.PURCHASE,
            amount: totalCost,
            description: `${quantity}x ${tool.name}`,
            timestamp: new Date().toISOString(),
            addedBy: 'admin'
        });
        
        await updateDoc(doc(db, 'users', state.editingUser), {
            tools: tools,
            transactions: transactions,
            credit: utils.calculateCredit(transactions)
        });
        
        userTabLoaders.tools(state.editingUser);
        userTabLoaders.credits(state.editingUser);
        utils.showToast(`gave ${quantity}x ${tool.name}`);
    },

    async giveFree(toolId) {
        if (!state.editingUser) return;
        
        const quantity = parseInt(utils.getElement(`toolQty-${toolId}`).value) || 1;
        const tool = state.allTools.find(t => t.id === toolId);
        if (!tool) return;
        
        const userDoc = await getDoc(doc(db, 'users', state.editingUser));
        const tools = userDoc.data().tools || [];
        
        for (let i = 0; i < quantity; i++) {
            tools.push({ name: tool.name, price: tool.price, used: false, gifted: true });
        }
        
        await updateDoc(doc(db, 'users', state.editingUser), { tools });
        userTabLoaders.tools(state.editingUser);
        utils.showToast(`gifted ${quantity}x ${tool.name} 🎁`);
    }
};

// ============================================
// PENDING ACTIONS
// ============================================

const pendingActions = {
    async approve(pendingId) {
        try {
            const pendingDoc = await getDoc(doc(db, 'pendingSelections', pendingId));
            if (!pendingDoc.exists()) {
                utils.showToast('request not found');
                return;
            }
            
            const selection = pendingDoc.data();
            let userRef = doc(db, 'users', selection.accessCode);
            let userDoc = await getDoc(userRef);
            
            const transactions = [];
            const tools = [];
            
            if (selection.currentCredit > 0) {
                transactions.push({
                    type: TRANSACTION_TYPES.PAYMENT,
                    amount: selection.currentCredit,
                    description: 'initial credits from character selection',
                    timestamp: new Date().toISOString(),
                    addedBy: 'system'
                });
            }
            
            transactions.push({
                type: TRANSACTION_TYPES.PURCHASE,
                amount: 25,
                description: `character: ${selection.characterName}`,
                timestamp: new Date().toISOString(),
                addedBy: 'system'
            });
            
            if (selection.tools?.length > 0) {
                selection.tools.forEach(tool => {
                    const quantity = tool.quantity || 1;
                    for (let i = 0; i < quantity; i++) {
                        tools.push({ name: tool.name, price: tool.price, used: false });
                    }
                    
                    transactions.push({
                        type: TRANSACTION_TYPES.PURCHASE,
                        amount: tool.price * quantity,
                        description: `${quantity}x ${tool.name}`,
                        timestamp: new Date().toISOString(),
                        addedBy: 'system'
                    });
                });
            }
            
            const userData = {
                handle: selection.handle || selection.accessCode,
                email: selection.email || '',
                status: 'active',
                team: selection.team || '',
                createdAt: new Date().toISOString(),
                characterId: selection.characterId || '',
                characterName: selection.characterName || '',
                tools: tools,
                transactions: transactions,
                credit: utils.calculateCredit(transactions),
                moderatorNote: 'welcome to the game! 🐳',
                individualPoints: 0,
                teamPoints: 0,
                pointsHistory: []
            };
            
            if (userDoc.exists()) {
                await updateDoc(userRef, userData);
            } else {
                await setDoc(userRef, userData);
            }
            
            if (selection.characterId) {
                await updateDoc(doc(db, 'characters', selection.characterId), {
                    available: false,
                    ownerId: selection.handle || selection.accessCode
                });
            }
            
            await deleteDoc(doc(db, 'pendingSelections', pendingId));
            
            utils.showToast(`approved ${utils.formatHandle(selection.handle)}! 🐳`);
            displays.pending();
            
        } catch (error) {
            console.error('Error approving:', error);
            utils.showToast('error approving request');
        }
    },

    async markPaid(pendingId, creditsNeeded) {
        if (creditsNeeded <= 0) {
            this.approve(pendingId);
            return;
        }
        
        const amount = prompt(`how many credits did they send? (needs ${creditsNeeded})`);
        if (!amount) return;
        
        try {
            const pendingDoc = await getDoc(doc(db, 'pendingSelections', pendingId));
            if (!pendingDoc.exists()) return;
            
            const selection = pendingDoc.data();
            
            await updateDoc(doc(db, 'pendingSelections', pendingId), {
                currentCredit: (selection.currentCredit || 0) + parseFloat(amount)
            });
            
            utils.showToast(`marked ${amount} credits received`);
            displays.pending();
            
        } catch (error) {
            console.error('Error marking as paid:', error);
        }
    },

    async reject(pendingId) {
        if (!confirm('reject this request?')) return;
        
        try {
            await deleteDoc(doc(db, 'pendingSelections', pendingId));
            utils.showToast('request rejected');
            displays.pending();
        } catch (error) {
            console.error('Error rejecting:', error);
        }
    }
};

// ============================================
// GLOBAL FUNCTIONS
// ============================================

// Search users
window.searchUsers = function() {
    const searchTerm = utils.getElement('searchUsers').value.toLowerCase();
    const filtered = state.allUsers.filter(user => 
        user.id.toLowerCase().includes(searchTerm) ||
        (user.handle && user.handle.toLowerCase().includes(searchTerm))
    );
    
    const tbody = utils.getElement('usersTableBody');
    tbody.innerHTML = filtered.map(user => {
        const credit = utils.calculateCredit(user.transactions);
        const toolsDisplay = templates.toolsList(user.tools);
        
        return `
            <tr>
                <td><strong>${utils.formatHandle(user.handle)}</strong></td>
                <td style="color: #666; font-size: 10px;">${user.id}</td>
                <td>${user.characterName || 'none'}</td>
                <td>${user.status || 'active'}</td>
                <td>${user.team || 'none'}</td>
                <td style="color: ${credit >= 0 ? '#4D9938' : '#D04545'}; font-weight: bold;">
                    ${credit}
                </td>
                <td>${user.individualPoints || 0}</td>
                <td>${user.teamPoints || 0}</td>
                <td>${toolsDisplay}</td>
                <td>
                    <button class="button small" onclick="userActions.edit('${user.id}')">edit</button>
                    <button class="button small warning" onclick="userActions.delete('${user.id}')">remove</button>
                </td>
            </tr>
        `;
    }).join('');
};

// Dialog functions
window.showCreateUser = () => {
    const select = utils.getElement('newCharacter');
    select.innerHTML = '<option value="">-- pick later --</option>' +
        state.allCharacters.filter(char => char.available)
            .map(char => `<option value="${char.id}">${char.name} (${char.show})</option>`)
            .join('');
    
    utils.showModal('createUserDialog');
};

window.hideCreateUser = () => {
    utils.hideModal('createUserDialog');
    utils.clearForm(['newAccessCode', 'newHandle', 'newEmail', 'newCharacter', 'newTeam', 'newPayment', 'newUserNote']);
};

window.createUser = () => userActions.create();
window.hideEditUser = () => {
    utils.hideModal('editUserDialog');
    state.editingUser = null;
};
window.saveUserEdit = () => userActions.save();

window.showCreateTool = () => {
    utils.getElement('toolDialogTitle').textContent = '🪤 Create Tool';
    utils.clearForm(['editingToolId', 'toolName', 'toolPrice', 'toolIcon', 'toolDescription']);
    utils.getElement('toolVisible').value = 'true';
    utils.showModal('toolDialog');
};

window.hideToolDialog = () => utils.hideModal('toolDialog');
window.saveTool = () => toolActions.save();

// Tab switching
window.switchEditTab = function(tabName) {
    document.querySelectorAll('#editUserDialog .tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('#editUserDialog .tab-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    utils.getElement(`edit-${tabName}-tab`).style.display = 'block';
    state.activeTab = tabName;
};

// Credits/points quick actions
window.quickAddCredits = async (amount, isGift) => {
    if (!state.editingUser) return;
    
    const userDoc = await getDoc(doc(db, 'users', state.editingUser));
    const transactions = userDoc.data().transactions || [];
    
    transactions.push({
        type: isGift ? TRANSACTION_TYPES.GIFT : TRANSACTION_TYPES.PAYMENT,
        amount: amount,
        description: isGift ? `gifted ${amount} credits 🎁` : `added ${amount} credits`,
        timestamp: new Date().toISOString(),
        addedBy: 'admin'
    });
    
    await updateDoc(doc(db, 'users', state.editingUser), {
        transactions: transactions,
        credit: utils.calculateCredit(transactions)
    });
    
    userTabLoaders.credits(state.editingUser);
    utils.showToast(isGift ? `gifted ${amount} credits 🎁` : `added ${amount} credits`);
};

window.addCustomCredits = async () => {
    if (!state.editingUser) return;
    
    const amount = parseFloat(utils.getElement('customCreditAmount').value);
    const note = utils.getElement('customCreditNote').value;
    
    if (!amount) {
        utils.showToast('enter an amount');
        return;
    }
    
    const userDoc = await getDoc(doc(db, 'users', state.editingUser));
    const transactions = userDoc.data().transactions || [];
    
    transactions.push({
        type: TRANSACTION_TYPES.PAYMENT,
        amount: amount,
        description: note || `custom credit adjustment`,
        timestamp: new Date().toISOString(),
        addedBy: 'admin'
    });
    
    await updateDoc(doc(db, 'users', state.editingUser), {
        transactions: transactions,
        credit: utils.calculateCredit(transactions)
    });
    
    utils.clearForm(['customCreditAmount', 'customCreditNote']);
    userTabLoaders.credits(state.editingUser);
    utils.showToast(`added ${amount} credits`);
};

window.clearPending = async () => {
    if (!state.editingUser) return;
    if (!confirm('clear all pending credits for this player?')) return;
    
    const userDoc = await getDoc(doc(db, 'users', state.editingUser));
    const transactions = userDoc.data().transactions || [];
    const currentCredit = utils.calculateCredit(transactions);
    
    if (currentCredit < 0) {
        transactions.push({
            type: TRANSACTION_TYPES.ADJUSTMENT,
            amount: Math.abs(currentCredit),
            description: 'pending cleared 🧧',
            timestamp: new Date().toISOString(),
            addedBy: 'admin'
        });
        
        await updateDoc(doc(db, 'users', state.editingUser), {
            transactions: transactions,
            credit: 0
        });
        
        userTabLoaders.credits(state.editingUser);
        utils.showToast('pending cleared 🧧');
    }
};

window.addPoints = async () => {
    if (!state.editingUser) return;
    
    const amount = parseInt(utils.getElement('pointsAmount').value);
    const type = utils.getElement('pointType').value;
    const target = utils.getElement('pointTarget').value;
    const reason = utils.getElement('pointReason').value;
    
    if (!amount || amount <= 0) {
        utils.showToast('enter points amount');
        return;
    }
    
    const userDoc = await getDoc(doc(db, 'users', state.editingUser));
    const userData = userDoc.data();
    
    const actualPoints = amount * POINT_MULTIPLIERS[type];
    
    const updates = {
        pointsHistory: [...(userData.pointsHistory || []), {
            amount: actualPoints,
            type: type,
            target: target,
            reason: reason,
            timestamp: new Date().toISOString(),
            addedBy: 'admin'
        }]
    };
    
    if (target === 'individual' || target === 'both') {
        updates.individualPoints = (userData.individualPoints || 0) + actualPoints;
    }
    
    if (target === 'team' || target === 'both') {
        updates.teamPoints = (userData.teamPoints || 0) + actualPoints;
    }
    
    await updateDoc(doc(db, 'users', state.editingUser), updates);
    
    utils.clearForm(['pointsAmount', 'pointReason']);
    userTabLoaders.points(state.editingUser);
    utils.showToast(`added ${actualPoints} points (${type}) 🎱`);
};

window.quickMsg = (text) => utils.getElement('editUserMessage').value = text;

// Expose action objects to global scope
window.userActions = userActions;
window.toolActions = toolActions;
window.toolHelpers = toolHelpers;
window.pendingActions = pendingActions;

// ============================================
// REALTIME LISTENERS
// ============================================

function setupRealtimeListeners() {
    // Users listener
    onSnapshot(collection(db, 'users'), () => {
        dataManager.loadUsers().then(() => {
            if (state.openWindows.has('users')) displays.users();
            if (state.openWindows.has('dashboard')) displays.dashboard();
            if (state.openWindows.has('money')) displays.money();
            if (state.openWindows.has('teams')) displays.teams();
            if (state.openWindows.has('points')) displays.points();
        });
    });
    
    // Characters listener
    onSnapshot(collection(db, 'characters'), () => {
        dataManager.loadCharacters().then(() => {
            if (state.openWindows.has('characters')) displays.characters();
        });
    });
    
    // Tools listener
    onSnapshot(collection(db, 'tools'), () => {
        dataManager.loadTools().then(() => {
            if (state.openWindows.has('tools')) displays.tools();
        });
    });
    
    // Pending selections listener
    onSnapshot(collection(db, 'pendingSelections'), (snapshot) => {
        if (state.openWindows.has('pending')) displays.pending();
        
        // Update pending count on icon
        const pendingIcon = Array.from(document.querySelectorAll('.desktop-icon')).find(icon => 
            icon.querySelector('.label')?.textContent.includes('Pending')
        );
        if (pendingIcon) {
            const label = pendingIcon.querySelector('.label');
            label.textContent = snapshot.size > 0 ? `Pending (${snapshot.size})` : 'Pending';
        }
    });
}