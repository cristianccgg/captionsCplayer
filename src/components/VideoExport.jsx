import React, { useState, useRef } from "react";
import { Save, Lock, Check } from "lucide-react";

const ExportOptions = {
  FREE: {
    maxDuration: 5 * 60, // 5 minutos
    resolution: "720p",
    watermark: true,
    formats: ["mp4"],
  },
  PRO: {
    maxDuration: 60 * 60, // 1 hora
    resolution: "1080p",
    watermark: false,
    formats: ["mp4", "webm", "avi"],
  },
  ENTERPRISE: {
    maxDuration: null, // Sin límite
    resolution: "4K",
    watermark: false,
    formats: ["mp4", "webm", "avi", "mov"],
  },
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

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isExportingRef = useRef(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

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

  const getMimeType = () => {
    const mimeTypes = [
      "video/mp4;codecs=h264",
      "video/mp4",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    throw new Error("No supported MIME type found.");
  };

  const startExport = async (planDetails) => {
    if (!videoUrl || !mainVideoRef.current) return;
    try {
      const originalVideoElement = mainVideoRef.current;

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        ctxRef.current = canvasRef.current.getContext("2d");
      }
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      // Mapeo de aspect ratios a resoluciones
      const resolutionMap = {
        "16:9": { width: 1920, height: 1080 },
        "9:16": { width: 1080, height: 1920 },
        "1:1": { width: 1080, height: 1080 },
      };

      // Obtener el aspect ratio actual del video
      const currentAspectRatio =
        mainVideoRef.current.videoWidth > mainVideoRef.current.videoHeight
          ? "16:9"
          : mainVideoRef.current.videoWidth === mainVideoRef.current.videoHeight
          ? "1:1"
          : "9:16";

      // Usar el aspect ratio seleccionado o el detectado
      const aspectRatio = planDetails.resolution || currentAspectRatio;

      // Cambiar aquí la destructuración
      const resolution = resolutionMap[aspectRatio] || resolutionMap["9:16"];
      const width = resolution.width;
      const height = resolution.height;

      canvas.width = width;
      canvas.height = height;

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const clonedVideoElement = originalVideoElement.cloneNode(true);

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
      const audioStream = destination.stream;
      const combinedStream = new MediaStream([
        ...videoStream.getTracks(),
        ...audioStream.getTracks(),
      ]);

      const mimeType = getMimeType();
      const options = {
        mimeType: mimeType,
        videoBitsPerSecond: 8000000,
      };

      mediaRecorderRef.current = new MediaRecorder(combinedStream, options);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `video_with_subtitles_${planDetails.resolution}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          audioContext.close();
        }

        setIsExporting(false);
        isExportingRef.current = false;
        setProgress(100);
      };

      setIsExporting(true);
      isExportingRef.current = true;
      setProgress(0);
      mediaRecorderRef.current.start();
      await clonedVideoElement.play();

      const renderFrame = () => {
        if (!isExportingRef.current) {
          mediaRecorderRef.current.stop();
          return;
        }

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
          mediaRecorderRef.current.stop();
          return;
        }

        requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (error) {
      console.error("Error during export:", error);
      setIsExporting(false);
      isExportingRef.current = false;
      setProgress(0);
      alert("Error during export: " + error.message);
    }
  };

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
        className="inline-flex items-center justify-center w-full mx-auto px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-black"
      >
        <Save className="w-4 h-4 mr-2" />
        <span className="text-center font-bold">
          {isExporting ? `Exportando... ${progress}%` : "Exportar video"}
        </span>
      </button>

      {showExportModal && <ExportModal />}
    </>
  );
}

export default VideoExport;
