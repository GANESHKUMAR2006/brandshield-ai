import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "./database.types";

export async function getSupabaseServerClient() {
  let cookieStore: {
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string, options?: CookieOptions) => void;
    delete: (name: string) => void;
  };

  try {
    cookieStore = await cookies();
  } catch {
    // When invoked outside Next.js request scope (e.g. unit/integration test suites, CLI runners),
    // provide an isolated in-memory cookie jar
    const inMemoryCookies = new Map<string, { name: string; value: string; options?: CookieOptions }>();
    cookieStore = {
      getAll() {
        return Array.from(inMemoryCookies.values()).map((c) => ({ name: c.name, value: c.value }));
      },
      set(name: string, value: string, options?: CookieOptions) {
        if (options && (options.maxAge === 0 || (options.expires && options.expires.getTime() <= 0))) {
          inMemoryCookies.delete(name);
        } else {
          inMemoryCookies.set(name, { name, value, options });
        }
      },
      delete(name: string) {
        inMemoryCookies.delete(name);
      },
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
