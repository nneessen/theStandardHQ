import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  AdvancedTimePeriod,
  AdvancedDateRange,
  getAdvancedDateRange,
} from "../components/TimePeriodSelector";

interface DateRangeContextValue {
  timePeriod: AdvancedTimePeriod;
  setTimePeriod: (period: AdvancedTimePeriod) => void;
  customRange: {
    startDate: Date;
    endDate: Date;
  };
  setCustomRange: (range: { startDate: Date; endDate: Date }) => void;
  dateRange: AdvancedDateRange;
}

const AnalyticsDateContext = createContext<DateRangeContextValue | undefined>(
  undefined,
);

// Helper function to create stable initial dates
function getInitialCustomRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  return {
    startDate: today,
    endDate: endDate,
  };
}

export function AnalyticsDateProvider({ children }: { children: ReactNode }) {
  // Default to YTD so the period-scoped panels (funnel, product mix, carriers,
  // premium-by-state, segments, leaderboard, trend comparison) load with a
  // meaningful window instead of just the current month's first few days.
  const [timePeriod, setTimePeriod] = useState<AdvancedTimePeriod>("YTD");
  const [customRange, setCustomRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>(getInitialCustomRange);

  // Calculate the actual date range based on the selected period
  const dateRange = getAdvancedDateRange(timePeriod, customRange);

  const value: DateRangeContextValue = {
    timePeriod,
    setTimePeriod,
    customRange,
    setCustomRange,
    dateRange,
  };

  return (
    <AnalyticsDateContext.Provider value={value}>
      {children}
    </AnalyticsDateContext.Provider>
  );
}

export function useAnalyticsDateRange() {
  const context = useContext(AnalyticsDateContext);
  if (context === undefined) {
    throw new Error(
      "useAnalyticsDateRange must be used within an AnalyticsDateProvider",
    );
  }
  return context;
}
