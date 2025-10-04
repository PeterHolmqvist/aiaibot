/* =========================
   AiAiBot Presale Frontend
   Single-source, self-contained
   ========================= */

(function () {
  'use strict';
  // sanity probe: if you don't see this in console, file didn't load
  console.log('[AiAiBot] script booting…');

  // Do NOT hard-return here; just warn so the rest of the UI can still bind
  if (!window.solanaWeb3) {
    console.warn('[AiAiBot] Solana web3 global not found. Check script tag order.');
    // no return; continue so the page remains interactive while you debug
  }

   /* ---------- CONSTANTS ( devnet ) ---------- */
const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new solanaWeb3.PublicKey("GKiKsPmSQHGvg5VFXAGy99vmb3JV9BPnqFzC9iwp95Km"); // your deployed devnet program
const MINT       = new solanaWeb3.PublicKey("CXxT8WBTSyCdTW14q4DTjCRzH2etqXxKZCRkffFpermn"); // your devnet mint


const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey("ATokenGPvR93gBfue3DBeQ8Z8CwRk3s8H7RkG4GZLFpR");

const conn = new solanaWeb3.Connection(RPC, "confirmed");

/* ---------- SMALL HELPERS ---------- */
const $id = (id) => document.getElementById(id);
const shorten = (a) => (a ? `${a.slice(0,4)}…${a.slice(-4)}` : 'Connect');

function setPill(addr) { const t = addr ? shorten(addr) : 'Connect';
  ['connectPill','connectBtn'].forEach(id => { const el=$id(id); if (el) el.textContent=t; });
}
function setStatus(text){ const el=$id('walletStatus'); if (el) el.textContent=`Wallet: ${text}`; }
function save(addr,chain){ localStorage.setItem('aiaibot_addr',addr||''); localStorage.setItem('aiaibot_chain',chain||''); }
function load(){ return { addr: localStorage.getItem('aiaibot_addr')||'', chain: localStorage.getItem('aiaibot_chain')||'' }; }
function disconnectWallet(){
  try{ window.solana?.disconnect?.(); }catch(_){}
  localStorage.removeItem('aiaibot_addr'); localStorage.removeItem('aiaibot_chain');
  setPill(''); setStatus('Not connected');
}

/* ---------- WALLET CONNECT (Solana first, then EVM fallback) ---------- */
async function connectWallet() {
  const sol = window.solana;
  if (sol && (sol.isPhantom || sol.isTrust || sol.connect)) {
    const resp = await sol.connect().catch(()=>null);
    const addr = resp?.publicKey?.toString?.() || sol?.publicKey?.toString?.() || '';
    if (addr) {
      setPill(addr); setStatus(addr); save(addr,'sol');
      sol.on?.('accountChanged', (pk)=>{ const a=pk?pk.toString():''; setPill(a); setStatus(a||'Disconnected'); save(a,'sol'); });
      return;
    }
  }
  const eth = window.ethereum || window.trustwallet || null;
  if (eth) {
    const accs = await eth.request({ method:'eth_requestAccounts' }).catch(()=>[]);
    const addr = accs?.[0] || '';
    if (addr) {
      setPill(addr); setStatus(addr); save(addr,'evm');
      eth.on?.('accountsChanged', (acc)=>{ const a=acc?.[0]||''; setPill(a); setStatus(a||'Disconnected'); save(a,'evm'); });
      return;
    }
  }
  alert('No compatible wallet found. Install Phantom/Trust/MetaMask.');
}

/* ---------- PAYMENT SELECTOR (addresses + dropdowns) ---------- */
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
const ICONS = {
  SOL:'assets/sol.svg', ETH:'assets/eth.svg', BNB:'assets/bnb.svg',
  POLYGON:'assets/polygon.svg', BTC:'assets/btc.svg', USDT:'assets/usdt.svg'
};

function enablePayIfSol(cur){
  const amtBox = $id('amountBox'); const actions=$id('payActions');
  const show = (cur==='SOL');
  if (amtBox) amtBox.style.display = show ? '' : 'none';
  if (actions) actions.style.display = show ? '' : 'none';
}

function initPaymentSelector(){
  const ddCur  = $id('ddCurrency');
  const ddUsdt = $id('ddUsdt');
  const elAddr = $id('payAddress');
  const elLbl  = $id('payLabel');
  const elCopy = $id('copyPay');
  const hint   = $id('networkHint');
  if (!ddCur || !elAddr || !elLbl) return;

  const labelFor = (cur) =>
    cur==='POLYGON'?'POL (Polygon)':cur==='BNB'?'BNB (BSC)':cur==='ETH'?'ETH (Ethereum)':cur==='BTC'?'BTC (Bitcoin)':'SOL (Solana)';

  function openToggle(dd, open){ dd.classList[open ? 'add' : 'remove']('open'); }
  function bindDropdown(dd, onSelect){
    const btn  = dd.querySelector('.dd-toggle');
    const list = dd.querySelector('.dd-list');
    btn.addEventListener('click', (e)=>{ e.stopPropagation(); const isOpen = dd.classList.contains('open');
      document.querySelectorAll('.dd.open').forEach(x => x!==dd && openToggle(x,false));
      openToggle(dd, !isOpen);
    });
    list.querySelectorAll('.dd-item').forEach(item=>{
      item.addEventListener('click',(e)=>{
        e.stopPropagation();
        const val = item.dataset.value, icon=item.querySelector('img')?.getAttribute('src'), label=item.querySelector('span')?.textContent || val;
        const tIcon = dd.querySelector('.dd-toggle .dd-icon');
        const tLab  = dd.querySelector('.dd-toggle .dd-label');
        if (tIcon && icon) tIcon.src = icon; if (tLab) tLab.textContent = label;
        openToggle(dd,false); onSelect(val);
      });
    });
  }
  function setCurrencyUI(cur){
    const tIcon = ddCur.querySelector('.dd-toggle .dd-icon');
    const tLab  = ddCur.querySelector('.dd-toggle .dd-label');
    if (tIcon) tIcon.src = ICONS[cur] || ICONS.SOL;
    if (tLab)  tLab.textContent = cur==='USDT' ? 'USDT' : labelFor(cur);
    if (ddUsdt) ddUsdt.style.display = (cur==='USDT') ? '' : 'none';
    if (cur==='USDT'){
      const net = ddUsdt?.querySelector('.dd-toggle .dd-label')?.dataset?.net || 'ERC20';
      elLbl.textContent  = `USDT on ${net}`;
      elAddr.textContent = ADDRS.USDT[net];
    } else {
      elLbl.textContent  = labelFor(cur);
      elAddr.textContent = ADDRS[cur];
    }
    enablePayIfSol(cur);
  }
  function setUsdtUI(net){
    const tLab = ddUsdt?.querySelector('.dd-toggle .dd-label');
    if (tLab){
      tLab.textContent = net==='ERC20'?'USDT on Ethereum (ERC-20)':net==='SPL'?'USDT on Solana (SPL)':net==='BEP20'?'USDT on BNB (BEP-20)':'USDT on Polygon';
      tLab.dataset.net = net;
    }
    elLbl.textContent  = `USDT on ${net}`;
    elAddr.textContent = ADDRS.USDT[net];
  }
  document.addEventListener('click', ()=>{ document.querySelectorAll('.dd.open').forEach(dd=>openToggle(dd,false)); });
  bindDropdown(ddCur,  (val)=> setCurrencyUI(val));
  bindDropdown(ddUsdt, (net)=> setUsdtUI(net));

  (async ()=>{
    try{
      if (window.solana?.connect){
        await window.solana.connect({ onlyIfTrusted:true }).catch(()=>{});
        if (window.solana.publicKey){ setCurrencyUI('SOL'); if(hint) hint.textContent='Detected Solana wallet.'; return; }
      }
    }catch(_){}
    try{
      const eth=window.ethereum||window.trustwallet;
      if (eth){
        const id=parseInt(await eth.request({method:'eth_chainId'}),16);
        if (id===1) setCurrencyUI('ETH'); else if(id===56) setCurrencyUI('BNB'); else if(id===137) setCurrencyUI('POLYGON'); else setCurrencyUI('ETH');
        if (hint) hint.textContent='Detected EVM network.'; return;
      }
    }catch(_){}
    setCurrencyUI('SOL');
  })();

  elCopy?.addEventListener('click',(e)=>{ e.preventDefault(); navigator.clipboard.writeText(elAddr.textContent); elCopy.textContent='Copy'; });
}

/* ---------- COUNTDOWN + STATIC PROGRESS BAR ---------- */
function initCountdownAndProgress(){
  const timer=$id('timer'), raisedEl=$id('raised'), targetEl=$id('target'), fillEl=$id('fill');
  if (timer){
    const deadline=new Date("2025-10-21T20:00:00Z").getTime();
    setInterval(()=>{ const t=deadline-Date.now(); if(t<0)return; const h=Math.floor(t/36e5),m=Math.floor(t%36e5/6e4),s=Math.floor(t%6e4/1e3); timer.textContent=`${h}h ${m}m ${s}s`; },1000);
  }
  if (raisedEl && targetEl && fillEl){
    const raised=0, target=800; // static for now
    raisedEl.textContent=raised; targetEl.textContent=target;
    fillEl.style.width=Math.min(100,(raised/target)*100)+'%';
  }
}

/* ---------- PRICE / AMOUNT (SOL only) ---------- */
const PRICE_PER_TOKEN_USD = 0.001;
async function fetchSolUsd(){
  try{
    const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',{cache:'no-store'});
    if(!r.ok) throw 0; const j=await r.json(); return j.solana?.usd||0;
  }catch{ return 0; }
}
function toggleAmountBox(show){ const box=$id('amountBox'); if (box) box.style.display = show ? '' : 'none'; }
function initAmountBox(){
  const input=$id('amountInput'), maxBtn=$id('maxBtn'), est=$id('estTokens');
  if (!input || !est) return;
  let solUsd=0;
  async function refreshPrice(){ const p=await fetchSolUsd(); if (p){ solUsd=p; update(); } }
  const clamp=(v)=>{ if(isNaN(v)) return 0.2; return Math.max(0.2, Math.min(2.0, v)); };
  function update(){
    const amt=clamp(parseFloat(input.value||'0')); input.value = (input.value ? amt : '');
    if (!amt || !solUsd){ est.textContent='—'; return; }
    const usd=amt*solUsd; const tokens=usd/PRICE_PER_TOKEN_USD; est.textContent=Math.floor(tokens).toLocaleString();
  }
  input.addEventListener('input', update);
  maxBtn?.addEventListener('click', ()=>{ input.value='2.0'; update(); });
  refreshPrice(); setInterval(refreshPrice, 60000);
}

/* ---------- ANCHOR INSTR DATA HELPERS ---------- */
const sha256_8 = async (name) => {
  const data=new TextEncoder().encode(`global:${name}`);
  const h=await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(h).slice(0,8);
};
const u64le = (n) => {
  const b=new ArrayBuffer(8), v=new DataView(b); const big=BigInt(n);
  v.setUint32(0, Number(big & 0xffffffffn), true);
  v.setUint32(4, Number((big >> 32n) & 0xffffffffn), true);
  return new Uint8Array(b);
};
const findPDA=(seeds,pid)=> solanaWeb3.PublicKey.findProgramAddressSync(seeds,pid)[0];

/* ---------- PDAs (browser-safe, computed lazily) ---------- */
let _pdaCache = null;
function getPDAs(){
  if (_pdaCache) return _pdaCache;
  const enc = new TextEncoder();
  const presalePDA  = findPDA([enc.encode("presale"),   MINT.toBuffer()], PROGRAM_ID);
  const vaultPDA    = findPDA([enc.encode("vault"),     presalePDA.toBuffer()], PROGRAM_ID);
  const mintAuthPDA = findPDA([enc.encode("mint-auth"), presalePDA.toBuffer()], PROGRAM_ID);
  _pdaCache = { presalePDA, vaultPDA, mintAuthPDA };
  return _pdaCache;
}

/* ---------- ATA helper ---------- */
const ataFor = (owner) =>
  solanaWeb3.PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];

/* ---------- PURCHASE (calls on-chain `purchase`) ---------- */
async function purchaseFromUi() {
  const status = $id('payStatus');
  const input  = $id('amountInput');
  const provider = window.solana;
  if (!provider) { alert("No Solana wallet found (install Phantom/Trust)."); return; }

  const amt = parseFloat((input?.value || '').trim());
  if (isNaN(amt) || amt < 0.2 || amt > 2.0) { alert("Enter an amount between 0.2 and 2.0 SOL."); return; }
  const lamports = Math.round(amt * 1e9);

  try {
    if (!provider.publicKey) await provider.connect();
    const buyer = provider.publicKey;
    const buyerAta = ataFor(buyer);

    const { presalePDA, vaultPDA, mintAuthPDA } = getPDAs();

    const disc = await sha256_8("purchase");
    const data = new Uint8Array([...disc, ...u64le(BigInt(lamports))]);

    const keys = [
      { pubkey: buyer,       isSigner: true,  isWritable: true },
      { pubkey: presalePDA,  isSigner: false, isWritable: true },
      { pubkey: MINT,        isSigner: false, isWritable: true },
      { pubkey: mintAuthPDA, isSigner: false, isWritable: false },
      { pubkey: vaultPDA,    isSigner: false, isWritable: true },
      { pubkey: buyerAta,    isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const ix = new solanaWeb3.TransactionInstruction({ programId: PROGRAM_ID, keys, data });
    const tx = new solanaWeb3.Transaction().add(ix);
    tx.feePayer = buyer;
    tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;

    status && (status.textContent = "Requesting signature…");
    if (provider.signAndSendTransaction) {
      const { signature } = await provider.signAndSendTransaction(tx);
      status && (status.textContent = "Submitting…");
      await conn.confirmTransaction(signature, "confirmed");
      status && (status.textContent = `Success! ${signature}`);
      alert(`Purchase sent ✔\nSignature:\n${signature}`);
    } else {
      const signed = await provider.signTransaction(tx);
      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      status && (status.textContent = "Submitting…");
      await conn.confirmTransaction(sig, "confirmed");
      status && (status.textContent = `Success! ${sig}`);
      alert(`Purchase sent ✔\nSignature:\n${sig}`);
    }
  } catch (e) {
    console.error(e);
    const msg = (e && e.message) ? e.message : String(e);
    status && (status.textContent = `Failed: ${msg}`);
    alert(`Purchase failed:\n${msg}`);
  }
}

/* ---------- BOOT ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const { addr } = load(); setPill(addr); setStatus(addr || 'Not connected');

  ['connectPill','connectBtn'].forEach(id => {
    const el = $id(id);
    if (el) el.addEventListener('click', async () => {
      const cur = (localStorage.getItem('aiaibot_addr')||'').trim();
      if (cur) { if (confirm('Disconnect wallet from AiAiBot?')) disconnectWallet(); }
      else { await connectWallet(); }
    });
  });

  // try silent auto-connect
  setTimeout(async () => {
    try {
      const sol = window.solana;
      if (sol?.connect) {
        await sol.connect({ onlyIfTrusted:true }).catch(()=>{});
        const a = sol.publicKey?.toString?.();
        if (a){ setPill(a); setStatus(a); save(a,'sol'); }
      }
    } catch(_) {}
  }, 60);

  initPaymentSelector();
  initCountdownAndProgress();
  initAmountBox();

  // wire Pay with SOL
  const payBtn = $id('payWithSol');
  if (payBtn) payBtn.addEventListener('click', (e)=>{ e.preventDefault(); purchaseFromUi(); });
});

  // ======== end of your code ========
  console.log('[AiAiBot] script ready ✓');
})();




