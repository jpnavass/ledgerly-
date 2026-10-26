// ============================================================================
// Endpoint Verificación OTP de Firma — Presupuesto Express Enterprise
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { sha256Hex } from '@/lib/compliance/hash';
import { verifyOtpForToken } from '@/lib/domain/otp-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, code } = body;

    if (!token || !code) {
      return NextResponse.json(
        { error: 'Token y código OTP son obligatorios.' },
        { status: 400 }
      );
    }

    const tokenHash = await sha256Hex(token);
    const result = verifyOtpForToken(tokenHash, code);

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Código OTP inválido.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al verificar OTP';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
