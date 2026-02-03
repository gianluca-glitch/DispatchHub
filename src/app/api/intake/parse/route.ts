import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntakeContent } from '@/lib/ai/claude';

// POST /api/intake/parse — parse raw content with AI and create IntakeItem
export async function POST(req: NextRequest) {
  const { rawContent, source, audioUrl } = await req.json();

  if (!rawContent || !source) {
    return NextResponse.json({ error: 'rawContent and source required' }, { status: 400 });
  }

  // Run Claude AI parse
  const parsed = await parseIntakeContent(rawContent, source);

  // Create intake item with parsed results
  const item = await db.intakeItem.create({
    data: {
      source: source.toUpperCase(),
      rawContent,
      audioUrl: audioUrl ?? null,
      parsedCustomer: parsed.customer,
      parsedPhone: parsed.phone,
      parsedEmail: parsed.email,
      parsedServiceType: parsed.serviceType,
      parsedAddress: parsed.address,
      parsedDate: parsed.date,
      parsedTime: parsed.time,
      parsedContainerSize: parsed.containerSize,
      parsedNotes: parsed.notes,
      confidence: parsed.confidence,
      status: parsed.confidence >= 90 ? 'PENDING' : parsed.confidence >= 70 ? 'NEEDS_REVIEW' : 'FLAGGED',
    },
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
