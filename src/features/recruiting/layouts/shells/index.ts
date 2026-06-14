// src/features/recruiting/layouts/shells/index.ts
// Public surface of the shell system: the dispatcher + the registry, plus the
// shared kit pieces shells compose. Individual shell components are imported
// directly by the registry; they are not re-exported here.

export { RecruitingPageRenderer, SHELL_REGISTRY } from "./registry";
export type { ShellProps, ShellComponent } from "./types";
export {
  ShellRoot,
  ShellHeader,
  Headshot,
  Decoration,
  ContentStream,
  FormSlot,
  splitFormAndContent,
  LOGO_HEADER_HEIGHT,
} from "./shellKit";
export { PinnedFormShell, NaturalScrollShell } from "./scaffolds";
