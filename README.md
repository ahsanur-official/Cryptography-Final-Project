# Crypto Chat

Crypto Chat is a course project for secure real-time messaging. It combines a modern multi-page UI with client-side cryptography, JWT authentication, Socket.io messaging, and proof logging so you can demonstrate encryption, decryption, signing, and hashing end to end.

## What it does

- Real-time bidirectional chat between users.
- AES-256-GCM encryption for message content.
- RSA-PSS digital signatures for authenticity.
- RSA-OAEP key wrapping for session key exchange.
- SHA-256 hashing for integrity checks.
- JWT-based authentication with bcrypt password hashing.
- Proof storage for encrypted and decrypted message evidence.
- A polished multi-page frontend with navbar, login, register, chat, proofs, and settings screens.

## Project Pages

- `index.html` - landing page with feature overview and entry buttons.
- `login.html` - dedicated login page.
- `register.html` - split sender/receiver registration layout.
- `chat.html` - messenger-style secure chat UI.
- `proofs.html` - proof dashboard for encryption and verification records.
- `settings.html` - user settings and local key controls.
- `proof.html` - legacy proof dashboard still present in the project.

## Tech Stack

- Node.js + Express
- Socket.io
- JWT + bcrypt
- Web Crypto API in the browser
- Firebase Admin for Firestore when credentials are available
- In-memory fallback storage when Firebase is not configured

## Crypto Flow

Each message uses a hybrid scheme:

1. Generate a random AES-256 key.
2. Encrypt the plaintext with AES-GCM.
3. Wrap the AES key with the recipient’s RSA-OAEP public key.
4. Sign the plaintext with the sender’s RSA-PSS private key.
5. Send the encrypted packet over Socket.io.
6. On the receiver side, unwrap the AES key, decrypt the message, verify the signature, and record proof data.

This is built for demonstration and coursework. It is not production-hardened and should not be treated as a security product.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create a `.env` file.

```env
PORT=3000
JWT_SECRET=your-secret-here
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

3. If you want Firestore persistence, place a Firebase service account JSON at the path above.

If Firebase is not available, the server automatically falls back to in-memory storage for users, public keys, messages, and proofs.

4. Start the app.

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Available Scripts

- `npm run dev` - start the server with nodemon.
- `npm start` - start the server with Node.js.

## Backend API

- `POST /api/register` - register a user and return a JWT.
- `POST /api/login` - log in a user and return a JWT.
- `POST /api/public-key` - save the user’s signing and encryption public keys.
- `GET /api/public-key/:username` - fetch public keys for a user.
- `POST /api/proofs` - store a proof record.
- `GET /api/proofs` - list stored proof records.

## Real-Time Events

- `secure-message` - relays encrypted message packets to the recipient’s room.
- `message-proof` - stores proof metadata from the client.

## Repository Layout

```text
src/server.js
public/index.html
public/login.html
public/register.html
public/chat.html
public/proofs.html
public/settings.html
public/navbar.html
public/navbar.js
public/main.js
public/login.js
public/register.js
public/proofs-page.js
public/settings.js
public/proof.html
public/proof.js
public/style.css
```

## Notes

- RSA private keys are stored in browser localStorage for this demo.
- Proof records are saved in Firestore when configured, otherwise in memory.
- The UI is intentionally split into separate pages so each page can run independently.
- The project is meant for a cryptography course demo, not for production use.
