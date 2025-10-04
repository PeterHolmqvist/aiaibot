import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createHash } from "crypto";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("GKiKsPmSQHGvg5VFXAGy99vmb3JV9BPnqFzC9iwp95Km");

const MINT_STR = process.env.MINT;
if (!MINT_STR) throw new Error("Set env var: MINT=<your_devnet_mint_address>");
const MINT = new PublicKey(MINT_STR);

// Defaults, but you can override via env: PRICE_LAMPORTS_PER_TOKEN / MIN_LAMPORTS / MAX_LAMPORTS
const PRICE = BigInt(process.env.PRICE_LAMPORTS_PER_TOKEN ?? 2_000_000);      // 0.002 SOL
const MIN   = BigInt(process.env.MIN_LAMPORTS ?? 200_000_000);                 // 0.2 SOL
const MAX   = BigInt(process.env.MAX_LAMPORTS ?? 2_000_000_000);               // 2 SOL

function discr(name: string) {
  const h = createHash("sha256").update(`global:${name}`).digest();
  return new Uint8Array(h.subarray(0, 8));
}
function u64(n: bigint) {
  const b = new ArrayBuffer(8); const v = new DataView(b);
  v.setUint32(0, Number(n & 0xffffffffn), true);
  v.setUint32(4, Number((n >> 32n) & 0xffffffffn), true);
  return new Uint8Array(b);
}

(async () => {
  const conn = new Connection(RPC, "confirmed");

  // Use the wallet & RPC from env (ANCHOR_WALLET / ANCHOR_PROVIDER_URL)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const admin = (provider.wallet as any).payer; // NodeWallet keypair

  const enc = (s: string) => new TextEncoder().encode(s);
  const [presale]  = PublicKey.findProgramAddressSync([enc("presale"),   MINT.toBytes()], PROGRAM_ID);
  const [vault]    = PublicKey.findProgramAddressSync([enc("vault"),     presale.toBytes()], PROGRAM_ID);
  const [mintAuth] = PublicKey.findProgramAddressSync([enc("mint-auth"), presale.toBytes()], PROGRAM_ID);

  console.log("Presale PDA:  ", presale.toBase58());
  console.log("Vault PDA:    ", vault.toBase58());
  console.log("MintAuth PDA: ", mintAuth.toBase58());

  const data = new Uint8Array([
    ...discr("initialize"),
    ...u64(PRICE), ...u64(MIN), ...u64(MAX),
  ]);

  const keys = [
    { pubkey: admin.publicKey,               isSigner: true,  isWritable: true },
    { pubkey: MINT,                          isSigner: false, isWritable: true },
    { pubkey: presale,                       isSigner: false, isWritable: true },
    { pubkey: vault,                         isSigner: false, isWritable: true },
    { pubkey: mintAuth,                      isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
    { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.from(data) });
  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;

  try {
    const sig = await conn.sendTransaction(tx, [admin], { skipPreflight: false });
    console.log("Initialize tx:", sig);
  } catch (e: any) {
    console.error("Initialize failed:", e?.message || e);
    console.error("Likely cause: mint/freeze authority not set to MintAuth PDA shown above.");
    console.error("Run the two spl-token authorize commands with that MintAuth PDA, then rerun this script.");
  }
})();


