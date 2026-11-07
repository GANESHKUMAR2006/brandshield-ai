/**
 * BrandShield AI — Production Auth Users Seed Script
 * 
 * Idempotently seeds verified reviewer accounts into Supabase Auth (auth.users & auth.identities)
 * with confirmed email status, server-controlled app_metadata (role, workspaces),
 * and user_metadata.
 */

import { Pool } from 'pg';

export const DEMO_USERS = [
  {
    email: 'elena.vance@dermaglow.com',
    password: 'BrandShield2026!',
    name: 'Dr. Elena Vance',
    role: 'compliance_reviewer',
    workspaces: ['dermaglow'],
  },
  {
    email: 'admin@dermaglow.com',
    password: 'BrandShield2026!',
    name: 'Compliance Administrator',
    role: 'admin',
    workspaces: ['dermaglow'],
  },
  {
    email: 'marcus.brody@dermaglow.com',
    password: 'BrandShield2026!',
    name: 'Marcus Brody, Esq.',
    role: 'legal_reviewer',
    workspaces: ['dermaglow'],
  },
];

export async function seedAuthUsers() {
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DATABASE_URL is required to seed auth users.');
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Seeding verified Supabase Auth accounts...');

  for (const user of DEMO_USERS) {
    try {
      const existing = await pool.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [user.email]
      );

      let userId;

      const appMetadata = {
        provider: 'email',
        providers: ['email'],
        role: user.role,
        workspaces: user.workspaces,
      };

      const userMetadata = {
        name: user.name,
        role: user.role,
        email: user.email,
      };

      if (existing.rows.length === 0) {
        const insertUserRes = await pool.query(
          `
          INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            phone_change,
            phone_change_token,
            email_change_token_current,
            reauthentication_token,
            email_change_confirm_status,
            is_sso_user,
            is_anonymous
          ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            $1,
            crypt($2, gen_salt('bf')),
            NOW(),
            $3::jsonb,
            $4::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            0,
            false,
            false
          )
          RETURNING id;
        `,
          [user.email, user.password, JSON.stringify(appMetadata), JSON.stringify(userMetadata)]
        );

        userId = insertUserRes.rows[0].id;
        console.log(`Created new auth.users account for ${user.email} (ID: ${userId})`);
      } else {
        userId = existing.rows[0].id;
        await pool.query(
          `
          UPDATE auth.users
          SET 
            encrypted_password = crypt($1, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = $2::jsonb,
            raw_user_meta_data = $3::jsonb,
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            phone_change = COALESCE(phone_change, ''),
            phone_change_token = COALESCE(phone_change_token, ''),
            email_change_token_current = COALESCE(email_change_token_current, ''),
            reauthentication_token = COALESCE(reauthentication_token, ''),
            email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
            is_sso_user = COALESCE(is_sso_user, false),
            is_anonymous = COALESCE(is_anonymous, false),
            updated_at = NOW()
          WHERE id = $4;
        `,
          [user.password, JSON.stringify(appMetadata), JSON.stringify(userMetadata), userId]
        );
      }

      // Ensure identity exists
      const idCheck = await pool.query(
        'SELECT id FROM auth.identities WHERE user_id = $1::uuid AND provider = $2',
        [userId, 'email']
      );

      if (idCheck.rows.length === 0) {
        await pool.query(
          `
          INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            $1::uuid,
            $2::jsonb,
            'email',
            $3::text,
            NOW(),
            NOW(),
            NOW()
          );
        `,
          [
            userId,
            JSON.stringify({
              sub: userId,
              email: user.email,
              name: user.name,
              role: user.role,
              email_verified: true,
            }),
            userId,
          ]
        );
        console.log(`Created auth.identities record for ${user.email}`);
      } else {
        console.log(`Verified auth.identities record for ${user.email}`);
      }
    } catch (err) {
      console.error(`Error processing user ${user.email}:`, err);
    }
  }

  // Final verification
  const verifyRes = await pool.query(
    `
    SELECT u.id, u.email, u.email_confirmed_at, u.raw_app_meta_data, count(i.id)::int as identity_count
    FROM auth.users u
    LEFT JOIN auth.identities i ON u.id = i.user_id
    WHERE u.email = ANY($1)
    GROUP BY u.id, u.email, u.email_confirmed_at, u.raw_app_meta_data
    ORDER BY u.email;
  `,
    [DEMO_USERS.map((u) => u.email)]
  );

  console.log('\n--- Verified Active Reviewers in Supabase Database ---');
  for (const row of verifyRes.rows) {
    console.log(
      `- ${row.email}: confirmed=${Boolean(row.email_confirmed_at)}, identities=${row.identity_count}, role=${row.raw_app_meta_data?.role}, workspaces=${JSON.stringify(row.raw_app_meta_data?.workspaces)}`
    );
  }

  await pool.end();
}

if (process.argv[1]?.endsWith('seed-production-auth.js')) {
  seedAuthUsers().catch((err) => {
    console.error('Seed script failed:', err);
    process.exit(1);
  });
}
