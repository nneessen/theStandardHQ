// src/features/messages/components/slack/MentionTextarea.tsx
// Textarea with @ mention autocomplete for Slack messages

import { useState, useRef, useMemo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { useSlackChannelMembers } from "@/hooks";
import type { SlackUser } from "@/types/slack.types";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  integrationId: string | null;
  channelId: string | null;
  placeholder?: string;
  disabled?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  integrationId,
  channelId,
  placeholder,
  disabled,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch channel members
  const { data: members, isLoading } = useSlackChannelMembers(
    integrationId,
    channelId,
  );

  // Detect @ trigger and extract search query
  const detectMentionTrigger = (
    text: string,
    position: number,
  ): { show: boolean; query: string; startPos: number } => {
    const textBeforeCursor = text.substring(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    // No @ found
    if (lastAtIndex === -1) {
      return { show: false, query: "", startPos: 0 };
    }

    // Check if it's an email (has @ in middle of word with . after)
    const afterAt = text.substring(lastAtIndex);
    const hasEmailPattern = /^@[^\s]+\.[^\s]+/.test(afterAt);
    if (hasEmailPattern) {
      return { show: false, query: "", startPos: 0 };
    }

    // Must be at start or after space/newline
    const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
    if (
      charBeforeAt &&
      charBeforeAt !== " " &&
      charBeforeAt !== "\n" &&
      charBeforeAt !== "\t"
    ) {
      return { show: false, query: "", startPos: 0 };
    }

    // Extract query after @
    const query = textBeforeCursor.substring(lastAtIndex + 1);

    // Check if query is still being typed (no space after @)
    const textAfterCursor = text.substring(position);
    const nextSpaceIndex = textAfterCursor.indexOf(" ");
    const nextNewlineIndex = textAfterCursor.indexOf("\n");
    const hasSpaceOrNewlineAfter =
      (nextSpaceIndex !== -1 && nextSpaceIndex === 0) ||
      (nextNewlineIndex !== -1 && nextNewlineIndex === 0);

    // Don't show dropdown if there's a space immediately after cursor
    if (hasSpaceOrNewlineAfter) {
      return { show: false, query: "", startPos: 0 };
    }

    return { show: true, query: query.toLowerCase(), startPos: lastAtIndex };
  };

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!members || members.length === 0) return [];

    // If no search query, show first 10 users
    if (!searchQuery) {
      return members.slice(0, 10);
    }

    // Filter by display name, real name, or username
    return members
      .filter((user) => {
        const displayName =
          user.profile?.display_name || user.real_name || user.name || "";
        const username = user.name || "";
        const query = searchQuery.toLowerCase();

        return (
          displayName.toLowerCase().includes(query) ||
          username.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
  }, [members, searchQuery]);

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;

    onChange(newValue);
    setCursorPos(newCursorPos);

    // Check for mention trigger
    const { show, query, startPos } = detectMentionTrigger(
      newValue,
      newCursorPos,
    );

    if (show) {
      setShowDropdown(true);
      setSearchQuery(query);
      setMentionStartPos(startPos);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
      setSearchQuery("");
    }
  };

  // Insert mention when user selects from dropdown
  const insertMention = (user: SlackUser) => {
    const beforeAt = value.substring(0, mentionStartPos);
    const afterCursor = value.substring(cursorPos);
    const mention = `<@${user.id}>`;
    const newValue = beforeAt + mention + " " + afterCursor;

    onChange(newValue);
    setShowDropdown(false);
    setSearchQuery("");

    // Set cursor after inserted mention
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = beforeAt.length + mention.length + 1;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : 0,
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredUsers.length - 1,
        );
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        setSearchQuery("");
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      }
    }

    // Normal Enter behavior when dropdown not shown
    if (e.key === "Enter" && !e.shiftKey && !showDropdown) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  // Handle cursor position changes
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPos(target.selectionStart);
  };

  // Reset selected index when filtered users change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredUsers.length]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        placeholder={placeholder}
        disabled={disabled}
        className="resize-none"
        rows={3}
      />

      <Popover open={showDropdown} onOpenChange={setShowDropdown}>
        <PopoverAnchor asChild>
          <div className="absolute bottom-full left-0 pointer-events-none" />
        </PopoverAnchor>
        <PopoverContent
          className="w-80 p-0"
          side="top"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false} loop>
            <CommandList className="max-h-64">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
                  <span className="ml-2 text-xs text-v2-ink-muted">
                    Loading users...
                  </span>
                </div>
              ) : filteredUsers.length > 0 ? (
                <CommandGroup
                  heading={
                    searchQuery
                      ? `Results (${filteredUsers.length})`
                      : `Users (${filteredUsers.length})`
                  }
                >
                  {filteredUsers.map((user, index) => {
                    const displayName =
                      user.profile?.display_name || user.real_name || user.name;
                    const username = user.name;

                    return (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => insertMention(user)}
                        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${
                          index === selectedIndex
                            ? "bg-accent"
                            : "hover:bg-accent/50"
                        }`}
                      >
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={user.profile?.image_48} />
                          <AvatarFallback className="text-[9px] bg-v2-ring">
                            {displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-v2-ink truncate">
                            {displayName}
                          </div>
                          <div className="text-[10px] text-v2-ink-muted truncate">
                            @{username}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : (
                <CommandEmpty className="py-6 text-center text-xs text-v2-ink-muted">
                  {searchQuery
                    ? `No users found matching "${searchQuery}"`
                    : "No users in this channel"}
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
