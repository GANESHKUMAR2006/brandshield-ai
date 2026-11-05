const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('=== BrandShield AI: Supabase Database Connectivity Test ===');
  if (!url || !key) {
    console.error('✗ Missing configuration: NEXT_PUBLIC_SUPABASE_URL and key must be set.');
    process.exit(1);
  }

  const startTime = Date.now();
  const supabase = createClient(url, key);

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .eq('slug', 'dermaglow')
      .single();

    const latency = Date.now() - startTime;

    if (error) {
      console.error(`✗ Query error: ${error.message} (Code: ${error.code})`);
      process.exit(1);
    }

    console.log(`✓ Supabase connection successful (${latency}ms)`);
    console.log(`✓ Active Workspace: ${data.name} (Slug: ${data.slug}, ID: ${data.id})`);

    // Verify products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    console.log(`✓ Registered Products: ${productCount}`);

    // Verify claims
    const { count: claimCount } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true });
    console.log(`✓ Registered Extracted Claims: ${claimCount}`);

    console.log('=== All Database Connectivity Checks Passed ===');
  } catch (err) {
    console.error('✗ Unexpected exception during connectivity test:', err.message);
    process.exit(1);
  }
}

testConnection();
