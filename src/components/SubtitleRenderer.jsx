import React, { useEffect } from "react";

export const SubtitleRenderer = ({
  phrase,
  currentTime,
  styles,
  containerWidth,
  containerHeight,
}) => {
  const loadFont = (fontFamily) => {
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
        currentTime >= phrase.start + timePerWord * index &&
        currentTime <= phrase.start + timePerWord * (index + 1),
    }));
  };

  const calculatePosition = () => {
    const padding = Math.round(20 * (containerHeight / 1080));
    const fontSize = styles.fontSize * (containerHeight / 1080);
    const lineHeight = fontSize * 1.2;

    if (styles.customPosition && styles.customPosition.y !== undefined) {
      return styles.customPosition.y * containerHeight;
    }

    return containerHeight - padding - lineHeight / 2;
  };

  const splitIntoLines = (words) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const scaledFontSize = styles.fontSize * (containerHeight / 1080);

    ctx.font = `${styles.fontWeight} ${styles.fontStyle} ${scaledFontSize}px ${
      styles.fontFamily || "system-ui, -apple-system, sans-serif"
    }`;

    const maxWidth = containerWidth * 0.9;
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;

    words.forEach((wordTiming) => {
      const wordWidth = ctx.measureText(wordTiming.word + " ").width;

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
    const padding = Math.round(20 * (containerHeight / 1080));

    return (
      <div
        style={{
          position: "absolute",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          top: `${verticalPosition}px`,
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        {lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            style={{
              backgroundColor: styles.backgroundColor,
              padding: `${Math.round(padding * 0.25)}px ${padding}px`,
              borderRadius: Math.round(4 * (containerHeight / 1080)),
              marginBottom:
                lineIndex < lines.length - 1 ? `${lineHeight * 0.2}px` : 0,
              display: "flex",
              gap: `${scaledFontSize * 0.25}px`,
              alignItems: "center",
              justifyContent: "center",
              maxWidth: `${containerWidth * 0.9}px`,
            }}
          >
            {line.map((wordTiming, index) => (
              <span
                key={index}
                style={{
                  color: wordTiming.isCurrentWord
                    ? styles.highlightColor
                    : styles.color,
                  fontSize: `${scaledFontSize}px`,
                  fontFamily:
                    styles.fontFamily || "system-ui, -apple-system, sans-serif",
                  fontWeight: styles.fontWeight,
                  fontStyle: styles.fontStyle,
                  textAlign: "center",
                  lineHeight: `${lineHeight}px`,
                  position: "relative",
                  textShadow: `
                    -1px -1px 0 #000,
                    1px -1px 0 #000,
                    -1px 1px 0 #000,
                    1px 1px 0 #000,
                    0 2px 2px rgba(0,0,0,0.5)
                  `,
                  filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.5))",
                }}
              >
                {wordTiming.word}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return renderSubtitles();
};

export default SubtitleRenderer;
