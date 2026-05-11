// src/features/legal/components/LegalPageLayout.tsx
import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/login">
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          {children}
        </div>
        <div className="mt-12 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Nick Neessen. All rights reserved.
            The Standard HQ&trade; is owned and operated by Nick Neessen as an
            independent commercial software product.
          </p>
        </div>
      </div>
    </div>
  );
}
