// Script to audit and fix /users/{userId}/tasks documents for missing or incorrect userId fields
// Run this with Node.js and the Firebase Admin SDK

const admin = require('firebase-admin');
const path = require('path');

// Path to your service account key
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function auditAndFixUserTasks() {
  const usersSnapshot = await db.collection('users').get();
  let totalChecked = 0;
  let totalFixed = 0;
  let issues = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const tasksRef = db.collection('users').doc(userId).collection('tasks');
    const tasksSnapshot = await tasksRef.get();
    for (const taskDoc of tasksSnapshot.docs) {
      totalChecked++;
      const taskData = taskDoc.data();
      // Check if userId field is missing or incorrect
      if (!taskData.userId || taskData.userId !== userId) {
        issues.push({ userId, taskId: taskDoc.id, oldUserId: taskData.userId });
        // Fix the userId field
        await tasksRef.doc(taskDoc.id).update({ userId });
        totalFixed++;
        console.log(`Fixed userId for /users/${userId}/tasks/${taskDoc.id} (was: ${taskData.userId})`);
      }
    }
  }

  console.log(`\nAudit complete. Checked: ${totalChecked}, Fixed: ${totalFixed}`);
  if (issues.length > 0) {
    console.log('Issues found and fixed:', issues);
  } else {
    console.log('No issues found. All userId fields are correct.');
  }
}

auditAndFixUserTasks().catch((err) => {
  console.error('Error during audit and fix:', err);
  process.exit(1);
});