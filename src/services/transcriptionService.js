import axios from "axios";

const LANGUAGE_CODES = {
  es: "Español",
  en: "Inglés",
  fr: "Francés",
  de: "Alemán",
  it: "Italiano",
  pt: "Portugués",
  auto: "Detección Automática",
};

const endsWithPunctuation = (text) => /[.!?]$/.test(text);

export const transcribeAudio = async (file, onProgress, options = {}) => {
  try {
    const API_KEY = import.meta.env.VITE_ASSEMBLY_API_KEY;

    // Configuración de idioma mejorada
    const languageConfig =
      options.languageCode === "auto"
        ? { language_detection: true }
        : {
            language_code: options.languageCode || "es",
          };

    console.log("Starting transcription process...");

    const uploadResponse = await axios.post(
      "https://api.assemblyai.com/v2/upload",
      file instanceof Blob ? file : new Blob([file], { type: file.type }),
      {
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/octet-stream",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const transcriptionResponse = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: uploadResponse.data.upload_url,
        ...languageConfig, // Usar configuración condicional
        punctuate: true,
      },
      {
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const checkCompletionWithRetry = async (
      transcriptId,
      maxRetries = 100,
      onProgress
    ) => {
      let lastProgress = 0;

      for (let i = 0; i < maxRetries; i++) {
        const statusResponse = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: {
              // Cambia ASSEMBLY_API_KEY por API_KEY
              Authorization: API_KEY,
            },
          }
        );
        const transcriptStatus = statusResponse.data.status;
        console.log("Transcription status:", transcriptStatus);

        let currentProgress;
        switch (transcriptStatus) {
          case "queued":
            currentProgress = 25;
            break;
          case "processing":
            currentProgress = 60;
            break;
          case "completed":
            currentProgress = 100;
            break;
          default:
            currentProgress = lastProgress;
        }

        if (currentProgress > lastProgress) {
          lastProgress = currentProgress;
          onProgress(currentProgress);
        }

        if (transcriptStatus === "completed") {
          console.log("Transcription completed successfully");
          return statusResponse.data;
        }
        if (transcriptStatus === "error") {
          throw new Error("Transcription failed: " + statusResponse.data.error);
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      throw new Error("Transcription timed out");
    };

    const transcript = await checkCompletionWithRetry(
      transcriptionResponse.data.id,
      100,
      onProgress
    );

    const words = transcript.words || [];
    let currentPhrase = [];
    let currentWordCount = 0;
    const MAX_WORDS_PER_PHRASE = 7;
    let phrases = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentPhrase.push(word);
      currentWordCount++;

      const isLastWord = i === words.length - 1;
      const hasLongPause = words[i + 1] && words[i + 1].start - word.end > 1000;

      if (
        currentWordCount >= MAX_WORDS_PER_PHRASE ||
        endsWithPunctuation(word.text) ||
        hasLongPause ||
        isLastWord
      ) {
        phrases.push({
          text: currentPhrase.map((w) => w.text).join(" "),
          start: currentPhrase[0].start,
          end: currentPhrase[currentPhrase.length - 1].end,
          words: currentPhrase,
        });

        currentPhrase = [];
        currentWordCount = 0;
      }
    }
    // Agregar información de idioma detectado
    const detectedLanguage = transcript.language_code || "unknown";

    return {
      phrases: phrases.map((phrase) => ({
        ...phrase,
        text: phrase.text.trim(),
      })),
      language: {
        code: detectedLanguage,
        name: LANGUAGE_CODES[detectedLanguage] || "Desconocido",
      },
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};
