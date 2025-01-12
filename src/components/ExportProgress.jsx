import React, { memo, useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock } from "lucide-react";

const formatTime = (seconds) => {
  if (seconds === Infinity || isNaN(seconds)) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const calculateTimeRemaining = (startTime, progress) => {
  if (!startTime || progress === 0) return null;

  const elapsed = (Date.now() - startTime) / 1000;
  const percentageComplete = progress / 100;

  // Evitar división por cero
  if (percentageComplete === 0) return null;

  const estimatedTotal = elapsed / percentageComplete;
  const remaining = Math.max(0, estimatedTotal - elapsed);

  // Si el tiempo restante es muy grande, probablemente es un cálculo erróneo
  return remaining > 7200 ? null : remaining; // máximo 2 horas
};

const ExportProgress = memo(({ isExporting, progress = 0, startTime }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [lastValidTime, setLastValidTime] = useState(null);

  useEffect(() => {
    if (!isExporting || !startTime) {
      setTimeRemaining(null);
      setLastValidTime(null);
      return;
    }

    const updateTimer = () => {
      const remaining = calculateTimeRemaining(startTime, progress);

      if (remaining !== null) {
        setLastValidTime(remaining);
        setTimeRemaining(remaining);
      } else if (lastValidTime !== null) {
        // Si no podemos calcular un nuevo tiempo, usar el último válido
        setTimeRemaining(Math.max(0, lastValidTime - 1));
      }
    };

    const timer = setInterval(updateTimer, 1000);
    updateTimer(); // Actualizar inmediatamente

    return () => clearInterval(timer);
  }, [isExporting, progress, startTime, lastValidTime]);

  if (!isExporting) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg p-8 max-w-sm w-full mx-4">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white font-medium">Exportando video</span>
              <span className="text-white font-medium">{progress}%</span>
            </div>
            <Progress
              value={progress}
              className="h-2 transition-all [&>div]:bg-pink-500"
            />
            {(timeRemaining !== null || lastValidTime !== null) && (
              <div className="flex items-center justify-end gap-2 mt-1">
                <Clock className="h-3 w-3 text-zinc-400" />
                <span className="text-xs text-zinc-400">
                  Tiempo restante: {formatTime(timeRemaining || lastValidTime)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
            <span className="text-sm text-zinc-300">
              {progress < 100
                ? "Procesando tu video..."
                : "¡Exportación completada!"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

ExportProgress.displayName = "ExportProgress";

export default ExportProgress;
