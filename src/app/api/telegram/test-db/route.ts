import { NextResponse } from 'next/server';
import { supabaseServerAnon } from '@/lib/supabase-server';

const supabase = supabaseServerAnon;

export async function GET() {
  try {
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('telegram_users')
      .select('count')
      .limit(1);

    // Get all telegram_users
    const { data: allUsers, error: allUsersError } = await supabase
      .from('telegram_users')
      .select('*');

    // Get specific user
    const { data: specificUser, error: specificError } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('chat_id', '5265283795');

    return NextResponse.json({
      success: true,
      testData,
      allUsers,
      specificUser,
      errors: {
        testError: testError?.message,
        allUsersError: allUsersError?.message,
        specificError: specificError?.message
      }
    });

  } catch (error) {
    console.error('Error testing database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test database' },
      { status: 500 }
    );
  }
} 