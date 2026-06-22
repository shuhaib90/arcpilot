import { NextRequest, NextResponse } from 'next/server';
import { mimoAgent } from '@/services/mimoAgent';

export async function POST(req: NextRequest) {
  try {
    const { query, userId, username, history } = await req.json();

    if (!query || !userId || !username) {
      return NextResponse.json(
        { error: 'Missing required chat payload fields.' },
        { status: 400 }
      );
    }

    // Run the actual tool-calling session with MiMo API
    const agentResult = await mimoAgent.runChatSession(query, userId, username, history || []);

    // Format to match UI expected structure
    const response = {
      action: {
        type: agentResult.status === 'requires_confirmation' ? 'send' : 'info',
        rawQuery: query,
        amount: agentResult.txPreviewData?.amount,
        recipient: agentResult.txPreviewData?.recipient,
      },
      status: agentResult.status,
      message: agentResult.text,
      data: agentResult.txPreviewData,
      executedTools: agentResult.toolCallsExecuted
    };

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
