import React, { useState, useRef } from "react";
import { Save } from "lucide-react";

export function VideoExport({
  videoUrl,
  phrases,
  subtitleStyles,
  videoRef: mainVideoRef,
}) {
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

    return words.map((word, index) => ({
      word,
      start: phrase.start + timePerWord * index,
      end: phrase.start + timePerWord * (index + 1),
      isCurrentWord:
        currentTime >= phrase.start + timePerWord * index &&
        currentTime <= phrase.start + timePerWord * (index + 1),
    }));
  };

  const drawSubtitles = (ctx, canvas, currentTime, phrases, subtitleStyles) => {
    const currentTimeMs = currentTime * 1000;
    const currentPhrases = phrases.filter(
      (phrase) => currentTimeMs >= phrase.start && currentTimeMs <= phrase.end
    );

    currentPhrases.forEach((phrase) => {
      // Obtener estilos para esta frase específica
      const phraseStyles =
        subtitleStyles.phraseStyles[phrase.id] || subtitleStyles.default;

      // Calcular tamaño de fuente escalado
      const fontSize = Math.round(
        phraseStyles.fontSize * (canvas.height / 1080)
      );
      const fontWeight = phraseStyles.fontWeight;
      const fontStyle = phraseStyles.fontStyle;

      // Configurar fuente
      // En la función drawSubtitles
      ctx.font = `${phraseStyles.fontWeight} ${
        phraseStyles.fontStyle
      } ${fontSize}px ${phraseStyles.fontFamily || "system-ui, sans-serif"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Calcular posición vertical
      let verticalPosition;
      const padding = Math.round(20 * (canvas.height / 1080));
      const lineHeight = fontSize * 1.2;

      // Manejar posición personalizada
      if (
        phraseStyles.customPosition &&
        phraseStyles.customPosition.y !== undefined
      ) {
        verticalPosition = phraseStyles.customPosition.y * canvas.height;
      } else {
        // Posiciones predeterminadas
        switch (phraseStyles.position) {
          case "top":
            verticalPosition = padding + lineHeight / 2;
            break;
          case "middle":
            verticalPosition = canvas.height / 2;
            break;
          case "bottom":
          default:
            verticalPosition = canvas.height - padding - lineHeight / 2;
        }
      }

      // Calcular dimensiones del texto
      const wordTimings = calculateWordTiming(phrase, currentTimeMs);

      // Preparar para dibujar texto multilínea si es necesario
      const maxWidth = canvas.width * 0.9;
      const words = wordTimings.map((wt) => wt.word);

      // Dividir palabras en líneas
      const lines = [];
      let currentLine = [];
      let currentLineWidth = 0;

      words.forEach((word) => {
        const wordWidth = ctx.measureText(word + " ").width;

        if (currentLineWidth + wordWidth > maxWidth) {
          // Comenzar nueva línea
          lines.push(currentLine);
          currentLine = [word];
          currentLineWidth = ctx.measureText(word + " ").width;
        } else {
          currentLine.push(word);
          currentLineWidth += wordWidth;
        }
      });

      // Añadir última línea
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }

      // Dibujar fondo para todas las líneas
      if (phraseStyles.backgroundColor !== "transparent") {
        ctx.fillStyle = phraseStyles.backgroundColor;

        lines.forEach((line, lineIndex) => {
          const lineText = line.join(" ");
          const lineWidth = ctx.measureText(lineText).width;
          const lineHeight = fontSize * 1.2;

          // Calcular posición de cada línea
          const lineVerticalPosition =
            verticalPosition +
            (lineIndex - (lines.length - 1) / 2) * lineHeight;

          const x = (canvas.width - lineWidth) / 2 - padding / 2;
          const y = lineVerticalPosition - lineHeight / 2;
          const width = lineWidth + padding;
          const height = lineHeight + padding / 2;

          // Dibujar fondo con bordes redondeados
          const radius = Math.round(4 * (canvas.height / 1080));
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, radius);
          ctx.fill();
        });
      }

      // Dibujar texto con palabras resaltadas
      lines.forEach((line, lineIndex) => {
        const lineText = line.join(" ");
        const lineWidth = ctx.measureText(lineText).width;

        // Calcular posición de cada línea
        const lineVerticalPosition =
          verticalPosition +
          (lineIndex - (lines.length - 1) / 2) * (fontSize * 1.2);

        let xOffset = (canvas.width - lineWidth) / 2;

        line.forEach((word, wordIndex) => {
          const wordTiming = wordTimings.find((wt) => wt.word === word);

          // Color de la palabra
          ctx.fillStyle = wordTiming.isCurrentWord
            ? phraseStyles.highlightColor
            : phraseStyles.color;

          // Dibujar palabra
          const wordMetrics = ctx.measureText(word + " ");
          ctx.fillText(
            word,
            xOffset + wordMetrics.width / 2,
            lineVerticalPosition
          );

          xOffset += wordMetrics.width;
        });
      });

      // Dibujar borde de texto si está activado
      if (phraseStyles.textStroke) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = Math.round(3 * (canvas.height / 1080));

        lines.forEach((line, lineIndex) => {
          const lineText = line.join(" ");
          const lineVerticalPosition =
            verticalPosition +
            (lineIndex - (lines.length - 1) / 2) * (fontSize * 1.2);

          ctx.strokeText(lineText, canvas.width / 2, lineVerticalPosition);
        });
      }
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

    return "";
  };

  const startExport = async () => {
    if (!videoUrl || !mainVideoRef.current) return;

    try {
      const originalVideoElement = mainVideoRef.current;

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        ctxRef.current = canvasRef.current.getContext("2d");
      }

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      canvas.width = originalVideoElement.videoWidth;
      canvas.height = originalVideoElement.videoHeight;

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const clonedVideoElement = originalVideoElement.cloneNode(true);
      clonedVideoElement.currentTime = 0;

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
        videoBitsPerSecond: 8000000, // 8 Mbps for better quality
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

          // Convert to MP4 if necessary using MediaRecorder's native output
          const finalBlob = mimeType.includes("mp4")
            ? blob
            : await convertToMp4(blob);

          const url = URL.createObjectURL(finalBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "video_with_subtitles.mp4";
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

      mediaRecorderRef.current.start(1000); // Capture chunks every second
      setIsExporting(true);
      isExportingRef.current = true;
      setProgress(0);

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

  // Helper function to convert WebM to MP4 if necessary
  const convertToMp4 = async (blob) => {
    // If the browser supports MP4 recording directly, return the blob as is
    if (blob.type.includes("mp4")) {
      return blob;
    }

    // Otherwise, we need to use MediaRecorder again to convert the format
    const video = document.createElement("video");
    video.src = URL.createObjectURL(blob);
    await video.play();

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    const stream = canvas.captureStream();
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/mp4",
    });

    const chunks = [];
    return new Promise((resolve) => {
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () =>
        resolve(new Blob(chunks, { type: "video/mp4" }));

      const drawFrame = () => {
        if (video.ended) {
          mediaRecorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0);
        requestAnimationFrame(drawFrame);
      };

      mediaRecorder.start();
      drawFrame();
    });
  };

  React.useEffect(() => {
    return () => {
      isExportingRef.current = false;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <button
      onClick={startExport}
      disabled={isExporting}
      className="inline-flex items-center justify-center w-full mx-auto px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-black disabled:opacity-50"
    >
      <Save className="w-4 h-4 mr-2" />
      <span className="text-center font-bold">
        {isExporting ? `Exporting ${progress}%` : "Export Video"}
      </span>
    </button>
  );
}

export default VideoExport;
