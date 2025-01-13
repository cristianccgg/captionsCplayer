import React, { useState, useRef, useCallback, useEffect } from "react";
import { Save, Lock, Check } from "lucide-react";
import ExportProgress from "./ExportProgress";

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
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [exportedVideoBlob, setExportedVideoBlob] = useState(null);

  // Función para detectar iOS
  const isIOS = () => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    console.log("Detectando iOS:", isIOS, "UserAgent:", navigator.userAgent);
    return isIOS;
  };

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isExportingRef = useRef(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const requestAnimationFrameRef = useRef(null);
  const audioContextRef = useRef(null); // Añadir esta línea
  const combinedStreamRef = useRef(null); // Añadir esta línea

  // Modified initialization effect
  useEffect(() => {
    if (hasInitialized) return;

    const savedState = localStorage.getItem("exportState");
    if (savedState) {
      const {
        progress: savedProgress,
        startTime,
        isExporting: wasExporting,
      } = JSON.parse(savedState);
      // Only restore export state if it was explicitly started by the user
      if (wasExporting && showExportModal) {
        setProgress(savedProgress);
        setExportStartTime(startTime);
        setIsExporting(true);
      }
      localStorage.removeItem("exportState");
    }
    setHasInitialized(true);
  }, [hasInitialized, showExportModal]);

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
      if (wasExporting) {
        setProgress(savedProgress);
        setExportStartTime(startTime);
        setIsExporting(true);
      }
      localStorage.removeItem("exportState");
    }
  }, []);

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
            console.log("Blob creado:", blob.size, "bytes");

            const isiOSDevice = isIOS();
            console.log("¿Es dispositivo iOS?:", isiOSDevice);

            if (isiOSDevice) {
              console.log("Mostrando modal para iOS");
              setExportedVideoBlob(blob);
              setShowIOSModal(true);
            } else {
              console.log("Descargando en dispositivo no-iOS");
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `video_with_subtitles_${planDetails.resolution}.mp4`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
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
      if (isExportingRef.current) {
        // Guardar el estado final si el componente se desmonta durante la exportación
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
  }, [progress, exportStartTime]);

  const handleExport = () => {
    console.log("Botón de exportación presionado");
    setShowExportModal(true);
  };

  const getIOSBitrate = (planDetails) => {
    // Bitrates optimizados para iOS
    const iOSBitrates = {
      "720p": 1500000, // 1.5 Mbps para 720p
      "1080p": 3000000, // 3 Mbps para 1080p
      "4K": 8000000, // 8 Mbps para 4K
    };

    return iOSBitrates[planDetails.resolution] || planDetails.bitrate;
  };

  const startExportForIOS = async (planDetails) => {
    console.log("Iniciando exportación para iOS...", { planDetails });

    if (!videoUrl || !mainVideoRef.current) {
      console.error("No hay URL de video o referencia de video");
      return;
    }

    const cleanup = () => {
      console.log("Ejecutando limpieza...");
      cancelAnimationFrame(requestAnimationFrameRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      // Limpiar streams y tracks
      if (combinedStreamRef.current) {
        combinedStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Cerrar contexto de audio si existe
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };

    try {
      const originalVideoElement = mainVideoRef.current;
      console.log("Video original obtenido:", {
        width: originalVideoElement.videoWidth,
        height: originalVideoElement.videoHeight,
        duration: originalVideoElement.duration,
        currentSrc: originalVideoElement.currentSrc,
        readyState: originalVideoElement.readyState,
      });

      setExportStartTime(Date.now());

      // Canvas setup
      if (!canvasRef.current) {
        console.log("Creando nuevo canvas...");
        canvasRef.current = document.createElement("canvas");
        ctxRef.current = canvasRef.current.getContext("2d", {
          alpha: false,
          desynchronized: true,
          willReadFrequently: true,
        });
      }

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      // Set dimensions
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
      console.log("Dimensiones del canvas configuradas:", { width, height });

      // Audio setup
      console.log("Configurando contexto de audio...");
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: "playback",
      });
      audioContextRef.current = audioContext;
      console.log("Contexto de audio creado exitosamente");

      // Mejorado el proceso de clonación de video
      console.log("Preparando clonación de video...");
      const clonedVideoElement = document.createElement("video");
      clonedVideoElement.muted = false;
      clonedVideoElement.playsInline = true;
      clonedVideoElement.setAttribute("playsinline", "");
      clonedVideoElement.crossOrigin = "anonymous";

      clonedVideoElement.width = originalVideoElement.width;
      clonedVideoElement.height = originalVideoElement.height;
      clonedVideoElement.currentTime = 0;

      // Mejorado el proceso de carga del video
      console.log("Iniciando carga del video clonado...");
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Timeout esperando carga del video"));
        }, 30000);

        const handleError = (e) => {
          clearTimeout(timeoutId);
          reject(new Error(`Error cargando video: ${e.type}`));
        };

        const handleSuccess = () => {
          clearTimeout(timeoutId);
          resolve();
        };

        const successEvents = ["loadeddata", "canplay", "canplaythrough"];
        successEvents.forEach((event) => {
          clonedVideoElement.addEventListener(
            event,
            () => {
              console.log(`Evento de video detectado: ${event}`);
              if (clonedVideoElement.readyState >= 3) {
                handleSuccess();
              }
            },
            { once: true }
          );
        });

        const errorEvents = ["error", "abort", "stalled"];
        errorEvents.forEach((event) => {
          clonedVideoElement.addEventListener(event, handleError, {
            once: true,
          });
        });

        if (originalVideoElement.src) {
          clonedVideoElement.src = originalVideoElement.src;
        } else if (videoUrl) {
          clonedVideoElement.src = videoUrl;
        } else {
          reject(new Error("No se encontró URL del video"));
        }

        clonedVideoElement.load();
      });

      console.log("Video cargado exitosamente. Estado:", {
        readyState: clonedVideoElement.readyState,
        duration: clonedVideoElement.duration,
        videoWidth: clonedVideoElement.videoWidth,
        videoHeight: clonedVideoElement.videoHeight,
      });

      // Setup audio pipeline
      console.log("Configurando pipeline de audio...");
      const source = audioContext.createMediaElementSource(clonedVideoElement);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);
      console.log("Pipeline de audio configurado");

      // Setup video stream
      console.log("Configurando stream de video...");
      const videoStream = canvas.captureStream(30);
      console.log(
        "Stream de video creado. Tracks:",
        videoStream.getTracks().length
      );

      const combinedStream = new MediaStream([
        ...videoStream.getTracks(),
        ...destination.stream.getTracks(),
      ]);
      combinedStreamRef.current = combinedStream; // Guardar referencia
      console.log(
        "Stream combinado creado. Tracks totales:",
        combinedStream.getTracks().length
      );

      // Verificar MIME types y configurar MediaRecorder con bitrate ajustado
      console.log("Verificando MIME types soportados...");
      const mimeType = getMimeType();
      console.log("MIME type seleccionado:", mimeType);

      // Ajustar bitrate para iOS
      const adjustedBitrate = getIOSBitrate(planDetails);
      console.log("Bitrate ajustado para iOS:", adjustedBitrate);

      const options = {
        mimeType,
        videoBitsPerSecond: adjustedBitrate,
        audioBitsPerSecond: 128000, // Reducido para iOS
      };
      console.log("Configurando MediaRecorder con opciones:", options);

      try {
        mediaRecorderRef.current = new MediaRecorder(combinedStream, options);
        console.log("MediaRecorder creado exitosamente");
      } catch (mrError) {
        console.error("Error creando MediaRecorder:", mrError);
        throw new Error(`No se pudo crear MediaRecorder: ${mrError.message}`);
      }

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        console.log("Chunk de datos recibido:", e.data.size, "bytes");
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onerror = (error) => {
        console.error("Error en MediaRecorder:", error);
      };

      mediaRecorderRef.current.onstart = () => {
        console.log("MediaRecorder iniciado");
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          console.log("MediaRecorder detenido. Procesando chunks...");
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            console.log("Blob creado:", blob.size, "bytes");
            setExportedVideoBlob(blob);
            setShowIOSModal(true);
          }
        } catch (error) {
          console.error("Error procesando chunks:", error);
        } finally {
          cleanup();
          setIsExporting(false);
          isExportingRef.current = false;
          setProgress(100);
          setExportStartTime(null);
        }
      };

      // Función de renderizado
      const render = () => {
        if (!isExportingRef.current) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(clonedVideoElement, 0, 0, canvas.width, canvas.height);

        drawSubtitles(
          ctx,
          canvas,
          clonedVideoElement.currentTime + 0.2,
          phrases,
          subtitleStyles
        );

        requestAnimationFrameRef.current = requestAnimationFrame(render);
      };

      // Iniciar proceso de exportación
      console.log("Iniciando proceso de exportación...");
      setIsExporting(true);
      isExportingRef.current = true;
      setProgress(0);

      if (!mediaRecorderRef.current) {
        throw new Error("MediaRecorder no está inicializado");
      }

      console.log("Iniciando MediaRecorder...");
      mediaRecorderRef.current.start(250);

      console.log("Iniciando reproducción...");
      try {
        await clonedVideoElement.play();
        console.log("Reproducción iniciada exitosamente");
      } catch (playError) {
        console.error("Error al reproducir:", playError);
        throw playError;
      }

      requestAnimationFrameRef.current = requestAnimationFrame(render);
      console.log("Renderizado iniciado");

      // Monitor de progreso
      const progressInterval = setInterval(() => {
        if (!isExportingRef.current) return;
        const currentProgress =
          (clonedVideoElement.currentTime / clonedVideoElement.duration) * 100;
        setProgress(Math.round(currentProgress));

        if (currentProgress >= 100) {
          console.log("Exportación completada");
          clearInterval(progressInterval);
          mediaRecorderRef.current?.stop();
        }
      }, 100);

      return () => {
        clearInterval(progressInterval);
        cleanup();
      };
    } catch (error) {
      console.error("Error en la exportación:", error);
      cleanup(); // Llamar cleanup en caso de error
      setIsExporting(false);
      isExportingRef.current = false;
      setProgress(0);
      setExportStartTime(null);
      alert(`Error en la exportación: ${error.message}`);
    }
  };

  const confirmExport = () => {
    console.log("Confirmando exportación...");
    const planDetails = ExportOptions[selectedPlan];

    if (isIOS()) {
      startExportForIOS(planDetails);
    } else {
      startExport(planDetails); // Mantener la exportación original para otros dispositivos
    }
    setShowExportModal(false);
  };

  return (
    <>
      <button
        onClick={handleExport}
        className="inline-flex items-center justify-center w-fit mx-auto px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-800 transition-colors duration-300 ease-in-out"
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

      {showExportModal && (
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
      )}

      {/* Modal específico para iOS */}
      {showIOSModal && exportedVideoBlob && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 rounded-xl shadow-lg w-full max-w-lg mx-auto my-auto relative">
            {/* Botón de cerrar en la esquina superior */}
            <button
              onClick={() => {
                setShowIOSModal(false);
                setExportedVideoBlob(null);
              }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 z-10"
            >
              ×
            </button>

            <div className="p-4">
              <h3 className="text-lg font-semibold text-white">
                Tu video está listo
              </h3>
              <p className="text-zinc-400 text-sm">
                Previsualiza y guarda tu video
              </p>
            </div>

            {/* Video preview en contenedor con altura máxima */}
            <div className="relative w-full h-[55vh] bg-black overflow-hidden">
              <div className="relative w-full h-full bg-black">
                <video
                  className="w-full h-full object-contain"
                  controls
                  src={URL.createObjectURL(exportedVideoBlob)}
                  playsInline
                  controlsList="nodownload"
                />
              </div>
            </div>

            {/* Botones en una sección fija en la parte inferior */}
            <div className="p-4 space-y-3 bg-zinc-900 rounded-b-xl">
              <button
                onClick={async () => {
                  try {
                    if (navigator.share) {
                      const file = new File(
                        [exportedVideoBlob],
                        "video_exportado.mp4",
                        {
                          type: exportedVideoBlob.type,
                        }
                      );
                      await navigator.share({
                        files: [file],
                        title: "Video exportado",
                      });
                    } else {
                      const url = URL.createObjectURL(exportedVideoBlob);
                      window.location.href = url;
                    }
                  } catch (error) {
                    console.error("Error al compartir:", error);
                    alert("Error al compartir el video. Intenta de nuevo.");
                  }
                }}
                className="w-full bg-pink-600 text-white rounded-lg py-3 font-medium hover:bg-pink-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Guardar Video
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default VideoExport;
