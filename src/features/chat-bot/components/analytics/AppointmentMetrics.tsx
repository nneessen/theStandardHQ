// src/features/chat-bot/components/analytics/AppointmentMetrics.tsx

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBotAnalytics } from "../../hooks/useChatBotAnalytics";

export function AppointmentMetrics({
  data,
}: {
  data: ChatBotAnalytics["appointments"];
}) {
  const total = data.total ?? 0;
  const bookingRate = Math.min(data.bookingRate ?? 0, 1);
  const showRate = Math.min(data.showRate ?? 0, 1);
  const cancelRate = Math.min(data.cancelRate ?? 0, 1);
  const avgDays = data.avgDaysToAppointment ?? 0;

  return (
    <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <Calendar className="h-3 w-3 text-violet-500" />
        <h4 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          Appointments
        </h4>
        <span className="ml-auto text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {total.toLocaleString()}
        </span>
      </div>

      <div className="space-y-1.5">
        <FunnelRow
          label="Booking Rate"
          value={`${(bookingRate * 100).toFixed(1)}%`}
          barPercent={bookingRate * 100}
          color="bg-violet-500"
        />
        <FunnelRow
          label="Show Rate"
          value={`${(showRate * 100).toFixed(1)}%`}
          barPercent={showRate * 100}
          color="bg-emerald-500"
        />
        <FunnelRow
          label="Cancel Rate"
          value={`${(cancelRate * 100).toFixed(1)}%`}
          barPercent={cancelRate * 100}
          color="bg-red-400"
        />
      </div>

      <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Avg days to appointment
          </span>
          <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
            {avgDays.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  barPercent,
  color,
}: {
  label: string;
  value: string;
  barPercent: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
        <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
          {value}
        </span>
      </div>
      <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(barPercent, 100)}%` }}
        />
      </div>
    </div>
  );
}
