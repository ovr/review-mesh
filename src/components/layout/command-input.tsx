import React, { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { ClaudeEffortLevel } from "../../agents/claude-agent";

type CommandMode = "idle" | "input" | "select-provider" | "effort";

const PROVIDERS = [
  { name: "Claude", description: "Claude AI agent", value: "claude" },
];

const EFFORT_LEVELS: ClaudeEffortLevel[] = ["low", "medium", "high"];

interface CommandInputProps {
  claudeEffort: ClaudeEffortLevel;
  onEffortChange: (provider: string, effort: ClaudeEffortLevel) => void;
  onFocusChange: (focused: boolean) => void;
}

export function CommandInput({ claudeEffort, onEffortChange, onFocusChange }: CommandInputProps) {
  const [mode, setMode] = useState<CommandMode>("idle");
  const [inputValue, setInputValue] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [pendingEffort, setPendingEffort] = useState<ClaudeEffortLevel>(claudeEffort);

  const resetToIdle = useCallback(() => {
    setMode("idle");
    setInputValue("");
    setSelectedProvider(null);
    onFocusChange(false);
  }, [onFocusChange]);

  const handleSubmit = useCallback((value: string | { value?: string }) => {
    const text = typeof value === "string" ? value : (value.value ?? "");
    const trimmed = text.trim();
    if (trimmed === "effort" || trimmed === "/effort") {
      setMode("select-provider");
      setInputValue("");
      return;
    }
    resetToIdle();
  }, [resetToIdle]);

  const handleProviderSelect = useCallback((_index: number, option: { value?: any } | null) => {
    if (option?.value) {
      setSelectedProvider(option.value);
      setPendingEffort(claudeEffort);
      setMode("effort");
    }
  }, [claudeEffort]);

  useKeyboard((key) => {
    if (mode === "idle" && key.raw === "/") {
      setMode("input");
      setInputValue("");
      onFocusChange(true);
    }
    if (mode === "effort") {
      const idx = EFFORT_LEVELS.indexOf(pendingEffort);
      if (key.name === "left" && idx > 0) {
        setPendingEffort(EFFORT_LEVELS[idx - 1]);
      }
      if (key.name === "right" && idx < EFFORT_LEVELS.length - 1) {
        setPendingEffort(EFFORT_LEVELS[idx + 1]);
      }
      if (key.name === "return") {
        onEffortChange(selectedProvider!, pendingEffort);
        resetToIdle();
      }
    }
    if (mode !== "idle" && key.name === "escape") {
      resetToIdle();
    }
  });

  if (mode === "input") {
    return (
      <box flexDirection="row" width="100%" height={1} flexShrink={0} paddingX={1}>
        <text fg="#7C3AED">/</text>
        <input
          focused
          value={inputValue}
          flexGrow={1}
          placeholder="effort"
          onInput={setInputValue}
          onSubmit={handleSubmit}
        />
      </box>
    );
  }

  if (mode === "select-provider") {
    return (
      <box flexDirection="column" width="100%" flexShrink={0}>
        <text fg="#7C3AED" attributes={1}> Select provider:</text>
        <select
          focused
          options={PROVIDERS}
          width="100%"
          height={PROVIDERS.length + 1}
          textColor="#E5E7EB"
          focusedBackgroundColor="#374151"
          focusedTextColor="#FFFFFF"
          selectedBackgroundColor="#7C3AED"
          selectedTextColor="#FFFFFF"
          showDescription
          descriptionColor="#9CA3AF"
          onSelect={handleProviderSelect}
        />
        <text fg="#6B7280"> Esc:cancel</text>
      </box>
    );
  }

  if (mode === "effort") {
    return (
      <box flexDirection="row" width="100%" height={1} flexShrink={0} paddingX={1}>
        <text fg="#7C3AED" attributes={1}>{selectedProvider} effort: </text>
        {EFFORT_LEVELS.map((level) => {
          const active = level === pendingEffort;
          return (
            <text
              key={level}
              fg={active ? "#FFFFFF" : "#6B7280"}
              bg={active ? "#7C3AED" : undefined}
              attributes={active ? 1 : 0}
            >
              {` ${level} `}
            </text>
          );
        })}
        <text fg="#6B7280">  ←→:select  Enter:confirm  Esc:cancel</text>
      </box>
    );
  }

  // idle
  return (
    <box width="100%" height={1} flexShrink={0} paddingX={1}>
      <text fg="#6B7280">/:command  effort:{claudeEffort}</text>
    </box>
  );
}
