// Enruta los dos idiomas: las URL en español (sin prefijo) se sirven desde
// app/es/… y las de /en/… desde app/en/… con sus segmentos en español. Si el
// visitante eligió inglés con el selector, las URL en español le llevan a su
// equivalente en inglés.

import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, internalPath, localePath } from "@/lib/i18n";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // /es/… no es una URL pública: se manda a la ruta sin prefijo.
  if (/^\/es(\/|$)/.test(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/es/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  if (/^\/en(\/|$)/.test(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = `/en${internalPath(pathname) === "/" ? "" : internalPath(pathname)}`;
    return NextResponse.rewrite(url);
  }

  // La tarjeta (imagen) se sirve tal cual: la piden las redes, no personas.
  const isImage = pathname.endsWith("/imagen");
  if (!isImage && req.cookies.get(LOCALE_COOKIE)?.value === "en" && req.method === "GET") {
    const url = req.nextUrl.clone();
    url.pathname = localePath("en", pathname);
    url.search = search;
    return NextResponse.redirect(url, 307);
  }

  const url = req.nextUrl.clone();
  url.pathname = `/es${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Todo menos la API, los ficheros internos de Next y los estáticos (con extensión).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
