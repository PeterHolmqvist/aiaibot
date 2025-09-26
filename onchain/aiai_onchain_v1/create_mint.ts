import { Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createMint, getMint } from "@solana/spl-token";

(async () => {
  const RPC = "https://api.devnet.solana.com";
  const conn = new Connection(RPC, "confirmed");
  const provider = anchor.AnchorProvider.local();
  // @ts-ignore
  const admin = (provider.wallet as anchor.Wallet).payer;

  // Create SPL mint (decimals=9) with mint authority = admin, freeze authority = admin
  const mint = await createMint(conn, admin, admin.publicKey, admin.publicKey, 9);
  console.log("NEW_MINT =", mint.toBase58());

  const info = await getMint(conn, mint);
  console.log("Mint decimals:", info.decimals);
  console.log("Mint authority:", info.mintAuthority?.toBase58());
  console.log("Freeze authority:", info.freezeAuthority?.toBase58());
})();
