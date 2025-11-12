
import React, { useEffect } from 'react';
import { BackIcon } from './icons';

interface ScriptPanelProps {
  script: string;
  setScript: (script: string) => void;
  onGenerate: (language: string) => void;
  onBack: () => void;
  language: string;
  setLanguage: (language: string) => void;
}

const ScriptPanel: React.FC<ScriptPanelProps> = ({ script, setScript, onGenerate, onBack, language, setLanguage }) => {

  useEffect(() => {
    if (!script) {
        onGenerate(language);
    }
  }, [script, onGenerate, language]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white">Generated Script</h3>
        <p className="text-sm text-gray-400 mt-1">
          Review and edit the AI-generated script below. You can also select a different language and regenerate it.
        </p>
      </div>
      <textarea
        value={script}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScript(e.target.value)}
        placeholder="Generating script..."
        className="w-full h-72 p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-gray-200"
      />
      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-4">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <BackIcon className="w-5 h-5" />
          Back
        </button>
        <div className="w-full sm:w-auto flex items-center justify-end gap-4">
           <div>
              <label htmlFor="language" className="sr-only">Script Language</label>
              <select
                id="language"
                value={language}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value)}
                className="p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="English">English</option>
                <option value="Hinglish">Hinglish</option>
                <option value="Hindi">Hindi</option>
                <option value="Spanish">Spanish</option>
                <option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option>
              </select>
            </div>
          <button
            onClick={() => onGenerate(language)}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
          >
            Regenerate Script
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScriptPanel;
