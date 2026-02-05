import React, { useRef } from 'react';

const ChatInput = ({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  return (
    <div className="shrink-0 p-4 bg-base-100 border-t border-base-300">
      <div className="flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          className="textarea flex-1 resize-none min-h-[44px] max-h-[120px] text-base transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          placeholder="输入消息，Enter 发送"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />
        <button
          type="button"
          className="btn btn-primary btn-circle shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="发送"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
