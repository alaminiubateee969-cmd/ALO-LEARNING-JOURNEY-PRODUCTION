import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
const TEMPLATES = [
  { id: 'welcome', name: 'Welcome', category: 'onboarding', body: 'Hi {name}, welcome to ALO Labs MarketingOS! Reply STOP to opt out.' },
  { id: 'follow_up', name: 'Follow Up', category: 'sales', body: 'Hi {name}, following up on your interest. Schedule a call?' },
  { id: 'promotion', name: 'Promotion', category: 'marketing', body: 'Hi {name}, 20% off this month! Code: AILO20' },
  { id: 'appointment', name: 'Appointment', category: 'scheduling', body: 'Hi {name}, reminder for tomorrow 10 AM. Reply C to confirm.' },
  { id: 'thank_you', name: 'Thank You', category: 'follow_up', body: 'Hi {name}, thank you for choosing ALO Labs! Rate us 1-5.' },
  { id: 'win_back', name: 'Win Back', category: 'retention', body: 'Hi {name}, we miss you! 30% off your next month.' },
  { id: 'newsletter', name: 'Newsletter', category: 'marketing', body: 'Hi {name}, want weekly marketing tips? Reply YES.' },
  { id: 'feedback', name: 'Feedback', category: 'support', body: 'Hi {name}, how satisfied are you? Reply 1-5.' },
];
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    return NextResponse.json({ data: TEMPLATES });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
