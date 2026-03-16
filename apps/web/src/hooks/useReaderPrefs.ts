import * as React from "react";

const DEFAULT_HIGHLIGHT = "#fbbf24";
const DEFAULT_VOICE = "af_heart";

export function useReaderPrefs() {
  const [autoAdvance, setAutoAdvanceState] = React.useState(
    () => typeof localStorage !== "undefined" ? localStorage.getItem("pref:autoAdvance") !== "false" : true,
  );

  const [highlightColor, setHighlightColorState] = React.useState(
    () => typeof localStorage !== "undefined" ? (localStorage.getItem("pref:highlightColor") ?? DEFAULT_HIGHLIGHT) : DEFAULT_HIGHLIGHT,
  );

  const [voice, setVoiceState] = React.useState(
    () => typeof localStorage !== "undefined" ? (localStorage.getItem("pref:voice") ?? DEFAULT_VOICE) : DEFAULT_VOICE,
  );

  React.useEffect(() => {
    document.documentElement.style.setProperty("--highlight-color", highlightColor);
  }, [highlightColor]);

  const setAutoAdvance = (v: boolean) => {
    localStorage.setItem("pref:autoAdvance", String(v));
    setAutoAdvanceState(v);
  };

  const setHighlightColor = (v: string) => {
    localStorage.setItem("pref:highlightColor", v);
    setHighlightColorState(v);
  };

  const setVoice = (v: string) => {
    localStorage.setItem("pref:voice", v);
    setVoiceState(v);
  };

  return { autoAdvance, setAutoAdvance, highlightColor, setHighlightColor, voice, setVoice };
}
