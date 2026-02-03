import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/intake/[id] — update status or parsed fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const body = await req.json();

  const updated = await db.intakeItem.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.parsedCustomer !== undefined && { parsedCustomer: body.parsedCustomer }),
      ...(body.parsedPhone !== undefined && { parsedPhone: body.parsedPhone }),
      ...(body.parsedEmail !== undefined && { parsedEmail: body.parsedEmail }),
      ...(body.parsedServiceType !== undefined && { parsedServiceType: body.parsedServiceType }),
      ...(body.parsedAddress !== undefined && { parsedAddress: body.parsedAddress }),
      ...(body.parsedDate !== undefined && { parsedDate: body.parsedDate }),
      ...(body.parsedTime !== undefined && { parsedTime: body.parsedTime }),
      ...(body.parsedContainerSize !== undefined && { parsedContainerSize: body.parsedContainerSize }),
      ...(body.parsedNotes !== undefined && { parsedNotes: body.parsedNotes }),
      ...(body.status === 'APPROVED' && { reviewedAt: new Date(), reviewedBy: 'Dispatcher' }),
    },
  });

  return NextResponse.json({ data: updated });
}
