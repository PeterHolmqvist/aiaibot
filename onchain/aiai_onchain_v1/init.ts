import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createHash } from "crypto";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("6Dm7yMZaLY6R757Az8uZkTwU4yXUzNx5h6YFuoqRqcQk");

const MINT_STR = process.env.MINT;
if (!MINT_STR) throw new Error("Set env var: MINT=<your_devnet_mint_address>");
const MINT = new PublicKey(MINT_STR);

const PRICE = 2_000_000n;      // 0.002 SOL
const MIN   = 200_000_000n;    // 0.2 SOL
const MAX   = 2_000_000_000n;  // 2 SOL

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
  const provider = anchor.AnchorProvider.local();
  // @ts-ignore
  const admin = (provider.wallet as anchor.Wallet).payer;

  const [presale]  = PublicKey.findProgramAddressSync([Buffer.from("presale"), MINT.toBuffer()], PROGRAM_ID);
  const [vault]    = PublicKey.findProgramAddressSync([Buffer.from("vault"), presale.toBuffer()], PROGRAM_ID);
  const [mintAuth] = PublicKey.findProgramAddressSync([Buffer.from("mint-auth"), presale.toBuffer()], PROGRAM_ID);

  console.log("Presale PDA:  ", presale.toBase58());
  console.log("Vault PDA:    ", vault.toBase58());
  console.log("MintAuth PDA: ", mintAuth.toBase58());

  const data = new Uint8Array([
    ...discr("initialize"),
    ...u64(PRICE), ...u64(MIN), ...u64(MAX),
  ]);
  const keys = [
    { pubkey: admin.publicKey, isSigner: true,  isWritable: true },
    { pubkey: MINT,            isSigner: false, isWritable: true },
    { pubkey: presale,         isSigner: false, isWritable: true },
    { pubkey: vault,           isSigner: false, isWritable: true },
    { pubkey: mintAuth,        isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.from(data), });

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

