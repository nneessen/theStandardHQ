// src/features/recruiting/components/contracting/ContractingRequestCard.tsx
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContractingRequestCardProps {
  request: {
    id: string;
    carrier: { id: string; name: string } | null;
    request_order: number;
    status: string;
    requested_date: string;
    writing_number?: string | null;
    writing_received_date?: string | null;
    carrier_instructions?: string | null;
  };
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isStaff: boolean;
}

const statusColors: Record<string, string> = {
  requested: "bg-muted text-foreground",
  in_progress: "bg-info/20 text-info",
  writing_received: "bg-success/20 text-success",
  completed: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function ContractingRequestCard({
  request,
  onUpdate,
  onDelete,
  isStaff,
}: ContractingRequestCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [writingNumber, setWritingNumber] = useState(
    request.writing_number || "",
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSaveWritingNumber = async () => {
    try {
      await onUpdate(request.id, {
        writing_number: writingNumber || null,
        // Only auto-update status if transitioning from requested/in_progress to writing_received
        ...(writingNumber &&
        (request.status === "requested" || request.status === "in_progress")
          ? { status: "writing_received" }
          : {}),
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save writing number:", error);
      // Reset to original value on error
      setWritingNumber(request.writing_number || "");
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      try {
        await onDelete(request.id);
        setShowDeleteDialog(false);
      } catch (error) {
        console.error("Failed to delete contract request:", error);
        setShowDeleteDialog(false);
      }
    }
  };

  return (
    <>
      {/* Single row - everything inline */}
      <div className="py-1.5 px-2 border-l-2 border-l-blue-500 hover:bg-background transition-colors">
        <div className="flex items-center gap-2 text-xs">
          {/* Carrier Name */}
          <div className="w-32 flex-shrink-0">
            <span className="font-medium text-xs truncate block">
              {request.carrier?.name || "Unknown Carrier"}
            </span>
          </div>

          {/* Writing Number Input - SAME ROW */}
          {isStaff && (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Input
                value={writingNumber}
                onChange={(e) => setWritingNumber(e.target.value)}
                placeholder="Writing #"
                className="h-6 text-xs px-2 w-full bg-card"
                onFocus={() => setIsEditing(true)}
                onBlur={() => {
                  if (writingNumber !== (request.writing_number || "")) {
                    handleSaveWritingNumber();
                  } else {
                    setIsEditing(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveWritingNumber();
                  } else if (e.key === "Escape") {
                    setWritingNumber(request.writing_number || "");
                    setIsEditing(false);
                  }
                }}
              />
              {isEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={handleSaveWritingNumber}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {/* Status Badge */}
          <Badge
            className={`text-[10px] px-2 py-0.5 h-5 whitespace-nowrap ${statusColors[request.status] || "bg-muted text-foreground"}`}
          >
            {request.status.replace(/_/g, " ")}
          </Badge>

          {/* Received Date */}
          {request.writing_received_date && (
            <span className="text-[10px] text-success whitespace-nowrap">
              ✓{" "}
              {new Date(request.writing_received_date).toLocaleDateString(
                "en-US",
                { month: "numeric", day: "numeric" },
              )}
            </span>
          )}

          {/* Delete Button */}
          {isStaff && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Carrier Instructions - collapsed by default */}
        {request.carrier_instructions && (
          <details className="mt-1">
            <summary className="text-[10px] text-info cursor-pointer hover:underline flex items-center gap-0.5">
              <AlertCircle className="h-2.5 w-2.5" />
              Instructions
            </summary>
            <pre className="mt-0.5 text-[10px] text-muted-foreground whitespace-pre-wrap font-sans">
              {request.carrier_instructions}
            </pre>
          </details>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this carrier contract request for{" "}
              <strong>{request.carrier?.name || "this carrier"}</strong>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
