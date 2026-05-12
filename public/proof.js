const proofList = document.getElementById('proofList');
const proofMeta = document.getElementById('proofMeta');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderProof(proof) {
  const isSendRecord = proof.type === 'send';
  const hashStatus = isSendRecord ? 'Hash captured' : (proof.hashVerified ? 'Hash verified' : 'Hash mismatch');
  const signatureStatus = isSendRecord ? 'Signature stored' : (proof.signatureVerified ? 'Signature verified' : 'Signature failed');
  const statusTone = proof.status === 'verified' ? 'success' : (isSendRecord ? 'info' : 'warning');
  return `
    <article class="message-card ${statusTone}">
      <h4>${escapeHtml(proof.type || 'proof')}</h4>
      <p><strong>Sender:</strong> ${escapeHtml(proof.senderUsername || proof.username || '-')}</p>
      <p><strong>Receiver:</strong> ${escapeHtml(proof.recipientUsername || '-')}</p>
      <p><strong>Status:</strong> ${escapeHtml(proof.status || 'stored')}</p>
      <p><strong>Hash:</strong> ${escapeHtml(proof.hash || '-')}</p>
      <p><strong>Calculated Hash:</strong> ${escapeHtml(proof.calculatedHash || (isSendRecord ? 'pending verification' : '-'))}</p>
      <p><strong>${escapeHtml(hashStatus)}</strong> | <strong>${escapeHtml(signatureStatus)}</strong></p>
      <p><strong>Ciphertext:</strong> ${escapeHtml((proof.ciphertext || '').slice(0, 72))}</p>
      <p><strong>Decrypted Text:</strong> ${escapeHtml((proof.decryptedText || '-').slice(0, 180))}</p>
      <p><strong>Timestamp:</strong> ${escapeHtml(proof.createdAt || '-')}</p>
    </article>
  `;
}

async function loadProofs() {
  try {
    const response = await fetch('/api/proofs');
    const data = await response.json();
    const proofs = data.proofs || [];
    proofMeta.textContent = `${proofs.length} proof records saved in the database / fallback store.`;
    if (!proofs.length) {
      proofList.innerHTML = '<div class="receiver-meta">No proof data yet.</div>';
      return;
    }
    proofList.innerHTML = proofs.map(renderProof).join('');
  } catch (error) {
    proofMeta.textContent = 'Unable to load proof records.';
    proofList.innerHTML = `<div class="message-card danger"><h4>Error</h4><p>${escapeHtml(error.message)}</p></div>`;
  }
}

loadProofs();
