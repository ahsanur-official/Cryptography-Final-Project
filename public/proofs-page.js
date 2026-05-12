// Proofs Page Management
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const navbarContainer = document.getElementById('navbar-container');
  const navbarResponse = await fetch('/navbar.html');
  navbarContainer.innerHTML = await navbarResponse.text();
  initializeNavbar();
  
  // Load proofs on page load
  await refreshProofs();
});

async function refreshProofs() {
  try {
    const response = await api.getProofs();
    const proofs = response.proofs || [];
    
    renderProofs(proofs);
  } catch (err) {
    showToast(`Failed to load proofs: ${err.message}`, 'error');
  }
}

function renderProofs(allProofs) {
  const proofsGrid = document.getElementById('proofsGrid');
  
  // Filter proofs based on current filter
  const filteredProofs = currentFilter === 'all' 
    ? allProofs 
    : allProofs.filter(p => p.type === currentFilter);
  
  if (filteredProofs.length === 0) {
    proofsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h2>No ${currentFilter === 'all' ? 'proofs' : currentFilter + ' proofs'} yet</h2>
        <p>Send or receive encrypted messages to see proofs</p>
      </div>
    `;
    return;
  }
  
  proofsGrid.innerHTML = filteredProofs.map(proof => createProofCard(proof)).join('');
}

function createProofCard(proof) {
  const isVerified = proof.status === 'verified';
  const timestamp = new Date(proof.createdAt);
  const timeString = formatTimestamp(timestamp);
  
  return `
    <div class="proof-card ${proof.type}">
      <div class="proof-badge ${proof.type}">
        ${proof.type === 'send' ? '📤 Sent' : '📥 Received'}
      </div>
      
      <div class="proof-title">${proof.senderUsername} → ${proof.recipientUsername}</div>
      
      <div class="proof-details">
        <div class="proof-detail">
          <strong>Status:</strong>
          <span>${proof.status || 'stored'}</span>
        </div>
        <div class="proof-detail">
          <strong>Time:</strong>
          <span>${timeString}</span>
        </div>
        <div class="proof-detail">
          <strong>Ciphertext:</strong>
          <span title="${proof.ciphertext}">${proof.ciphertext.slice(0, 24)}...</span>
        </div>
      </div>
      
      <div class="proof-verification ${isVerified ? '' : 'failed'}">
        <div class="verification-item ${proof.signatureVerified ? 'passed' : 'failed'}">
          <span class="status-icon">${proof.signatureVerified ? '✓' : '✕'}</span>
          <span>Digital Signature ${proof.signatureVerified ? 'Verified' : 'Failed'}</span>
        </div>
        <div class="verification-item ${proof.hashVerified ? 'passed' : 'failed'}">
          <span class="status-icon">${proof.hashVerified ? '✓' : '✕'}</span>
          <span>Hash Verification ${proof.hashVerified ? 'Passed' : 'Failed'}</span>
        </div>
        <div class="verification-item">
          <strong>Hash:</strong>
          <span title="${proof.hash}">${proof.hash.slice(0, 16)}...</span>
        </div>
      </div>
      
      ${proof.decryptedText ? `
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 12px; margin-top: 12px; font-size: 0.9rem; color: var(--text);">
          <strong>Message:</strong> "${proof.decryptedText.slice(0, 60)}${proof.decryptedText.length > 60 ? '...' : ''}"
        </div>
      ` : ''}
    </div>
  `;
}

function formatTimestamp(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function filterProofs(type) {
  currentFilter = type;
  
  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Refresh display
  refreshProofs();
}
