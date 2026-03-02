import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('waitlist')
      .insert({ email })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Already registered — still return success
        return NextResponse.json({ success: true });
      }
      console.error('[Waitlist] Insert error:', error);
      return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Waitlist] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
