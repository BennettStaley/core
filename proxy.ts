import linguiConfig from 'lingui.config'
import Negotiator from 'negotiator'
import { type NextRequest, NextResponse } from 'next/server'

const { locales } = linguiConfig

const getRequestLocale = (requestHeaders: Headers): string => {
  const langHeader = requestHeaders.get('accept-language') || undefined
  const languages = new Negotiator({
    headers: { 'accept-language': langHeader },
  }).languages(locales.slice())

  // Ensure the locale is valid, default to the first locale in `linguiConfig.locales`
  const activeLocale = languages.find(lang => locales.includes(lang)) || locales[0] || 'en'

  return activeLocale
}

export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl

  const pathnameHasLocale = locales.some(
    (locale: string) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  )

  if (pathnameHasLocale) {
    return
  }

  // Redirect if there is no locale
  const locale = getRequestLocale(request.headers)

  request.nextUrl.pathname = `/${locale}${pathname}`

  return NextResponse.redirect(request.nextUrl)
}

// Routes excluded from locale redirect:
//   api    — tRPC + REST endpoints, no locale needed
//   panel  — tRPC panel dev tool, served as a plain route handler
//   static — icons, favicon and the web app manifest (redirecting them to
//            /en/... 404s and breaks iOS home-screen install)
export const config = {
  matcher: [
    '/((?!api|panel(?:/|$)|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
}
