import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';
import { projectsChatWithTools, generateProjectGreeting } from '@/lib/ai/projects-chat';

// GET /api/projects/chat — retrieve global chat history
export async function GET() {
  try {
    const messages = await db.projectChat.findMany({
      where: { projectId: null },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });
    return NextResponse.json({ data: messages });
  } catch (err) {
    console.error('[ProjectChat GET]', err);
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}

// POST /api/projects/chat — send message, get AI response
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, chatHistory, greeting, selectedProjectId } = body;

    // Generate greeting if requested
    if (greeting) {
      try {
        const greetingText = await generateProjectGreeting();
        return NextResponse.json({ data: { response: greetingText, toolResults: [] } });
      } catch (err) {
        console.error('[ProjectChat greeting]', err);
        return NextResponse.json({ data: { response: 'Projects loaded. What do you need?', toolResults: [] } });
      }
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Log user message
    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'chat_message',
      module: 'projects',
      detail: message,
    });

    // Save user message to DB
    await db.projectChat.create({
      data: { projectId: null, role: 'user', text: message },
    });

    // Send to AI with tools
    const history = Array.isArray(chatHistory)
      ? chatHistory.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      : [];

    const result = await projectsChatWithTools(history, message, selectedProjectId);

    // Log AI response
    logActivity({
      userId: 'ai',
      userName: 'AI',
      action: 'ai_response',
      module: 'projects',
      detail: result.response.slice(0, 500),
    });

    // Save AI response to DB
    await db.projectChat.create({
      data: { projectId: null, role: 'assistant', text: result.response },
    });

    return NextResponse.json({
      data: {
        response: result.response,
        toolResults: result.toolResults,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ProjectChat POST]', errMsg);

    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: 'Chat failed',
      error: errMsg,
    });

    // User-friendly error messages
    if (errMsg.includes('API key')) {
      return NextResponse.json({ error: 'API key invalid — check Settings.' }, { status: 401 });
    }
    if (errMsg.includes('Rate limit') || errMsg.includes('429')) {
      return NextResponse.json({ error: 'Rate limit hit — wait 30 seconds.' }, { status: 429 });
    }

    return NextResponse.json({ error: 'AI temporarily unavailable.' }, { status: 500 });
  }
}
