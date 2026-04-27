// src/features/messages/components/compose/ContactBrowser.tsx
// Contact browser sheet for email compose with tabs, filtering, and favorites
// Uses zinc palette and compact design patterns

import { useCallback, useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Search,
  Star,
  Users,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserPlus,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useContactBrowser,
  type ContactTab,
} from "../../hooks/useContactBrowser";
import type { Contact } from "../../services/contactService";

interface ContactBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectContact: (contact: Contact) => void;
  selectedEmails: string[];
}

export function ContactBrowser({
  open,
  onOpenChange,
  onSelectContact,
  selectedEmails,
}: ContactBrowserProps) {
  const {
    contacts,
    total,
    hasMore,
    roles,
    activeTab,
    search,
    roleFilter,
    page,
    pageSize,
    isLoading,
    isFetching,
    setActiveTab,
    setSearch,
    setRoleFilter,
    nextPage,
    prevPage,
    toggleFavorite,
    isTogglingFavorite,
    fetchAllTeamContacts,
    isSuperAdmin,
    fetchAllUsersContacts,
  } = useContactBrowser({ pageSize: 50 });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [showAllUsersConfirm, setShowAllUsersConfirm] = useState(false);

  // Filter out already selected contacts
  const availableContacts = contacts.filter(
    (c) => !selectedEmails.includes(c.email.toLowerCase()),
  );

  // Updated tabs with correct naming - include All Users for super-admins
  const tabs: { id: ContactTab; label: string; icon: typeof Users }[] = [
    { id: "all", label: "All Contacts", icon: Users },
    { id: "favorites", label: "Favorites", icon: Star },
    { id: "team", label: "My Team", icon: User },
    // Conditionally add All Users tab for super-admins
    ...(isSuperAdmin
      ? [{ id: "all_users" as ContactTab, label: "All Users", icon: Globe }]
      : []),
  ];

  const handleContactClick = useCallback(
    (contact: Contact) => {
      onSelectContact(contact);
    },
    [onSelectContact],
  );

  const handleFavoriteClick = useCallback(
    (e: React.MouseEvent, contact: Contact) => {
      e.stopPropagation();
      toggleFavorite(contact);
    },
    [toggleFavorite],
  );

  // Add entire team handler
  const handleAddAll = useCallback(async () => {
    setIsAddingAll(true);
    try {
      const allTeamContacts = await fetchAllTeamContacts();
      const unselected = allTeamContacts.filter(
        (c) => !selectedEmails.includes(c.email.toLowerCase()),
      );
      unselected.forEach((contact) => {
        onSelectContact(contact);
      });
    } finally {
      setIsAddingAll(false);
    }
  }, [fetchAllTeamContacts, selectedEmails, onSelectContact]);

  // Add all users handler (super-admin only) - shows confirmation first
  const handleAddAllUsersClick = useCallback(() => {
    setShowAllUsersConfirm(true);
  }, []);

  // Confirmed add all users
  const handleAddAllUsersConfirmed = useCallback(async () => {
    setShowAllUsersConfirm(false);
    setIsAddingAll(true);
    try {
      const allUsers = await fetchAllUsersContacts();
      const unselected = allUsers.filter(
        (c) => !selectedEmails.includes(c.email.toLowerCase()),
      );
      unselected.forEach((contact) => {
        onSelectContact(contact);
      });
    } finally {
      setIsAddingAll(false);
    }
  }, [fetchAllUsersContacts, selectedEmails, onSelectContact]);

  // Focus search when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[320px] sm:w-[380px] p-0 flex flex-col bg-v2-canvas "
      >
        {/* Header - Zinc styled */}
        <SheetHeader className="px-3 py-2 bg-v2-card border-b border-v2-ring">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-v2-ink" />
            <SheetTitle className="text-sm font-semibold text-v2-ink">
              Team Contacts
            </SheetTitle>
          </div>
          <p className="text-[10px] text-v2-ink-muted">
            {total} contact{total !== 1 ? "s" : ""} available
          </p>
        </SheetHeader>

        {/* Search - Compact */}
        <div className="px-3 py-2 bg-v2-card border-b border-v2-ring">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-7 h-7 text-[11px] bg-v2-canvas border-v2-ring"
            />
          </div>
        </div>

        {/* Tabs - Compact zinc style */}
        <div className="flex gap-0.5 p-1.5 bg-v2-ring/50 dark:bg-v2-ring/50 mx-2 mt-2 rounded-md">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-medium rounded transition-all",
                  isActive
                    ? "bg-v2-card shadow-sm text-v2-ink"
                    : "text-v2-ink-muted hover:text-v2-ink",
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filters - Only when relevant */}
        {(activeTab === "all" || activeTab === "team") && roles.length > 0 && (
          <div className="px-3 py-2 border-b border-v2-ring">
            <Select
              value={roleFilter || "all"}
              onValueChange={(v) => setRoleFilter(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-6 text-[10px] bg-v2-card border-v2-ring">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px]">
                  All roles
                </SelectItem>
                {roles.map((role) => (
                  <SelectItem
                    key={role.name}
                    value={role.name}
                    className="text-[10px]"
                  >
                    {role.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Add Entire Team button - only on My Team tab */}
        {activeTab === "team" && total > 0 && (
          <div className="px-3 py-1.5 border-b border-v2-ring bg-v2-card">
            <button
              onClick={handleAddAll}
              disabled={isAddingAll}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-colors w-full justify-center",
                isAddingAll
                  ? "bg-v2-ring text-v2-ink-subtle cursor-not-allowed"
                  : "bg-v2-ring hover:bg-v2-ring dark:hover:bg-v2-card-dark text-v2-ink-muted",
              )}
            >
              {isAddingAll ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-3 w-3" />
                  Add Entire Team ({total})
                </>
              )}
            </button>
          </div>
        )}

        {/* Add All Users button - only on All Users tab (super-admin only) */}
        {activeTab === "all_users" && total > 0 && (
          <div className="px-3 py-1.5 border-b border-v2-ring bg-v2-card">
            <button
              onClick={handleAddAllUsersClick}
              disabled={isAddingAll}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-colors w-full justify-center",
                isAddingAll
                  ? "bg-v2-ring text-v2-ink-subtle cursor-not-allowed"
                  : "bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
              )}
            >
              {isAddingAll ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Globe className="h-3 w-3" />
                  Add All Users ({total})
                </>
              )}
            </button>
          </div>
        )}

        {/* Contact List - Fixed height with scroll */}
        <ScrollArea className="flex-1">
          <div className="px-2 py-1 space-y-0.5">
            {isLoading ? (
              <LoadingSkeleton />
            ) : availableContacts.length === 0 ? (
              <EmptyState activeTab={activeTab} search={search} />
            ) : (
              availableContacts.map((contact) => (
                <ContactRow
                  key={`${contact.type}-${contact.id}`}
                  contact={contact}
                  onClick={() => handleContactClick(contact)}
                  onFavoriteClick={(e) => handleFavoriteClick(e, contact)}
                  isTogglingFavorite={isTogglingFavorite}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Pagination - ALWAYS visible */}
        <div className="px-3 py-2 bg-v2-card border-t border-v2-ring">
          <div className="flex items-center justify-between text-[10px]">
            <button
              onClick={prevPage}
              disabled={page === 1}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded transition-colors",
                page === 1
                  ? "text-v2-ink-subtle cursor-not-allowed"
                  : "text-v2-ink-muted dark:text-v2-ink-subtle hover:bg-v2-ring dark:hover:bg-v2-ring",
              )}
            >
              <ChevronLeft className="h-3 w-3" />
              Prev
            </button>
            <span className="text-v2-ink-muted">
              {total > 0 ? (
                <>
                  {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}{" "}
                  of {total}
                </>
              ) : (
                "No contacts"
              )}
            </span>
            <button
              onClick={nextPage}
              disabled={!hasMore}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded transition-colors",
                !hasMore
                  ? "text-v2-ink-subtle cursor-not-allowed"
                  : "text-v2-ink-muted dark:text-v2-ink-subtle hover:bg-v2-ring dark:hover:bg-v2-ring",
              )}
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Loading overlay for fetching */}
        {isFetching && !isLoading && (
          <div className="absolute inset-0 bg-v2-canvas/50 /50 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
          </div>
        )}
      </SheetContent>

      {/* Confirmation dialog for Add All Users */}
      <AlertDialog
        open={showAllUsersConfirm}
        onOpenChange={setShowAllUsersConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add All Users?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  You are about to add{" "}
                  <span className="font-semibold text-v2-ink">
                    {total} users
                  </span>{" "}
                  as recipients.
                </p>
                <p className="mt-2">
                  This will send an email to every user in the system.
                </p>
                <p className="mt-3 text-amber-600 dark:text-amber-400 font-medium">
                  This action is intended for system-wide announcements only.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddAllUsersConfirmed}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Add All {total} Users
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="space-y-1 py-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2 py-1.5 rounded bg-v2-card border border-v2-ring/60"
        >
          <div className="h-5 w-5 rounded bg-v2-ring animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-24 rounded bg-v2-ring animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-v2-ring animate-pulse" />
          </div>
          <div className="h-4 w-12 rounded bg-v2-ring animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// Empty state component
function EmptyState({
  activeTab,
  search,
}: {
  activeTab: ContactTab;
  search: string;
}) {
  const getMessage = () => {
    if (search.length >= 2) return "No contacts found";
    switch (activeTab) {
      case "favorites":
        return "No favorites yet";
      case "team":
        return "No team members under you";
      case "all_users":
        return "No users found";
      default:
        return "No contacts available";
    }
  };

  const getIcon = () => {
    switch (activeTab) {
      case "all_users":
        return <Globe className="h-8 w-8 text-v2-ink-subtle mb-2 mx-auto" />;
      default:
        return null;
    }
  };

  return (
    <div className="text-center py-8">
      {getIcon()}
      <p className="text-[11px] text-v2-ink-muted">{getMessage()}</p>
      {activeTab === "favorites" && search.length < 2 && (
        <p className="text-[10px] text-v2-ink-subtle mt-1">
          Click the star icon on any contact to add favorites
        </p>
      )}
      {activeTab === "team" && search.length < 2 && (
        <p className="text-[10px] text-v2-ink-subtle mt-1">
          Your downlines will appear here
        </p>
      )}
    </div>
  );
}

// Contact row component - Zinc styled
interface ContactRowProps {
  contact: Contact;
  onClick: () => void;
  onFavoriteClick: (e: React.MouseEvent) => void;
  isTogglingFavorite: boolean;
}

function ContactRow({
  contact,
  onClick,
  onFavoriteClick,
  isTogglingFavorite,
}: ContactRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group",
        "bg-v2-card hover:bg-v2-canvas",
        "border border-v2-ring/60 hover:border-v2-ring ",
        "transition-all",
      )}
    >
      {/* Add button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="p-1 rounded bg-v2-ring hover:bg-v2-ring dark:hover:bg-v2-card-dark text-v2-ink-muted dark:text-v2-ink-subtle shrink-0 transition-colors"
      >
        <Plus className="h-3 w-3" />
      </button>

      {/* Name and email */}
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium text-v2-ink truncate block">
          {contact.name}
        </span>
        <span className="text-[10px] text-v2-ink-muted truncate block">
          {contact.email}
        </span>
      </div>

      {/* Role badge */}
      {contact.role && (
        <Badge className="h-4 text-[9px] px-1 shrink-0 bg-v2-ring text-v2-ink-muted dark:text-v2-ink-subtle border-0">
          {contact.role.slice(0, 8)}
        </Badge>
      )}

      {/* Favorite button - More prominent */}
      <button
        onClick={onFavoriteClick}
        disabled={isTogglingFavorite}
        className={cn(
          "p-1 rounded shrink-0 transition-all",
          contact.isFavorite
            ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            : "text-v2-ink-subtle hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30",
        )}
        title={
          contact.isFavorite ? "Remove from favorites" : "Add to favorites"
        }
      >
        <Star
          className="h-3.5 w-3.5"
          fill={contact.isFavorite ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}
