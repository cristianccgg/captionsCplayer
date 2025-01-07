import React, { useEffect } from "react";

export const SubtitleRenderer = ({
  phrase,
  currentTime,
  styles,
  containerWidth,
  containerHeight,
}) => {
  // Función para cargar fuentes dinámicamente
  const loadFont = (fontFamily) => {
    // Extrae el nombre de la fuente para las fuentes de Google
    const googleFontName = fontFamily.match(/'([^']*)'/);
    if (googleFontName) {
      const link = document.createElement("link");
      link.href = `https://fonts.googleapis.com/css2?family=${googleFontName[1].replace(
        /\s+/g,
        "+"
      )}:wght@400;700&display=swap`;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  };

  useEffect(() => {
    // Cargar la fuente al montar el componente
    if (styles.fontFamily) {
      loadFont(styles.fontFamily);
    }
  }, [styles.fontFamily]);

  const calculateWordTiming = () => {
    const phraseLength = phrase.end - phrase.start;
    const words = phrase.text.split(" ");
    const timePerWord = phraseLength / words.length;
    return words.map((word, index) => ({
      word,
      start: phrase.start + timePerWord * index,
      end: phrase.start + timePerWord * (index + 1),
      isCurrentWord:
        currentTime * 1000 >= phrase.start + timePerWord * index &&
        currentTime * 1000 <= phrase.start + timePerWord * (index + 1),
    }));
  };

  const calculatePosition = () => {
    const padding = Math.round(20 * (containerHeight / 1080));
    const fontSize = styles.fontSize * (containerHeight / 1080);
    const lineHeight = fontSize * 1.2;

    const defaultPositions = {
      top: padding + lineHeight / 2,
      middle: containerHeight / 2,
      bottom: containerHeight - padding - lineHeight / 2,
    };

    if (styles.customPosition && styles.customPosition.y !== undefined) {
      return styles.customPosition.y * containerHeight;
    }

    return defaultPositions[styles.position || "bottom"];
  };

  // Nueva función para dividir el texto en líneas
  const splitIntoLines = (words) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const scaledFontSize = styles.fontSize * (containerHeight / 1080);

    // Usar la fuente completa, incluyendo familia y variantes
    ctx.font = `${styles.fontWeight} ${styles.fontStyle} ${scaledFontSize}px ${
      styles.fontFamily || "system-ui, -apple-system, sans-serif"
    }`;

    const maxWidth = containerWidth * 0.9;
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;

    words.forEach((wordTiming) => {
      const word = wordTiming.word;
      const wordWidth = ctx.measureText(word + " ").width;

      if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [wordTiming];
        currentWidth = wordWidth;
      } else {
        currentLine.push(wordTiming);
        currentWidth += wordWidth;
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  };

  const renderSubtitles = () => {
    const verticalPosition = calculatePosition();
    const wordTimings = calculateWordTiming();
    const lines = splitIntoLines(wordTimings);
    const scaledFontSize = styles.fontSize * (containerHeight / 1080);
    const lineHeight = scaledFontSize * 1.2;
    const scale = styles.fontSize < 30 ? styles.fontSize / 30 : 1;

    // Preparar estilo de fuente para los subtítulos
    const fontStyle = {
      fontFamily: styles.fontFamily || "system-ui, -apple-system, sans-serif",
      fontWeight: styles.fontWeight,
      fontStyle: styles.fontStyle,
      position: "relative",
    };

    return (
      <div
        style={{
          position: "absolute",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          top: `${verticalPosition}px`,
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            backgroundColor: styles.backgroundColor,
            padding: `${Math.round(
              10 * (containerHeight / 1080)
            )}px ${Math.round(20 * (containerHeight / 1080))}px`,
            borderRadius: Math.round(4 * (containerHeight / 1080)),
            maxWidth: `${containerWidth * 0.9}px`,
            width: "fit-content",
            transform: scale < 1 ? `scale(${scale})` : "none",
            transformOrigin: "center center",
          }}
        >
          {lines.map((line, lineIndex) => (
            <p
              key={lineIndex}
              style={{
                margin: 0,
                marginBottom:
                  lineIndex < lines.length - 1 ? `${lineHeight * 0.2}px` : 0,
                fontSize: `${scaledFontSize}px`,
                ...fontStyle,
                textAlign: styles.textAlign,
                lineHeight: `${lineHeight}px`,
                whiteSpace: "nowrap",
              }}
            >
              {line.map((wordTiming, index) => (
                <span
                  key={index}
                  style={{
                    color: wordTiming.isCurrentWord
                      ? styles.highlightColor
                      : styles.color,
                    transition: "color 0.2s",
                  }}
                >
                  {wordTiming.word}
                  {index < line.length - 1 ? " " : ""}
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>
    );
  };

  return renderSubtitles();
};

export default SubtitleRenderer;
