import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        // 1. Verify the secret
        // Finnhub sends the secret in the 'X-Finnhub-Secret' header
        const signature = req.headers.get('X-Finnhub-Secret');
        const webhookSecret = process.env.FINNHUB_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('FINNHUB_WEBHOOK_SECRET is not set in environment variables');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (signature !== webhookSecret) {
            console.warn('Invalid Finnhub webhook signature');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse the body
        const body = await req.json();

        // 3. Log the event (for now)
        console.log('Received Finnhub Webhook Event:', JSON.stringify(body, null, 2));

        // TODO: Process specific event types here
        // e.g., if (body.event === 'earnings') { ... }

        // 4. Acknowledge receipt
        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error) {
        console.error('Error processing Finnhub webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
