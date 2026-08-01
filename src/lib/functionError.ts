// supabase-js throws a generic "Edge Function returned a non-2xx status code" on any
// non-200 response and leaves `data` null, hiding the real error body. Parse it from
// error.context (the raw Response) instead of trusting error.message.
export async function getFunctionErrorMessage(error: any, fallback = 'Something went wrong'): Promise<string> {
  const context = error?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // response body wasn't JSON
    }
  }
  return error?.message || fallback;
}
