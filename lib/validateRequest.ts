/**
 * Request validation helpers for API routes.
 * Parses JSON bodies against Zod schemas and returns typed results or
 * pre-built NextResponse error objects.
 */

import { NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

/** Discriminated union returned by {@link parseBody}. */
type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse };

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * On success, returns `{ success: true, data }` with the parsed value.
 * On failure, returns `{ success: false, error }` with a 400 NextResponse
 * containing either an "Invalid JSON body" message or per-field validation errors.
 *
 * @param request - The incoming Request object
 * @param schema  - A Zod schema describing the expected body shape
 * @returns A discriminated union of parsed data or an error response
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = (result.error as ZodError).flatten().fieldErrors;
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Validation failed', fields: fieldErrors },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: result.data };
}
