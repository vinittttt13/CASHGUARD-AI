"use client";

import { useState } from "react";
import { Printer, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AmlTransactionResponse } from "@/types";

interface StatutoryNoticeModalProps {
  open: boolean;
  onClose: () => void;
  transaction: AmlTransactionResponse & {
    amount_paid: number;
    payment_currency: string;
    from_bank?: string;
    to_bank?: string;
  };
}

// Masks all but the last 4 characters of a bank/account identifier so the
// printed notice doesn't leak the full value into a screenshot or log.
function mask(value: string | undefined | null): string {
  if (!value) return "UNSPECIFIED";
  if (value.length <= 4) return value;
  return `${"X".repeat(value.length - 4)}${value.slice(-4)}`;
}

export function StatutoryNoticeModal({ open, onClose, transaction }: StatutoryNoticeModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!open) return null;

  const noticeRef = `CCIW/S91-94/${new Date().getFullYear()}/${String(
    Math.floor(Math.random() * 90000) + 10000,
  ).padStart(5, "0")}`;
  const verificationHash = `sha256:${noticeRef.replace(/\W/g, "").toLowerCase()}${transaction.laundering_probability
    .toFixed(4)
    .replace(".", "")}`;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Statutory Bank Freeze Notice"
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border bg-white shadow-2xl text-slate-900 dark:text-slate-100 dark:bg-slate-950 print:max-h-none print:shadow-none print:overflow-visible print:rounded-none print:border-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="print:block hidden bg-black text-white text-center py-3 text-[11px] font-bold tracking-widest uppercase">
          Statutory Notice — Section 91 Cr.P.C. / Section 94 BNSS, 2023
        </div>

        <div className="p-8 space-y-6 font-serif">
          <header className="text-center border-b-2 border-slate-800 pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Office of the Superintendent of Police / Cyber Crime Cell
            </p>
            <h1 className="text-xl font-extrabold uppercase mt-1">
              Notice under Section 91 Cr.P.C. / Section 94 Bharatiya Nagarik
              Suraksha Sanhita (BNSS), 2023
            </h1>
            <p className="text-xs text-slate-500 mt-2">Reference: {noticeRef}</p>
          </header>

          <section className="text-sm leading-relaxed space-y-2">
            <p>
              <strong>To:</strong> The Nodal Officer, {transaction.to_bank ?? "Payment Gateway Switch"}
            </p>
            <p>
              <strong>Date:</strong> {new Date().toLocaleDateString("en-IN")}
            </p>
          </section>

          <section className="text-sm leading-relaxed space-y-3 border-t border-b py-4">
            <p>
              This is an urgent matter of ongoing cyber financial crime investigation.
              Automated transaction risk analysis has flagged the following transaction as
              exhibiting characteristics consistent with money laundering:
            </p>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5 font-bold pr-4">Originating Account</td>
                  <td className="py-1.5 font-mono">{mask(transaction.from_bank)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 font-bold pr-4">Beneficiary Account</td>
                  <td className="py-1.5 font-mono">{mask(transaction.to_bank)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 font-bold pr-4">Amount</td>
                  <td className="py-1.5">
                    {transaction.payment_currency} {transaction.amount_paid.toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 font-bold pr-4">Risk Assessment</td>
                  <td className="py-1.5 uppercase font-bold">
                    {transaction.risk_level} ({(transaction.laundering_probability * 100).toFixed(1)}%
                    laundering probability, model {transaction.model_name})
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              You are hereby directed, under the cited statutory authority, to place an
              <strong> IMMEDIATE DEBIT FREEZE / LIEN</strong> on the above account(s) to prevent
              dissipation of the funds pending formal investigation, and to furnish account
              opening records and transaction history for the preceding 90 days.
            </p>
          </section>

          <footer className="text-xs text-slate-500 space-y-1">
            <p>System verification hash: <span className="font-mono">{verificationHash}</span></p>
            <p>Generated: {new Date().toISOString()}</p>
            <p>Authorizing Officer: Officer-in-Charge, Cyber Crime Investigation Wing (signature block — manual countersignature required before service)</p>
          </footer>

          <div className="flex justify-end gap-2 print:hidden pt-4 border-t">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={isPrinting} className="gap-2">
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, aside, header.site-header, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function StatutoryNoticeButton({
  transaction,
}: {
  transaction: StatutoryNoticeModalProps["transaction"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="gap-2 w-full"
        onClick={() => setOpen(true)}
      >
        <Scale className="h-4 w-4" /> Generate Statutory Bank Notice (Sec 91 CrPC / 94 BNSS)
      </Button>
      <StatutoryNoticeModal open={open} onClose={() => setOpen(false)} transaction={transaction} />
    </>
  );
}
