// Minimal client/server helper functions for hashing and base64 helpers.
const crypto = require('crypto');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = { sha256Hex };
