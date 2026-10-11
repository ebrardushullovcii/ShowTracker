# ADR-0071: Web Auth Pages Use The Landing Ticket

## Context

The web landing page is a cinema-ticket design rendered as plain DOM (`components/landing/TicketLanding.web.tsx`) so it can use CSS that React Native styles cannot express: ticket perforation masks, web fonts, and gradients. Its Sign in and Get started buttons led to the older dark React Native auth screens, which looked like a different product.

## Decision

On web, `/login` and `/register` render `components/auth/AuthTicket.web.tsx`: the landing's admission ticket with the form on the main side and an Admit One stub. It reuses the landing stylesheet and adds `.tk-auth` rules in `components/auth/authTicketStyles.ts`. The form is a real HTML form with `autocomplete` attributes so password managers fill and save credentials.

Native keeps the React Native screens in `app/(auth)/`, since the landing does not exist on native.

Both use `useSignInForm` and `useRegisterForm` in `components/auth/useAuthForms.ts`, so validation, error messages, guest sign-in, and redirects stay identical across platforms.

## Verification

Open `/login` and `/register` signed out at desktop and phone widths. The ticket matches the landing, stacks on phones, shows validation errors, links between the two pages, and "Continue as guest" still signs in. `scripts/ui-inspect.mjs` relies on the "Continue as guest" label.
