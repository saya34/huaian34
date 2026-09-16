"use client";

import { UnifiedGameProvider } from "./core/UnifiedGameProvider";
import { FeedbackProvider } from "./feedback/FeedbackProvider";
import { UnifiedFeedbackBridge } from "./feedback/UnifiedFeedbackBridge";

/**
 * Mounts the authoritative game state once around an actual game surface.
 *
 * The desktop phone frame deliberately does not use this wrapper: it is only a
 * presentation shell around an embedded game document. Keeping providers out of
 * the shell prevents duplicate saves, announcements and feedback overlays.
 */
export default function GameProviders({ children }: { children: React.ReactNode }) {
  return (
    <UnifiedGameProvider>
      <FeedbackProvider>
        <UnifiedFeedbackBridge>{children}</UnifiedFeedbackBridge>
      </FeedbackProvider>
    </UnifiedGameProvider>
  );
}
