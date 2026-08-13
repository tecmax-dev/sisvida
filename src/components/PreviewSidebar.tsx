
import React, { useState } from 'react';
import { Eye, Code, Copy, Check } from 'lucide-react';

interface PreviewSidebarProps {
  code?: string;
  preview?: React.ReactNode;
  language?: string;
  title?: string;
}

export const PreviewSidebar: React.FC<PreviewSidebarProps> = ({
  code = '',
  preview,
  language = 'jsx',
  title = 'Preview',
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full gap-4">
      {/* Preview Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">{title}</h3>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white rounded-lg p-6 shadow-sm">
          {preview ? (
            preview
          ) : (
            <div className="text-gray-400 flex items-center justify-center h-full">
              Nenhuma visualização disponível
            </div>
          )}
        </div>
      </div>

      {/* Code Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-800">Código</h3>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            title="Copiar código"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-900 rounded-lg p-4 shadow-sm">
          <pre className="text-sm font-mono text-gray-100 whitespace-pre-wrap break-words">
            <code className={`language-${language}`}>
              {code || '// Nenhum código disponível'}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default PreviewSidebar;
