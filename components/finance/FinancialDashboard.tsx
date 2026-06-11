"use client";
import LeftPanel  from "./LeftPanel";
import RightPanel from "./RightPanel";
import { C } from "@/config/colors";

export default function FinancialDashboard() {
  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", overflow: "hidden", background: C.bg }}>
      <LeftPanel />
      <RightPanel />
    </div>
  );
}
