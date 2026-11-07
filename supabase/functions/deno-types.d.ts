// supabase/functions/deno-types.d.ts
// Khai báo ambient types cho Deno Edge Functions trong môi trường VS Code

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}
