// src/features/kpi/components/RecordingsTab.tsx
// Recordings tab: upload a call recording (with metadata), then browse the
// agent's uploaded recordings.

import React from "react";
import { RecordingUploadDropZone } from "./RecordingUploadDropZone";
import { RecordingsList } from "./RecordingsList";

export const RecordingsTab: React.FC = () => {
  return (
    <div className="space-y-3">
      <RecordingUploadDropZone />
      <RecordingsList />
    </div>
  );
};
