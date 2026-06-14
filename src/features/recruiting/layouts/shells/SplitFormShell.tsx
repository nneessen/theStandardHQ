// src/features/recruiting/layouts/shells/SplitFormShell.tsx
//
// The "split-form" layout (the default; formerly AiComposedLayout). Content on the
// left (scrolls internally), lead form pinned in the right pane. This is the
// back-compat shell: any spec without an explicit layout renders exactly like this.

import { ShellHeader, ContentStream, splitFormAndContent } from "./shellKit";
import { PinnedFormShell } from "./scaffolds";
import type { ShellProps } from "./types";

export function SplitFormShell(props: ShellProps) {
  const { spec, theme, ctx } = props;
  const { contentBlocks } = splitFormAndContent(spec);

  return (
    <PinnedFormShell
      shell={props}
      leftBgImage={theme.hero_image_url}
      left={
        <div className="flex min-h-full flex-col gap-10 px-5 pt-5 pb-10 sm:px-8 lg:gap-12 lg:px-12 lg:py-10 xl:px-16">
          <ShellHeader ctx={ctx} theme={theme} />
          <ContentStream
            blocks={contentBlocks}
            ctx={ctx}
            className="flex flex-1 flex-col justify-center gap-10 lg:gap-12"
          />
        </div>
      }
    />
  );
}

export default SplitFormShell;
