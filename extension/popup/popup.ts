import { generateTOTP } from '../utils/totp';
import QrScanner from 'qr-scanner';

// ── Cross-browser compatibility ─────────────────────────────
// Chrome, Edge, Opera use `chrome.*`; Firefox MV3 also supports `chrome.*` 
// but historically used `browser.*`. Safari also supports `chrome.*` in MV3.
// We use `chrome.*` which is the universal MV3 standard.
const storage = chrome.storage.local;
const runtime = chrome.runtime;

// ── State ───────────────────────────────────────────────────
let editingDomain: string | null = null;
let vault: Record<string, { secret: string }> = {};
let searchQuery = '';

// ── DOM refs ────────────────────────────────────────────────
const domainInput = document.getElementById('domain') as HTMLInputElement;
const secretInput = document.getElementById('secret') as HTMLInputElement;
const form = document.getElementById('addForm') as HTMLFormElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const cancelEditBtn = document.getElementById('cancelEditBtn') as HTMLButtonElement;
const secretsList = document.getElementById('secretsList') as HTMLUListElement;
const emptyState = document.getElementById('emptyState') as HTMLDivElement;
const template = document.getElementById('secret-item-template') as HTMLTemplateElement;
const toggleFormBtn = document.getElementById('toggleFormBtn') as HTMLButtonElement;
const formPanel = document.getElementById('formPanel') as HTMLDivElement;
const formTitle = document.getElementById('formTitle') as HTMLSpanElement;
const searchBar = document.getElementById('searchBar') as HTMLDivElement;
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const toggleSecretBtn = document.getElementById('toggleSecret') as HTMLButtonElement;
const eyeIcon = document.getElementById('eyeIcon') as SVGElement;
const eyeOffIcon = document.getElementById('eyeOffIcon') as SVGElement;
const qrBtn = document.getElementById('qrBtn') as HTMLButtonElement;
const qrInput = document.getElementById('qrInput') as HTMLInputElement;
const toastEl = document.getElementById('toast') as HTMLDivElement;
const toastMsg = document.getElementById('toastMsg') as HTMLSpanElement;

const helpBtn = document.getElementById('helpBtn') as HTMLButtonElement;
const helpModal = document.getElementById('helpModal') as HTMLDivElement;
const closeHelpBtn = document.getElementById('closeHelpBtn') as HTMLButtonElement;

const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;
const sunIcon = document.getElementById('sunIcon') as SVGElement;
const moonIcon = document.getElementById('moonIcon') as SVGElement;

const CIRCUMFERENCE = 2 * Math.PI * 15.5; // ~97.4

// ── Theme ───────────────────────────────────────────────────
storage.get(['theme', 'colorScheme']).then((data) => {
    const theme = data.theme || 'indigo';
    themeSelect.value = theme;
    document.documentElement.setAttribute('data-theme', theme);

    const colorScheme = data.colorScheme || 'dark';
    document.documentElement.setAttribute('data-color-scheme', colorScheme);
    sunIcon.classList.toggle('hidden', colorScheme === 'dark');
    moonIcon.classList.toggle('hidden', colorScheme === 'light');
});

themeSelect.addEventListener('change', (e) => {
    const theme = (e.target as HTMLSelectElement).value;
    document.documentElement.setAttribute('data-theme', theme);
    storage.set({ theme });
});

themeToggleBtn.addEventListener('click', () => {
    const currentScheme = document.documentElement.getAttribute('data-color-scheme') || 'dark';
    const newScheme = currentScheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-color-scheme', newScheme);
    sunIcon.classList.toggle('hidden', newScheme === 'dark');
    moonIcon.classList.toggle('hidden', newScheme === 'light');
    
    storage.set({ colorScheme: newScheme });
});

// ── Help Modal ──────────────────────────────────────────────
helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
closeHelpBtn.addEventListener('click', () => helpModal.classList.add('hidden'));

// ── Toast ───────────────────────────────────────────────────
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string) {
    toastMsg.textContent = msg;
    toastEl.classList.remove('hidden');
    // Force reflow so transition fires
    void toastEl.offsetWidth;
    toastEl.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.classList.add('hidden'), 300);
    }, 2000);
}

// ── Toggle Form ─────────────────────────────────────────────
function openForm(isEdit = false) {
    formPanel.classList.remove('collapsed');
    toggleFormBtn.classList.add('active');
    if (!isEdit) {
        formTitle.textContent = 'Add New Secret';
        (saveBtn.querySelector('span') as HTMLSpanElement).textContent = 'Add Secret';
        (saveBtn.querySelector('svg') as SVGElement).style.display = '';
    }
}

function closeForm() {
    formPanel.classList.add('collapsed');
    toggleFormBtn.classList.remove('active');
    cancelEdit();
}

toggleFormBtn.addEventListener('click', () => {
    if (formPanel.classList.contains('collapsed')) {
        openForm();
        setTimeout(() => domainInput.focus(), 350);
    } else {
        closeForm();
    }
});

// ── Toggle secret visibility ────────────────────────────────
let secretVisible = false;
toggleSecretBtn.addEventListener('click', () => {
    secretVisible = !secretVisible;
    secretInput.type = secretVisible ? 'text' : 'password';
    eyeIcon.classList.toggle('hidden', secretVisible);
    eyeOffIcon.classList.toggle('hidden', !secretVisible);
});

// ── QR Scanner ──────────────────────────────────────────────
qrBtn.addEventListener('click', () => qrInput.click());

qrInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    (e.target as HTMLInputElement).value = '';
    
    await handleQrFile(file);
});

// Allow pasting images from clipboard
document.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                // Open form if closed
                if (formPanel.classList.contains('collapsed')) {
                    openForm();
                }
                await handleQrFile(file);
                return; // Break after first image found
            }
        }
    }
});

async function handleQrFile(file: File) {
    try {
        qrBtn.classList.add('loading'); // Optional styling
        const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
        
        // Expected format: otpauth://totp/Issuer:Label?secret=SECRET&issuer=Issuer
        const url = new URL(result.data);
        
        if (url.protocol !== 'otpauth:' || url.host !== 'totp') {
            showToast('Invalid QR code: Not a TOTP URI');
            return;
        }

        const secret = url.searchParams.get('secret');
        if (!secret) {
            showToast('No secret found in QR code');
            return;
        }

        // Try to extract domain/label from pathname or issuer param
        let domainStr = url.pathname.replace(/^\//, ''); // Remove leading slash
        const issuer = url.searchParams.get('issuer');
        
        if (issuer && !domainStr.includes(issuer)) {
             domainStr = issuer; // Prefer issuer param if present
        } else if (domainStr.includes(':')) {
             domainStr = domainStr.split(':')[0]; // Example "GitHub:user" -> "GitHub"
        } else if (!domainStr) {
             domainStr = 'Scanned Account';
        }

        // Auto-fill form
        domainInput.value = decodeURIComponent(domainStr).trim();
        secretInput.value = secret;
        
        // Force secret to be visible to verify
        if (!secretVisible) toggleSecretBtn.click();
        
        showToast('QR code scanned successfully');

    } catch (err) {
        showToast('No QR code found in image');
        console.error('QR scan error:', err);
    } finally {
        qrBtn.classList.remove('loading');
    }
}

// ── Vault operations ────────────────────────────────────────
async function loadVault() {
    const data = await storage.get('vault');
    vault = data.vault || {};
    updateUI();
}

async function saveVault() {
    await storage.set({ vault });
    updateUI();
}

function updateUI() {
    const domains = Object.keys(vault).sort();
    // Show/hide search bar if 3+ entries
    searchBar.classList.toggle('hidden', domains.length < 3);
    renderList();
}

// ── Search ──────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderList();
});

// ── Render List ─────────────────────────────────────────────
function renderList() {
    secretsList.innerHTML = '';
    let domains = Object.keys(vault).sort();

    if (searchQuery) {
        domains = domains.filter(d => d.toLowerCase().includes(searchQuery));
    }

    if (Object.keys(vault).length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    if (domains.length === 0) {
        // Search returned no results
        const noResult = document.createElement('div');
        noResult.className = 'empty-state';
        noResult.innerHTML = `<p class="empty-desc">No matches for "<strong>${searchQuery}</strong>"</p>`;
        secretsList.appendChild(noResult);
        return;
    }

    domains.forEach((domain, index) => {
        const item = template.content.cloneNode(true) as DocumentFragment;
        const li = item.querySelector('li')!;
        li.style.animationDelay = `${index * 40}ms`;
        li.style.position = 'relative';

        // Domain name
        li.querySelector('.domain-name')!.textContent = domain;

        // Generate TOTP
        const totpCodeEl = li.querySelector('.totp-code')!;
        try {
            const code = generateTOTP(vault[domain].secret);
            totpCodeEl.textContent = formatCode(code);
        } catch {
            totpCodeEl.textContent = 'INVALID';
            totpCodeEl.classList.add('error');
        }

        // Countdown ring
        updateCountdown(li);

        // ── Copy ────────────────────────────────────────────
        li.querySelector('.copy-btn')!.addEventListener('click', async () => {
            try {
                const code = generateTOTP(vault[domain].secret);
                await navigator.clipboard.writeText(code);
                const btn = li.querySelector('.copy-btn')!;
                btn.classList.add('copied');
                showToast('Code copied!');
                setTimeout(() => btn.classList.remove('copied'), 1500);
            } catch {
                showToast('Copy failed');
            }
        });

        // ── Edit ────────────────────────────────────────────
        li.querySelector('.edit-btn')!.addEventListener('click', () => {
            editingDomain = domain;
            domainInput.value = domain;
            secretInput.value = vault[domain].secret;
            formTitle.textContent = 'Edit Secret';
            (saveBtn.querySelector('span') as HTMLSpanElement).textContent = 'Update';
            (saveBtn.querySelector('svg') as SVGElement).style.display = 'none';
            cancelEditBtn.classList.remove('hidden');
            openForm(true);
            setTimeout(() => domainInput.focus(), 350);
        });

        // ── Delete (inline confirmation) ────────────────────
        li.querySelector('.delete-btn')!.addEventListener('click', () => {
            // Check if there is already a confirm overlay
            if (li.querySelector('.delete-confirm')) return;

            const overlay = document.createElement('div');
            overlay.className = 'delete-confirm';
            overlay.innerHTML = `
                <span>Delete?</span>
                <button class="confirm-yes" type="button">Yes</button>
                <button class="confirm-no" type="button">No</button>
            `;

            overlay.querySelector('.confirm-yes')!.addEventListener('click', async () => {
                delete vault[domain];
                if (editingDomain === domain) cancelEdit();
                await saveVault();
                showToast(`${domain} removed`);
            });

            overlay.querySelector('.confirm-no')!.addEventListener('click', () => {
                overlay.remove();
            });

            li.appendChild(overlay);
        });

        secretsList.appendChild(item);
    });
}

// ── Format TOTP code with space in middle ───────────────────
function formatCode(code: string): string {
    if (code.length === 6) return code.slice(0, 3) + ' ' + code.slice(3);
    return code;
}

// ── Countdown ───────────────────────────────────────────────
function updateCountdown(li: Element) {
    const now = Math.floor(Date.now() / 1000);
    const remaining = 30 - (now % 30);
    const offset = CIRCUMFERENCE - (remaining / 30) * CIRCUMFERENCE;

    const ring = li.querySelector('.ring-progress') as SVGCircleElement;
    const text = li.querySelector('.countdown-text') as HTMLSpanElement;

    if (ring && text) {
        ring.style.strokeDashoffset = String(offset);
        text.textContent = String(remaining);
        ring.classList.toggle('urgent', remaining <= 5);
    }
}

// ── Cancel Edit ─────────────────────────────────────────────
function cancelEdit() {
    editingDomain = null;
    form.reset();
    formTitle.textContent = 'Add New Secret';
    (saveBtn.querySelector('span') as HTMLSpanElement).textContent = 'Add Secret';
    (saveBtn.querySelector('svg') as SVGElement).style.display = '';
    cancelEditBtn.classList.add('hidden');
    secretVisible = false;
    secretInput.type = 'password';
    eyeIcon.classList.remove('hidden');
    eyeOffIcon.classList.add('hidden');
}

// ── Form submission ─────────────────────────────────────────
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const domain = domainInput.value.trim().toLowerCase();
    const secret = secretInput.value.trim();

    if (!domain || !secret) return;

    // Validate secret is valid Base32 before saving
    try {
        generateTOTP(secret);
    } catch {
        showToast('Invalid secret key');
        secretInput.focus();
        return;
    }

    const isNew = !vault[domain];

    if (editingDomain && editingDomain !== domain) {
        delete vault[editingDomain];
    }

    vault[domain] = { secret };
    await saveVault();
    showToast(isNew ? `${domain} added` : `${domain} updated`);
    closeForm();
});

cancelEditBtn.addEventListener('click', closeForm);

// ── Initial load ────────────────────────────────────────────
loadVault();

// ── Live update every second ────────────────────────────────
setInterval(() => {
    const items = secretsList.querySelectorAll('li.secret-item');
    items.forEach(li => {
        const domainEl = li.querySelector('.domain-name');
        const domain = domainEl?.textContent;
        if (!domain || !vault[domain]) return;

        // Update countdown ring
        updateCountdown(li);

        // Update TOTP code
        try {
            const code = generateTOTP(vault[domain].secret);
            const codeEl = li.querySelector('.totp-code')!;
            const formatted = formatCode(code);
            if (codeEl.textContent !== formatted) {
                codeEl.textContent = formatted;
            }
        } catch {
            // Keep existing state
        }
    });
}, 1000);
