// admin-modular.js - SIMPLIFIED & FIXED VERSION

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
    onSnapshot,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// ============================================
// FIREBASE SETUP
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

// ============================================
// GLOBAL STATE
// ============================================
const state = {
    isAuthenticated: false,
    users: [],
    teams: [],
    tools: [],
    characters: [],
    pendingSelections: [],
    currentEditUser: null,
    currentEditTool: null,
    activeWindows: new Set(),
    minimizedWindows: new Set()
};

// ============================================
// AUTHENTICATION
// ============================================
window.adminLogin = function() {
    const password = document.getElementById('adminPassword').value;
    
    // Simple password check - you should use proper auth in production
    if (password === 'olympics2') {
        state.isAuthenticated = true;
        sessionStorage.setItem('adminAuth', 'true');
        document.getElementById('loginWindow').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        initializeAdmin();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
};

window.adminLogout = function() {
    sessionStorage.removeItem('adminAuth');
    location.reload();
};

// ============================================
// INITIALIZATION
// ============================================
async function initializeAdmin() {
    console.log('Initializing admin panel...');
    
    // Update clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Load all data
    await loadAllData();
    
    // Setup real-time listeners
    setupRealtimeListeners();
    
    // Open dashboard by default
    openWindow('dashboard');
}

function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    document.getElementById('clock').textContent = time;
}

// ============================================
// DATA LOADING
// ============================================
async function loadAllData() {
    try {
        await Promise.all([
            loadUsers(),
            loadTeams(),
            loadTools(),
            loadCharacters(),
            loadPendingSelections()
        ]);
        
        updateDashboard();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data', 'error');
    }
}

async function loadUsers() {
    const snapshot = await getDocs(collection(db, 'users'));
    state.users = [];
    snapshot.forEach(doc => {
        state.users.push({ id: doc.id, ...doc.data() });
    });
    console.log('Loaded users:', state.users.length);
}

async function loadTeams() {
    // For now, hardcoded teams
    state.teams = [
        { id: 'HOT', name: 'HOT', color: '#ff6600' },
        { id: 'COLD', name: 'COLD', color: '#0099ff' }
    ];
}

async function loadTools() {
    const snapshot = await getDocs(collection(db, 'tools'));
    state.tools = [];
    snapshot.forEach(doc => {
        state.tools.push({ id: doc.id, ...doc.data() });
    });
    console.log('Loaded tools:', state.tools.length);
}

async function loadCharacters() {
    const snapshot = await getDocs(collection(db, 'characters'));
    state.characters = [];
    snapshot.forEach(doc => {
        state.characters.push({ id: doc.id, ...doc.data() });
    });
    console.log('Loaded characters:', state.characters.length);
}

async function loadPendingSelections() {
    const snapshot = await getDocs(collection(db, 'pendingSelections'));
    state.pendingSelections = [];
    snapshot.forEach(doc => {
        state.pendingSelections.push({ id: doc.id, ...doc.data() });
    });
    console.log('Loaded pending:', state.pendingSelections.length);
}

// ============================================
// REALTIME LISTENERS
// ============================================
function setupRealtimeListeners() {
    // Listen for pending selections
    onSnapshot(collection(db, 'pendingSelections'), (snapshot) => {
        state.pendingSelections = [];
        snapshot.forEach(doc => {
            state.pendingSelections.push({ id: doc.id, ...doc.data() });
        });
        updatePendingCount();
        updatePendingList();
    });
    
    // Listen for user changes
    onSnapshot(collection(db, 'users'), (snapshot) => {
        state.users = [];
        snapshot.forEach(doc => {
            state.users.push({ id: doc.id, ...doc.data() });
        });
        updateUsersTable();
        updateDashboard();
    });
}

// ============================================
// DASHBOARD
// ============================================
function updateDashboard() {
    // Calculate stats
    const totalUsers = state.users.length;
    const activeUsers = state.users.filter(u => u.status === 'active').length;
    const totalRevenue = state.users.reduce((sum, u) => {
        const credits = calculateCredits(u.transactions || []);
        return sum + Math.max(0, credits);
    }, 0);
    const totalCredit = state.users.reduce((sum, u) => {
        const credits = calculateCredits(u.transactions || []);
        return sum + credits;
    }, 0);
    const totalPoints = state.users.reduce((sum, u) => 
        sum + (u.individualPoints || 0) + (u.teamPoints || 0), 0);
    
    // Update display
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('totalRevenue').textContent = '$' + totalRevenue;
    document.getElementById('totalCredit').textContent = totalCredit;
    document.getElementById('totalPending').textContent = state.pendingSelections.length;
    document.getElementById('totalPoints').textContent = totalPoints;
    
    // Update activity
    updateRecentActivity();
}

function updateRecentActivity() {
    const activityList = document.getElementById('activityList');
    
    // Get recent pending selections
    const recent = state.pendingSelections.slice(0, 5);
    
    if (recent.length === 0) {
        activityList.innerHTML = '<p style="color: #666;">No recent activity</p>';
        return;
    }
    
    activityList.innerHTML = recent.map(p => `
        <div style="padding: 8px; background: #f0f0f0; margin: 5px 0; border-radius: 4px;">
            <strong>@${p.handle || p.accessCode}</strong> - 
            ${p.characterName || 'Character selection'} - 
            ${p.totalCost > 0 ? `$${p.totalCost} pending` : 'Ready to approve'}
        </div>
    `).join('');
}

// ============================================
// USERS MANAGEMENT
// ============================================
function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    if (state.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">No users yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = state.users.map(user => {
        const credits = calculateCredits(user.transactions || []);
        const toolCount = (user.tools || []).length;
        
        return `
            <tr>
                <td>@${user.handle || user.id}</td>
                <td>${user.id}</td>
                <td>${user.characterName || '-'}</td>
                <td><span class="status-${user.status || 'active'}">${(user.status || 'active').toUpperCase()}</span></td>
                <td><span class="team-${(user.team || 'none').toLowerCase()}">${user.team || '-'}</span></td>
                <td>${credits}</td>
                <td>${user.individualPoints || 0}</td>
                <td>${user.teamPoints || 0}</td>
                <td>${toolCount}</td>
                <td>
                    <button class="button small" onclick="editUser('${user.id}')">edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.searchUsers = function() {
    const search = document.getElementById('searchUsers').value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableBody tr');
    
    rows.forEach(row => {
        const handle = row.cells[0].textContent.toLowerCase();
        row.style.display = handle.includes(search) ? '' : 'none';
    });
};

// ============================================
// USER CRUD
// ============================================
window.showCreateUser = function() {
    document.getElementById('createUserDialog').style.display = 'block';
    
    // Populate dropdowns
    const charSelect = document.getElementById('newCharacter');
    charSelect.innerHTML = '<option value="">-- pick later --</option>' +
        state.characters
            .filter(c => c.available)
            .map(c => `<option value="${c.id}">${c.name}</option>`)
            .join('');
    
    const teamSelect = document.getElementById('newTeam');
    teamSelect.innerHTML = '<option value="">unassigned</option>' +
        state.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
};

window.hideCreateUser = function() {
    document.getElementById('createUserDialog').style.display = 'none';
};

window.createUser = async function() {
    const accessCode = document.getElementById('newAccessCode').value.toUpperCase();
    const handle = document.getElementById('newHandle').value;
    const email = document.getElementById('newEmail').value;
    const characterId = document.getElementById('newCharacter').value;
    const team = document.getElementById('newTeam').value;
    const payment = parseInt(document.getElementById('newPayment').value) || 0;
    const note = document.getElementById('newUserNote').value;
    
    if (!accessCode || !handle) {
        showToast('Access code and handle are required!', 'error');
        return;
    }
    
    try {
        // Check if code exists
        const existing = await getDoc(doc(db, 'users', accessCode));
        if (existing.exists()) {
            showToast('Access code already exists!', 'error');
            return;
        }
        
        // Get character info
        let characterData = {};
        if (characterId) {
            const char = state.characters.find(c => c.id === characterId);
            if (char) {
                characterData = {
                    characterId: characterId,
                    characterName: char.name,
                    characterShow: char.show || ''
                };
            }
        }
        
        // Create user data
        const userData = {
            accessCode,
            handle: handle.replace('@', ''),
            email: email || '',
            team: team || '',
            status: 'active',
            individualPoints: 0,
            teamPoints: 0,
            tools: [],
            transactions: payment > 0 ? [{
                type: 'payment',
                amount: payment,
                note: 'Initial payment',
                timestamp: new Date().toISOString()
            }] : [],
            moderatorNote: note || '',
            createdAt: new Date().toISOString(),
            ...characterData
        };
        
        // If they paid enough for game pass, give it to them
        if (payment >= 25) {
            userData.tools.push({
                name: 'GAME PASS',
                price: 25,
                used: false
            });
            userData.transactions.push({
                type: 'purchase',
                amount: 25,
                note: 'Game Pass (auto)',
                timestamp: new Date().toISOString()
            });
        }
        
        // Save to Firebase
        await setDoc(doc(db, 'users', accessCode), userData);
        
        // Update character availability if selected
        if (characterId) {
            await updateDoc(doc(db, 'characters', characterId), {
                available: false,
                ownerId: accessCode
            });
        }
        
        showToast(`Player @${handle} created successfully!`, 'success');
        hideCreateUser();
        await loadAllData();
        
    } catch (error) {
        console.error('Error creating user:', error);
        showToast('Error creating user', 'error');
    }
};

window.editUser = async function(userId) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    
    state.currentEditUser = user;
    
    // Populate edit form
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserHandle').textContent = user.handle || user.id;
    document.getElementById('editHandle').value = user.handle || '';
    document.getElementById('editStatus').value = user.status || 'active';
    
    // Populate character dropdown
    const charSelect = document.getElementById('editCharacter');
    charSelect.innerHTML = '<option value="">-- none --</option>' +
        state.characters.map(c => 
            `<option value="${c.id}" ${c.id === user.characterId ? 'selected' : ''}>${c.name}</option>`
        ).join('');
    
    // Show credit info
    const credits = calculateCredits(user.transactions || []);
    updateUserCreditDisplay(credits);
    
    // Show tools
    updateUserToolsList(user.tools || []);
    
    // Show points
    document.getElementById('userIndPoints').textContent = user.individualPoints || 0;
    document.getElementById('userTeamPoints').textContent = user.teamPoints || 0;
    
    // Show team
    const teamSelect = document.getElementById('editUserTeam');
    teamSelect.innerHTML = '<option value="">unassigned</option>' +
        state.teams.map(t => 
            `<option value="${t.id}" ${t.id === user.team ? 'selected' : ''}>${t.name}</option>`
        ).join('');
    
    // Show dialog
    document.getElementById('editUserDialog').style.display = 'block';
    switchEditTab('info');
};

window.hideEditUser = function() {
    document.getElementById('editUserDialog').style.display = 'none';
    state.currentEditUser = null;
};

window.saveUserEdit = async function() {
    if (!state.currentEditUser) return;
    
    try {
        const updates = {
            handle: document.getElementById('editHandle').value,
            status: document.getElementById('editStatus').value,
            characterId: document.getElementById('editCharacter').value,
            team: document.getElementById('editUserTeam').value,
            moderatorNote: document.getElementById('editUserMessage').value
        };
        
        // Get character info if changed
        if (updates.characterId) {
            const char = state.characters.find(c => c.id === updates.characterId);
            if (char) {
                updates.characterName = char.name;
                updates.characterShow = char.show || '';
            }
        }
        
        await updateDoc(doc(db, 'users', state.currentEditUser.id), updates);
        
        showToast('User updated successfully!', 'success');
        hideEditUser();
        await loadAllData();
        
    } catch (error) {
        console.error('Error updating user:', error);
        showToast('Error updating user', 'error');
    }
};

// ============================================
// CREDITS & TRANSACTIONS
// ============================================
function calculateCredits(transactions) {
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
}

function updateUserCreditDisplay(credits) {
    const display = document.getElementById('userCreditDisplay');
    display.textContent = `current credits: ${credits}`;
    display.className = credits > 0 ? 'credit-display credit-positive' :
                       credits < 0 ? 'credit-display credit-negative' :
                       'credit-display credit-zero';
}

window.quickAddCredits = async function(amount, isGift) {
    if (!state.currentEditUser) return;
    
    try {
        const transaction = {
            type: isGift ? 'gift' : 'payment',
            amount: amount,
            note: isGift ? 'Gifted by admin' : 'Payment received',
            timestamp: new Date().toISOString()
        };
        
        const user = state.currentEditUser;
        const transactions = [...(user.transactions || []), transaction];
        
        await updateDoc(doc(db, 'users', user.id), { transactions });
        
        // Refresh user data
        const updated = await getDoc(doc(db, 'users', user.id));
        state.currentEditUser = { id: user.id, ...updated.data() };
        
        const newCredits = calculateCredits(transactions);
        updateUserCreditDisplay(newCredits);
        
        showToast(`Added ${amount} credits${isGift ? ' (gift)' : ''}`, 'success');
        
    } catch (error) {
        console.error('Error adding credits:', error);
        showToast('Error adding credits', 'error');
    }
};

// ============================================
// PENDING SELECTIONS
// ============================================
function updatePendingCount() {
    document.getElementById('totalPending').textContent = state.pendingSelections.length;
    document.getElementById('pendingCount').textContent = state.pendingSelections.length;
    
    // Update desktop icon badge
    const pendingIcon = document.querySelector('.desktop-icon:nth-child(8)');
    if (pendingIcon) {
        let badge = pendingIcon.querySelector('.notification-badge');
        if (state.pendingSelections.length > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'notification-badge';
                pendingIcon.appendChild(badge);
            }
            badge.textContent = state.pendingSelections.length;
        } else if (badge) {
            badge.remove();
        }
    }
}

function updatePendingList() {
    const list = document.getElementById('pendingList');
    
    if (state.pendingSelections.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #666;">no pending requests! 🎉</p>';
        return;
    }
    
    list.innerHTML = state.pendingSelections.map(p => `
        <div class="pending-request">
            <div class="pending-request-header">
                <strong>@${p.handle || p.accessCode}</strong>
                <span>${new Date(p.submittedAt || p.timestamp).toLocaleString()}</span>
            </div>
            <div class="pending-request-info">
                ${p.characterName ? `
                    <div class="info-row">
                        <span class="label">Character:</span>
                        <span class="value">${p.characterName}</span>
                    </div>
                ` : ''}
                ${p.tools && p.tools.length > 0 ? `
                    <div class="info-row">
                        <span class="label">Tools:</span>
                        <span class="value">${p.tools.map(t => t.name).join(', ')}</span>
                    </div>
                ` : ''}
                <div class="info-row">
                    <span class="label">Total Cost:</span>
                    <span class="value" style="color: ${p.totalCost > 0 ? '#ff0000' : '#00cc00'}">
                        ${p.totalCost > 0 ? '$' + p.totalCost + ' needed' : 'Paid!'}
                    </span>
                </div>
            </div>
            <div class="pending-request-actions">
                <button class="button primary small" onclick="approvePending('${p.id}')">approve ✓</button>
                <button class="button warning small" onclick="rejectPending('${p.id}')">reject ×</button>
            </div>
        </div>
    `).join('');
}

window.approvePending = async function(pendingId) {
    const pending = state.pendingSelections.find(p => p.id === pendingId);
    if (!pending) return;
    
    try {
        // Get user
        const userDoc = await getDoc(doc(db, 'users', pending.accessCode));
        if (!userDoc.exists()) {
            showToast('User not found!', 'error');
            return;
        }
        
        const userData = userDoc.data();
        const updates = {};
        
        // Add character if selected
        if (pending.characterId) {
            updates.characterId = pending.characterId;
            updates.characterName = pending.characterName;
            
            // Mark character as taken
            await updateDoc(doc(db, 'characters', pending.characterId), {
                available: false,
                ownerId: pending.accessCode
            });
        }
        
        // Add tools
        if (pending.tools && pending.tools.length > 0) {
            const currentTools = userData.tools || [];
            updates.tools = [...currentTools, ...pending.tools];
            
            // Add purchase transaction
            const transactions = userData.transactions || [];
            transactions.push({
                type: 'purchase',
                amount: pending.toolsCost || 0,
                note: `Purchased: ${pending.tools.map(t => t.name).join(', ')}`,
                timestamp: new Date().toISOString()
            });
            updates.transactions = transactions;
        }
        
        // Update user
        await updateDoc(doc(db, 'users', pending.accessCode), updates);
        
        // Delete pending selection
        await deleteDoc(doc(db, 'pendingSelections', pendingId));
        
        showToast(`Approved @${pending.handle}!`, 'success');
        await loadAllData();
        
    } catch (error) {
        console.error('Error approving:', error);
        showToast('Error approving request', 'error');
    }
};

window.rejectPending = async function(pendingId) {
    if (!confirm('Reject this request?')) return;
    
    try {
        await deleteDoc(doc(db, 'pendingSelections', pendingId));
        showToast('Request rejected', 'warning');
        await loadAllData();
    } catch (error) {
        console.error('Error rejecting:', error);
        showToast('Error rejecting request', 'error');
    }
};

// ============================================
// WINDOW MANAGEMENT
// ============================================
window.openWindow = function(windowId) {
    const win = document.getElementById(`window-${windowId}`);
    if (!win) return;
    
    // Show window
    win.style.display = 'block';
    state.activeWindows.add(windowId);
    
    // Remove from minimized
    state.minimizedWindows.delete(windowId);
    updateMinimizedBar();
    
    // Bring to front
    bringToFront(win);
    
    // Load content if needed
    if (windowId === 'users') updateUsersTable();
    if (windowId === 'pending') updatePendingList();
    if (windowId === 'characters') updateCharactersGrid();
    if (windowId === 'tools') updateToolsList();
};

window.closeWindow = function(windowId) {
    const win = document.getElementById(`window-${windowId}`);
    if (win) win.style.display = 'none';
    state.activeWindows.delete(windowId);
    state.minimizedWindows.delete(windowId);
    updateMinimizedBar();
};

window.minimizeWindow = function(windowId) {
    const win = document.getElementById(`window-${windowId}`);
    if (win) win.style.display = 'none';
    state.minimizedWindows.add(windowId);
    updateMinimizedBar();
};

window.maximizeWindow = function(windowId) {
    const win = document.getElementById(`window-${windowId}`);
    if (win) win.classList.toggle('maximized');
};

function updateMinimizedBar() {
    const bar = document.getElementById('minimizedBar');
    bar.innerHTML = Array.from(state.minimizedWindows).map(id => `
        <div class="minimized-window" onclick="openWindow('${id}')">
            ${id.charAt(0).toUpperCase() + id.slice(1)}
        </div>
    `).join('');
}

function bringToFront(element) {
    const windows = document.querySelectorAll('.window');
    windows.forEach(w => w.style.zIndex = '100');
    element.style.zIndex = '200';
}

// ============================================
// UI HELPERS
// ============================================
window.switchEditTab = function(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(`edit-${tab}-tab`).style.display = 'block';
    event.target.classList.add('active');
};

window.showToast = function(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

function updateCharactersGrid() {
    const grid = document.getElementById('charactersGrid');
    const available = state.characters.filter(c => c.available).length;
    const taken = state.characters.filter(c => !c.available).length;
    
    document.getElementById('availableChars').textContent = available;
    document.getElementById('takenChars').textContent = taken;
    
    grid.innerHTML = state.characters.map(c => `
        <div class="character-card ${!c.available ? 'taken' : ''}">
            <div class="character-name">${c.name}</div>
            <div class="character-show">${c.show || 'Unknown'}</div>
            <div class="character-status ${c.available ? 'available' : 'taken'}">
                ${c.available ? 'AVAILABLE' : `TAKEN by @${c.ownerId || 'unknown'}`}
            </div>
        </div>
    `).join('');
}

function updateToolsList() {
    const list = document.getElementById('toolsList');
    
    list.innerHTML = state.tools.map(tool => `
        <div class="tool-item ${tool.visible === false ? 'hidden' : ''}">
            <div class="tool-info">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-description">${tool.description || 'No description'}</div>
            </div>
            <div class="tool-price">${tool.price} credits</div>
            <button class="button small" onclick="editTool('${tool.id}')">edit</button>
        </div>
    `).join('');
}

function updateUserToolsList(tools) {
    const list = document.getElementById('userToolsList');
    
    if (!tools || tools.length === 0) {
        list.innerHTML = '<p style="color: #666;">No tools yet</p>';
        return;
    }
    
    list.innerHTML = tools.map(tool => `
        <div class="tool-tag ${tool.used ? 'used' : ''}">
            ${tool.name} ${tool.used ? '(USED)' : ''}
        </div>
    `).join('');
}

// ============================================
// TAB HANDLERS
// ============================================
window.quickMsg = function(msg) {
    document.getElementById('editUserMessage').value = msg;
};

window.quickAdjustPoints = async function(type, amount) {
    if (!state.currentEditUser) return;
    
    try {
        const user = state.currentEditUser;
        const field = type === 'individual' ? 'individualPoints' : 'teamPoints';
        const current = user[field] || 0;
        const newValue = Math.max(0, current + amount);
        
        await updateDoc(doc(db, 'users', user.id), {
            [field]: newValue
        });
        
        document.getElementById(type === 'individual' ? 'userIndPoints' : 'userTeamPoints')
            .textContent = newValue;
        
        showToast(`${type} points ${amount > 0 ? 'added' : 'removed'}!`, 'success');
        
    } catch (error) {
        console.error('Error adjusting points:', error);
        showToast('Error adjusting points', 'error');
    }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Check if already authenticated
    if (sessionStorage.getItem('adminAuth') === 'true') {
        state.isAuthenticated = true;
        document.getElementById('loginWindow').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        initializeAdmin();
    }
    
    // Setup window dragging
    setupWindowDragging();
});

// ============================================
// WINDOW DRAGGING
// ============================================
function setupWindowDragging() {
    const windows = document.querySelectorAll('.window.draggable');
    
    windows.forEach(win => {
        const header = win.querySelector('.window-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        function dragStart(e) {
            if (e.target.closest('.window-controls')) return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === header || e.target.parentNode === header) {
                isDragging = true;
                bringToFront(win);
            }
        }
        
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                xOffset = currentX;
                yOffset = currentY;
                
                win.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }
        
        function dragEnd() {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }
    });
}

// Export for debugging
window.adminState = state;