import axios from "axios";

const ASSEMBLY_API_KEY = "cb727e29922b4d62950a8d695975bcc6";

const endsWithPunctuation = (text) => /[.!?]$/.test(text);

export const transcribeAudio = async (file, onProgress) => {
  try {
    console.log("Starting transcription process...");
    console.log("Uploading file to AssemblyAI...");

    // Ajuste específico para Chrome
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await axios.post(
      "https://api.assemblyai.com/v2/upload",
      file instanceof Blob ? file : new Blob([file], { type: file.type }),
      {
        headers: {
          Authorization: ASSEMBLY_API_KEY,
          "Content-Type": "application/octet-stream",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    if (!uploadResponse.data.upload_url) {
      throw new Error("Upload failed");
    }
    console.log("File uploaded successfully");

    // El resto del código permanece exactamente igual
    console.log("Starting transcription...");
    const transcriptionResponse = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: uploadResponse.data.upload_url,
        language_code: "es",
        punctuate: true,
      },
      {
        headers: {
          Authorization: ASSEMBLY_API_KEY,
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
            headers: { Authorization: ASSEMBLY_API_KEY },
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

    return {
      phrases: phrases.map((phrase) => ({
        ...phrase,
        text: phrase.text.trim(),
      })),
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};
