# Secure Real-Time Messaging (Cryptography Course)

Minimal scaffold for a secure real-time chat app using Node.js, Socket.io, and Firebase (Firestore). Intended as a course project starter.

Quick start

1. Copy your Firebase service account JSON to `firebase-service-account.json` (see firebase-service-account.json.example).
2. Copy `.env.example` to `.env` and set `JWT_SECRET` and other values.
3. Install:

```bash
npm install
```

4. Run in development:

```bash
npm run dev
```

What's included

- `src/server.js` - Express + Socket.io server, auth endpoints, socket auth middleware
- `public/` - simple frontend (login/register/chat) and client-side crypto helpers
- `firebase-service-account.json.example` - example service account

Notes

- You must provide a Firebase service account to let the server access Firestore.
- This scaffold demonstrates flows and is for learning/demonstration. For production, follow secure key storage, HTTPS, and hardened crypto practices.
