export function SetupBanner() {
  return (
    <div className="w-full max-w-md rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Local setup required</p>
      <p className="mt-1 text-amber-900">
        Supabase is not configured yet. The app runs on{' '}
        <strong>http://localhost:3001</strong> (not port 3000).
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-amber-900">
        <li>Start Docker Desktop</li>
        <li>
          <code className="rounded bg-white px-1">npx supabase start</code>
        </li>
        <li>
          <code className="rounded bg-white px-1">cp .env.example .env.local</code>
        </li>
        <li>
          Copy keys from <code className="rounded bg-white px-1">npx supabase status</code> into{' '}
          <code className="rounded bg-white px-1">.env.local</code>
        </li>
        <li>
          Restart the dev server: <code className="rounded bg-white px-1">npm run dev</code>
        </li>
      </ol>
      <p className="mt-3 text-xs text-amber-800">
        Run <code className="rounded bg-white px-1">npm run check</code> to diagnose issues.
      </p>
    </div>
  );
}
