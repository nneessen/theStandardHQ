// src/features/expenses/components/ExpenseTemplatesPanel.tsx
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { ExpenseTemplate } from "@/types/expense.types";

interface ExpenseTemplatesPanelProps {
  templates: ExpenseTemplate[];
  onUseTemplate: (template: ExpenseTemplate) => void;
  onDeleteTemplate: (template: ExpenseTemplate) => void;
}

export function ExpenseTemplatesPanel({
  templates,
  onUseTemplate,
  onDeleteTemplate,
}: ExpenseTemplatesPanelProps) {
  if (templates.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Quick Add Templates
        </div>
        <CardDescription className="text-xs">
          One-click expense creation from saved templates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => onUseTemplate(template)}
              className="flex flex-col p-3 bg-gradient-to-br from-primary/15 via-accent/10 to-card rounded-lg shadow-md cursor-pointer transition-all hover:shadow-lg hover:from-primary/20"
            >
              <div className="text-xs font-semibold text-foreground mb-1">
                {template.template_name}
              </div>
              <div className="text-sm font-bold text-primary font-mono">
                {formatCurrency(template.amount)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {template.category} • {template.expense_type}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTemplate(template);
                }}
                className="mt-2 h-7 text-[11px] text-destructive hover:bg-destructive/10"
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
