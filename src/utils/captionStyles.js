// src/utils/captionStyles.js
export const getCaptionStyle = (style, containerWidth, containerHeight) => {
  const baseStyle = {
    fontFamily: "Arial",
    fill: "#ffffff",
    padding: 20,
    originX: "center",
    originY: "center",
    textAlign: "center",
    selectable: false,
    shadow: new fabric.Shadow({
      color: "rgba(0,0,0,0.5)",
      blur: 5,
      offsetX: 2,
      offsetY: 2,
    }),
  };

  const styles = {
    default: {
      ...baseStyle,
      fontSize: 24,
      left: containerWidth / 2,
      top: containerHeight * 0.9,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    centered: {
      ...baseStyle,
      fontSize: 32,
      left: containerWidth / 2,
      top: containerHeight / 2,
      backgroundColor: "rgba(0,0,0,0.7)",
      fontWeight: "bold",
    },
    large: {
      ...baseStyle,
      fontSize: 48,
      left: containerWidth / 2,
      top: containerHeight / 2,
      backgroundColor: "rgba(0,0,0,0.8)",
      fontWeight: "bold",
      padding: 30,
    },
  };

  return styles[style] || styles.default;
};
