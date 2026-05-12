require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const memoryStore = {
  users: [],
  messages: [],
  publicKeys: [],
  proofs: []
};

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
let db = null;
if (!fs.existsSync(serviceAccountPath)) {
  console.warn('Firebase service account file not found at', serviceAccountPath);
  console.warn('Create one from the Firebase console and set FIREBASE_SERVICE_ACCOUNT_PATH in .env');
}
try {
  const serviceAccount = require(path.resolve(serviceAccountPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log('Firebase Firestore connected.');
} catch (err) {
  console.warn('Firebase admin init skipped or failed:', err.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function getCollection(name) {
  return db ? db.collection(name) : null;
}

function upsertMemoryRecord(list, key, value) {
  const index = list.findIndex((item) => item[key] === value[key]);
  if (index >= 0) {
    list[index] = { ...list[index], ...value };
    return list[index];
  }
  list.push(value);
  return value;
}

async function saveProofRecord(record) {
  if (db) {
    await db.collection('proofs').add(record);
    return;
  }
  memoryStore.proofs.push({ id: `proof_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, ...record });
}

async function listProofRecords() {
  if (db) {
    const snapshot = await db.collection('proofs').orderBy('createdAt', 'desc').limit(50).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
  return [...memoryStore.proofs].reverse();
}

async function savePublicKey(username, publicKey, publicKeyType) {
  const record = {
    username,
    ...publicKey,
    publicKeyType,
    updatedAt: new Date().toISOString()
  };
  if (db) {
    await db.collection('publicKeys').doc(username).set(record, { merge: true });
    return record;
  }
  return upsertMemoryRecord(memoryStore.publicKeys, 'username', record);
}

async function getPublicKey(username) {
  if (db) {
    const doc = await db.collection('publicKeys').doc(username).get();
    return doc.exists ? doc.data() : null;
  }
  return memoryStore.publicKeys.find((item) => item.username === username) || null;
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req) || req.body.token;
  if (!token) return res.status(401).json({ error: 'auth required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Simple user registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    if (db) {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('username', '==', username).get();
      if (!snapshot.empty) return res.status(400).json({ error: 'user exists' });
    } else if (memoryStore.users.some((user) => user.username === username)) {
      return res.status(400).json({ error: 'user exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const userDoc = { username, passwordHash: hash, createdAt: new Date().toISOString() };
    if (db) {
      const usersRef = getCollection('users');
      const doc = await usersRef.add(userDoc);
      const token = jwt.sign({ uid: doc.id, username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, username, uid: doc.id });
    }
    const id = `user_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    memoryStore.users.push({ id, ...userDoc });
    const token = jwt.sign({ uid: id, username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, username, uid: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Simple login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    let userRecord = null;
    let userId = null;
    if (db) {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('username', '==', username).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        userRecord = doc.data();
        userId = doc.id;
      }
    } else {
      userRecord = memoryStore.users.find((user) => user.username === username) || null;
      userId = userRecord && userRecord.id;
    }
    if (!userRecord) return res.status(400).json({ error: 'invalid credentials' });
    const data = userRecord;
    const ok = await bcrypt.compare(password, data.passwordHash);
    if (!ok) return res.status(400).json({ error: 'invalid credentials' });
    const token = jwt.sign({ uid: userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username, uid: userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/profile/username', requireAuth, async (req, res) => {
  const { newUsername } = req.body;
  const currentUsername = req.user.username;
  const uid = req.user.uid;

  if (!newUsername || !newUsername.trim()) {
    return res.status(400).json({ error: 'newUsername is required' });
  }

  const normalizedNewUsername = newUsername.trim();
  if (normalizedNewUsername === currentUsername) {
    return res.status(400).json({ error: 'username unchanged' });
  }

  try {
    if (db) {
      const existingSnapshot = await db.collection('users').where('username', '==', normalizedNewUsername).get();
      if (!existingSnapshot.empty) {
        return res.status(409).json({ error: 'username already exists' });
      }

      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'user not found' });
      }

      await userRef.set({ username: normalizedNewUsername, updatedAt: new Date().toISOString() }, { merge: true });

      const oldKeyRecord = await getPublicKey(currentUsername);
      if (oldKeyRecord) {
        await savePublicKey(normalizedNewUsername, {
          signPublicKey: oldKeyRecord.signPublicKey,
          encryptPublicKey: oldKeyRecord.encryptPublicKey
        }, oldKeyRecord.publicKeyType || 'RSA');
      }
    } else {
      if (memoryStore.users.some((user) => user.username === normalizedNewUsername)) {
        return res.status(409).json({ error: 'username already exists' });
      }

      const userIndex = memoryStore.users.findIndex((user) => user.id === uid);
      if (userIndex === -1) {
        return res.status(404).json({ error: 'user not found' });
      }

      memoryStore.users[userIndex].username = normalizedNewUsername;
      memoryStore.users[userIndex].updatedAt = new Date().toISOString();

      const oldKeyRecord = await getPublicKey(currentUsername);
      if (oldKeyRecord) {
        await savePublicKey(normalizedNewUsername, {
          signPublicKey: oldKeyRecord.signPublicKey,
          encryptPublicKey: oldKeyRecord.encryptPublicKey
        }, oldKeyRecord.publicKeyType || 'RSA');
      }
    }

    const token = jwt.sign({ uid, username: normalizedNewUsername }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, username: normalizedNewUsername, uid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/public-key', async (req, res) => {
  const { username, signPublicKey, encryptPublicKey, publicKeyType } = req.body;
  if (!username || !signPublicKey || !encryptPublicKey) {
    return res.status(400).json({ error: 'username, signPublicKey, and encryptPublicKey are required' });
  }
  try {
    await savePublicKey(username, { signPublicKey, encryptPublicKey }, publicKeyType || 'RSA');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/public-key/:username', async (req, res) => {
  try {
    const record = await getPublicKey(req.params.username);
    if (!record) return res.status(404).json({ error: 'public key not found' });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/proofs', async (req, res) => {
  const proof = req.body;
  if (!proof || !proof.type || !proof.createdAt) {
    return res.status(400).json({ error: 'invalid proof payload' });
  }
  try {
    await saveProofRecord(proof);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/proofs', async (req, res) => {
  try {
    const proofs = await listProofRecords();
    res.json({ proofs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('auth required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    return next();
  } catch (err) {
    return next(new Error('invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;
  console.log('connected', user && user.username);
  // Join a room for the user to receive messages
  if (user && user.uid) socket.join(user.uid);
  if (user && user.username) socket.join(user.username);

  socket.on('secure-message', async (msg) => {
    // msg: { toUid, ciphertext, iv, hash, encryptedKey, signature, senderUsername, recipientUsername }
    try {
      const { toUid, ciphertext, iv, hash, encryptedKey, signature, senderUsername, recipientUsername, encryptedPreview } = msg;
      // Optionally store message in Firestore
      if (db) {
        await db.collection('messages').add({
          from: user.uid,
          to: toUid,
          senderUsername,
          recipientUsername,
          ciphertext,
          iv,
          hash,
          encryptedKey,
          signature,
          encryptedPreview,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'sent'
        });
      } else {
        memoryStore.messages.push({
          id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          from: user.uid,
          to: toUid,
          senderUsername,
          recipientUsername,
          ciphertext,
          iv,
          hash,
          encryptedKey,
          signature,
          encryptedPreview,
          createdAt: new Date().toISOString(),
          status: 'sent'
        });
      }
      // Emit to recipient room
      io.to(toUid).emit('secure-message', { from: user.uid, senderUsername, recipientUsername, ciphertext, iv, hash, encryptedKey, signature, encryptedPreview });
    } catch (err) {
      console.error('message error', err);
    }
  });

  socket.on('message-proof', async (proof) => {
    try {
      await saveProofRecord({
        ...proof,
        createdAt: proof.createdAt || new Date().toISOString(),
        username: user.username
      });
    } catch (err) {
      console.error('proof error', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnected', user && user.username);
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
