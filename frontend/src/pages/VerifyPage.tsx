import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Moon, XCircle } from "lucide-react";

import { apiRequest, type ApiBillVerification } from "../api/client";
import { formatMoney } from "../utils/accounting";

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ApiBillVerification | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await apiRequest<ApiBillVerification>(
          `/api/bills/${id}/verify`,
        );

        if (!cancelled) {
          setResult(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to verify this receipt.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-lunar-background p-6">
      <section className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="flex items-center justify-center gap-2">
          <Moon size={24} className="text-lunar-primary" />
          <p className="font-semibold">Lunar Receipt Verification</p>
        </div>

        {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

        {!error && !result && (
          <p className="mt-6 text-sm text-lunar-muted">Checking receipt…</p>
        )}

        {result && result.valid && (
          <div className="mt-6">
            <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
            <p className="mt-4 text-lg font-semibold text-emerald-700">
              Receipt verified
            </p>
            <dl className="mt-6 space-y-2 text-left text-sm">
              <div className="flex justify-between">
                <dt className="text-lunar-muted">Receipt number</dt>
                <dd className="font-medium">{result.receiptNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-lunar-muted">Facility</dt>
                <dd className="font-medium">{result.facilityName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-lunar-muted">Amount</dt>
                <dd className="font-medium">{formatMoney(result.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-lunar-muted">Paid at</dt>
                <dd className="font-medium">
                  {result.paidAt
                    ? new Date(result.paidAt).toLocaleString("en-NG", {
                        timeZone: "Africa/Lagos",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {result && !result.valid && (
          <div className="mt-6">
            <XCircle size={48} className="mx-auto text-red-600" />
            <p className="mt-4 text-lg font-semibold text-red-700">
              This receipt could not be verified
            </p>
            <p className="mt-2 text-sm text-lunar-muted">
              It may not exist, or the bill has not been paid.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
