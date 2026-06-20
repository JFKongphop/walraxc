import { NextRequest, NextResponse } from 'next/server';

const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

/** Fetch a Walrus blob by ID — replaces ECIES decrypt. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const blobId = params.id;
    const res = await fetch(`${WALRUS_AGGREGATOR}/${encodeURIComponent(blobId)}`);
    if (!res.ok) throw new Error(`Walrus ${res.status}`);
    const text = await res.text();
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
  }
}
