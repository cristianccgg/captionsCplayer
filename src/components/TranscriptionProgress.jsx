import React, { memo } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

const TranscriptionProgress = memo(
  ({ isTranscribing, status, progress = 0 }) => {
    if (!isTranscribing) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg p-8 max-w-sm w-full mx-4">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white font-medium">{status}</span>
                <span className="text-white font-medium">{progress}%</span>
              </div>
              <Progress
                value={progress}
                className="h-2 transition-all [&>div]:bg-pink-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
              <span className="text-sm text-zinc-300">
                Procesando tu video...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TranscriptionProgress.displayName = "TranscriptionProgress";

export default TranscriptionProgress;
