export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user type from query params
    const { searchParams } = new URL(request.url);
    const userType = searchParams.get('userType') as 'admin' | 'seller' | 'customer';

    if (!userType) {
      return NextResponse.json({ error: 'Missing userType' }, { status: 400 });
    }

    let query;

    if (userType === 'admin') {
      // Get all sellers (owners) for admin
      query = supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          created_at,
          user_chat_status(is_online, last_seen)
        `)
        .eq('role', 'owner')
        .eq('is_verified', true)
        .order('full_name');
    } else if (userType === 'seller') {
      // Get all admins for seller (including owners and users with is_admin=true)
      query = supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          created_at,
          user_chat_status(is_online, last_seen)
        `)
        .or('role.eq.admin,is_admin.eq.true')
        .order('full_name');
    } else if (userType === 'customer') {
      // For customers, return admins (role = 'admin' OR is_admin = true)
      query = supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          is_admin,
          created_at,
          user_chat_status(is_online, last_seen)
        `)
        .or('role.eq.admin,is_admin.eq.true')
        .order('full_name');
    } else {
      return NextResponse.json({ error: 'Invalid userType' }, { status: 400 });
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error in GET /api/chat/users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 