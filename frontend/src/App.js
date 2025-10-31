import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import Navbar from "./Navbar";
import { translateText } from "./services/api";

function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState([]);
  const [interim, setInterim] = useState("");
  const [signVideos, setSignVideos] = useState([]); // array of video URLs
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const isMountedRef = useRef(false);
  const videoRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported — please use Chrome.");
      return;
    }

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = async (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          setTranscriptLines((prev) => [...prev, text.trim()]);
          await handleTranslation(text.trim());
        } else {
          interimText += text;
        }
      }
      setInterim(interimText.trim());
    };

    recog.onerror = (e) => {
      console.error("SpeechRecognition error:", e);
    };

    recog.onend = () => {
      if (isMountedRef.current && isListening) {
        setTimeout(() => {
          try {
            recog.start();
          } catch (e) {}
        }, 200);
      }
    };

    recognitionRef.current = recog;

    return () => {
      isMountedRef.current = false;
      try {
        recog.onend = null;
        recog.stop();
      } catch (e) {}
      recognitionRef.current = null;
    };
  }, []); // eslint-disable-line

  const startListening = () => {
    const recog = recognitionRef.current;
    if (!recog) {
      alert("SpeechRecognition not available in this browser.");
      return;
    }
    try {
      recog.start();
      setIsListening(true);
    } catch (err) {
      console.warn("start error:", err);
      setIsListening(true);
    }
  };

  const stopListening = () => {
    const recog = recognitionRef.current;
    if (recog) {
      const originalOnEnd = recog.onend;
      recog.onend = null;
      try {
        recog.stop();
      } catch (e) {}
      recog.onend = originalOnEnd;
    }
    setIsListening(false);
    setInterim("");
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const clearTranscript = () => {
    setTranscriptLines([]);
    setInterim("");
    setSignVideos([]);
    setCurrentVideoIndex(0);
  };

  const handleTranslation = async (text) => {
    try {
      setError(null);
      const response = await translateText(text);

      // Flask returns an object with "results"
      if (response.results) {
        const paths = response.results.map((r) => fixVideoPath(r.path));
        console.log("🎬 Video paths received:", paths);
        setSignVideos(paths);
        setCurrentVideoIndex(0);
      } else if (response.partial_results) {
        const paths = response.partial_results.map((r) => fixVideoPath(r.path));
        setSignVideos(paths);
        setCurrentVideoIndex(0);
        setError("Some words could not be matched.");
      } else {
        setError("No valid results returned.");
        setSignVideos([]);
      }
    } catch (error) {
      setError(error.message);
      console.error("Translation failed:", error);
    }
  };

  // ✅ Fix video path to load from /static/words/
  const fixVideoPath = (path) => {
    let cleanPath = path.replace(/^\/?frontend\/public\//, "");
    if (!cleanPath.startsWith("static/")) {
      cleanPath = "static/" + cleanPath.replace(/^\/?/, "");
    }
    return cleanPath;
  };

  const handleVideoEnd = () => {
    setCurrentVideoIndex((prevIndex) =>
      prevIndex + 1 < signVideos.length ? prevIndex + 1 : prevIndex
    );
  };

  useEffect(() => {
    if (signVideos.length > 0 && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch((e) => {
        console.warn("Autoplay blocked by browser:", e);
      });
    }
  }, [currentVideoIndex, signVideos]);

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="layout">
          {/* Left preview card */}
          <div className="card preview-card">
            <h1 className="title">Speech to Sign</h1>
            <div className="preview-image-wrap">
              {error ? (
                <div className="error-message">{error}</div>
              ) : signVideos && signVideos.length > 0 ? (
                <video
                  key={currentVideoIndex}
                  ref={videoRef}
                  src={signVideos[currentVideoIndex]}
                  autoPlay
                  muted
                  playsInline
                  onEnded={handleVideoEnd}
                  style={{
                    maxWidth: "100%",
                    borderRadius: 10,
                    outline: "none",
                  }}
                />
              ) : (
                <img
                  className="preview-image"
                  src="https://images.unsplash.com/photo-1581093588401-22dca9f0c3da?auto=format&fit=crop&w=1200&q=80"
                  alt="Sign language"
                />
              )}
            </div>
          </div>

          {/* Right column: transcript + mic */}
          <div className="right-col">
            <div className="card transcript-card">
              <h2 className="card-heading">Live Transcript</h2>

              <div className="transcript-list" role="log" aria-live="polite">
                {transcriptLines.length === 0 && !interim ? (
                  <div className="placeholder">Speak to see the translation</div>
                ) : null}

                {transcriptLines.map((line, idx) => (
                  <div className="transcript-line" key={idx}>
                    {line}
                  </div>
                ))}

                {interim ? (
                  <div className="transcript-interim">{interim}</div>
                ) : (
                  isListening && (
                    <div className="listening-note">listening...</div>
                  )
                )}
              </div>
            </div>

            <div className="card mic-card">
              <div className="mic-center">
                <button
                  className={`mic-button ${isListening ? "listening" : ""}`}
                  onClick={toggleListening}
                  aria-pressed={isListening}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 120 120"
                    className="mic-svg"
                    aria-hidden
                  >
                    <defs>
                      <radialGradient id="g" cx="50%" cy="40%">
                        <stop offset="0" stopColor="#ffd36b" />
                        <stop offset="0.35" stopColor="#ff7bb0" />
                        <stop offset="0.65" stopColor="#6ea4ff" />
                        <stop offset="1" stopColor="#6df3c1" />
                      </radialGradient>
                    </defs>
                    <circle cx="60" cy="60" r="56" fill="url(#g)" />
                    <g transform="translate(30,30)" fill="#111">
                      <path d="M30 2c-5.5 0-10 4.5-10 10v20c0 5.5 4.5 10 10 10s10-4.5 10-10V12c0-5.5-4.5-10-10-10z" />
                      <rect x="22" y="36" width="16" height="4" rx="2" />
                      <path d="M10 46a2 2 0 0 1 2-2h36a2 2 0 1 1 0 4H12a2 2 0 0 1-2-2z" />
                    </g>
                  </svg>
                </button>
              </div>

              <div className="mic-actions">
                <button className="clear-btn" onClick={clearTranscript}>
                  Clear
                </button>
                <div className="status-text">
                  {isListening ? "Listening — speak now" : "Click mic to start"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
