import React from 'react';

export const formatWhatsAppText = (text: string) => {
  if (!text) return '';

  // Bold: *text*
  let formatted = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

  // Italic: _text_
  formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');

  // Strikethrough: ~text~
  formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');

  // Monospace: ```text```
  formatted = formatted.replace(/```(.*?)```/g, '<code style="font-family: monospace; background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 4px;">$1</code>');

  // Newlines
  formatted = formatted.replace(/\n/g, '<br />');

  return formatted;
};

export interface UrlButton {
  text: string;
  url: string;
}

interface WhatsAppPreviewProps {
  text: string;
  caption?: string;
  type?: string;
  file?: File | null;
  backgroundColor?: string;
  footer?: string;
  buttons?: string[];
  urlButtons?: UrlButton[];
}

export const WhatsAppPreview: React.FC<WhatsAppPreviewProps> = ({ text, caption, type, file, backgroundColor, footer, buttons, urlButtons }) => {
  const content = (type === 'text' || type === 'buttons') ? text : caption;
  const hasFile = type !== 'text' && file;
  const isStatusText = type === 'text' && backgroundColor;
  const isButtons = type === 'buttons';
  const hasUrlButtons = urlButtons && urlButtons.length > 0 && urlButtons.some(b => b.text);

  return (
    <div className="bg-[#0b141a] rounded-2xl p-4 max-w-sm border border-slate-700 shadow-2xl">
      <div
        className={`rounded-lg relative shadow-sm ${isStatusText ? 'min-h-[200px] flex flex-col items-center justify-center text-center p-2' : 'bg-[#202c33]'}`}
        style={isStatusText ? { backgroundColor } : {}}
      >
        {hasFile && (
          <div className="mb-0 rounded-t overflow-hidden bg-[#111b21] aspect-video flex items-center justify-center border border-white/5">
            {type === 'image' && file && (
              <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
            )}
            {type === 'video' && <div className="text-slate-500 text-xs">Vista previa de video</div>}
            {type === 'audio' && <div className="text-slate-500 text-xs">Archivo de audio</div>}
            {type === 'document' && <div className="text-slate-500 text-xs">Documento: {file.name}</div>}
          </div>
        )}
        <div className="px-2.5 py-2">
          <div
            className="text-[14.2px] text-[#e9edef] leading-relaxed wrap-break-word whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: formatWhatsAppText(content || '') }}
          />
          {footer && <p className="text-xs text-slate-400/80 mt-1">{footer}</p>}
          <div className="flex justify-end mt-1">
            <span className="text-[11px] text-[#8696a0]">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        </div>
        {/* Quick Reply Buttons */}
        {isButtons && buttons && buttons.length > 0 && (
          <div className="border-t border-white/10">
            {buttons.filter(b => b).map((btn, index) => (
              <div key={index} className="text-center text-blue-400 py-2.5 border-b border-white/10 last:border-b-0">
                {btn}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* URL/Hyperlink Buttons */}
      {hasUrlButtons && (
        <div className="mt-1.5 space-y-1">
          {urlButtons!.filter(b => b.text).map((btn, index) => (
            <div
              key={index}
              className="bg-[#202c33] rounded-lg flex items-center justify-center gap-2 py-2.5 cursor-pointer hover:bg-[#2a3942] transition-colors"
            >
              <span className="text-[14px] text-[#53bdeb] font-medium">{btn.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
