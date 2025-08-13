// admin.js - INTERNET OLYMPICS 2 Admin Panel

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    onSnapshot,
    query,
    where,
    writeBatch
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

// Admin App Module
const AdminApp = {
    // State
    state: {
        users: [],
        characters: [],
        tools: [],
        teamWallets: {
            HOT: 0,
            COLD: 0
        },
        activeWindows: [],
        currentEditUser: null,
        listeners: []
    },

    // Initialize
    init() {
        console.log('Initializing Admin Panel...');
        this.setupLogin();
        this.setupEventHandlers();
    },

    // Login System
    setupLogin() {
        const loginBtn = document.getElementById('loginBtn');
        const passwordInput = document.getElementById('adminPassword');
        
        const doLogin = () => {
            const password = passwordInput.value;
            
            if (password === 'admin123') {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('desktop').style.display = 'block';
                this.initializeAdmin();
            } else {
                const error = document.getElementById('loginError');
                error.style.display = 'block';
                setTimeout(() => {
                    error.style.display = 'none';
                }, 3000);
            }
        };
        
        loginBtn.onclick = doLogin;
        passwordInput.onkeypress = (e) => {
            if (e.key === 'Enter') doLogin();
        };
    },

    // Initialize Admin Panel
    async initializeAdmin() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        
        await this.loadAllData();
        this.setupListeners();
        this.openWindow('dashboard');
        
        console.log('Admin panel ready!');
    },

    // Load Data
    async loadAllData() {
        // Load users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        this.state.users = [];
        usersSnapshot.forEach(doc => {
            this.state.users.push({ id: doc.id, ...doc.data() });
        });
        
        // Load characters
        const charactersSnapshot = await getDocs(collection(db, 'characters'));
        this.state.characters = [];
        charactersSnapshot.forEach(doc => {
            this.state.characters.push({ id: doc.id, ...doc.data() });
        });
        
        // Load tools
        const toolsSnapshot = await getDocs(collection(db, 'tools'));
        this.state.tools = [];
        toolsSnapshot.forEach(doc => {
            this.state.tools.push({ id: doc.id, ...doc.data() });
        });
        
        // Load team wallets
        const teamWalletsDoc = await getDoc(doc(db, 'gameState', 'teamWallets'));
        if (teamWalletsDoc.exists()) {
            this.state.teamWallets = teamWalletsDoc.data();
        } else {
            await setDoc(doc(db, 'gameState', 'teamWallets'), {
                HOT: 0,
                COLD: 0
            });
        }
        
        this.updateDashboard();
        this.updateUsersTable();
        this.updateToolsGrid();
        this.updatePointsSelects();
        this.updateWalletDisplays();
    },

    // Setup Event Handlers
    setupEventHandlers() {
        // Desktop icons
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            icon.onclick = () => {
                const windowName = icon.getAttribute('data-window');
                const action = icon.getAttribute('data-action');
                
                if (windowName) {
                    this.openWindow(windowName);
                } else if (action === 'logout') {
                    this.logout();
                }
            };
        });

        // Window controls
        document.querySelectorAll('.window-btn').forEach(btn => {
            btn.onclick = () => {
                const action = btn.getAttribute('data-action');
                const windowId = btn.getAttribute('data-window');
                
                if (action === 'close') {
                    this.closeWindow(windowId);
                } else if (action === 'minimize') {
                    this.minimizeWindow(windowId);
                }
            };
        });

        // Make windows draggable
        this.setupDraggableWindows();
    },

    // Window Management
    openWindow(windowName) {
        const window = document.getElementById(`window-${windowName}`);
        if (window) {
            // Close other windows
            document.querySelectorAll('.window').forEach(w => {
                w.classList.remove('active');
            });
            
            window.classList.add('active');
            
            // Update taskbar
            this.updateTaskbar();
        }
    },

    closeWindow(windowName) {
        const window = document.getElementById(`window-${windowName}`);
        if (window) {
            window.classList.remove('active');
            this.updateTaskbar();
        }
    },

    minimizeWindow(windowName) {
        this.closeWindow(windowName);
    },

    updateTaskbar() {
        const taskbarWindows = document.getElementById('taskbarWindows');
        const activeWindows = document.querySelectorAll('.window.active');
        
        taskbarWindows.innerHTML = Array.from(activeWindows).map(window => {
            const title = window.querySelector('.window-header span').textContent;
            return `<div class="taskbar-window active">${title}</div>`;
        }).join('');
    },

    setupDraggableWindows() {
        document.querySelectorAll('.window-header').forEach(header => {
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;
            
            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('window-btn')) return;
                
                const window = header.parentElement;
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                
                if (e.target === header || e.target.tagName === 'SPAN') {
                    isDragging = true;
                }
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    
                    xOffset = currentX;
                    yOffset = currentY;
                    
                    const window = header.parentElement;
                    window.style.transform = `translate(${currentX}px, ${currentY}px)`;
                }
            });
            
            document.addEventListener('mouseup', () => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            });
        });
    },

    // Dashboard Functions
    updateDashboard() {
        const totalPlayers = this.state.users.length;
        const activePlayers = this.state.users.filter(u => u.status === 'active').length;
        const totalCredits = this.state.users.reduce((sum, u) => sum + (u.credits || 0), 0);
        
        document.getElementById('totalPlayers').textContent = totalPlayers;
        document.getElementById('activePlayers').textContent = activePlayers;
        document.getElementById('totalCredits').textContent = totalCredits;
        document.getElementById('pendingCount').textContent = '0';
        
        // Update team wallets
        document.getElementById('hotTeamWallet').textContent = this.state.teamWallets.HOT || 0;
        document.getElementById('coldTeamWallet').textContent = this.state.teamWallets.COLD || 0;
        
        // Update badges
        const playerBadge = document.getElementById('playerCount');
        if (totalPlayers > 0) {
            playerBadge.textContent = totalPlayers;
            playerBadge.style.display = 'flex';
        }
    },

    // Users Management
    updateUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = this.state.users.map(user => {
            const toolCount = user.tools ? user.tools.length : 0;
            const availableTools = user.tools ? user.tools.filter(t => t.status !== 'used').length : 0;
            
            return `
                <tr>
                    <td>${user.id}</td>
                    <td>@${user.handle || '-'}</td>
                    <td>${user.characterName || '-'}</td>
                    <td><span class="${user.team ? `team-${user.team.toLowerCase()}` : ''}">${user.team || '-'}</span></td>
                    <td><span class="status-badge status-${user.status || 'active'}">${user.status || 'active'}</span></td>
                    <td>${user.credits || 0}</td>
                    <td>${user.individualPoints || 0}</td>
                    <td>${toolCount} (${availableTools} avail)</td>
                    <td class="action-buttons">
                        <button class="action-btn" onclick="AdminApp.editUser('${user.id}')">edit</button>
                        <button class="action-btn" onclick="AdminApp.deleteUser('${user.id}')">delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    editUser(userId) {
        const user = this.state.users.find(u => u.id === userId);
        if (!user) return;
        
        this.state.currentEditUser = userId;
        
        document.getElementById('editAccessCode').value = user.id;
        document.getElementById('editHandle').value = user.handle || '';
        document.getElementById('editTeam').value = user.team || '';
        document.getElementById('editStatus').value = user.status || 'active';
        document.getElementById('editCredits').value = user.credits || 0;
        document.getElementById('editIndividualPoints').value = user.individualPoints || 0;
        
        // Populate character select
        const charSelect = document.getElementById('editCharacterSelect');
        const availableChars = this.state.characters.filter(c => c.available !== false || c.ownerId === userId);
        charSelect.innerHTML = '<option value="">None</option>' +
            availableChars.map(c => 
                `<option value="${c.id}" ${user.characterId === c.id ? 'selected' : ''}>${c.name || c.id}</option>`
            ).join('');
        
        // Display user's tools
        this.displayUserTools(user.tools || []);
        
        this.showModal('editUserModal');
    },

    displayUserTools(tools) {
        const container = document.getElementById('editUserTools');
        
        if (!tools || tools.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666;">No tools assigned</div>';
            return;
        }
        
        container.innerHTML = tools.map((tool, index) => `
            <div class="tool-item ${tool.status === 'used' ? 'used' : ''}">
                <div class="tool-status ${tool.status || 'available'}"></div>
                <img src="../assets/cast/${getToolIcon(tool.name)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\"%3E%3Crect width=\"48\" height=\"48\" fill=\"%23cccccc\"/%3E%3Ctext x=\"24\" y=\"28\" text-anchor=\"middle\" fill=\"%23666\" font-size=\"10\"%3E?%3C/text%3E%3C/svg%3E'" alt="${tool.name}">
                <div>${tool.name || 'Unknown'}</div>
                <div style="font-size: 9px;">${tool.status || 'available'}</div>
                <button class="action-btn" style="margin-top: 5px;" onclick="AdminApp.toggleToolStatus(${index})">toggle</button>
                <button class="action-btn" style="margin-top: 5px;" onclick="AdminApp.removeToolFromUser(${index})">remove</button>
            </div>
        `).join('');
    },

    toggleToolStatus(toolIndex) {
        const user = this.state.users.find(u => u.id === this.state.currentEditUser);
        if (!user || !user.tools || !user.tools[toolIndex]) return;
        
        const currentStatus = user.tools[toolIndex].status || 'available';
        user.tools[toolIndex].status = currentStatus === 'used' ? 'available' : 'used';
        
        this.displayUserTools(user.tools);
    },

    removeToolFromUser(toolIndex) {
        const user = this.state.users.find(u => u.id === this.state.currentEditUser);
        if (!user || !user.tools) return;
        
        user.tools.splice(toolIndex, 1);
        this.displayUserTools(user.tools);
    },

    showAssignToolModal() {
        const toolSelect = document.getElementById('assignToolSelect');
        toolSelect.innerHTML = '<option value="">Select tool...</option>' +
            this.state.tools.map(t => 
                `<option value="${t.id}" data-name="${t.name}" data-icon="${t.icon}">${t.name} (${t.price || 0} credits)</option>`
            ).join('');
        
        this.showModal('assignToolModal');
    },

    assignToolToUser() {
        const toolSelect = document.getElementById('assignToolSelect');
        const selectedOption = toolSelect.options[toolSelect.selectedIndex];
        
        if (!selectedOption.value) {
            this.showToast('Select a tool', 'error');
            return;
        }
        
        const user = this.state.users.find(u => u.id === this.state.currentEditUser);
        if (!user) return;
        
        if (!user.tools) user.tools = [];
        
        user.tools.push({
            toolId: selectedOption.value,
            name: selectedOption.dataset.name,
            icon: selectedOption.dataset.icon,
            status: document.getElementById('assignToolStatus').value,
            acquiredAt: new Date().toISOString()
        });
        
        this.displayUserTools(user.tools);
        this.closeModal('assignToolModal');
        this.showToast('Tool assigned', 'success');
    },

    // FIXED: Save User Edit Function
    async saveUserEdit() {
        if (!this.state.currentEditUser) return;
        
        const user = this.state.users.find(u => u.id === this.state.currentEditUser);
        if (!user) return;
        
        // Get the selected character
        const selectedCharacterId = document.getElementById('editCharacterSelect').value;
        const selectedCharacter = selectedCharacterId ? 
            this.state.characters.find(c => c.id === selectedCharacterId) : null;
        
        const updates = {
            handle: document.getElementById('editHandle').value,
            team: document.getElementById('editTeam').value,
            status: document.getElementById('editStatus').value,
            credits: parseInt(document.getElementById('editCredits').value) || 0,
            individualPoints: parseInt(document.getElementById('editIndividualPoints').value) || 0,
            tools: user.tools || []
        };
        
        // Only update character fields if a character is selected
        if (selectedCharacter) {
            updates.characterId = selectedCharacter.id;
            updates.characterName = selectedCharacter.name || null;
            updates.characterShow = selectedCharacter.show || null; // IMPORTANT: Add this field
        } else {
            // If no character selected, explicitly set to null
            updates.characterId = null;
            updates.characterName = null;
            updates.characterShow = null;
        }
        
        // IMPORTANT: Preserve existing fields that aren't being edited
        // Keep any existing moderatorNote if it exists
        if (user.moderatorNote) {
            updates.moderatorNote = user.moderatorNote;
        }
        
        // Keep any existing timestamp fields
        if (user.createdAt) {
            updates.createdAt = user.createdAt;
        }
        
        await updateDoc(doc(db, 'users', this.state.currentEditUser), updates);
        
        this.closeModal('editUserModal');
        this.showToast('Player updated successfully', 'success');
        this.loadAllData();
    },

    async deleteUser(userId) {
        if (confirm(`Delete player ${userId}?`)) {
            await deleteDoc(doc(db, 'users', userId));
            this.showToast('Player deleted', 'success');
            this.loadAllData();
        }
    },

    showAddUserModal() {
        document.getElementById('newAccessCode').value = '';
        document.getElementById('newHandle').value = '';
        document.getElementById('newCredits').value = '0';
        this.showModal('addUserModal');
    },

    // FIXED: Add New User Function
    async addNewUser() {
        const accessCode = document.getElementById('newAccessCode').value.toUpperCase();
        const handle = document.getElementById('newHandle').value;
        const credits = parseInt(document.getElementById('newCredits').value) || 0;
        
        if (!accessCode || !handle) {
            this.showToast('Access code and handle are required', 'error');
            return;
        }
        
        // Check if code already exists
        const existingUser = await getDoc(doc(db, 'users', accessCode));
        if (existingUser.exists()) {
            this.showToast('Access code already exists', 'error');
            return;
        }
        
        // Use setDoc for initial creation with ALL fields initialized
        const newUserData = {
            handle: handle,
            credits: credits,
            status: 'active',
            individualPoints: 0,
            tools: [],
            createdAt: new Date().toISOString(),
            // Initialize character fields as null
            characterId: null,
            characterName: null,
            characterShow: null,
            team: null,
            moderatorNote: null
        };
        
        await setDoc(doc(db, 'users', accessCode), newUserData);
        
        // If they paid $25 or more, give them the game pass
        if (credits >= 25) {
            const gamePassTool = this.state.tools.find(t => t.name === 'GAME PASS');
            if (gamePassTool) {
                // Use updateDoc here to avoid overwriting
                await updateDoc(doc(db, 'users', accessCode), {
                    tools: [{
                        toolId: gamePassTool.id,
                        name: 'GAME PASS',
                        icon: gamePassTool.icon,
                        status: 'available',
                        acquiredAt: new Date().toISOString()
                    }],
                    credits: credits - 25
                });
            }
        }
        
        this.closeModal('addUserModal');
        this.showToast('Player created successfully', 'success');
        this.loadAllData();
    },

    // NEW: Moderator Note Functions
    async sendModeratorNote(userId, note) {
        if (!userId || !note) {
            this.showToast('User ID and note are required', 'error');
            return;
        }
        
        // Use updateDoc to only update the moderatorNote field
        await updateDoc(doc(db, 'users', userId), {
            moderatorNote: note,
            moderatorNoteTimestamp: new Date().toISOString()
        });
        
        this.showToast('Moderator note sent', 'success');
        this.loadAllData();
    },

    async clearModeratorNote(userId) {
        if (!userId) return;
        
        await updateDoc(doc(db, 'users', userId), {
            moderatorNote: null,
            moderatorNoteTimestamp: null
        });
        
        this.showToast('Moderator note cleared', 'success');
        this.loadAllData();
    },

    // NEW: Recovery function to restore missing character data
    async recoverCharacterData() {
        console.log('Starting character data recovery...');
        
        // Define your character assignments here
        const characterAssignments = {
            // Example format:
            // 'USER_CODE': {
            //     characterId: 'character-id',
            //     characterName: 'Character Name',
            //     characterShow: 'Show Name'
            // },
            // Add your actual assignments here
        };
        
        const batch = writeBatch(db);
        let updateCount = 0;
        
        for (const [userId, charData] of Object.entries(characterAssignments)) {
            const userDoc = await getDoc(doc(db, 'users', userId));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Only update if character data is missing
                if (!userData.characterId || !userData.characterName || !userData.characterShow) {
                    const userRef = doc(db, 'users', userId);
                    batch.update(userRef, {
                        characterId: charData.characterId || userData.characterId || null,
                        characterName: charData.characterName || userData.characterName || null,
                        characterShow: charData.characterShow || userData.characterShow || null
                    });
                    updateCount++;
                    console.log(`Queued update for ${userId}`);
                }
            }
        }
        
        if (updateCount > 0) {
            await batch.commit();
            console.log(`Successfully recovered character data for ${updateCount} users`);
            this.showToast(`Recovered data for ${updateCount} users`, 'success');
            await this.loadAllData();
        } else {
            console.log('No users needed character data recovery');
            this.showToast('No recovery needed', 'info');
        }
    },

    // Wallet Management
    updateWalletDisplays() {
        document.getElementById('hotWalletBalance').textContent = this.state.teamWallets.HOT || 0;
        document.getElementById('coldWalletBalance').textContent = this.state.teamWallets.COLD || 0;
    },

    async updateTeamWallet(team) {
        const input = document.getElementById(`${team.toLowerCase()}WalletInput`);
        const action = document.getElementById(`${team.toLowerCase()}WalletAction`).value;
        const amount = parseInt(input.value) || 0;
        
        if (!amount && action !== 'set') {
            this.showToast('Enter an amount', 'error');
            return;
        }
        
        let newAmount = this.state.teamWallets[team] || 0;
        
        if (action === 'add') {
            newAmount += amount;
        } else if (action === 'subtract') {
            newAmount = Math.max(0, newAmount - amount);
        } else if (action === 'set') {
            newAmount = amount;
        } else if (action === 'distribute') {
            // Distribute points from team wallet to team members
            const teamMembers = this.state.users.filter(u => u.team === team);
            if (teamMembers.length === 0) {
                this.showToast(`No members in ${team} team`, 'error');
                return;
            }
            
            if (amount > newAmount) {
                this.showToast('Not enough points in wallet', 'error');
                return;
            }
            
            const pointsPerMember = Math.floor(amount / teamMembers.length);
            
            // Update each team member's individual points
            for (const member of teamMembers) {
                await updateDoc(doc(db, 'users', member.id), {
                    individualPoints: (member.individualPoints || 0) + pointsPerMember
                });
            }
            
            // Subtract from team wallet
            newAmount -= (pointsPerMember * teamMembers.length);
            
            this.showToast(`Distributed ${pointsPerMember} points to ${teamMembers.length} ${team} members`, 'success');
        }
        
        // Update team wallet in Firebase
        await updateDoc(doc(db, 'gameState', 'teamWallets'), {
            [team]: newAmount
        });
        
        // Clear input
        input.value = '';
        
        this.showToast(`${team} wallet updated`, 'success');
        await this.loadAllData();
    },

    async resetTeamWallets() {
        if (!confirm('Reset both team wallets to 0?')) return;
        
        await updateDoc(doc(db, 'gameState', 'teamWallets'), {
            HOT: 0,
            COLD: 0
        });
        
        this.showToast('Team wallets reset', 'success');
        this.loadAllData();
    },

    // Points Management
    updatePointsSelects() {
        const select = document.getElementById('pointsPlayerSelect');
        select.innerHTML = '<option value="">Select player...</option>' +
            this.state.users.map(u => 
                `<option value="${u.id}">@${u.handle || u.id}</option>`
            ).join('');
    },

    async updateIndividualPoints() {
        const userId = document.getElementById('pointsPlayerSelect').value;
        const points = parseInt(document.getElementById('individualPointsInput').value) || 0;
        const type = document.getElementById('pointsType').value;
        
        if (!userId) {
            this.showToast('Select a player', 'error');
            return;
        }
        
        const user = this.state.users.find(u => u.id === userId);
        if (!user) return;
        
        let newPoints = user.individualPoints || 0;
        
        if (type === 'add') {
            newPoints += points;
        } else if (type === 'subtract') {
            newPoints = Math.max(0, newPoints - points);
        } else if (type === 'set') {
            newPoints = points;
        }
        
        await updateDoc(doc(db, 'users', userId), {
            individualPoints: newPoints
        });
        
        this.showToast('Points updated!', 'success');
        this.loadAllData();
    },

    async resetAllPoints() {
        if (!confirm('Reset all individual points to 0?')) return;
        
        const updatePromises = this.state.users.map(user => 
            updateDoc(doc(db, 'users', user.id), { individualPoints: 0 })
        );
        
        await Promise.all(updatePromises);
        this.showToast('All individual points reset!', 'success');
        this.loadAllData();
    },

    async doubleAllPoints() {
        if (!confirm('Double all individual points?')) return;
        
        const updatePromises = this.state.users.map(user => 
            updateDoc(doc(db, 'users', user.id), { 
                individualPoints: (user.individualPoints || 0) * 2 
            })
        );
        
        await Promise.all(updatePromises);
        this.showToast('All individual points doubled!', 'success');
        this.loadAllData();
    },

    // Tools Management
    updateToolsGrid() {
        const grid = document.getElementById('toolsGrid');
        grid.innerHTML = this.state.tools.map(tool => `
            <div class="tool-card ${tool.visible === false ? 'hidden' : ''}" onclick="AdminApp.editTool('${tool.id}')">
                <img class="tool-image" src="../assets/cast/${getToolIcon(tool.name)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\"%3E%3Crect width=\"48\" height=\"48\" fill=\"%23cccccc\"/%3E%3Ctext x=\"24\" y=\"28\" text-anchor=\"middle\" fill=\"%23666\" font-size=\"10\"%3E?%3C/text%3E%3C/svg%3E'" alt="${tool.name}">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-price">${tool.price || 0} credits</div>
                ${tool.visible === false ? '<div style="color: red; font-size: 10px;">HIDDEN</div>' : ''}
            </div>
        `).join('');
    },

    async editTool(toolId) {
        const tool = this.state.tools.find(t => t.id === toolId);
        if (!tool) return;
        
        const newVisible = !tool.visible;
        await updateDoc(doc(db, 'tools', toolId), {
            visible: newVisible
        });
        
        this.showToast(`Tool ${newVisible ? 'shown' : 'hidden'}`, 'success');
        this.loadAllData();
    },

    showAddToolModal() {
        document.getElementById('newToolName').value = '';
        document.getElementById('newToolDesc').value = '';
        document.getElementById('newToolPrice').value = '25';
        document.getElementById('newToolImage').value = 'game-pass.png';
        document.getElementById('newToolVisible').value = 'true';
        this.showModal('addToolModal');
    },

    async addNewTool() {
        const name = document.getElementById('newToolName').value;
        const description = document.getElementById('newToolDesc').value;
        const price = parseInt(document.getElementById('newToolPrice').value) || 0;
        const image = document.getElementById('newToolImage').value;
        const visible = document.getElementById('newToolVisible').value === 'true';
        
        if (!name) {
            this.showToast('Tool name is required', 'error');
            return;
        }
        
        await addDoc(collection(db, 'tools'), {
            name: name,
            description: description,
            price: price,
            image: image,
            visible: visible,
            createdAt: new Date().toISOString()
        });
        
        this.closeModal('addToolModal');
        this.showToast('Tool created successfully', 'success');
        this.loadAllData();
    },

    // Tab Management
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');
    },

    // Modal Management
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // Utility Functions
    showToast(message, type = 'default') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('clock').textContent = `${hours}:${minutes}`;
    },

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            this.state.listeners.forEach(unsub => unsub());
            window.location.reload();
        }
    },

    // Real-time Listeners
    setupListeners() {
        // Listen to users collection
        const unsubUsers = onSnapshot(collection(db, 'users'), () => {
            this.loadAllData();
        });
        
        // Listen to team wallets
        const unsubWallets = onSnapshot(doc(db, 'gameState', 'teamWallets'), (doc) => {
            if (doc.exists()) {
                this.state.teamWallets = doc.data();
                this.updateWalletDisplays();
                this.updateDashboard();
            }
        });
        
        this.state.listeners.push(unsubUsers, unsubWallets);
    }
};

// Make AdminApp globally accessible
window.AdminApp = AdminApp;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    AdminApp.state.listeners.forEach(unsub => unsub());
});