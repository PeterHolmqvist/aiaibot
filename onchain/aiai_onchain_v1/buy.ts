import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createHash } from "crypto";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("6Dm7yMZaLY6R757Az8uZkTwU4yXUzNx5h6YFuoqRqcQk");
const MINT = new PublicKey(process.env.MINT!);        // export MINT=...

const LAMPORTS = BigInt(200_000_000); // 0.2 SOL
const discr = (name: string) => Buffer.from(createHash("sha256").update(`global:${name}`).digest().subarray(0, 8));
const u64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };

(async () => {
  const conn = new Connection(RPC, "confirmed");
  const provider = anchor.AnchorProvider.local(); // uses ANCHOR_WALLET
  // @ts-ignore
  const buyer = (provider.wallet as anchor.Wallet).payer;

  const [presale]  = PublicKey.findProgramAddressSync([Buffer.from("presale"), MINT.toBuffer()], PROGRAM_ID);
  const [vault]    = PublicKey.findProgramAddressSync([Buffer.from("vault"), presale.toBuffer()], PROGRAM_ID);
  const [mintAuth] = PublicKey.findProgramAddressSync([Buffer.from("mint-auth"), presale.toBuffer()], PROGRAM_ID);

  const buyerAta = getAssociatedTokenAddressSync(MINT, buyer.publicKey);

  const keys = [
    { pubkey: buyer.publicKey, isSigner: true,  isWritable: true },  // buyer
    { pubkey: presale,         isSigner: false, isWritable: true },  // presale
    { pubkey: MINT,            isSigner: false, isWritable: true },  // mint
    { pubkey: mintAuth,        isSigner: false, isWritable: false }, // mint_authority
    { pubkey: vault,           isSigner: false, isWritable: true },  // vault
    { pubkey: buyerAta,        isSigner: false, isWritable: true },  // buyer_ata
    { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.concat([discr("purchase"), u64(LAMPORTS)]),
  });

  const tx = new Transaction().add(ix);
  const sig = await conn.sendTransaction(tx, [buyer], { skipPreflight: false });
  console.log("Buy tx:", sig);
  console.log("Buyer ATA:", buyerAta.toBase58());
})().catch(e => {
  console.error(e);
  process.exit(1);
});

