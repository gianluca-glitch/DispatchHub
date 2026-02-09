import { NextRequest, NextResponse } from 'next/server';

// POST /api/admin/auth — simple password gate
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = body.password as string | undefined;

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    return NextResponse.json({ data: { authenticated: true } });
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
