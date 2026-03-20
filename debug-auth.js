// Temporary debug script - run with: node debug-auth.js
require('dotenv').config({ path: '.env.local' });

console.log('=== Supabase Auth Debug ===');
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing');

if (typeof window !== 'undefined') {
  console.log('=== Browser Storage Check ===');

  // Check localStorage for Supabase keys
  const supabaseKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      supabaseKeys.push(key);
    }
  }

  console.log('Supabase localStorage keys:', supabaseKeys);

  // If you want to clear them:
  // supabaseKeys.forEach(key => localStorage.removeItem(key));
  // console.log('Cleared Supabase localStorage keys');
}