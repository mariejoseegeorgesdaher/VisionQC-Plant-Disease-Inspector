import { useMemo, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { askMoreInfoQuestion, buildMoreInfoScanContext } from "../../lib/moreInfoChat";

function formatAssistantMessage(content) {
  return String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getAssistantErrorMessage(error) {
  const message = error instanceof Error ? error.message : "";

  if (/ollama|llama/i.test(message)) {
    return "The plant assistant is not ready right now. Make sure the local AI service is running, then try again.";
  }

  return message || "Could not ask the plant assistant.";
}

export function MoreInfoChat({ scan, fallback = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const context = useMemo(() => buildMoreInfoScanContext(scan, fallback), [fallback, scan]);

  const sendQuestion = async () => {
    const nextQuestion = question.trim();
    if (!nextQuestion || isSending) return;

    const nextMessages = [...messages, { role: "user", content: nextQuestion }];
    setMessages(nextMessages);
    setQuestion("");
    setError("");

    try {
      setIsSending(true);
      const answer = await askMoreInfoQuestion({
        context,
        question: nextQuestion,
        history: messages.slice(-8),
        chatUrl: scan?.moreInfoChatUrl,
      });
      setMessages([...nextMessages, { role: "assistant", content: answer || "I could not generate an answer." }]);
    } catch (err) {
      setMessages(messages);
      setQuestion(nextQuestion);
      setError(getAssistantErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#d7e7de] bg-[#f8fcf9] p-4">
      <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">Need More Info?</p>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-[#0d4d3d]/15 bg-white px-4 py-2 text-sm text-[#0d4d3d] transition-colors hover:bg-[#f1f8f4]"
      >
        <MessageCircle className="h-4 w-4" />
        <span>{isOpen ? "Close Chat" : "More Info?"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3">
          {messages.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#0d4d3d]/10 bg-white/80 p-3">
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "ml-auto bg-[#0d4d3d] text-white"
                        : "mr-auto border border-[#cfe5da] bg-[#f4fbf7] text-[#0d4d3d]"
                    } max-w-[92%]`}
                  >
                    {message.role === "assistant" ? (
                      <div className="space-y-2">
                        {formatAssistantMessage(message.content).map((line, lineIndex) => {
                          const isHeading = line.endsWith(":");
                          const isBullet = line.startsWith("-");
                          return (
                            <p
                              key={lineIndex}
                              className={
                                isHeading
                                  ? "font-semibold text-[#083b30]"
                                  : isBullet
                                    ? "pl-3 leading-5"
                                    : "leading-5"
                              }
                            >
                              {isBullet ? line.replace(/^-\s*/, "• ") : line}
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendQuestion();
                }
              }}
              placeholder="Ask a follow-up question"
              rows={3}
              className="w-full resize-none rounded-2xl border border-[#0d4d3d]/15 bg-white px-4 py-3 text-sm leading-5 text-[#2a2d35] outline-none focus:border-[#0d4d3d]/40"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void sendQuestion()}
                disabled={!question.trim() || isSending}
                className="inline-flex items-center justify-center text-white transition-colors hover:bg-[#0a6b52] disabled:text-white disabled:opacity-100"
                style={{
                  width: 64,
                  height: 54,
                  minWidth: 64,
                  borderRadius: 16,
                  backgroundColor: "#0d4d3d",
                  padding: 0,
                }}
                aria-label="Send question"
              >
                <Send size={21} strokeWidth={2.2} />
              </button>
            </div>
          </div>
          {isSending && <p className="text-sm text-[#2a2d35]/60">Plant assistant is thinking...</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
