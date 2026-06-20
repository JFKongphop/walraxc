import { NextRequest, NextResponse } from 'next/server';

/** Sui RPC proxy — avoids CORS issues in browser. */
const SUI_RPC = 'https://fullnode.testnet.sui.io:443';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(SUI_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: { message: 'Sui RPC proxy error' } }, { status: 502 });
  }
}
