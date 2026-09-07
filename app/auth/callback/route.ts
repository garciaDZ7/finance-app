import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getSafeNext(requestUrl: URL) {
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (!next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  const nextUrl = new URL(next, requestUrl.origin);

  return nextUrl.origin === requestUrl.origin ? nextUrl : null;
}

function redirectToLogin(
  requestUrl: URL,
  error: string,
  errorCode?: string | null,
  errorDescription?: string | null,
) {
  const loginUrl = new URL("/login", requestUrl.origin);

  loginUrl.searchParams.set("error", error);

  if (errorCode) {
    loginUrl.searchParams.set("error_code", errorCode);
  }

  if (errorDescription) {
    loginUrl.searchParams.set("error_description", errorDescription);
  }

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNext(requestUrl);

  if (!next) {
    return redirectToLogin(
      requestUrl,
      "invalid-redirect",
      "invalid_next",
      "The requested redirect path is not valid.",
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(next);
    }

    return redirectToLogin(
      requestUrl,
      "code-exchange-failed",
      error.code,
      error.message,
    );
  }

  return redirectToLogin(
    requestUrl,
    "invalid-credentials",
    requestUrl.searchParams.get("error_code"),
    requestUrl.searchParams.get("error_description"),
  );
}