"use client";

import React, { useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import WatershedPicker from "@/components/treatment/WatershedPicker";
import TreatmentPlanner from "@/components/treatment/TreatmentPlanner";
import type { Watershed } from "@/components/treatment/treatmentData";

const TreatmentSection: React.FC = () => {
  const [ws, setWs] = useState<Watershed | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicHeader />

      {ws ? (
        <TreatmentPlanner ws={ws} onBack={() => setWs(null)} />
      ) : (
        <WatershedPicker onSelect={setWs} />
      )}

      <footer className="py-8 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-1">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.
          </p>
          <p className="text-[10px] text-slate-400/70">
            Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default TreatmentSection;
