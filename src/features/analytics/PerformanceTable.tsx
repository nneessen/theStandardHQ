// /home/nneessen/projects/commissionTracker/src/features/analytics/PerformanceTable.tsx

import React from "react";
import { DataTable } from "../../components/shared/DataTable";
import {
  CarrierPerformance,
  StatePerformance,
  ProductPerformance,
} from "../../types/metrics.types";
import { DataTableColumn } from "../../types/ui.types";

interface PerformanceTableProps {
  title: string;
  data: CarrierPerformance[] | StatePerformance[] | ProductPerformance[];
  type: "carrier" | "state" | "product";
}

export const PerformanceTable: React.FC<PerformanceTableProps> = ({
  title,
  data,
  type,
}) => {
  const renderTable = () => {
    switch (type) {
      case "carrier": {
        const carrierData = data as CarrierPerformance[];
        const carrierColumns: DataTableColumn<CarrierPerformance>[] = [
          {
            header: "Carrier",
            accessor: "carrierName",
            render: (item: CarrierPerformance) => (
              <div className="font-medium">{item.carrierName}</div>
            ),
          },
          {
            header: "Policies",
            accessor: "policies",
            render: (item: CarrierPerformance) => item.policies,
          },
          {
            header: "Total Revenue",
            accessor: "revenue",
            render: (item: CarrierPerformance) =>
              `$${item.revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`,
          },
          {
            header: "Avg Commission",
            accessor: "averageCommission",
            render: (item: CarrierPerformance) => (
              <span className="font-medium text-success">
                $
                {item.averageCommission.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                })}
              </span>
            ),
          },
        ];
        return (
          <DataTable
            data={carrierData.slice(0, 10)}
            columns={carrierColumns}
            emptyMessage="No performance data available"
          />
        );
      }

      case "state": {
        const stateData = data as StatePerformance[];
        const stateColumns: DataTableColumn<StatePerformance>[] = [
          {
            header: "State",
            accessor: "state",
            render: (item: StatePerformance) => (
              <div className="font-medium">{item.state}</div>
            ),
          },
          {
            header: "Policies",
            accessor: "policies",
            render: (item: StatePerformance) => item.policies,
          },
          {
            header: "Total Revenue",
            accessor: "revenue",
            render: (item: StatePerformance) =>
              `$${item.revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`,
          },
          {
            header: "Avg Policy Size",
            accessor: "averageSize",
            render: (item: StatePerformance) => (
              <span className="font-medium text-success">
                $
                {item.averageSize.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                })}
              </span>
            ),
          },
        ];
        return (
          <DataTable
            data={stateData.slice(0, 10)}
            columns={stateColumns}
            emptyMessage="No performance data available"
          />
        );
      }

      case "product": {
        const productData = data as ProductPerformance[];
        const productColumns: DataTableColumn<ProductPerformance>[] = [
          {
            header: "Product",
            accessor: "product",
            render: (item: ProductPerformance) => {
              const productLabels: Record<string, string> = {
                whole_life: "Whole Life",
                term: "Term Life",
                universal_life: "Universal Life",
                indexed_universal_life: "Indexed Universal",
                accidental: "Accidental Death",
                final_expense: "Final Expense",
                annuity: "Annuity",
              };
              return (
                <div className="font-medium">
                  {productLabels[item.product] || item.product}
                </div>
              );
            },
          },
          {
            header: "Policies",
            accessor: "policies",
            render: (item: ProductPerformance) => item.policies,
          },
          {
            header: "Total Revenue",
            accessor: "revenue",
            render: (item: ProductPerformance) =>
              `$${item.revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`,
          },
          {
            header: "Avg Policy Size",
            accessor: "averageSize",
            render: (item: ProductPerformance) => (
              <span className="font-medium text-success">
                $
                {item.averageSize.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                })}
              </span>
            ),
          },
        ];
        return (
          <DataTable
            data={productData.slice(0, 10)}
            columns={productColumns}
            emptyMessage="No performance data available"
          />
        );
      }

      default:
        return <div>No data available</div>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-medium">{title}</h3>
      </div>
      {renderTable()}
    </div>
  );
};
