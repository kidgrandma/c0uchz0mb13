// admin.js - INTERNET OLYMPICS 2 Admin Panel (Complete Fixed Version)

// Firebase imports (Firestore only - no Auth needed)
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

// Initialize Firebase (Firestore only)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================
// SIMPLE SECURE AUTHENTICATION
// ============================================

// Hash function for password (basic security)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Your hashed password (change this after setting up)
// Default password is "olympicsAdmin2024!" - CHANGE THIS IMMEDIATELY
const ADMIN_PASSWORD_HASH = 'f44d66d49ae0e7b1c90914f8a4276d0db4e419f43864750ddaf65ca177c88bf4';

// Session management (stays logged in until browser closes)
const SESSION_KEY = 'io2_admin_session';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Create secure session token
function createSessionToken() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return btoa(`${timestamp}-${random}-${ADMIN_PASSWORD_HASH.substring(0, 8)}`);
}

// Validate session
function validateSession() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return false;
    
    try {
        const decoded = atob(session);
        const [timestamp] = decoded.split('-');
        const sessionAge = Date.now() - parseInt(timestamp);
        
        // Check if session is expired
        if (sessionAge > SESSION_TIMEOUT) {
            localStorage.removeItem(SESSION_KEY);
            return false;
        }
        
        return true;
    } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        return false;
    }
}

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    isAuthenticated: false,
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
        if (toast) {
            toast.textContent = message;
            toast.className = `toast show ${type}`;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
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
    }
};

// ============================================
// AUTHENTICATION
// ============================================

// Check authentication on load
function checkAuth() {
    if (validateSession()) {
        state.isAuthenticated = true;
        showAdminPanel();
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    const loginWindow = utils.getElement('loginWindow');
    const adminPanel = utils.getElement('adminPanel');
    
    if (loginWindow) loginWindow.style.display = 'block';
    if (adminPanel) adminPanel.style.display = 'none';
}

function showAdminPanel() {
    const loginWindow = utils.getElement('loginWindow');
    const adminPanel = utils.getElement('adminPanel');
    
    if (loginWindow) loginWindow.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'block';
    
    utils.showToast('Welcome back, admin! 🎮', 'success');
    initializeAdmin();
}

// Simple password login
window.adminLogin = async function() {
    const passwordInput = utils.getElement('adminPassword');
    const password = passwordInput?.value;
    
    if (!password) {
        showAuthError('enter the password');
        return;
    }
    
    // Hash the entered password
    const hashedPassword = await hashPassword(password);
    
    // Add small delay to prevent brute force
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (hashedPassword === ADMIN_PASSWORD_HASH) {
        // Create session
        const sessionToken = createSessionToken();
        localStorage.setItem(SESSION_KEY, sessionToken);
        state.isAuthenticated = true;
        
        showAdminPanel();
    } else {
        showAuthError('nope. try again.');
        
        // Clear password field
        if (passwordInput) passwordInput.value = '';
    }
};

function showAuthError(message) {
    const errorEl = utils.getElement('loginError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 3000);
    }
}

// Logout
window.adminLogout = function() {
    if (confirm('Sign out of admin panel?')) {
        localStorage.removeItem(SESSION_KEY);
        state.isAuthenticated = false;
        
        // Clean up listeners
        state.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        state.listeners = [];
        
        location.reload();
    }
};

// ============================================
// SECURITY MEASURES
// ============================================

// Prevent console access to sensitive functions
(function() {
    // Store original console
    const originalConsole = window.console;
    
    // Override console in production
    if (window.location.hostname !== 'localhost') {
        window.console = {
            log: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {}
        };
    }
    
    // Detect dev tools (basic check)
    let devtools = { open: false, orientation: null };
    const threshold = 160;
    
    setInterval(() => {
        if (window.outerWidth - window.innerWidth > threshold || 
            window.outerHeight - window.innerHeight > threshold) {
            if (!devtools.open && !state.isAuthenticated) {
                // Dev tools opened while not authenticated
                document.body.innerHTML = '<h1 style="text-align:center; margin-top:50px;">🚫 Access Denied</h1>';
            }
            devtools.open = true;
        } else {
            devtools.open = false;
        }
    }, 500);
})();

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing admin panel...');
    checkAuth();
    initializeClock();
    initializeWindowDragging();
    
    // Enter key handler for password field
    const passwordField = utils.getElement('adminPassword');
    if (passwordField) {
        passwordField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') adminLogin();
        });
    }
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

function initializeWindowDragging() {
    let draggedWindow = null;
    let offset = { x: 0, y: 0 };
    
    document.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('window-header') || e.target.parentElement?.classList.contains('window-header')) {
            const window = e.target.closest('.window');
            if (window && window.classList.contains('draggable')) {
                draggedWindow = window;
                const rect = draggedWindow.getBoundingClientRect();
                offset.x = e.clientX - rect.left;
                offset.y = e.clientY - rect.top;
                windowManager.bringToFront(draggedWindow);
            }
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (draggedWindow) {
            draggedWindow.style.left = `${e.clientX - offset.x}px`;
            draggedWindow.style.top = `${e.clientY - offset.y}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        draggedWindow = null;
    });
}

async function initializeAdmin() {
    if (!state.isAuthenticated) {
        console.log('Not authenticated');
        return;
    }
    
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

function setupRealtimeListeners() {
    // Listen for pending selections changes
    const pendingListener = onSnapshot(collection(db, 'pendingSelections'), (snapshot) => {
        const pendingBadge = utils.getElement('pendingBadge');
        const pendingCount = snapshot.size;
        
        // Update desktop icon badge
        const desktopIcons = document.querySelectorAll('.desktop-icon');
        desktopIcons.forEach(icon => {
            if (icon.querySelector('.label')?.textContent === 'Pending') {
                let badge = icon.querySelector('.notification-badge');
                if (pendingCount > 0) {
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.className = 'notification-badge';
                        icon.appendChild(badge);
                    }
                    badge.textContent = pendingCount;
                } else if (badge) {
                    badge.remove();
                }
            }
        });
        
        // Refresh pending window if open
        if (state.openWindows.has('pending')) {
            displays.pending();
        }
    });
    
    state.listeners.push(pendingListener);
}

// ============================================
// WINDOW MANAGEMENT
// ============================================

const windowManager = {
    open(windowId) {
        if (!state.isAuthenticated) return;
        
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
        if (!bar) return;
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

// Window manager global functions (protected)
window.openWindow = (id) => state.isAuthenticated && windowManager.open(id);
window.closeWindow = (id) => state.isAuthenticated && windowManager.close(id);
window.minimizeWindow = (id) => state.isAuthenticated && windowManager.minimize(id);
window.maximizeWindow = (id) => state.isAuthenticated && windowManager.maximize(id);

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
                if (user.status === 'active' || !user.status) stats.active++;
                
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
            if (activityList) {
                recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                activityList.innerHTML = recentActivity.length === 0 ? 
                    '<div class="empty-state"><span class="empty-icon">🦗</span><p>nothing happening yet...</p></div>' :
                    recentActivity.slice(0, 5).map(user => `
                        <div style="padding: 10px; border-bottom: 1px solid #E0E0E0;">
                            <strong>${utils.formatHandle(user.handle)}</strong>
                            <span style="color: #999; font-size: 10px;">(${user.code})</span>
                            <span style="float: right; color: #666;">
                                ${new Date(user.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                    `).join('');
            }
                
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
            const statusIcon = user.status === 'active' ? '✅' : user.status === 'blocked' ? '🚫' : user.status === 'dead' ? '💀' : '✅';
            
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
                        <button class="button small" onclick="showEditUser('${user.id}')">edit</button>
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
            
            if (snapshot.empty) {
                if (pendingCount) pendingCount.textContent = '0';
                pendingList.innerHTML = '<div class="empty-state"><span class="empty-icon">✨</span><p>no pending requests</p></div>';
                return;
            }
            
            if (pendingCount) pendingCount.textContent = snapshot.size;
            
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
            <div style="padding: 20px; background: ${isLeading ? 'linear-gradient(135deg, #FFD700, #FFF8DC)' : 'white'}; border: 2px solid ${isLeading ? '#DAA520' : '#E0E0E0'}; border-radius: 8px; margin-bottom: 15px;">
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

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

window.showCreateUser = function() {
    state.editingUser = null;
    
    // Clear all fields
    utils.clearForm(['newAccessCode', 'newHandle', 'newEmail', 'newCharacter', 'newTeam', 'newPayment', 'newUserNote']);
    
    // Populate character dropdown
    const characterSelect = utils.getElement('newCharacter');
    if (characterSelect) {
        characterSelect.innerHTML = '<option value="">-- pick later --</option>' +
            state.allCharacters
                .filter(c => c.available)
                .map(c => `<option value="${c.id}">${c.name} (${c.show})</option>`)
                .join('');
    }
    
    // Show dialog
    const dialog = utils.getElement('createUserDialog');
    if (dialog) dialog.style.display = 'block';
};

window.hideCreateUser = function() {
    const dialog = utils.getElement('createUserDialog');
    if (dialog) dialog.style.display = 'none';
};

window.createUser = async function() {
    try {
        const accessCode = utils.getElement('newAccessCode').value;
        const handle = utils.getElement('newHandle').value;
        
        if (!accessCode || !handle) {
            utils.showToast('Access code and handle are required', 'error');
            return;
        }
        
        // Check if user already exists
        const existingUser = state.allUsers.find(u => u.id === accessCode);
        if (existingUser) {
            utils.showToast('Access code already exists', 'error');
            return;
        }
        
        const characterId = utils.getElement('newCharacter').value;
        const character = characterId ? state.allCharacters.find(c => c.id === characterId) : null;
        
        const newUser = {
            handle: handle.replace('@', ''),
            email: utils.getElement('newEmail').value || '',
            characterId: characterId || null,
            characterName: character ? character.name : null,
            team: utils.getElement('newTeam').value || null,
            tools: [],
            transactions: [],
            individualPoints: 0,
            teamPoints: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            notes: []
        };
        
        // Add initial payment if specified
        const initialPayment = parseFloat(utils.getElement('newPayment').value) || 0;
        if (initialPayment > 0) {
            newUser.transactions.push({
                type: 'payment',
                amount: initialPayment,
                description: 'Initial payment',
                timestamp: new Date().toISOString()
            });
        }
        
        // Add welcome note if specified
        const welcomeNote = utils.getElement('newUserNote').value;
        if (welcomeNote) {
            newUser.notes.push({
                message: welcomeNote,
                from: 'admin',
                timestamp: new Date().toISOString()
            });
        }
        
        // Create user in database
        await setDoc(doc(db, 'users', accessCode), newUser);
        
        // Update character availability if selected
        if (characterId) {
            await updateDoc(doc(db, 'characters', characterId), {
                available: false,
                ownerId: handle
            });
        }
        
        utils.showToast('Player created successfully! 🎉', 'success');
        hideCreateUser();
        
        // Reload data
        await Promise.all([
            dataManager.loadUsers(),
            dataManager.loadCharacters()
        ]);
        displays.users();
        
    } catch (error) {
        console.error('Error creating user:', error);
        utils.showToast('Error creating user', 'error');
    }
};

window.showEditUser = function(userId) {
    const user = state.allUsers.find(u => u.id === userId);
    if (!user) return;
    
    state.editingUser = user;
    
    // Show user handle in header
    const handleSpan = utils.getElement('editUserHandle');
    if (handleSpan) handleSpan.textContent = utils.formatHandle(user.handle);
    
    // Store user ID
    utils.getElement('editUserId').value = userId;
    
    // Populate info tab
    utils.getElement('editHandle').value = user.handle || '';
    utils.getElement('editStatus').value = user.status || 'active';
    utils.getElement('editTeam').value = user.team || '';
    
    // Populate character dropdown
    const characterSelect = utils.getElement('editCharacter');
    if (characterSelect) {
        characterSelect.innerHTML = '<option value="">-- none --</option>' +
            state.allCharacters.map(c => 
                `<option value="${c.id}" ${user.characterId === c.id ? 'selected' : ''}>${c.name}</option>`
            ).join('');
    }
    
    // Display credit info
    const credit = utils.calculateCredit(user.transactions);
    const creditDisplay = utils.getElement('userCreditDisplay');
    if (creditDisplay) {
        creditDisplay.textContent = `current credits: ${credit}`;
        creditDisplay.className = credit >= 0 ? 'credit-display credit-positive' : 'credit-display credit-negative';
    }
    
    // Display transaction history
    const historyDiv = utils.getElement('userTransactionHistory');
    if (historyDiv && user.transactions) {
        historyDiv.innerHTML = user.transactions.length === 0 ? 
            '<p style="color: #666;">no transactions yet</p>' :
            user.transactions.map(t => `
                <div class="transaction-item ${t.type}">
                    <div>
                        <strong>${t.type}</strong>: ${t.amount} credits
                        ${t.description ? `<br><small>${t.description}</small>` : ''}
                    </div>
                    <small>${new Date(t.timestamp).toLocaleDateString()}</small>
                </div>
            `).join('');
    }
    
    // Display points
    utils.getElement('userIndPoints').textContent = user.individualPoints || 0;
    utils.getElement('userTeamPoints').textContent = user.teamPoints || 0;
    
    // Display tools
    const toolsList = utils.getElement('userToolsList');
    if (toolsList) {
        toolsList.innerHTML = user.tools && user.tools.length > 0 ?
            '<h4>Current Tools:</h4>' + user.tools.map(tool => 
                `<div class="tool-tag ${tool.used ? 'used' : ''}">${tool.name} ${tool.used ? '(used)' : ''}</div>`
            ).join('') :
            '<p style="color: #666;">no tools yet</p>';
    }
    
    // Display available tools to give
    const availableTools = utils.getElement('availableToolsList');
    if (availableTools) {
        availableTools.innerHTML = state.allTools
            .filter(t => t.visible !== false)
            .map(tool => `
                <button class="button small" onclick="giveTool('${user.id}', '${tool.id}')">
                    ${tool.name} (${tool.price} credits)
                </button>
            `).join('');
    }
    
    // Show dialog and activate first tab
    switchEditTab('info');
    const dialog = utils.getElement('editUserDialog');
    if (dialog) dialog.style.display = 'block';
};

window.hideEditUser = function() {
    const dialog = utils.getElement('editUserDialog');
    if (dialog) dialog.style.display = 'none';
    state.editingUser = null;
};

window.saveUserEdit = async function() {
    if (!state.editingUser) return;
    
    try {
        const updates = {
            handle: utils.getElement('editHandle').value,
            status: utils.getElement('editStatus').value,
            team: utils.getElement('editTeam').value || null
        };
        
        const characterId = utils.getElement('editCharacter').value;
        if (characterId !== state.editingUser.characterId) {
            // Release old character if exists
            if (state.editingUser.characterId) {
                await updateDoc(doc(db, 'characters', state.editingUser.characterId), {
                    available: true,
                    ownerId: null
                });
            }
            
            // Assign new character
            if (characterId) {
                const character = state.allCharacters.find(c => c.id === characterId);
                updates.characterId = characterId;
                updates.characterName = character ? character.name : null;
                
                await updateDoc(doc(db, 'characters', characterId), {
                    available: false,
                    ownerId: updates.handle
                });
            } else {
                updates.characterId = null;
                updates.characterName = null;
            }
        }
        
        // Check for message to send
        const message = utils.getElement('editUserMessage').value;
        if (message) {
            const notes = state.editingUser.notes || [];
            notes.push({
                message,
                from: 'admin',
                timestamp: new Date().toISOString()
            });
            updates.notes = notes;
        }
        
        await updateDoc(doc(db, 'users', state.editingUser.id), updates);
        
        utils.showToast('User updated! 💾', 'success');
        hideEditUser();
        
        // Reload data
        await Promise.all([
            dataManager.loadUsers(),
            dataManager.loadCharacters()
        ]);
        displays.users();
        
    } catch (error) {
        console.error('Error updating user:', error);
        utils.showToast('Error updating user', 'error');
    }
};

window.switchEditTab = function(tabName) {
    // Hide all tab contents
    document.querySelectorAll('#editUserDialog .tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active from all tabs
    document.querySelectorAll('#editUserDialog .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    const tabContent = utils.getElement(`edit-${tabName}-tab`);
    if (tabContent) tabContent.style.display = 'block';
    
    // Mark tab as active
    const activeTab = Array.from(document.querySelectorAll('#editUserDialog .tab'))
        .find(tab => tab.textContent.toLowerCase() === tabName);
    if (activeTab) activeTab.classList.add('active');
};

// Quick action functions for credits
window.quickAddCredits = async function(amount, isGift) {
    if (!state.editingUser) return;
    
    try {
        const transactions = state.editingUser.transactions || [];
        transactions.push({
            type: isGift ? 'gift' : 'payment',
            amount: amount,
            description: isGift ? 'Admin gift' : 'Payment received',
            timestamp: new Date().toISOString()
        });
        
        await updateDoc(doc(db, 'users', state.editingUser.id), { transactions });
        
        utils.showToast(`Added ${amount} credits!`, 'success');
        
        // Reload user data
        await dataManager.loadUsers();
        showEditUser(state.editingUser.id);
        
    } catch (error) {
        console.error('Error adding credits:', error);
        utils.showToast('Error adding credits', 'error');
    }
};

window.clearPending = async function() {
    if (!state.editingUser) return;
    
    const credit = utils.calculateCredit(state.editingUser.transactions);
    if (credit >= 0) {
        utils.showToast('No pending credits to clear', 'info');
        return;
    }
    
    try {
        const transactions = state.editingUser.transactions || [];
        transactions.push({
            type: 'adjustment',
            amount: Math.abs(credit),
            description: 'Pending cleared by admin',
            timestamp: new Date().toISOString()
        });
        
        await updateDoc(doc(db, 'users', state.editingUser.id), { transactions });
        
        utils.showToast('Pending credits cleared!', 'success');
        
        // Reload user data
        await dataManager.loadUsers();
        showEditUser(state.editingUser.id);
        
    } catch (error) {
        console.error('Error clearing pending:', error);
        utils.showToast('Error clearing pending', 'error');
    }
};

window.addCustomCredits = async function() {
    if (!state.editingUser) return;
    
    const amount = parseFloat(utils.getElement('customCreditAmount').value);
    const note = utils.getElement('customCreditNote').value;
    
    if (!amount) {
        utils.showToast('Please enter an amount', 'warning');
        return;
    }
    
    try {
        const transactions = state.editingUser.transactions || [];
        transactions.push({
            type: amount > 0 ? 'payment' : 'purchase',
            amount: Math.abs(amount),
            description: note || 'Admin adjustment',
            timestamp: new Date().toISOString()
        });
        
        await updateDoc(doc(db, 'users', state.editingUser.id), { transactions });
        
        utils.showToast('Credits added!', 'success');
        
        // Clear form
        utils.clearForm(['customCreditAmount', 'customCreditNote']);
        
        // Reload user data
        await dataManager.loadUsers();
        showEditUser(state.editingUser.id);
        
    } catch (error) {
        console.error('Error adding custom credits:', error);
        utils.showToast('Error adding credits', 'error');
    }
};

// Points functions
window.addPoints = async function() {
    if (!state.editingUser) return;
    
    const amount = parseInt(utils.getElement('pointsAmount').value) || 0;
    const type = utils.getElement('pointType').value;
    const target = utils.getElement('pointTarget').value;
    const reason = utils.getElement('pointReason').value;
    
    if (amount <= 0) {
        utils.showToast('Please enter a valid amount', 'warning');
        return;
    }
    
    try {
        const multiplier = POINT_MULTIPLIERS[type] || 1;
        const actualPoints = amount * multiplier;
        
        const pointsHistory = state.editingUser.pointsHistory || [];
        pointsHistory.push({
            amount: actualPoints,
            type,
            target,
            reason,
            timestamp: new Date().toISOString(),
            awardedBy: 'admin'
        });
        
        const updates = { pointsHistory };
        
        if (target === 'individual' || target === 'both') {
            updates.individualPoints = (state.editingUser.individualPoints || 0) + actualPoints;
        }
        if (target === 'team' || target === 'both') {
            updates.teamPoints = (state.editingUser.teamPoints || 0) + actualPoints;
        }
        
        await updateDoc(doc(db, 'users', state.editingUser.id), updates);
        
        utils.showToast(`Awarded ${actualPoints} points!`, 'success');
        
        // Clear form
        utils.clearForm(['pointsAmount', 'pointReason']);
        
        // Reload user data
        await dataManager.loadUsers();
        showEditUser(state.editingUser.id);
        displays.points();
        
    } catch (error) {
        console.error('Error adding points:', error);
        utils.showToast('Error adding points', 'error');
    }
};

// Tool management functions
window.showCreateTool = function() {
    state.editingTool = null;
    utils.clearForm(['toolName', 'toolPrice', 'toolIcon', 'toolDescription']);
    utils.getElement('toolVisible').value = 'true';
    utils.getElement('toolDialogTitle').textContent = '🪤 Create Tool';
    utils.getElement('editingToolId').value = '';
    
    const dialog = utils.getElement('toolDialog');
    if (dialog) dialog.style.display = 'block';
};

window.hideToolDialog = function() {
    const dialog = utils.getElement('toolDialog');
    if (dialog) dialog.style.display = 'none';
    state.editingTool = null;
};

window.saveTool = async function() {
    try {
        const toolData = {
            name: utils.getElement('toolName').value,
            price: parseInt(utils.getElement('toolPrice').value) || 0,
            icon: utils.getElement('toolIcon').value || '',
            description: utils.getElement('toolDescription').value || '',
            visible: utils.getElement('toolVisible').value === 'true'
        };
        
        if (!toolData.name || !toolData.price) {
            utils.showToast('Name and price are required', 'warning');
            return;
        }
        
        const editingId = utils.getElement('editingToolId').value;
        
        if (editingId) {
            // Update existing tool
            await updateDoc(doc(db, 'tools', editingId), toolData);
            utils.showToast('Tool updated!', 'success');
        } else {
            // Create new tool
            toolData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'tools'), toolData);
            utils.showToast('Tool created!', 'success');
        }
        
        hideToolDialog();
        
        // Reload tools
        await dataManager.loadTools();
        displays.tools();
        
    } catch (error) {
        console.error('Error saving tool:', error);
        utils.showToast('Error saving tool', 'error');
    }
};

window.giveTool = async function(userId, toolId) {
    const user = state.allUsers.find(u => u.id === userId);
    const tool = state.allTools.find(t => t.id === toolId);
    
    if (!user || !tool) return;
    
    // Check if user has enough credits
    const credit = utils.calculateCredit(user.transactions);
    if (credit < tool.price) {
        utils.showToast(`User needs ${tool.price - credit} more credits for this tool`, 'warning');
        return;
    }
    
    try {
        const tools = user.tools || [];
        tools.push({
            id: toolId,
            name: tool.name,
            price: tool.price,
            used: false,
            acquiredAt: new Date().toISOString()
        });
        
        const transactions = user.transactions || [];
        transactions.push({
            type: 'purchase',
            amount: tool.price,
            description: `Tool: ${tool.name}`,
            timestamp: new Date().toISOString()
        });
        
        await updateDoc(doc(db, 'users', userId), { tools, transactions });
        
        utils.showToast(`Gave ${tool.name} to user!`, 'success');
        
        // Reload user data
        await dataManager.loadUsers();
        showEditUser(userId);
        
    } catch (error) {
        console.error('Error giving tool:', error);
        utils.showToast('Error giving tool', 'error');
    }
};

// Search function
window.searchUsers = function() {
    const query = utils.getElement('searchUsers').value.toLowerCase();
    const tbody = utils.getElement('usersTableBody');
    
    if (!query) {
        displays.users();
        return;
    }
    
    const filtered = state.allUsers.filter(user => 
        user.handle?.toLowerCase().includes(query) ||
        user.id?.toLowerCase().includes(query) ||
        user.characterName?.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">no matches found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(user => {
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
                    <button class="button small" onclick="showEditUser('${user.id}')">edit</button>
                    <button class="button small warning" onclick="userActions.delete('${user.id}')">remove</button>
                </td>
            </tr>
        `;
    }).join('');
};

// Quick message functions
window.quickMsg = function(message) {
    const messageField = utils.getElement('editUserMessage');
    if (messageField) messageField.value = message;
};

// ============================================
// ACTION HANDLERS
// ============================================

const userActions = {
    edit(userId) {
        showEditUser(userId);
    },

    async delete(userId) {
        if (!confirm('Delete this user? This cannot be undone!')) return;
        
        try {
            await deleteDoc(doc(db, 'users', userId));
            utils.showToast('User deleted', 'success');
            
            await dataManager.loadUsers();
            displays.users();
        } catch (error) {
            console.error('Error deleting user:', error);
            utils.showToast('Error deleting user', 'error');
        }
    }
};

const toolActions = {
    edit(toolId) {
        const tool = state.allTools.find(t => t.id === toolId);
        if (!tool) return;
        
        state.editingTool = tool;
        
        utils.getElement('toolName').value = tool.name;
        utils.getElement('toolPrice').value = tool.price;
        utils.getElement('toolIcon').value = tool.icon || '';
        utils.getElement('toolDescription').value = tool.description || '';
        utils.getElement('toolVisible').value = tool.visible !== false ? 'true' : 'false';
        utils.getElement('toolDialogTitle').textContent = '🔧 Edit Tool';
        utils.getElement('editingToolId').value = toolId;
        
        const dialog = utils.getElement('toolDialog');
        if (dialog) dialog.style.display = 'block';
    },

    async toggleVisibility(toolId) {
        const tool = state.allTools.find(t => t.id === toolId);
        if (!tool) return;
        
        try {
            await updateDoc(doc(db, 'tools', toolId), {
                visible: tool.visible === false
            });
            
            utils.showToast('Tool visibility updated', 'success');
            await dataManager.loadTools();
            displays.tools();
            
        } catch (error) {
            console.error('Error updating tool:', error);
            utils.showToast('Error updating tool', 'error');
        }
    },

    async delete(toolId) {
        if (!confirm('Delete this tool?')) return;
        
        try {
            await deleteDoc(doc(db, 'tools', toolId));
            utils.showToast('Tool deleted', 'success');
            
            await dataManager.loadTools();
            displays.tools();
        } catch (error) {
            console.error('Error deleting tool:', error);
            utils.showToast('Error deleting tool', 'error');
        }
    }
};

const pendingActions = {
    async approve(requestId) {
        try {
            const snapshot = await getDoc(doc(db, 'pendingSelections', requestId));
            if (!snapshot.exists()) {
                utils.showToast('Request not found', 'error');
                return;
            }
            
            const request = snapshot.data();
            
            // Create new user
            const newUser = {
                handle: request.handle,
                accessCode: request.accessCode,
                characterId: request.characterId,
                characterName: request.characterName,
                tools: request.tools || [],
                transactions: [{
                    type: 'purchase',
                    amount: 25 + (request.tools?.reduce((sum, t) => sum + t.price * (t.quantity || 1), 0) || 0),
                    description: 'Initial registration and tools',
                    timestamp: new Date().toISOString()
                }],
                individualPoints: 0,
                teamPoints: 0,
                status: 'active',
                createdAt: new Date().toISOString()
            };
            
            // Add user to database
            await setDoc(doc(db, 'users', request.accessCode), newUser);
            
            // Update character availability
            if (request.characterId) {
                await updateDoc(doc(db, 'characters', request.characterId), {
                    available: false,
                    ownerId: request.handle
                });
            }
            
            // Delete pending request
            await deleteDoc(doc(db, 'pendingSelections', requestId));
            
            utils.showToast('Request approved! 🎉', 'success');
            
            // Reload data
            await Promise.all([
                dataManager.loadUsers(),
                dataManager.loadCharacters()
            ]);
            displays.pending();
            
        } catch (error) {
            console.error('Error approving request:', error);
            utils.showToast('Error approving request', 'error');
        }
    },

    async markPaid(requestId, amount) {
        try {
            const snapshot = await getDoc(doc(db, 'pendingSelections', requestId));
            if (!snapshot.exists()) {
                utils.showToast('Request not found', 'error');
                return;
            }
            
            const request = snapshot.data();
            const currentCredit = request.currentCredit || 0;
            
            await updateDoc(doc(db, 'pendingSelections', requestId), {
                currentCredit: currentCredit + amount,
                lastPayment: new Date().toISOString()
            });
            
            utils.showToast('Payment marked!', 'success');
            displays.pending();
            
        } catch (error) {
            console.error('Error marking payment:', error);
            utils.showToast('Error marking payment', 'error');
        }
    },

    async reject(requestId) {
        if (!confirm('Reject this request?')) return;
        
        try {
            await deleteDoc(doc(db, 'pendingSelections', requestId));
            utils.showToast('Request rejected', 'warning');
            displays.pending();
            
        } catch (error) {
            console.error('Error rejecting request:', error);
            utils.showToast('Error rejecting request', 'error');
        }
    }
};

// Make action handlers globally available
window.userActions = userActions;
window.toolActions = toolActions;
window.pendingActions = pendingActions;
