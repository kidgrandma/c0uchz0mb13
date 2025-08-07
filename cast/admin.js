// admin.js - INTERNET OLYMPICS 2 Admin Panel with Firebase Auth

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
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
    onSnapshot,
    query,
    where
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
const auth = getAuth(app);
const db = getFirestore(app);

// Authorized admin email
const ADMIN_EMAIL = 'paizley@vaporbae.net';

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
    currentUser: null,
    openWindows: new Set(),
    minimizedWindows: new Set(),
    allCharacters: [],
    allUsers: [],
    allTools: [],
    editingUser: null,
    editingTool: null,
    activeTab: 'info',
    listeners: []
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

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    getElement(id) {
        return document.getElementById(id);
    },

    hideModal(modalId) {
        const modal = utils.getElement(modalId);
        if (modal) modal.style.display = 'none';
    },

    showModal(modalId) {
        const modal = utils.getElement(modalId);
        if (modal) modal.style.display = 'block';
    },

    clearForm(formIds) {
        formIds.forEach(id => {
            const el = utils.getElement(id);
            if (el) {
                if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                } else {
                    el.value = '';
                }
            }
        });
    },

    showMessage(elementId, message, type = 'error') {
        const el = utils.getElement(elementId);
        if (el) {
            el.textContent = message;
            el.className = `form-message ${type}`;
            el.style.display = 'block';
            setTimeout(() => {
                el.style.display = 'none';
            }, 5000);
        }
    }
};

// ============================================
// AUTHENTICATION
// ============================================

// Initialize auth state listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Check if user is authorized admin
        if (user.email === ADMIN_EMAIL) {
            state.currentUser = user;
            showAdminPanel(user);
        } else {
            // User is not authorized
            signOut(auth);
            showAuthError('Access denied. This account is not authorized.');
        }
    } else {
        // User is signed out
        showLoginScreen();
    }
});

function showLoginScreen() {
    utils.getElement('loginWindow').style.display = 'block';
    utils.getElement('adminPanel').style.display = 'none';
    utils.getElement('emailAuthSection').style.display = 'block';
    utils.getElement('authLoading').style.display = 'none';
}

function showAdminPanel(user) {
    utils.getElement('loginWindow').style.display = 'none';
    utils.getElement('adminPanel').style.display = 'block';
    utils.getElement('currentUser').textContent = `👤 ${user.email}`;
    utils.showToast(`Welcome back, ${user.email.split('@')[0]}! 🎮`, 'success');
    initializeAdmin();
}

function showAuthError(message) {
    const errorEl = utils.getElement('loginError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    utils.getElement('authLoading').style.display = 'none';
    utils.getElement('emailAuthSection').style.display = 'block';
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

// Email/Password login
window.adminLogin = async function() {
    const email = utils.getElement('adminEmail').value;
    const password = utils.getElement('adminPassword').value;
    
    if (!email || !password) {
        showAuthError('Please enter email and password');
        return;
    }
    
    // Show loading state
    utils.getElement('emailAuthSection').style.display = 'none';
    utils.getElement('authLoading').style.display = 'block';
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Auth state listener will handle the rest
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Authentication failed';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later';
                break;
        }
        
        showAuthError(errorMessage);
    }
};

// Google Sign-In
window.googleLogin = async function() {
    const provider = new GoogleAuthProvider();
    
    // Show loading state
    utils.getElement('emailAuthSection').style.display = 'none';
    utils.getElement('authLoading').style.display = 'block';
    
    try {
        const result = await signInWithPopup(auth, provider);
        // Auth state listener will handle the rest
    } catch (error) {
        console.error('Google login error:', error);
        showAuthError('Google sign-in failed. Please try again.');
    }
};

// Logout
window.adminLogout = async function() {
    if (confirm('Sign out of admin panel?')) {
        try {
            // Clean up listeners
            state.listeners.forEach(unsubscribe => unsubscribe());
            state.listeners = [];
            
            await signOut(auth);
            utils.showToast('Signed out successfully', 'info');
        } catch (error) {
            console.error('Logout error:', error);
            utils.showToast('Error signing out', 'error');
        }
    }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeClock();
    initializeWindowDragging();
    
    // Enter key handlers
    utils.getElement('adminPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminLogin();
    });
    
    utils.getElement('adminEmail')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            utils.getElement('adminPassword').focus();
        }
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
    if (!state.currentUser) return;
    
    try {
        await Promise.all([
            dataManager.loadCharacters(),
            dataManager.loadTools(),
            dataManager.loadUsers()
        ]);
        setupRealtimeListeners();
        windowManager.open('dashboard');
    } catch (error) {
        console.error('Error initializing admin:', error);
        utils.showToast('Error loading data. Please refresh.', 'error');
    }
}

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
window.refreshDashboard = () => displays.dashboard();

function initializeWindowDragging() {
    let draggedWindow = null;
    let offset = { x: 0, y: 0 };
    
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-header') && !e.target.closest('button')) {
            const windowEl = e.target.closest('.window');
            if (windowEl?.classList.contains('draggable') && !windowEl.classList.contains('maximized')) {
                draggedWindow = windowEl;
                const rect = windowEl.getBoundingClientRect();
                offset.x = e.clientX - rect.left;
                offset.y = e.clientY - rect.top;
                windowManager.bringToFront(windowEl);
            }
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (draggedWindow) {
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
        try {
            const snapshot = await getDocs(collection(db, 'characters'));
            state.allCharacters = [];
            snapshot.forEach(doc => {
                state.allCharacters.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error('Error loading characters:', error);
            utils.showToast('Error loading characters', 'error');
        }
    },

    async loadTools() {
        try {
            const snapshot = await getDocs(collection(db, 'tools'));
            state.allTools = [];
            snapshot.forEach(doc => {
                state.allTools.push({ id: doc.id, ...doc.data() });
            });
            state.allTools.sort((a, b) => a.price - b.price);
        } catch (error) {
            console.error('Error loading tools:', error);
            utils.showToast('Error loading tools', 'error');
        }
    },

    async loadUsers() {
        try {
            const snapshot = await getDocs(collection(db, 'users'));
            state.allUsers = [];
            snapshot.forEach(doc => {
                state.allUsers.push({ id: doc.id, ...doc.data() });
            });
            state.allUsers.sort((a, b) => (a.handle || a.id).localeCompare(b.handle || b.id));
        } catch (error) {
            console.error('Error loading users:', error);
            utils.showToast('Error loading users', 'error');
        }
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
                
                if (user.createdAt) {
                    recentActivity.push({
                        handle: user.handle,
                        code: user.id,
                        timestamp: user.createdAt
                    });
                }
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
                const el = utils.getElement(id);
                if (el) el.textContent = value;
            });
            
            // Recent activity
            const activityList = utils.getElement('activityList');
            recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            activityList.innerHTML = recentActivity.length === 0 ? 
                '<div class="empty-state"><span class="empty-icon">🦗</span><p>nothing happening yet...</p></div>' :
                recentActivity.slice(0, 5).map(user => `
                    <div>
                        <strong>${utils.formatHandle(user.handle)}</strong>
                        <span style="color: #999; font-size: 10px;">(${user.code})</span>
                        <span style="float: right; color: #666;">
                            ${new Date(user.timestamp).toLocaleDateString()}
                        </span>
                    </div>
                `).join('');
                
        } catch (error) {
            console.error('Error loading dashboard:', error);
            utils.showToast('Error loading dashboard', 'error');
        }
    },

    users() {
        const tbody = utils.getElement('usersTableBody');
        
        if (state.allUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">no players yet. waiting... 🐰</td></tr>';
            return;
        }
        
        tbody.innerHTML = state.allUsers.map(user => {
            const credit = utils.calculateCredit(user.transactions);
            const toolsDisplay = templates.toolsList(user.tools);
            const statusIcon = user.status === 'active' ? '✅' : user.status === 'blocked' ? '🚫' : '💀';
            
            return `
                <tr>
                    <td><strong>${utils.formatHandle(user.handle)}</strong></td>
                    <td style="color: #666; font-size: 10px;">${user.id}</td>
                    <td>${user.characterName || '-'}</td>
                    <td>${statusIcon} ${user.status || 'active'}</td>
                    <td>${user.team || '-'}</td>
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
                        ${char.available ? '✅ available' : `❌ taken by ${utils.formatHandle(char.ownerId)}`}
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
            toolsList.innerHTML = '<div class="empty-state"><span class="empty-icon">🪤</span><p>no tools yet. make some weird stuff.</p></div>';
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
            '<div class="empty-state"><span class="empty-icon">🧧</span><p>everyone\'s good!</p></div>' :
            pendingPlayers.map(p => `
                <div style="padding: 12px; background: linear-gradient(135deg, #FFF8DC 0%, #FFE4B5 100%); border: 2px solid #DAA520; margin-bottom: 10px; border-radius: 6px;">
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
            '<div class="empty-state"><span class="empty-icon">🏆</span><p>no points awarded yet</p></div>' :
            '<h3>Top Players</h3>' + leaderboard.map((user, i) => 
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
            '<div class="empty-state"><span class="empty-icon">🎯</span><p>no points activity yet</p></div>' :
            allPointsHistory.slice(0, 10).map(p => `
                <div class="points-log-item ${p.type}">
                    <div>
                        <strong>${utils.formatHandle(p.handle)}</strong> got ${p.amount} ${p.type} points
                        ${p.reason ? `for "${p.reason}"` : ''}
                    </div>
                    <small style="color: #666;">
                        ${new Date(p.timestamp).toLocaleDateString()}
                    </small>
                </div>
            `).join('');
    },

    async pending() {
        const pendingList = utils.getElement('pendingList');
        pendingList.innerHTML = '<p>loading pending requests...</p>';
        
        try {
            const snapshot = await getDocs(collection(db, 'pendingSelections'));
            const pendingCount = utils.getElement('pendingCount');
            const pendingBadge = utils.getElement('pendingBadge');
            
            if (snapshot.empty) {
                pendingCount.textContent = '0';
                pendingBadge.style.display = 'none';
                pendingList.innerHTML = '<div class="empty-state"><span class="empty-icon">✨</span><p>no pending requests</p></div>';
                return;
            }
            
            pendingCount.textContent = snapshot.size;
            pendingBadge.textContent = snapshot.size;
            pendingBadge.style.display = snapshot.size > 0 ? 'block' : 'none';
            
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
// TEMPLATES (continued in next part due to length)
// ============================================

const templates = {
    toolsList(tools = []) {
        if (!tools || tools.length === 0) return '<span style="color: #999;">none</span>';
        
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
            <div style="${isLeading ? 'background: linear-gradient(135deg, #FFD700, #FFF8DC);' : ''} ${isLeading ? 'border-color: #DAA520;' : ''}">
                <h3>${isLeading ? '👑 ' : ''}${team.name} ${team.points ? `(${team.points} points)` : ''}</h3>
                ${team.members.length === 0 ? 
                    '<p style="color: #666;">no members yet</p>' :
                    team.members.map(member => `
                        <div style="padding: 8px; border-bottom: 1px solid #E0E0E0;">
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
        
        const totalCost = 25 + toolsCost;
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
                            ${creditsNeeded > 0 ? creditsNeeded + ' credits' : '✅ fully funded!'}
                        </span>
                    </div>
                </div>
                <div class="pending-request-actions">
                    <button class="button primary" onclick="pendingActions.approve('${req.id}')">approve 🐳</button>
                    <button class="button" onclick="pendingActions.markPaid('${req.id}', ${creditsNeeded})">mark paid</button>
                    <button class="button warning" onclick="pendingActions.reject('${req.id}')">reject</button>
                </div>
            </div>
        `;
    }
};

// Continued in next message due to length...