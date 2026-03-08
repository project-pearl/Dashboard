import { NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse };

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
