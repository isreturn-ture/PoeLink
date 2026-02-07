import React, { useRef } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
  inputAriaLabel?: string;
  sendAriaLabel?: string;
}

const ChatInput = ({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = '输入消息，Enter 发送',
  inputAriaLabel = '输入消息',
  sendAriaLabel = '发送',
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  return (
    <div className="shrink-0 px-3 py-2.5 sm:px-4 sm:py-3 bg-base-100">
      <div className="flex gap-2 sm:gap-3 items-end">
        <textarea
          ref={textareaRef}
          className="textarea flex-1 resize-none min-h-[40px] max-h-[100px] py-2.5 text-[15px] leading-relaxed rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/30"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          aria-label={inputAriaLabel}
        />
        <button
          type="button"
          className="btn btn-primary btn-circle min-w-[40px] min-h-[40px] w-10 h-10 shrink-0 transition-colors duration-200 hover:opacity-90 disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label={sendAriaLabel}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
