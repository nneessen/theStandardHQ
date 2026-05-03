// /home/nneessen/projects/commissionTracker/src/features/test/TestCompGuide.tsx

import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCarriers } from "../../hooks/carriers";
import { useProducts } from "../../hooks/products/useProducts";
import { useCompGuide } from "../../hooks/comps";
import { supabase } from "../../services/base/supabase";

export const TestCompGuide: React.FC = () => {
  const { user } = useAuth();
  const { data: carriers = [] } = useCarriers();
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const { data: products = [] } = useProducts(selectedCarrierId);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test component data
  const [compGuideData, setCompGuideData] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test component data
  const [directQuery, setDirectQuery] = useState<any>(null);

  const userContractLevel = user?.contract_level || 100;

  // Use the hook
  const { data: hookData, error: hookError } = useCompGuide(
    selectedProductId,
    userContractLevel,
  );

  // Direct query test
  useEffect(() => {
    const testDirectQuery = async () => {
      if (!selectedProductId) return;

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("comp_guide")
        .select("*")
        .eq("product_id", selectedProductId)
        .eq("contract_level", userContractLevel)
        .lte("effective_date", today)
        .or(`expiration_date.is.null,expiration_date.gte.${today}`)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      setDirectQuery({ data, error });
    };

    testDirectQuery();
  }, [selectedProductId, userContractLevel]);

  // Load all comp_guide data
  useEffect(() => {
    const loadCompGuideData = async () => {
      const { data, error } = await supabase
        .from("comp_guide")
        .select(
          `
          *,
          products (
            id,
            name,
            carrier_id,
            carriers (
              id,
              name
            )
          )
        `,
        )
        .order("product_id", { ascending: true })
        .order("contract_level", { ascending: true });

      if (!error) {
        setCompGuideData(data || []);
      }
    };

    loadCompGuideData();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Comp Guide Debug Panel</h1>

      <div className="bg-warning/10 border border-warning/30 p-4 rounded mb-4">
        <p className="font-semibold">User Info:</p>
        <p>User ID: {user?.id}</p>
        <p>Contract Level: {userContractLevel}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Carrier
          </label>
          <select
            className="w-full p-2 border rounded"
            value={selectedCarrierId}
            onChange={(e) => {
              setSelectedCarrierId(e.target.value);
              setSelectedProductId("");
            }}
          >
            <option value="">-- Select Carrier --</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Select Product
          </label>
          <select
            className="w-full p-2 border rounded"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            disabled={!selectedCarrierId}
          >
            <option value="">-- Select Product --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({((p.commission_percentage ?? 0) * 100).toFixed(1)}%
                base)
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedProductId && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-info/10 border border-info/30 p-4 rounded">
            <h3 className="font-semibold mb-2">useCompGuide Hook Result:</h3>
            {hookError ? (
              <p className="text-destructive">
                Error: {JSON.stringify(hookError)}
              </p>
            ) : hookData ? (
              <pre className="text-sm">{JSON.stringify(hookData, null, 2)}</pre>
            ) : (
              <p className="text-muted-foreground">No data from hook</p>
            )}
          </div>

          <div className="bg-success/10 border border-success/30 p-4 rounded">
            <h3 className="font-semibold mb-2">Direct Query Result:</h3>
            {directQuery?.error ? (
              <p className="text-destructive">
                Error: {JSON.stringify(directQuery.error)}
              </p>
            ) : directQuery?.data ? (
              <pre className="text-sm">
                {JSON.stringify(directQuery.data, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">No data from direct query</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-muted border border-border p-4 rounded">
        <h3 className="font-semibold mb-2">
          All Comp Guide Entries ({compGuideData.length}):
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Carrier</th>
                <th className="text-left p-2">Product</th>
                <th className="text-left p-2">Contract Level</th>
                <th className="text-left p-2">Commission %</th>
                <th className="text-left p-2">Bonus %</th>
                <th className="text-left p-2">Effective Date</th>
              </tr>
            </thead>
            <tbody>
              {compGuideData.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No comp_guide entries found. The FIX_COMP_GUIDE_DATA.sql
                    script needs to be run in Supabase!
                  </td>
                </tr>
              ) : (
                compGuideData.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">
                      {item.products?.carriers?.name || "N/A"}
                    </td>
                    <td className="p-2">
                      {item.products?.name || item.product_id}
                    </td>
                    <td className="p-2">{item.contract_level}</td>
                    <td className="p-2">
                      {(item.commission_percentage * 100).toFixed(1)}%
                    </td>
                    <td className="p-2">
                      {(item.bonus_percentage * 100).toFixed(1)}%
                    </td>
                    <td className="p-2">{item.effective_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
