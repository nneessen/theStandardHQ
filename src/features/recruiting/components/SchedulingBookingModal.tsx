// src/features/recruiting/components/SchedulingBookingModal.tsx

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink } from "lucide-react";
import type { SchedulingIntegrationType } from "@/types/integration.types";
import { INTEGRATION_TYPE_LABELS } from "@/types/integration.types";
import {
  CalendlyEmbed,
  GoogleCalendarEmbed,
  ZoomEmbed,
  GoogleMeetEmbed,
} from "./embeds";

interface SchedulingBookingModalProps {
  open: boolean;
  onClose: () => void;
  integrationType: SchedulingIntegrationType;
  bookingUrl: string;
  itemName: string;
  instructions?: string;
  meetingId?: string;
  passcode?: string;
  onBookingComplete?: () => void;
}

export function SchedulingBookingModal({
  open,
  onClose,
  integrationType,
  bookingUrl,
  itemName,
  instructions,
  meetingId,
  passcode,
  onBookingComplete,
}: SchedulingBookingModalProps) {
  const [hasBooked, setHasBooked] = useState(false);

  const handleBookingComplete = () => {
    setHasBooked(true);
    onBookingComplete?.();
  };

  const handleClose = () => {
    setHasBooked(false);
    onClose();
  };

  // Validate URL
  const isValidUrl = bookingUrl && bookingUrl.startsWith("https://");

  const renderEmbed = () => {
    if (!isValidUrl) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-background rounded-lg h-full">
          <AlertCircle className="h-8 w-8 text-warning mb-3" />
          <p className="text-[11px] text-muted-foreground dark:text-muted-foreground text-center mb-3">
            Invalid booking URL. Please contact your recruiter.
          </p>
        </div>
      );
    }

    switch (integrationType) {
      case "calendly":
        return (
          <CalendlyEmbed
            url={bookingUrl}
            onEventScheduled={handleBookingComplete}
            className="h-full"
          />
        );
      case "google_calendar":
        return <GoogleCalendarEmbed url={bookingUrl} className="h-full" />;
      case "zoom":
        return (
          <ZoomEmbed
            url={bookingUrl}
            meetingId={meetingId}
            passcode={passcode}
            instructions={instructions}
            className="h-full"
          />
        );
      case "google_meet":
        return (
          <GoogleMeetEmbed
            url={bookingUrl}
            meetingCode={meetingId}
            phoneDialIn={passcode}
            instructions={instructions}
            className="h-full"
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-6 bg-background rounded-lg h-full">
            <AlertCircle className="h-8 w-8 text-warning mb-3" />
            <p className="text-[11px] text-muted-foreground dark:text-muted-foreground text-center mb-3">
              Unsupported scheduling type
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              asChild
            >
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Open in New Tab
              </a>
            </Button>
          </div>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" size="xl" className="flex flex-col p-0">
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <SheetTitle className="text-sm font-semibold">{itemName}</SheetTitle>
          <SheetDescription className="text-[10px]">
            {INTEGRATION_TYPE_LABELS[integrationType]} Scheduling
          </SheetDescription>
        </SheetHeader>

        {/* Instructions (for Calendly/Google Calendar only) */}
        {instructions && integrationType !== "zoom" && (
          <div className="px-4 py-2 bg-info/10 mx-4 mt-2 rounded-lg">
            <p className="text-[11px] text-info">{instructions}</p>
          </div>
        )}

        {/* Embed Container - takes remaining height */}
        <div className="flex-1 p-4 pt-2 overflow-hidden">{renderEmbed()}</div>

        {/* Footer */}
        <div className="p-4 pt-2 border-t border-border flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {hasBooked
              ? "Booking confirmed! You can close this panel."
              : "Having trouble? "}
            {!hasBooked && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline hover:no-underline"
              >
                Open in new tab
              </a>
            )}
          </p>
          {hasBooked && (
            <Button size="sm" className="h-7 text-[11px]" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
