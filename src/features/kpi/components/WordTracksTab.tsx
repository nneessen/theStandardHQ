// src/features/kpi/components/WordTracksTab.tsx
// Word Tracks tab: add a phrase, then manage the personal library inline.

import React from "react";
import { WordTrackForm } from "./WordTrackForm";
import { WordTrackLibrary } from "./WordTrackLibrary";

export const WordTracksTab: React.FC = () => {
  return (
    <div className="space-y-3">
      <WordTrackForm />
      <WordTrackLibrary />
    </div>
  );
};
