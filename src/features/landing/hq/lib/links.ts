/*
 * Shared route targets for the HQ landing CTAs.
 *
 * `/join-the-standard` is served by the `$slug` catch-all route
 * (publicJoinAltRoute in src/router.tsx), so it is NOT a member of TanStack
 * Router's typed route union. Typing it as a plain `string` — exactly what the
 * existing GoldCTAButton does (`to?: string`) — lets `<Link to={APPLY_PATH}>`
 * accept it without a literal-union type error, while still routing correctly.
 */
export const APPLY_PATH: string = "/join-the-standard";
