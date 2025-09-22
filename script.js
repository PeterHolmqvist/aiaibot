/* ========= shared: helpers ========= */
const $ = (id) => document.getElementById(id);
const shorten = (a) => (a ? `${a.slice(0,4)}…${a.slice(-4)}` : 'Connect');

function setStatus(text) { const el = $('walletStatus'); if (el) el.textContent = `Wallet: ${text}`; }
function setPill(addr)   { const txt = addr ? shorten(addr) : 'Connect'; ['connectPill','connectBtn'].forEach(id => { const el=$(id); if (el) el.textContent = txt; }); }
function save(addr, chain){ localStorage.setItem('aiaibot_addr', addr||''); localStorage.setItem('aiaibot_chain', chain||''); }
function load(){ return { addr: localStorage.getItem('aiaibot_addr')||'', chain: localStorage.getItem('aiaibot_chain')||'' }; }
function disconnectWallet(){
  try { window.solana?.disconnect?.(); } catch(_) {}
  localStorage.removeItem('aiaibot_addr');
  localStorage.removeItem('aiaibot_chain');
  setPill('');            // shows “Connect”
  setStatus('Not connected');
}

/* ========= shared: wallet connect (Solana first, then EVM) ========= */
async function connectWallet() {
  // Solana (Phantom/Trust)
  const sol = window.solana;
  if (sol && (sol.isPhantom || sol.isTrust || sol.connect)) {
    try {
      const resp = await sol.connect(); // popup
      const addr = resp?.publicKey?.toString?.() || sol.publicKey?.toString?.() || '';
      if (addr) {
        setPill(addr); setStatus(addr); save(addr,'sol');
        sol.on?.('accountChanged', (pk)=>{ const a=pk?pk.toString():''; setPill(a); setStatus(a||'Disconnected'); save(a,'sol'); });
        return;
      }
    } catch(e){ console.warn('Solana connect cancelled:', e); }
  }
  // EVM (Trust/MetaMask etc.)
  const eth = window.ethereum || window.trustwallet || null;
  if (eth) {
    try {
      const accs = await eth.request({ method:'eth_requestAccounts' });
      const addr = accs?.[0] || '';
      if (addr) {
        setPill(addr); setStatus(addr); save(addr,'evm');
        eth.on?.('accountsChanged', (acc)=>{ const a=acc?.[0]||''; setPill(a); setStatus(a||'Disconnected'); save(a,'evm'); });
        return;
      }
    } catch(e){ console.warn('EVM connect cancelled:', e); }
  }
  alert('No compatible wallet found. Install Trust Wallet, Phantom, or MetaMask.');
}

/* ========= presale: payment selector (custom dropdown) ========= */
const ADDRS = {
  SOL:     "BwWqamBRPFe2uqmgbFv9kJwWvDartafW1qiXfJwLRVrs",
  ETH:     "0x2EE381ba70ca63F547041812158F7DdA78f54b64",
  BNB:     "0x2EE381ba70ca63F547041812158F7DdA78f54b64",
  POLYGON: "0x2EE381ba70ca63F547041812158F7DdA78f54b64",
  BTC:     "bc1qztasf5emlsjlznqtm0fr7vw4erxxjfmv7xqy99",
  USDT: {
    ERC20:   "0x2EE381ba70ca63F547041812158F7DdA78f54b64",
    SPL:     "BwWqamBRPFe2uqmgbFv9kJwWvDartafW1qiXfJwLRVrs",
    BEP20:   "0x2EE381ba70ca63F547041812158F7DdA78f54b64",
    POLYGON: "0x2EE381ba70ca63F547041812158F7DdA78f54b64"
  }
};

// Ikoner för menyknapparna
const ICONS = {
  SOL: 'assets/sol.svg',
  ETH: 'assets/eth.svg',
  BNB: 'assets/bnb.svg',
  POLYGON: 'assets/polygon.svg',
  BTC: 'assets/btc.svg',
  USDT: 'assets/usdt.svg'
};

function initPaymentSelector(){
  const ddCur  = document.getElementById('ddCurrency');     // valuta-dropdown
  const ddUsdt = document.getElementById('ddUsdt');         // USDT-nät-dropdown
  const elAddr = $('payAddress');
  const elLbl  = $('payLabel');
  const elCopy = $('copyPay');
  const hint   = $('networkHint');

  if (!ddCur || !elAddr || !elLbl) return; // inte på denna sida

  const labelFor = (cur) =>
    cur === 'POLYGON' ? 'POL (Polygon)' :
    cur === 'BNB'     ? 'BNB (BSC)' :
    cur === 'ETH'     ? 'ETH (Ethereum)' :
    cur === 'BTC'     ? 'BTC (Bitcoin)' :
                        'SOL (Solana)';

  function openToggle(dd, open){
    dd.classList[open ? 'add' : 'remove']('open');
  }

  function bindDropdown(dd, onSelect){
    const btn  = dd.querySelector('.dd-toggle');
    const list = dd.querySelector('.dd-list');

    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const isOpen = dd.classList.contains('open');
      document.querySelectorAll('.dd.open').forEach(x => x!==dd && openToggle(x,false));
      openToggle(dd, !isOpen);
    });

    list.querySelectorAll('.dd-item').forEach(item=>{
      item.addEventListener('click', (e)=>{
        e.stopPropagation();
        const val   = item.dataset.value;
        const icon  = item.querySelector('img')?.getAttribute('src');
        const label = item.querySelector('span')?.textContent || val;

        const tIcon = dd.querySelector('.dd-toggle .dd-icon');
        const tLab  = dd.querySelector('.dd-toggle .dd-label');
        if (tIcon && icon) tIcon.src = icon;
        if (tLab)          tLab.textContent = label;

        openToggle(dd,false);
        onSelect(val);
      });
    });
  }

  function setCurrencyUI(cur){
    const tIcon = ddCur.querySelector('.dd-toggle .dd-icon');
    const tLab  = ddCur.querySelector('.dd-toggle .dd-label');
    if (tIcon) tIcon.src = ICONS[cur] || ICONS.SOL;
    if (tLab)  tLab.textContent = cur === 'USDT' ? 'USDT' : labelFor(cur);

    ddUsdt.style.display = (cur === 'USDT') ? '' : 'none';

    if (cur === 'USDT'){
      const net = ddUsdt.querySelector('.dd-toggle .dd-label')?.dataset?.net || 'ERC20';
      elLbl.textContent  = `USDT on ${net}`;
      elAddr.textContent = ADDRS.USDT[net];
    } else {
      elLbl.textContent  = labelFor(cur);
      elAddr.textContent = ADDRS[cur];
    }

    // <<< NYTT: styr amount-boxen (bara för SOL) >>>
    enablePayIfSol(cur); // visar amount + pay bara för SOL
  }

  function setUsdtUI(net){
    const tLab = ddUsdt.querySelector('.dd-toggle .dd-label');
    if (tLab){
      tLab.textContent =
        net==='ERC20' ? 'USDT on Ethereum (ERC-20)' :
        net==='SPL'   ? 'USDT on Solana (SPL)' :
        net==='BEP20' ? 'USDT on BNB (BEP-20)' :
                        'USDT on Polygon';
      tLab.dataset.net = net;
    }
    elLbl.textContent  = `USDT on ${net}`;
    elAddr.textContent = ADDRS.USDT[net];
  }

  document.addEventListener('click', ()=> {
    document.querySelectorAll('.dd.open').forEach(dd=>openToggle(dd,false));
  });

  bindDropdown(ddCur,  (val)=> setCurrencyUI(val));
  bindDropdown(ddUsdt, (net)=> setUsdtUI(net));

  // Auto-detect nätverk (best effort), annars default SOL
  (async ()=>{
    try {
      if (window.solana?.connect) {
        await window.solana.connect({ onlyIfTrusted:true }).catch(()=>{});
        if (window.solana.publicKey){
          setCurrencyUI('SOL');
          if (hint) hint.textContent = 'Detected Solana wallet.';
          return;
        }
      }
    } catch(_){}
    try {
      const eth = window.ethereum || window.trustwallet;
      if (eth){
        const id = parseInt(await eth.request({ method:'eth_chainId' }),16);
        if (id===1)       setCurrencyUI('ETH');
        else if (id===56) setCurrencyUI('BNB');
        else if (id===137)setCurrencyUI('POLYGON');
        else              setCurrencyUI('ETH');
        if (hint) hint.textContent = 'Detected EVM network.';
        return;
      }
    } catch(_){}
    setCurrencyUI('SOL');
  })();

  elCopy?.addEventListener('click', (e)=>{
    e.preventDefault();
    navigator.clipboard.writeText(elAddr.textContent);
    elCopy.textContent = 'Copy';
  });
}

/* ========= presale: countdown/progress (only if elements exist) ========= */
function initCountdownAndProgress(){
  const timer = $('timer'), addrCopy = $('copy'), addr = $('addr'), raisedEl=$('raised'), targetEl=$('target'), fillEl=$('fill');
  if (timer){
    const deadline = new Date("2025-10-21T20:00:00Z").getTime();
    setInterval(()=>{ const t=deadline-Date.now(); if(t<0)return; const h=Math.floor(t/36e5), m=Math.floor(t%36e5/6e4), s=Math.floor(t%6e4/1e3); timer.textContent=`${h}h ${m}m ${s}s`; },1000);
  }
  if (addrCopy && addr){
    addrCopy.onclick=(e)=>{ e.preventDefault(); navigator.clipboard.writeText(addr.textContent); addrCopy.textContent='Copied!'; setTimeout(()=>addrCopy.textContent='Copy',1200); };
  }
  if (raisedEl && targetEl && fillEl){
    const raised=0, target=800;
    raisedEl.textContent=raised; targetEl.textContent=target;
    fillEl.style.width=Math.min(100,(raised/target)*100)+'%';
  }
}

/* ========= boot (runs on both pages safely) ========= */
window.addEventListener('DOMContentLoaded', () => {
  const { addr } = load(); setPill(addr); setStatus(addr || 'Not connected');

  ['connectPill','connectBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', async () => {
      const addr = (localStorage.getItem('aiaibot_addr')||'').trim();
      if (addr) {
        if (confirm('Disconnect wallet from AiAiBot?')) disconnectWallet();
      } else {
        await connectWallet();
      }
    });
  });

  setTimeout(async () => {
    try {
      const sol = window.solana;
      if (sol?.connect) {
        await sol.connect({ onlyIfTrusted:true }).catch(()=>{});
        const a = sol.publicKey?.toString?.();
        if (a){ setPill(a); setStatus(a); save(a,'sol'); }
      }
    } catch(e){}
    try {
      const eth = window.ethereum || window.trustwallet;
      if (eth) {
        const accs = await eth.request({ method:'eth_accounts' });
        if (accs?.[0]){ setPill(accs[0]); setStatus(accs[0]); save(accs[0],'evm'); }
      }
    } catch(e){}
  }, 60);

  initPaymentSelector();
  initCountdownAndProgress();

  // <<< NYTT: starta amount-boxen (SOL 0.2–2.0 + växelkurs) >>>
  initAmountBox();
});

// === terminal typing effect (loops) ===
function initTerminalTyping() {
  const el = document.querySelector('.terminal-os__screen span:first-child');
  if (!el) return;
  const full = el.textContent.trim();

  function typeLoop() {
    let i = 0;
    function typeOnce() {
      if (i <= full.length) {
        el.textContent = full.slice(0, i);
        i++;
        setTimeout(typeOnce, 35);
      } else {
        setTimeout(() => {
          el.textContent = '';
          typeLoop();
        }, 5000);
      }
    }
    typeOnce();
  }

  el.textContent = '';
  typeLoop();
}
initTerminalTyping();

// === price + amount (SOL only) ===
const PRICE_PER_TOKEN_USD = 0.001;

async function fetchSolUsd(){
  try{
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',{cache:'no-store'});
    if(!r.ok) throw 0; const j = await r.json(); return j.solana?.usd || 0;
  }catch{ return 0; }
}

function toggleAmountBox(show){
  const box = document.getElementById('amountBox');
  if (box) box.style.display = show ? '' : 'none';
}

function initAmountBox(){
  const input = document.getElementById('amountInput');
  const maxBtn = document.getElementById('maxBtn');
  const est = document.getElementById('estTokens');
  if (!input || !est) return;

  let solUsd = 0;

  async function refreshPrice(){
    const p = await fetchSolUsd();
    if (p) { solUsd = p; update(); }
  }

  function clamp(v){ if(isNaN(v)) return 0.2; return Math.max(0.2, Math.min(2.0, v)); }

  function update(){
    const amt = clamp(parseFloat(input.value||'0'));
    input.value = (input.value ? amt : '');
    if (!amt || !solUsd){ est.textContent = '—'; return; }
    const usd = amt * solUsd;
    const tokens = usd / PRICE_PER_TOKEN_USD;
    est.textContent = Math.floor(tokens).toLocaleString();
  }

  input.addEventListener('input', update);
  maxBtn?.addEventListener('click', ()=>{ input.value='2.0'; update(); });

  refreshPrice();
  setInterval(refreshPrice, 60000);
}

// hooka in i payment-selector: visa boxen bara för SOL
function onCurrencyChangedForAmount(cur){
  toggleAmountBox(cur === 'SOL');
}

// === SOL Pay button (simple transfer) ===
function setPayUI(show){ 
  const a = document.getElementById('payActions'); 
  if (a) a.style.display = show ? '' : 'none'; 
}

function enablePayIfSol(cur){
  // visa amount + pay bara för SOL
  const isSol = (cur === 'SOL');
  toggleAmountBox(isSol);
  setPayUI(isSol);
}

function solConnected(){ return !!(window.solana && window.solana.publicKey); }

async function payWithSol(){
  const status = document.getElementById('payStatus');
  const input  = document.getElementById('amountInput');
  const toAddr = ADDRS.SOL; // din preset
  if (!input) return;

  // validations
  const amt = parseFloat(input.value || '0');
  if (isNaN(amt) || amt < 0.2 || amt > 2.0){
    alert('Enter an amount between 0.2 and 2.0 SOL.'); return;
  }
  if (!window.solana){
    alert('No Solana wallet found. Install Phantom or Trust.'); return;
  }

  try{
    // connect if needed
    if (!solConnected()){
      await window.solana.connect(); // popup
    }
    status.textContent = 'Building transaction…';

    const { Connection, PublicKey, SystemProgram, Transaction } = solanaWeb3;
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const fromPubkey = new PublicKey(window.solana.publicKey.toString());
    const toPubkey   = new PublicKey(toAddr);

    const lamports = BigInt(Math.round(amt * 1e9)); // 1 SOL = 1e9 lamports

    const { blockhash } = await connection.getLatestBlockhash('finalized');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey })
      .add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports }));

    status.textContent = 'Requesting signature…';
    // Phantom stöder signAndSendTransaction
    const sig = await window.solana.signAndSendTransaction(tx);
    status.textContent = 'Submitting…';

    // vänta på kvitto
    await connection.confirmTransaction(sig.signature, 'confirmed');

    status.textContent = 'Success!';
    alert(`Payment sent ✔\nSignature:\n${sig.signature}`);
  }catch(err){
    console.error(err);
    status.textContent = 'Payment canceled or failed.';
    alert('Payment canceled or failed.');
  }
}

// Hooka upp knappen när DOM är klar
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('payWithSol');
  if (btn) btn.addEventListener('click', payWithSol);
});



