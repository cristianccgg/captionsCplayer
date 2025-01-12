import React, { useState, useRef, useCallback, useEffect } from "react";
import { Save, Lock, Check } from "lucide-react";
import ExportProgress from "./ExportProgress";
import VideoPreviewModal from "./VideoPreviewModal"; // Ajusta la ruta según tu estructura

const ExportOptions = {
  FREE: {
    maxDuration: 5 * 60,
    resolution: "720p",
    watermark: true,
    formats: ["mp4"],
    bitrate: 2500000, // 2.5 Mbps para 720p
  },
  PRO: {
    maxDuration: 60 * 60,
    resolution: "1080p",
    watermark: false,
    formats: ["mp4", "webm", "avi"],
    bitrate: 5000000, // 5 Mbps para 1080p
  },
  ENTERPRISE: {
    maxDuration: null,
    resolution: "4K",
    watermark: false,
    formats: ["mp4", "webm", "avi", "mov"],
    bitrate: 16000000, // 16 Mbps para 4K
  },
};

const isIOSMobile = () => {
  return (
    /iPad|iPhone|iPod/.test(navigator.platform) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1 &&
      !/Mac/.test(navigator.userAgent))
  );
};

const calculateDimensions = (videoElement, targetHeight) => {
  const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
  const isVertical = videoElement.videoHeight > videoElement.videoWidth;

  if (isVertical) {
    const height = targetHeight;
    const width = Math.round(height * aspectRatio);
    return { width, height };
  } else {
    const width = Math.round(targetHeight * aspectRatio);
    return { width, height: targetHeight };
  }
};

export function VideoExport({
  videoUrl,
  phrases,
  subtitleStyles,
  videoRef: mainVideoRef,
}) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("FREE");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStartTime, setExportStartTime] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isExportingRef = useRef(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const requestAnimationFrameRef = useRef(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Agregar protección contra navegación
  useEffect(() => {
    if (!isExporting) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ""; // Mensaje requerido por algunos navegadores
      return "La exportación está en progreso. ¿Estás seguro de que quieres salir?";
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isExportingRef.current) {
        // Guardar el estado actual para cuando el usuario vuelva
        localStorage.setItem(
          "exportState",
          JSON.stringify({
            progress: progress,
            startTime: exportStartTime,
            isExporting: true,
          })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isExporting, progress, exportStartTime]);

  // Recuperar estado de exportación si existe
  useEffect(() => {
    const savedState = localStorage.getItem("exportState");
    if (savedState) {
      const {
        progress: savedProgress,
        startTime,
        isExporting: wasExporting,
      } = JSON.parse(savedState);

      // Solo recuperar el estado si teníamos un video y estábamos exportando
      if (wasExporting && videoUrl) {
        const timeElapsed = Date.now() - startTime;
        // Si han pasado más de 5 segundos, no recuperar el estado
        if (timeElapsed < 5000) {
          setProgress(savedProgress);
          setExportStartTime(startTime);
          setIsExporting(true);
        }
      }
      localStorage.removeItem("exportState");
    }
  }, [videoUrl]);

  const calculateWordTiming = (phrase, currentTime) => {
    const phraseLength = phrase.end - phrase.start;
    const words = phrase.text.split(" ");
    const timePerWord = phraseLength / words.length;
    const mediaRecorderDelay = 50;

    return words.map((word, index) => ({
      word,
      start: phrase.start + timePerWord * index + mediaRecorderDelay,
      end: phrase.start + timePerWord * (index + 1) + mediaRecorderDelay,
      isCurrentWord:
        currentTime >=
          phrase.start + timePerWord * index + mediaRecorderDelay &&
        currentTime <=
          phrase.start + timePerWord * (index + 1) + mediaRecorderDelay,
    }));
  };

  const drawSubtitles = (ctx, canvas, currentTime, phrases, subtitleStyles) => {
    const currentTimeMs = Math.round(currentTime * 1000);
    const initialDelay = 1000; // Introduce a delay of 1 second to skip the initial "rebobinado"
    const bufferTime = 50; // Keep buffer time reasonable to prevent early disappearance

    // Skip the first second of the video to handle the initial glitch
    if (currentTimeMs < initialDelay) return;

    // Adjust currentTimeMs by subtracting the initial delay
    const adjustedTime = currentTimeMs - initialDelay;

    // Filter to get the current phrase only
    const currentPhrase = phrases.find(
      (phrase) =>
        adjustedTime >= phrase.start && adjustedTime <= phrase.end + bufferTime // Allow a small margin at the end
    );

    if (!currentPhrase) return; // If no current phrase, do nothing

    const phraseStyles =
      subtitleStyles.phraseStyles[currentPhrase.id] || subtitleStyles.default;
    const fontSize = Math.round(phraseStyles.fontSize * (canvas.height / 1080));
    ctx.font = `${phraseStyles.fontWeight} ${
      phraseStyles.fontStyle
    } ${fontSize}px ${phraseStyles.fontFamily || "system-ui, sans-serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const padding = Math.round(20 * (canvas.height / 1080));
    const lineHeight = fontSize * 1.2;
    let verticalPosition =
      phraseStyles.customPosition && phraseStyles.customPosition.y !== undefined
        ? phraseStyles.customPosition.y * canvas.height
        : canvas.height - padding - lineHeight / 2;

    const wordTimings = calculateWordTiming(currentPhrase, adjustedTime);
    const words = wordTimings.map((wt) => wt.word);
    const lines = [];
    let currentLine = [];
    let currentLineWidth = 0;
    const maxWidth = canvas.width * 0.9;

    words.forEach((word) => {
      const wordWidth = ctx.measureText(word + " ").width;
      if (currentLineWidth + wordWidth > maxWidth) {
        lines.push(currentLine);
        currentLine = [word];
        currentLineWidth = wordWidth;
      } else {
        currentLine.push(word);
        currentLineWidth += wordWidth;
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    if (phraseStyles.backgroundColor !== "transparent") {
      ctx.fillStyle = phraseStyles.backgroundColor;
      lines.forEach((line, lineIndex) => {
        const lineText = line.join(" ");
        const lineWidth = ctx.measureText(lineText).width;
        const lineVerticalPosition =
          verticalPosition + (lineIndex - (lines.length - 1) / 2) * lineHeight;
        const x = (canvas.width - lineWidth) / 2 - padding / 2;
        const y = lineVerticalPosition - lineHeight / 2;
        const width = lineWidth + padding;
        const height = lineHeight + padding / 2;
        const radius = Math.round(4 * (canvas.height / 1080));

        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        ctx.fill();
      });
    }

    lines.forEach((line, lineIndex) => {
      const lineText = line.join(" ");
      const lineVerticalPosition =
        verticalPosition + (lineIndex - (lines.length - 1) / 2) * lineHeight;
      let xOffset = (canvas.width - ctx.measureText(lineText).width) / 2;

      line.forEach((word) => {
        const wordTiming = wordTimings.find((wt) => wt.word === word);
        ctx.fillStyle = wordTiming.isCurrentWord
          ? phraseStyles.highlightColor
          : phraseStyles.color;

        // Agregar borde negro
        ctx.strokeStyle = "black";
        ctx.lineWidth = Math.max(2, fontSize * 0.08);
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(
          word,
          xOffset + ctx.measureText(word).width / 2,
          lineVerticalPosition
        );

        // Texto principal
        ctx.fillText(
          word,
          xOffset + ctx.measureText(word).width / 2,
          lineVerticalPosition
        );
        xOffset += ctx.measureText(word + " ").width;
      });
    });
  };

  const getMimeType = useCallback(() => {
    // Para iOS móvil, forzar MP4 con codec H.264
    if (isIOSMobile()) {
      return 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    }

    const mimeTypes = [
      "video/mp4;codecs=h264",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp9",
      "video/webm",
      "video/mp4",
    ];

    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    throw new Error("No supported MIME type found.");
  }, []);

  const startExport = async (planDetails) => {
    if (!videoUrl || !mainVideoRef.current) return;

    try {
      const originalVideoElement = mainVideoRef.current;
      setExportStartTime(Date.now());

      // Crear canvas solo si no existe
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        ctxRef.current = canvasRef.current.getContext("2d", {
          alpha: false,
          desynchronized: true,
          willReadFrequently: true, // Optimización para lecturas frecuentes
        });
      }

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      const targetHeight =
        planDetails.resolution === "4K"
          ? 2160
          : planDetails.resolution === "1080p"
          ? 1080
          : 720;

      const { width, height } = calculateDimensions(
        originalVideoElement,
        targetHeight
      );
      canvas.width = width;
      canvas.height = height;

      if (isIOSMobile()) {
        try {
          const options = {
            mimeType: getMimeType(),
            videoBitsPerSecond: planDetails.bitrate,
            audioBitsPerSecond: 128000,
          };

          const videoStream = canvas.captureStream(30);
          const audioContext = new (window.AudioContext ||
            window.webkitAudioContext)({
            sampleRate: 44100,
            latencyHint: "playback",
          });

          const source =
            audioContext.createMediaElementSource(originalVideoElement);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          source.connect(audioContext.destination);

          const combinedStream = new MediaStream([
            videoStream.getVideoTracks()[0],
            destination.stream.getAudioTracks()[0],
          ]);

          mediaRecorderRef.current = new MediaRecorder(combinedStream, options);
          chunksRef.current = [];

          // Agregar manejador de errores
          mediaRecorderRef.current.onerror = (error) => {
            console.error("MediaRecorder error:", error);
            alert("Error durante la exportación: " + error.message);
            setIsExporting(false);
            isExportingRef.current = false;
            setProgress(0);
          };

          // Mejorar el manejo del progreso
          const duration = originalVideoElement.duration;
          let lastTime = 0;

          const renderFrame = () => {
            if (!isExportingRef.current) return;

            const currentTime = originalVideoElement.currentTime;

            // Actualizar progreso solo si el tiempo ha cambiado
            if (currentTime > lastTime) {
              const currentProgress = (currentTime / duration) * 100;
              setProgress(Math.round(currentProgress));
              lastTime = currentTime;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
              originalVideoElement,
              0,
              0,
              canvas.width,
              canvas.height
            );
            drawSubtitles(ctx, canvas, currentTime, phrases, subtitleStyles);

            if (currentTime < duration) {
              requestAnimationFrameRef.current =
                requestAnimationFrame(renderFrame);
            } else {
              mediaRecorderRef.current.stop();
            }
          };

          mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };

          mediaRecorderRef.current.onstop = async () => {
            try {
              if (chunksRef.current.length > 0) {
                const blob = new Blob(chunksRef.current, {
                  // Forzar el tipo MIME para mejor compatibilidad con iOS
                  type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
                });
                const url = URL.createObjectURL(blob);

                // En lugar de crear elementos DOM, usamos estados de React
                setPreviewUrl(url);
                setIsPreviewOpen(true);

                // Limpiar después de exportar exitosamente
                audioContext.close();
                setIsExporting(false);
                isExportingRef.current = false;
                setProgress(100);
              }
            } catch (error) {
              console.error("Error al finalizar la exportación:", error);
              alert("Error al finalizar la exportación: " + error.message);
            }
          };

          setIsExporting(true);
          isExportingRef.current = true;
          setProgress(0);

          // Iniciar grabación con un tamaño de timeslice más pequeño para iOS
          mediaRecorderRef.current.start(100);
          originalVideoElement.currentTime = 0;
          await originalVideoElement.play();
          renderFrame();

          return;
        } catch (error) {
          console.error("Error en exportación iOS:", error);
          alert("Error durante la exportación en iOS: " + error.message);
          setIsExporting(false);
          isExportingRef.current = false;
          setProgress(0);
        }
      }

      // Crear un Worker para mantener el proceso de renderizado
      const renderWorker = new Worker(
        URL.createObjectURL(
          new Blob(
            [
              `
              let isExporting = true;
              let lastTimestamp = 0;
  
              self.onmessage = function(e) {
                if (e.data.type === 'stop') {
                  isExporting = false;
                } else if (e.data.type === 'start') {
                  isExporting = true;
                  requestAnimationFrame(function loop(timestamp) {
                    if (!isExporting) return;
                    
                    if (timestamp - lastTimestamp >= ${1000 / 30}) {
                      self.postMessage({ type: 'render' });
                      lastTimestamp = timestamp;
                    }
                    
                    requestAnimationFrame(loop);
                  });
                }
              };
              `,
            ],
            { type: "application/javascript" }
          )
        )
      );

      // Manejar la visibilidad del documento
      const handleVisibilityChange = () => {
        if (document.hidden) {
          renderWorker.postMessage({ type: "start" });
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        latencyHint: "playback",
      });

      const clonedVideoElement = originalVideoElement.cloneNode(true);
      clonedVideoElement.muted = false; // Asegurar que el audio se procese

      await new Promise((resolve) => {
        clonedVideoElement.addEventListener("loadeddata", resolve, {
          once: true,
        });
        clonedVideoElement.currentTime = 0;
      });

      const source = audioContext.createMediaElementSource(clonedVideoElement);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);

      const videoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...videoStream.getTracks(),
        ...destination.stream.getTracks(),
      ]);

      const options = {
        mimeType: getMimeType(),
        videoBitsPerSecond: planDetails.bitrate,
        audioBitsPerSecond: 128000,
      };

      mediaRecorderRef.current = new MediaRecorder(combinedStream, options);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      const cleanup = () => {
        renderWorker.terminate();
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        cancelAnimationFrame(requestAnimationFrameRef.current);
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
        }
        audioContext.close();
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: getMimeType() });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `video_with_subtitles_${planDetails.resolution}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } catch (error) {
          console.error("Error al finalizar la exportación:", error);
        } finally {
          cleanup();
          setIsExporting(false);
          isExportingRef.current = false;
          setProgress(100);
          setExportStartTime(null);
        }
      };

      setIsExporting(true);
      isExportingRef.current = true;
      setProgress(0);

      mediaRecorderRef.current.start(250);
      await clonedVideoElement.play();

      renderWorker.onmessage = () => {
        if (!isExportingRef.current) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(clonedVideoElement, 0, 0, canvas.width, canvas.height);

        drawSubtitles(
          ctx,
          canvas,
          clonedVideoElement.currentTime,
          phrases,
          subtitleStyles
        );

        const currentProgress =
          (clonedVideoElement.currentTime / clonedVideoElement.duration) * 100;
        setProgress(Math.round(currentProgress));

        if (clonedVideoElement.currentTime >= clonedVideoElement.duration) {
          cleanup();
        }
      };

      renderWorker.postMessage({ type: "start" });

      // Cleanup si hay error
      window.addEventListener("unload", cleanup);
      return () => {
        window.removeEventListener("unload", cleanup);
        cleanup();
      };
    } catch (error) {
      console.error("Error during export:", error);
      setIsExporting(false);
      isExportingRef.current = false;
      setProgress(0);
      setExportStartTime(null);
      alert("Error during export: " + error.message);
    }
  };

  useEffect(() => {
    return () => {
      if (isExportingRef.current && videoUrl) {
        localStorage.setItem(
          "exportState",
          JSON.stringify({
            progress: progress,
            startTime: exportStartTime,
            isExporting: true,
          })
        );
      }
    };
  }, [progress, exportStartTime, videoUrl]);

  const handleExport = () => {
    setShowExportModal(true);
  };

  const confirmExport = () => {
    const planDetails = ExportOptions[selectedPlan];

    if (selectedPlan === "FREE") {
      startExport(planDetails);
      setShowExportModal(false);
    } else {
      alert(`Actualiza a plan ${selectedPlan} para estas características`);
    }
  };

  const ExportModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-white">
          Opciones de Exportación
        </h2>

        {Object.entries(ExportOptions).map(([plan, details]) => (
          <div
            key={plan}
            className={`flex items-center justify-between p-4 mb-2 rounded 
              ${
                selectedPlan === plan
                  ? "bg-pink-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            onClick={() => setSelectedPlan(plan)}
          >
            <div>
              <h3 className="font-bold">{plan} Plan</h3>
              <ul className="text-sm">
                <li>
                  Duración máx:{" "}
                  {details.maxDuration
                    ? `${details.maxDuration / 60} min`
                    : "Ilimitado"}
                </li>
                <li>Resolución: {details.resolution}</li>
                <li>Marca de agua: {details.watermark ? "Sí" : "No"}</li>
              </ul>
            </div>
            {selectedPlan === plan && <Check />}
            {plan !== "FREE" && <Lock className="text-yellow-500" />}
          </div>
        ))}

        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={() => setShowExportModal(false)}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={confirmExport}
            className="bg-pink-600 text-white px-4 py-2 rounded"
          >
            Exportar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={handleExport}
        className="inline-flex items-center justify-center w-fit mx-auto px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-800  transition-colors duration-300 ease-in-out"
      >
        <Save className="w-4 h-4 mr-2" />
        <span className="text-center font-bold">
          {isExporting ? `Exportando... ${progress}%` : "Exportar video"}
        </span>
      </button>

      <ExportProgress
        isExporting={isExporting}
        progress={progress}
        startTime={exportStartTime}
      />

      {showExportModal && <ExportModal />}
      {isIOSMobile() && (
        <div className="mb-4 p-3 bg-pink-600 bg-opacity-20 border border-yellow-600 rounded">
          <p className="text-yellow-400 text-xs">
            Nota: La exportación en iOS móvil puede tomar más tiempo. Por favor,
            mantén la pantalla activa durante el proceso.
          </p>
        </div>
      )}
      <button
        onClick={handleExport}
        className="inline-flex items-center justify-center w-fit mx-auto px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-800  transition-colors duration-300 ease-in-out"
      >
        <Save className="w-4 h-4 mr-2" />
        <span className="text-center font-bold">
          {isExporting ? `Exportando... ${progress}%` : "Exportar video"}
        </span>
      </button>

      <ExportProgress
        isExporting={isExporting}
        progress={progress}
        startTime={exportStartTime}
      />

      {showExportModal && <ExportModal />}

      {/* Agregar el VideoPreviewModal aquí */}
      <VideoPreviewModal
        isOpen={isPreviewOpen}
        videoUrl={previewUrl}
        onClose={() => {
          setIsPreviewOpen(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
        onDownload={() => {
          const a = document.createElement("a");
          a.href = previewUrl;
          a.download = `video_with_subtitles_${ExportOptions[selectedPlan].resolution}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setIsPreviewOpen(false);
        }}
      />

      {isIOSMobile() && (
        <div className="mb-4 p-3 bg-pink-600 bg-opacity-20 border border-yellow-600 rounded">
          <p className="text-yellow-400 text-xs">
            Nota: La exportación en iOS móvil puede tomar más tiempo. Por favor,
            mantén la pantalla activa durante el proceso.
          </p>
        </div>
      )}
    </>
  );
}

export default VideoExport;
