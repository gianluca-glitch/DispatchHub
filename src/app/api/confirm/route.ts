import { NextRequest, NextResponse } from 'next/server';
import { sendConfirmations } from '@/lib/confirmation';

// POST /api/confirm — fire call + email + SMS for a job
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { jobId } = body;

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  try {
    await sendConfirmations(jobId);
    return NextResponse.json({ success: true, message: 'Confirmations sent' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send confirmations' },
      { status: 500 }
    );
  }
}
