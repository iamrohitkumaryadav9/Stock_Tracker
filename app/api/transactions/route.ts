import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { deleteTransactionHistory } from '@/lib/actions/portfolio.actions';

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await deleteTransactionHistory(session.user.id);
    const status = result.success ? 200 : 500;

    return NextResponse.json(result, { status });
  } catch (error) {
    console.error('Error deleting transaction history:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

