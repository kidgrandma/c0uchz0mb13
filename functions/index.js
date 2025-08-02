const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Approve character selection
exports.approveSelection = functions.https.onCall(async (data, context) => {
  const { selectionId } = data;

  try {
    // Get the pending selection
    const selectionDoc = await db.collection('pendingSelections').doc(selectionId).get();
    if (!selectionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Selection not found');
    }

    const selectionData = selectionDoc.data();

    // Start a batch write
    const batch = db.batch();

    // Update user with character
    batch.update(db.collection('users').doc(selectionData.accessCode), {
      characterId: selectionData.characterId,
      characterName: selectionData.characterName,
      tools: selectionData.tools,
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Mark character as unavailable
    batch.update(db.collection('characters').doc(selectionData.characterId), {
      available: false,
      ownerId: selectionData.accessCode
    });

    // Delete pending selection
    batch.delete(db.collection('pendingSelections').doc(selectionId));

    // Commit the batch
    await batch.commit();

    return { 
      success: true, 
      message: `Approved ${selectionData.characterName} for ${selectionData.accessCode}` 
    };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Update user status (block/dead/active)
exports.updateUserStatus = functions.https.onCall(async (data, context) => {
  const { userId, status } = data;

  try {
    await db.collection('users').doc(userId).update({ status });
    return { success: true, message: `Updated ${userId} status to ${status}` };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Notification when new selection is submitted
exports.onSelectionSubmitted = functions.firestore
  .document('pendingSelections/{selectionId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    console.log('New character selection:', data.characterName, 'by', data.accessCode);
    
    // You can add email/Discord notifications here later
  });