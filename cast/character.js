// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    updateDoc,
    arrayUnion
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

console.log('Character.js loaded');

// Transaction types (matching admin.js)
const TRANSACTION_TYPES = {
    PAYMENT: 'payment',
    PURCHASE: 'purchase',
    ADJUSTMENT: 'adjustment',
    REFUND: 'refund',
    GIFT: 'gift'
};

// Global state management
const state = {
    characters: [],
    availableCharacters: [],
    currentIndex: 0,
    selectedWeapons: {},
    currentCharacter: null,
    currentAccessCode: null,
    currentUser: null,
    touchStartX: 0,
    touchEndX: 0,
    currentView: 'carousel',
    pendingSelectionId: null,
    allTools: [],
    approvalUnsubscribe: null,
    userCredit: 0,
    submissionInProgress: false // Add flag to prevent duplicate submissions
};

// Tool icon mapping
const toolIconMap = {
    'LABUBU VOODOO': 'labubu-voodoo.png',
    'KOOL-AID KILLA': 'kool-aid-life.png',
    'MY GIRL\'S GLASSES': 'glasses-see.png',
    'H4CK3D AF': 'anon-hack.png',
    'GAME PASS': 'game-pass.png',
    'BLESSED BEYBLADE': 'blessed-beyblade.png'
};

// Calculate credit from transactions (matching admin.js)
function calculateCredit(transactions = []) {
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

// DOM Elements
const elements = {
    videoBg: document.getElementById('videoBg'),
    bgMusic: document.getElementById('bgMusic'),
    accessCodeContainer: document.getElementById('accessCodeContainer'),
    accessCodeInput: document.getElementById('accessCodeInput'),
    errorMessage: document.getElementById('errorMessage'),
    viewToggle: document.getElementById('viewToggle'),
    carouselWrapper: document.getElementById('carouselWrapper'),
    gridWrapper: document.getElementById('gridWrapper'),
    carousel: document.getElementById('carousel'),
    discsGrid: document.getElementById('discsGrid'),
    instructions: document.getElementById('instructions'),
    pendingStatus: document.getElementById('pendingStatus'),
    playerProfile: document.getElementById('playerProfile'),
    modalOverlay: document.getElementById('modalOverlay'),
    gamePassNotice: document.getElementById('gamePassNotice'),
    addonsQuestion: document.getElementById('addonsQuestion'),
    weaponsSection: document.getElementById('weaponsSection')
};

// Initialize music playback
function initMusic() {
    const bgMusic = elements.bgMusic;
    if (bgMusic) {
        bgMusic.volume = 0.5;
        
        const playPromise = bgMusic.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Music started playing automatically');
            }).catch(error => {
                console.log('Autoplay prevented, will play on first user interaction');
                
                const playOnInteraction = () => {
                    bgMusic.play();
                    document.removeEventListener('click', playOnInteraction);
                    document.removeEventListener('keydown', playOnInteraction);
                    document.removeEventListener('touchstart', playOnInteraction);
                };
                
                document.addEventListener('click', playOnInteraction);
                document.addEventListener('keydown', playOnInteraction);
                document.addEventListener('touchstart', playOnInteraction);
            });
        }
    }
}

// Load tools from Firebase
async function loadToolsFromFirebase() {
    try {
        const snapshot = await getDocs(collection(db, 'tools'));
        state.allTools = [];
        
        snapshot.forEach(doc => {
            const toolData = doc.data();
            // Only add visible tools
            if (toolData.visible !== false) {
                state.allTools.push({
                    id: doc.id,
                    ...toolData
                });
            }
        });
        
        state.allTools.sort((a, b) => a.price - b.price);
        console.log('Loaded tools from Firebase:', state.allTools);
        
    } catch (error) {
        console.error('Error loading tools:', error);
    }
}

// Validate access code
async function validateAccessCode() {
    const code = elements.accessCodeInput.value.toUpperCase();
    console.log('Validating access code:', code);
    
    if (!code) return;

    try {
        const userDoc = await getDoc(doc(db, 'users', code));
        console.log('User doc exists:', userDoc.exists());
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User data:', userData);
            
            // Check if user is blocked or dead
            if (userData.status === 'blocked' || userData.status === 'dead') {
                elements.errorMessage.textContent = 
                    userData.status === 'blocked' ? 'NO ENTRY - UR BLOCKED 🚫' : 'SORRY UR DEAD 💀 RIP';
                elements.errorMessage.style.display = 'block';
                return;
            }

            state.currentAccessCode = code;
            state.currentUser = userData;
            
            // Load tools from Firebase
            await loadToolsFromFirebase();
            
            // Switch video background
            if (elements.videoBg) {
                elements.videoBg.src = '../assets/cast/loop-bg.mp4';
                elements.videoBg.load();
                elements.videoBg.play();
            }
            
            // Hide access code screen
            elements.accessCodeContainer.style.display = 'none';
            
            // Check if user already has a character
            if (userData.characterId) {
                console.log('User has character, showing profile');
                showPlayerProfile(userData);
            } else {
                console.log('User needs character, showing selection');
                // Go straight to character selection
                checkPendingSelection(state.currentAccessCode);
            }
            
        } else {
            elements.errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Error validating access code:', error);
        elements.errorMessage.style.display = 'block';
    }
}

// Check for pending selections
async function checkPendingSelection(accessCode) {
    const q = query(collection(db, 'pendingSelections'), where('accessCode', '==', accessCode));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        const pendingDoc = querySnapshot.docs[0];
        state.pendingSelectionId = pendingDoc.id;
        const pendingData = pendingDoc.data();
        showPendingStatus(pendingData);
    } else {
        // Show character selection
        elements.viewToggle.style.display = 'block';
        elements.carouselWrapper.style.display = 'block';
        elements.instructions.style.display = 'block';
        loadCharacters();
    }
}

// Show pending status
function showPendingStatus(pendingData) {
    // Hide character selection elements
    elements.viewToggle.style.display = 'none';
    elements.carouselWrapper.style.display = 'none';
    elements.gridWrapper.style.display = 'none';
    elements.instructions.style.display = 'none';
    
    const discDiv = document.getElementById('pendingDisc');
    const infoDiv = document.getElementById('pendingInfo');
    
    // Show disc image
    discDiv.innerHTML = `<img src="../assets/cast/cast-members/${pendingData.characterId}-disc.png" alt="${pendingData.characterName}">`;
    
    // Show info
    const toolsList = pendingData.tools && pendingData.tools.length > 0 ? 
        pendingData.tools.map(t => `${t.name} (${t.price} credits)`).join(', ') : 
        'None';
    
    const handle = pendingData.handle || state.currentUser.handle || pendingData.accessCode;
    
    infoDiv.innerHTML = `
        <p><strong>Player:</strong> @${handle}</p>
        <p><strong>Character:</strong> ${pendingData.characterName}</p>
        <p><strong>Stuff requested:</strong> ${toolsList}</p>
        ${pendingData.totalCost > 0 ? `
            <p style="font-size: 24px; color: #ff00ff; margin-top: 20px;">💸 send moneyz 2 unlock! 💸</p>
            <p><strong>VENMO:</strong> @worksucksdotnet</p>
            <p><strong>ZELLE:</strong> paizley@worksucks.net</p>
            <p style="margin-top: 15px; font-size: 20px;">need: <strong>${pendingData.totalCost} credz</strong></p>
            <p style="font-size: 14px; color: #ffff00;">don't 4get ur handle in the memo!! 📝</p>
        ` : `
            <p style="font-size: 24px; color: #00ff00; margin-top: 20px;">✨ all paid up! waiting 4 mod... ✨</p>
            <p style="font-size: 14px;">they'll approve u soon promise 💿</p>
        `}
    `;
    
    elements.pendingStatus.style.display = 'block';
    
    // Start monitoring
    startApprovalMonitoring(state.pendingSelectionId);
}

// Change selection
async function changeSelection() {
    if (state.pendingSelectionId) {
        try {
            await deleteDoc(doc(db, 'pendingSelections', state.pendingSelectionId));
            state.pendingSelectionId = null;
            
            // Hide pending status and show selection
            elements.pendingStatus.style.display = 'none';
            elements.viewToggle.style.display = 'block';
            elements.carouselWrapper.style.display = 'block';
            elements.instructions.style.display = 'block';
            loadCharacters();
        } catch (error) {
            console.error('Error deleting pending selection:', error);
            alert('Error changing selection. Please try again.');
        }
    }
}

// Show player profile
async function showPlayerProfile(userData) {
    // Refresh user data
    const userDoc = await getDoc(doc(db, 'users', state.currentAccessCode));
    if (userDoc.exists()) {
        userData = userDoc.data();
        state.currentUser = userData;
    }
    
    // Hide character selection elements
    elements.viewToggle.style.display = 'none';
    elements.carouselWrapper.style.display = 'none';
    elements.gridWrapper.style.display = 'none';
    elements.instructions.style.display = 'none';
    
    const handle = userData.handle || userData.code || userData.id;
    document.getElementById('profileTitle').textContent = `@${handle.toLowerCase()}'s space`;
    
    const discDiv = document.getElementById('profileDisc');
    const infoDiv = document.getElementById('profileInfo');
    
    // Show disc image
    if (userData.characterId) {
        discDiv.innerHTML = `<img src="../assets/cast/cast-members/${userData.characterId}-disc.png" alt="${userData.characterName}">`;
    }
    
    // Calculate credits using transaction system
    const credit = userData.credit || calculateCredit(userData.transactions || []);
    console.log('Profile credit:', credit);
    
    // Show credit or payment due
    if (credit > 0) {
        document.getElementById('creditSection').style.display = 'block';
        document.getElementById('creditAmount').textContent = credit;
        document.getElementById('paymentDue').style.display = 'none';
    } else if (credit < 0) {
        document.getElementById('paymentDue').style.display = 'block';
        document.getElementById('amountOwed').textContent = Math.abs(credit);
        document.getElementById('creditSection').style.display = 'none';
    } else {
        document.getElementById('creditSection').style.display = 'block';
        document.getElementById('creditAmount').textContent = '0';
        document.getElementById('paymentDue').style.display = 'none';
    }
    
    // Check for moderator note
    if (userData.moderatorNote) {
        document.getElementById('moderatorNote').style.display = 'block';
        document.getElementById('noteText').textContent = userData.moderatorNote;
    } else {
        document.getElementById('moderatorNote').style.display = 'none';
    }
    
    // Get character info
    const show = await getCharacterShow(userData.characterId);
    
    // Create tools list with icons
    let toolsList = '';
    const allTools = [...(userData.tools || [])];
    
    if (allTools.length > 0) {
        // Group tools by name
        const toolCounts = {};
        allTools.forEach(tool => {
            if (!toolCounts[tool.name]) {
                toolCounts[tool.name] = { count: 0, used: 0 };
            }
            toolCounts[tool.name].count++;
            if (tool.used) toolCounts[tool.name].used++;
        });
        
        // Create tools display
        const toolsHtml = Object.entries(toolCounts).map(([toolName, data]) => {
            const iconFile = toolIconMap[toolName] || 'default-tool.png';
            const isUsed = data.used === data.count;
            
            return `
                <div class="tool-icon-item ${isUsed ? 'used' : ''}">
                    <div class="tool-icon-wrapper">
                        <img src="../assets/cast/${iconFile}" alt="${toolName}" 
                             onerror="this.src='../assets/cast/default-tool.png'">
                        ${data.count > 1 ? `<div class="tool-quantity-badge">${data.count}</div>` : ''}
                    </div>
                    <div class="tool-icon-name">${toolName}</div>
                </div>
            `;
        }).join('');
        
        toolsList = `<div class="tools-icons-grid">${toolsHtml}</div>`;
    } else {
        toolsList = '<p style="text-align: center; color: #666;">no weapons yet... get some!! 🛒</p>';
    }
    
    // Build info HTML
    infoDiv.innerHTML = `
        <p><strong>Character:</strong> ${userData.characterName || 'None'}</p>
        <p><strong>Show:</strong> ${show}</p>
        <p><strong>Status:</strong> <span class="status-${userData.status?.toLowerCase() || 'active'}">${(userData.status || 'active').toUpperCase()}</span></p>
        <div class="profile-stats-simple">
            <div class="stat-line">
                <span><strong>Team:</strong></span>
                <span>${userData.team || 'No Team'}</span>
            </div>
            <div class="stat-line">
                <span><strong>Individual Points:</strong></span>
                <span>${userData.individualPoints || 0}</span>
            </div>
            <div class="stat-line">
                <span><strong>Team Points:</strong></span>
                <span>${userData.teamPoints || 0}</span>
            </div>
        </div>
        <div class="tools-simple">
            <h4>YOUR WEAPONS:</h4>
            ${toolsList}
        </div>
    `;
    
    elements.playerProfile.style.display = 'block';
}

// Get character show info
async function getCharacterShow(characterId) {
    if (!characterId) return 'No character selected';
    
    try {
        const charDoc = await getDoc(doc(db, 'characters', characterId));
        if (charDoc.exists()) {
            return charDoc.data().show || 'Unknown Show';
        }
    } catch (error) {
        console.error('Error getting character show:', error);
    }
    return 'Unknown Show';
}

// Switch view between carousel and grid
function switchView(view) {
    state.currentView = view;
    
    // Update toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });
    
    // Show/hide views
    if (view === 'carousel') {
        elements.carouselWrapper.style.display = 'block';
        elements.gridWrapper.style.display = 'none';
    } else {
        elements.carouselWrapper.style.display = 'none';
        elements.gridWrapper.style.display = 'block';
    }
}

// Load characters from Firebase
async function loadCharacters() {
    console.log('Starting to load characters...');
    try {
        const querySnapshot = await getDocs(collection(db, 'characters'));
        state.characters = [];
        state.availableCharacters = [];
        
        querySnapshot.forEach((doc) => {
            const charData = doc.data();
            if (charData.available) {
                const character = {
                    id: doc.id,
                    ...charData
                };
                state.characters.push(character);
                state.availableCharacters.push(character);
            }
        });

        console.log(`Found ${state.availableCharacters.length} available characters`);
        initCarousel();
        initGrid();
    } catch (error) {
        console.error('Error loading characters:', error);
        alert('Error loading characters: ' + error.message);
    }
}

// Initialize carousel
function initCarousel() {
    const carousel = elements.carousel;
    carousel.innerHTML = '';

    state.availableCharacters.forEach((char, index) => {
        const sleeve = document.createElement('div');
        sleeve.className = 'disc-sleeve';
        sleeve.dataset.index = index;
        sleeve.dataset.character = char.id;
        
        const img = document.createElement('img');
        img.src = `../assets/cast/cast-members/${char.id}.png`;
        img.alt = char.name;
        
        sleeve.appendChild(img);
        carousel.appendChild(sleeve);

        // Click handler for disc selection
        sleeve.addEventListener('click', () => selectCharacter(char));
    });

    updateCarousel();
}

// Initialize grid view
function initGrid() {
    const grid = elements.discsGrid;
    grid.innerHTML = '';

    state.availableCharacters.forEach((char) => {
        const gridDisc = document.createElement('div');
        gridDisc.className = 'grid-disc';
        gridDisc.dataset.character = char.id;
        
        const img = document.createElement('img');
        img.src = `../assets/cast/cast-members/${char.id}-disc.png`;
        img.alt = char.name;
        
        gridDisc.appendChild(img);
        grid.appendChild(gridDisc);

        // Click handler
        gridDisc.addEventListener('click', () => selectCharacter(char));
    });
}

// Update carousel positions
function updateCarousel() {
    const sleeves = document.querySelectorAll('.disc-sleeve');
    
    sleeves.forEach((sleeve, index) => {
        sleeve.classList.remove('active', 'prev', 'next', 'far-prev', 'far-next');
        
        const diff = index - state.currentIndex;
        
        if (diff === 0) {
            sleeve.classList.add('active');
        } else if (diff === -1 || (diff > 0 && diff === state.availableCharacters.length - 1)) {
            sleeve.classList.add('prev');
        } else if (diff === 1 || (diff < 0 && Math.abs(diff) === state.availableCharacters.length - 1)) {
            sleeve.classList.add('next');
        } else {
            sleeve.classList.add(diff < 0 ? 'far-prev' : 'far-next');
        }
    });
}

// Navigate carousel
function navigateCarousel(direction) {
    if (direction === 'prev') {
        state.currentIndex = (state.currentIndex - 1 + state.availableCharacters.length) % state.availableCharacters.length;
    } else {
        state.currentIndex = (state.currentIndex + 1) % state.availableCharacters.length;
    }
    updateCarousel();
}

// Character selection
async function selectCharacter(character) {
    state.currentCharacter = character;
    state.selectedWeapons = {};
    state.submissionInProgress = false; // Reset submission flag
    
    // Refresh user data to ensure we have latest tools
    try {
        const userDoc = await getDoc(doc(db, 'users', state.currentAccessCode));
        if (userDoc.exists()) {
            state.currentUser = userDoc.data();
            console.log('Refreshed user data:', state.currentUser);
        }
    } catch (error) {
        console.error('Error refreshing user data:', error);
    }
    
    // Update modal content
    document.getElementById('modalDiscImg').src = `../assets/cast/cast-members/${character.id}-disc.png`;
    document.getElementById('characterName').textContent = character.name;
    document.getElementById('characterShow').textContent = character.show;
    
    // Check game pass and credit status
    const totalCredit = calculateCredit(state.currentUser.transactions || []);
    const hasGamePass = (state.currentUser.tools || []).some(tool => 
        tool.name && tool.name.toUpperCase() === 'GAME PASS'
    );
    
    // Update the add-ons question based on status
    const priceNote = document.querySelector('.price-note');
    const questionTitle = document.querySelector('.question-title');
    
    if (!hasGamePass) {
        // User needs game pass first
        questionTitle.textContent = 'GAME PASS REQUIRED ($25) - WANT ANY WEAPONS TOO?';
        priceNote.innerHTML = `<span style="color: #ff0000;">⚠️ u need game pass to play (${totalCredit >= 25 ? 'using credits' : '$25'})</span>`;
    } else if (totalCredit > 0) {
        // Has game pass and credits
        questionTitle.textContent = 'WANT TO SPEND YOUR CREDITS ON WEAPONS?';
        priceNote.innerHTML = `u got <span style="color: #00ff00;">${totalCredit} credits</span> to spend!`;
    } else {
        // Has game pass but no credits
        questionTitle.textContent = 'DO YOU WANT TO BUY ANY ADD-ONS OR WEAPONS?';
        priceNote.innerHTML = 'stuff starts at <span class="small-price">$25</span>';
    }
    
    // Show add-ons question first, hide weapons section
    elements.addonsQuestion.style.display = 'block';
    elements.weaponsSection.style.display = 'none';
    
    elements.modalOverlay.classList.add('active');
}

// Handle "Yes" to add-ons
function showWeaponsStore() {
    elements.addonsQuestion.style.display = 'none';
    elements.weaponsSection.style.display = 'block';
    
    // Calculate available credits
    const totalCredit = calculateCredit(state.currentUser.transactions || []);
    const hasGamePass = (state.currentUser.tools || []).some(tool => 
        tool.name && tool.name.toUpperCase() === 'GAME PASS'
    );
    
    // Generate weapons grid
    const weaponsGrid = document.getElementById('weaponsGrid');
    weaponsGrid.innerHTML = '';
    
    // Add all tools
    state.allTools.forEach((tool, index) => {
        const weaponEl = document.createElement('div');
        weaponEl.className = 'weapon-item';
        weaponEl.dataset.index = index;
        weaponEl.dataset.toolId = tool.id;
        
        // Check if user already owns this tool
        const userOwnsThis = (state.currentUser.tools || []).some(userTool => 
            userTool.name && userTool.name.toUpperCase() === tool.name.toUpperCase()
        );
        
        // Special handling for game pass
        if (tool.name === 'GAME PASS') {
            if (userOwnsThis) {
                weaponEl.className += ' already-owned';
                weaponEl.style.opacity = '0.5';
                weaponEl.style.cursor = 'not-allowed';
            } else if (!hasGamePass && totalCredit < 25) {
                // User needs game pass - auto-select it
                weaponEl.className += ' required-gamepass';
                weaponEl.style.border = '3px solid #ff0000';
                weaponEl.style.background = 'rgba(255, 255, 0, 0.1)';
                
                // Auto-select game pass
                state.selectedWeapons[index] = {
                    tool: tool,
                    quantity: 1,
                    mandatory: true
                };
            }
        }
        
        const iconFile = toolIconMap[tool.name] || tool.icon || 'default-tool.png';
        
        weaponEl.innerHTML = `
            <div class="weapon-icon">
                <img src="../assets/cast/${iconFile}" alt="${tool.name}"
                     onerror="this.src='../assets/cast/default-tool.png'">
            </div>
            <div class="weapon-name">${tool.name}${tool.name === 'GAME PASS' && !userOwnsThis && totalCredit < 25 ? ' 🚨 NEED THIS' : ''}${userOwnsThis ? ' ✓ OWNED' : ''}</div>
            ${tool.description ? `<div class="tool-description">${tool.description}</div>` : ''}
            <div class="weapon-price">${userOwnsThis ? 'OWNED' : tool.price + ' credz'}</div>
            <div class="weapon-quantity" ${tool.name === 'GAME PASS' && !userOwnsThis && totalCredit < 25 ? 'style="display: flex; background: #ff0000; color: white;"' : ''}>
                ${tool.name === 'GAME PASS' && !userOwnsThis && totalCredit < 25 ? '1' : '0'}
            </div>
        `;
        
        // Only allow clicking if not mandatory game pass AND not already owned
        if (!(tool.name === 'GAME PASS' && !hasGamePass && totalCredit < 25) && !userOwnsThis) {
            weaponEl.addEventListener('click', () => toggleWeapon(index, tool));
        }
        
        weaponsGrid.appendChild(weaponEl);
    });
    
    updateTotal();
    
    // Reset checkout state
    document.getElementById('checkoutBtn').style.display = 'block';
    document.getElementById('skipBtn').style.display = 'block';
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('startOverBtn').style.display = 'none';
    document.getElementById('checkoutBtn').disabled = false;
    document.getElementById('skipBtn').disabled = false;
}

// Handle "No" to add-ons - go straight to approval (no weapons modal)
async function skipAddonsAndCheckout() {
    if (!state.currentCharacter || !state.currentAccessCode || state.submissionInProgress) return;
    
    state.submissionInProgress = true; // Set flag to prevent duplicate submissions
    
    console.log('Skip and checkout - submitting selection for:', state.currentAccessCode);
    
    // Hide add-ons question
    elements.addonsQuestion.style.display = 'none';
    // Show weapons section container but hide the actual weapons
    elements.weaponsSection.style.display = 'block';
    
    // Hide the weapons grid and title
    document.getElementById('weaponsGrid').style.display = 'none';
    document.querySelector('.weapons-title').style.display = 'none';
    
    // Hide checkout/skip buttons, show payment modal
    document.getElementById('checkoutBtn').style.display = 'none';
    document.getElementById('skipBtn').style.display = 'none';
    document.getElementById('paymentModal').style.display = 'block';
    document.getElementById('startOverBtn').style.display = 'block';
    
    // Hide the total price div since they're not buying weapons
    document.getElementById('totalPriceDiv').style.display = 'none';
    
    try {
        const totalCredit = calculateCredit(state.currentUser.transactions || []);
        const hasGamePass = (state.currentUser.tools || []).some(tool => tool.name === 'GAME PASS');
        
        console.log('User status:', { hasGamePass, totalCredit });
        
        // Character is FREE - only need game pass if they don't have it
        const tools = [];
        let totalCost = 0;
        let toolsCost = 0;
        
        if (!hasGamePass) {
            // Need to buy game pass ONLY
            tools.push({ name: 'GAME PASS', price: 25, used: false });
            toolsCost = 25; // Only game pass costs money
            totalCost = Math.max(0, 25 - totalCredit);
        }
        
        const selectionData = {
            accessCode: state.currentAccessCode,
            handle: state.currentUser.handle || state.currentAccessCode,
            characterId: state.currentCharacter.id,
            characterName: state.currentCharacter.name,
            tools: tools,
            totalCost: totalCost,  // Amount they need to pay (after credits)
            toolsCost: toolsCost,   // Total cost of items (just game pass if needed)
            currentCredit: totalCredit,
            needsGamePass: !hasGamePass,
            characterCost: 0,  // CHARACTER IS FREE
            status: 'pending',
            submittedAt: new Date().toISOString()
        };
        
        console.log('Submitting selection data:', selectionData);
        
        const docRef = await addDoc(collection(db, 'pendingSelections'), selectionData);
        state.pendingSelectionId = docRef.id;
        
        console.log('Successfully created pending selection:', docRef.id);
        
        // Start monitoring for approval
        startApprovalMonitoring(docRef.id);
        
        // Update payment message based on game pass status
        const paymentMsg = document.getElementById('paymentMessage');
        if (!hasGamePass) {
            // Needs game pass ONLY (not character)
            if (totalCost > 0) {
                paymentMsg.innerHTML = `
                    <span style="font-size: 24px; color: #ffff00;">💸 GAME PASS: <span style="font-size: 14px;">$</span>${totalCost} 💸</span><br>
                    <span style="font-size: 14px; color: #ff00ff;">include ur @handle!</span>
                `;
                document.querySelector('.payment-handles').style.display = 'block';
            } else {
                // Has credit to cover game pass
                paymentMsg.innerHTML = `
                    <span style="font-size: 24px; color: #00ff00;">✨ USING CREDITS ✨</span><br>
                    <span style="font-size: 14px;">25 credz for game pass</span>
                `;
                document.querySelector('.payment-handles').style.display = 'none';
            }
        } else {
            // Already has game pass - character is FREE, no payment needed
            paymentMsg.innerHTML = `
                <span style="font-size: 24px; color: #00ff00;">✨ CHARACTER READY! ✨</span><br>
                <span style="font-size: 14px;">u got game pass already!</span>
            `;
            document.querySelector('.payment-handles').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error submitting selection:', error);
        alert('Error submitting selection: ' + error.message);
        state.submissionInProgress = false;
    }
}

// Toggle weapon selection
function toggleWeapon(index, tool) {
    const weaponEl = document.querySelector(`.weapon-item[data-index="${index}"]`);
    if (!weaponEl) return;
    
    let quantityEl = weaponEl.querySelector('.weapon-quantity');
    
    if (!state.selectedWeapons[index]) {
        state.selectedWeapons[index] = { tool: tool, quantity: 0 };
    }
    
    state.selectedWeapons[index].quantity++;
    weaponEl.classList.add('selected');
    quantityEl.textContent = state.selectedWeapons[index].quantity;
    quantityEl.style.display = 'flex';
    
    updateTotal();
}

// Update total price
function updateTotal() {
    let total = 0;
    let hasRequiredGamePass = false;
    
    for (const [index, data] of Object.entries(state.selectedWeapons)) {
        total += data.tool.price * data.quantity;
        if (data.tool.name === 'GAME PASS' && data.mandatory) {
            hasRequiredGamePass = true;
        }
    }
    
    const totalDiv = document.getElementById('totalPriceDiv');
    if (total > 0) {
        totalDiv.innerHTML = `TOTAL: <span style="color: #ff00ff; font-size: 20px;"><span style="font-size: 14px;">$</span>${total}</span> ${hasRequiredGamePass ? '<span style="color: #ffff00; font-size: 12px;">(includes game pass)</span>' : ''}`;
    } else {
        totalDiv.innerHTML = '▓▒░ SELECT UR WEAPONZ! ░▒▓';
    }
}

// Skip weapons (from weapons view)
async function skipWeaponsFromStore() {
    if (!state.currentCharacter || !state.currentAccessCode || state.submissionInProgress) return;
    
    state.submissionInProgress = true;
    
    console.log('Skip weapons from store - submitting selection for:', state.currentAccessCode);
    
    // Hide weapons grid and buttons
    document.getElementById('weaponsGrid').style.display = 'none';
    document.querySelector('.weapons-title').style.display = 'none';
    document.getElementById('checkoutBtn').style.display = 'none';
    document.getElementById('skipBtn').style.display = 'none';
    document.getElementById('totalPriceDiv').style.display = 'none';
    
    // Show payment modal
    document.getElementById('paymentModal').style.display = 'block';
    document.getElementById('startOverBtn').style.display = 'block';
    
    try {
        const totalCredit = calculateCredit(state.currentUser.transactions || []);
        const hasGamePass = (state.currentUser.tools || []).some(tool => tool.name === 'GAME PASS');
        
        console.log('Skip weapons - user status:', { hasGamePass, totalCredit });
        
        // Character is FREE - only need game pass if they don't have it
        const tools = [];
        let totalCost = 0;
        let toolsCost = 0;
        
        if (!hasGamePass) {
            tools.push({ name: 'GAME PASS', price: 25, used: false });
            toolsCost = 25; // Only game pass costs money
            totalCost = Math.max(0, 25 - totalCredit);
        }
        
        const selectionData = {
            accessCode: state.currentAccessCode,
            handle: state.currentUser.handle || state.currentAccessCode,
            characterId: state.currentCharacter.id,
            characterName: state.currentCharacter.name,
            tools: tools,
            totalCost: totalCost,  // Amount they need to pay
            toolsCost: toolsCost,   // Total cost of items (just game pass)
            currentCredit: totalCredit,
            needsGamePass: !hasGamePass,
            characterCost: 0,  // CHARACTER IS FREE
            status: 'pending',
            submittedAt: new Date().toISOString()
        };
        
        console.log('Submitting selection data:', selectionData);
        
        const docRef = await addDoc(collection(db, 'pendingSelections'), selectionData);
        state.pendingSelectionId = docRef.id;
        
        console.log('Successfully created pending selection:', docRef.id);
        
        startApprovalMonitoring(docRef.id);
        
        // Update payment message
        const paymentMsg = document.getElementById('paymentMessage');
        if (!hasGamePass && totalCost > 0) {
            paymentMsg.innerHTML = `
                <span style="font-size: 24px; color: #ffff00;">💸 GAME PASS: <span style="font-size: 14px;">$</span>${totalCost} 💸</span><br>
                <span style="font-size: 14px; color: #ff00ff;">include ur @handle!</span>
            `;
            document.querySelector('.payment-handles').style.display = 'block';
        } else {
            paymentMsg.innerHTML = `
                <span style="font-size: 24px; color: #00ff00;">✨ CHARACTER READY! ✨</span><br>
                ${!hasGamePass ? `<span style="font-size: 14px;">using 25 credz for game pass</span>` : ''}
            `;
            document.querySelector('.payment-handles').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error submitting selection:', error);
        alert('Error submitting selection: ' + error.message);
        state.submissionInProgress = false;
        // Show elements again on error
        document.getElementById('checkoutBtn').style.display = 'block';
        document.getElementById('skipBtn').style.display = 'block';
        document.getElementById('totalPriceDiv').style.display = 'block';
    }
}

// Proceed to checkout with weapons
async function proceedToCheckout() {
    if (!state.currentCharacter || !state.currentAccessCode || state.submissionInProgress) return;
    
    state.submissionInProgress = true; // Set flag to prevent duplicate submissions
    
    console.log('Proceed to checkout - submitting selection for:', state.currentAccessCode);
    
    const btn = document.getElementById('checkoutBtn');
    const skipBtn = document.getElementById('skipBtn');
    btn.disabled = true;
    skipBtn.disabled = true;
    btn.textContent = 'SUBMITTING...';
    
    // Hide the weapons grid and title after checkout
    document.getElementById('weaponsGrid').style.display = 'none';
    document.querySelector('.weapons-title').style.display = 'none';
    
    // Hide the checkout buttons and total price
    document.getElementById('checkoutBtn').style.display = 'none';
    document.getElementById('skipBtn').style.display = 'none';
    document.getElementById('totalPriceDiv').style.display = 'none';
    
    // Show payment modal
    document.getElementById('paymentModal').style.display = 'block';
    document.getElementById('startOverBtn').style.display = 'block';
    
    try {
        const selectedTools = [];
        let totalToolsCost = 0;
        
        const hasGamePass = (state.currentUser.tools || []).some(tool => tool.name === 'GAME PASS');
        
        console.log('User has game pass:', hasGamePass);
        console.log('Selected weapons:', state.selectedWeapons);
        
        // Add game pass if needed
        if (!hasGamePass) {
            selectedTools.push({ name: 'GAME PASS', price: 25, used: false });
            totalToolsCost += 25;
        }
        
        // Convert selected weapons to array
        for (const [index, data] of Object.entries(state.selectedWeapons)) {
            // Skip if it's the mandatory game pass (already added above)
            if (data.mandatory && data.tool.name === 'GAME PASS') continue;
            
            for (let i = 0; i < data.quantity; i++) {
                selectedTools.push({ 
                    name: data.tool.name, 
                    price: data.tool.price,
                    used: false 
                });
            }
            totalToolsCost += data.tool.price * data.quantity;
        }
        
        // Calculate credits
        const totalPayments = calculateCredit(state.currentUser.transactions || []);
        const creditsNeeded = Math.max(0, totalToolsCost - totalPayments);
        
        console.log('Checkout calculation:', { totalToolsCost, totalPayments, creditsNeeded });
        
        const selectionData = {
            accessCode: state.currentAccessCode,
            handle: state.currentUser.handle || state.currentAccessCode,
            characterId: state.currentCharacter.id,
            characterName: state.currentCharacter.name,
            tools: selectedTools,
            totalCost: creditsNeeded,
            toolsCost: totalToolsCost,
            currentCredit: totalPayments,
            needsGamePass: !hasGamePass,
            status: 'pending',
            submittedAt: new Date().toISOString()
        };
        
        console.log('Submitting selection data:', selectionData);
        
        const docRef = await addDoc(collection(db, 'pendingSelections'), selectionData);
        state.pendingSelectionId = docRef.id;
        
        console.log('Successfully created pending selection:', docRef.id);
        
        // Start monitoring
        startApprovalMonitoring(docRef.id);
        
        // Update payment message
        const paymentMsg = document.getElementById('paymentMessage');
        if (creditsNeeded > 0) {
            paymentMsg.innerHTML = `
                <span style="font-size: 24px; color: #ffff00;">💸 SEND <span style="font-size: 14px;">$</span>${creditsNeeded} 💸</span><br>
                <span style="font-size: 14px; color: #ff00ff;">include ur @handle in memo!</span>
            `;
            document.querySelector('.payment-handles').style.display = 'block';
        } else {
            paymentMsg.innerHTML = `
                <span style="font-size: 24px; color: #00ff00;">✨ UR ALL SET!! ✨</span><br>
                <span style="font-size: 14px;">using ${totalToolsCost} of ur ${totalPayments} credz</span>
            `;
            document.querySelector('.payment-handles').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error submitting selection:', error);
        alert('Error submitting selection: ' + error.message);
        btn.disabled = false;
        skipBtn.disabled = false;
        btn.textContent = 'ADD TO TAB & CHECKOUT →';
        state.submissionInProgress = false;
        // Show elements again on error
        document.getElementById('checkoutBtn').style.display = 'block';
        document.getElementById('skipBtn').style.display = 'block';
        document.getElementById('totalPriceDiv').style.display = 'block';
    }
}

// Monitor for approval
function startApprovalMonitoring(pendingId) {
    if (!pendingId) return;
    
    // Clean up any existing listener
    if (state.approvalUnsubscribe) {
        state.approvalUnsubscribe();
    }
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(doc(db, 'pendingSelections', pendingId), 
        (doc) => {
            if (!doc.exists()) {
                // Document was deleted - check if user was approved
                checkIfApproved();
            }
        },
        (error) => {
            console.error('Error monitoring approval:', error);
        }
    );
    
    // Store unsubscribe function
    state.approvalUnsubscribe = unsubscribe;
}

// Check if user was approved
async function checkIfApproved() {
    try {
        const userDoc = await getDoc(doc(db, 'users', state.currentAccessCode));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.characterId) {
                // User was approved!
                const paymentModal = document.getElementById('paymentModal');
                paymentModal.innerHTML = `
                    <h3 style="font-size: 32px; color: #ff00ff;">🎉 YESSSSS APPROVED!! 🎉</h3>
                    <div class="emoji-line">🔌💿🍄🎱🐳💊</div>
                    <p style="font-size: 24px; margin: 20px 0;">WELCOME 2 THE OLYMPICS BBY!</p>
                    <p style="font-size: 18px;">taking u to ur profile now...</p>
                    <p style="font-size: 14px; color: #ffff00;">✨ let's gooooo ✨</p>
                `;
                
                // Clean up listener
                if (state.approvalUnsubscribe) {
                    state.approvalUnsubscribe();
                }
                
                // Redirect after a moment
                setTimeout(() => {
                    elements.modalOverlay.classList.remove('active');
                    showPlayerProfile(userData);
                }, 3000);
            }
        }
    } catch (error) {
        console.error('Error checking approval:', error);
    }
}

// Start over
function startOver() {
    // Reset submission flag
    state.submissionInProgress = false;
    
    // Delete pending selection if exists
    if (state.pendingSelectionId) {
        deleteDoc(doc(db, 'pendingSelections', state.pendingSelectionId))
            .then(() => {
                state.pendingSelectionId = null;
                closeModal();
                checkPendingSelection(state.currentAccessCode);
            })
            .catch(error => {
                console.error('Error deleting pending selection:', error);
                closeModal();
                checkPendingSelection(state.currentAccessCode);
            });
    } else {
        closeModal();
        checkPendingSelection(state.currentAccessCode);
    }
}

// Close modal
function closeModal() {
    elements.modalOverlay.classList.remove('active');
    state.selectedWeapons = {};
    state.currentCharacter = null;
    state.submissionInProgress = false; // Reset submission flag
    
    // Reset displays
    elements.addonsQuestion.style.display = 'block';
    elements.weaponsSection.style.display = 'none';
    document.getElementById('weaponsGrid').style.display = 'grid'; // Reset grid display
    document.querySelector('.weapons-title').style.display = 'block'; // Reset title display
    document.getElementById('checkoutBtn').style.display = 'block';
    document.getElementById('skipBtn').style.display = 'block';
    document.getElementById('totalPriceDiv').style.display = 'block'; // Reset total price display
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('startOverBtn').style.display = 'none';
}

// Touch handling
function handleTouchStart(e) {
    state.touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    state.touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    if (state.currentView === 'carousel') {
        if (state.touchEndX < state.touchStartX - 50) {
            navigateCarousel('next');
        }
        if (state.touchEndX > state.touchStartX + 50) {
            navigateCarousel('prev');
        }
    }
}

// Test Firebase connection and collection
async function testFirebaseConnection() {
    console.log('Testing Firebase connection...');
    
    try {
        // Test 1: Try to read from pendingSelections
        const testQuery = query(collection(db, 'pendingSelections'));
        const snapshot = await getDocs(testQuery);
        console.log('PendingSelections collection exists, documents:', snapshot.size);
        
        // Test 2: Try to create a test document
        const testDoc = {
            test: true,
            timestamp: new Date().toISOString(),
            message: 'Test document - can be deleted'
        };
        
        const docRef = await addDoc(collection(db, 'pendingSelections'), testDoc);
        console.log('Successfully created test document:', docRef.id);
        
        // Clean up test document
        await deleteDoc(doc(db, 'pendingSelections', docRef.id));
        console.log('Test document deleted');
        
        return true;
    } catch (error) {
        console.error('Firebase test failed:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'permission-denied') {
            console.error('PERMISSION DENIED - Check Firebase security rules');
        }
        
        return false;
    }
}

// Initialize event listeners
function initEventListeners() {
    // Test Firebase on load
    testFirebaseConnection();
    
    // Access code validation
    document.getElementById('validateCodeBtn').addEventListener('click', validateAccessCode);
    elements.accessCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            validateAccessCode();
        }
    });
    
    // View toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchView(e.target.dataset.view);
        });
    });
    
    // Carousel navigation
    document.getElementById('prevBtn').addEventListener('click', () => navigateCarousel('prev'));
    document.getElementById('nextBtn').addEventListener('click', () => navigateCarousel('next'));
    
    // Add-ons question handlers
    document.getElementById('yesAddonsBtn').addEventListener('click', showWeaponsStore);
    document.getElementById('noAddonsBtn').addEventListener('click', skipAddonsAndCheckout);
    
    // Modal controls
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('checkoutBtn').addEventListener('click', proceedToCheckout);
    document.getElementById('skipBtn').addEventListener('click', skipWeaponsFromStore);
    document.getElementById('startOverBtn').addEventListener('click', startOver);
    
    // Profile controls
    document.getElementById('changeSelectionBtn').addEventListener('click', changeSelection);
    const reopenShopBtn = document.getElementById('reopenShopBtn');
    if (reopenShopBtn) {
        reopenShopBtn.addEventListener('click', () => {
            alert('sry credit shopping is thru the admin rn!! bug the mod about it 📟💿');
        });
    }
    document.getElementById('homeBtn').addEventListener('click', () => {
        window.location.href = '../index.html';
    });
    
    // Touch events
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') navigateCarousel('prev');
        if (e.key === 'ArrowRight') navigateCarousel('next');
        if (e.key === 'Escape') closeModal();
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initMusic();
    initEventListeners();
});