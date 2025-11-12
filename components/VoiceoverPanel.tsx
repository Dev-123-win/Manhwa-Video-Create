
import React, { useState } from 'react';
import { VoiceOption } from '../types';
import { BackIcon, MicIcon } from './icons';

interface VoiceoverPanelProps {
  script: string;
  onGenerate: (voice: VoiceOption) => void;
  onBack: () => void;
}

const voiceCategories: { category: string, voices: { name: VoiceOption, description: string }[] }[] = [
    {
        category: 'Female Voices',
        voices: [
            { name: 'Kore', description: 'Clear, Neutral' },
            { name: 'Zephyr', description: 'Calm, Warm' },
        ]
    },
    {
        category: 'Male Voices',
        voices: [
            { name: 'Puck', description: 'Energetic, Bright' },
            { name: 'Charon', description: 'Deep, Resonant' },
            { name: 'Fenrir', description: 'Authoritative, Strong' },
        ]
    }
];

const VoiceoverPanel: React.FC<VoiceoverPanelProps> = ({ script, onGenerate, onBack }) => {
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>('Kore');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white">Generate Voiceover</h3>
        <p className="text-sm text-gray-400 mt-1">
          Choose a voice for your narration. The AI will convert your script into speech.
        </p>
      </div>
      
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
        <p className="text-gray-300 whitespace-pre-wrap">{script}</p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">Select a Voice:</label>
        {voiceCategories.map(({ category, voices }) => (
          <div key={category}>
            <h4 className="text-md font-semibold text-gray-400 mb-3">{category}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {voices.map((voice) => (
                <div
                  key={voice.name}
                  onClick={() => setSelectedVoice(voice.name)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedVoice === voice.name
                      ? 'border-purple-500 bg-purple-900/30 ring-2 ring-purple-500'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <p className="font-semibold text-white">{voice.name}</p>
                  <p className="text-xs text-gray-400">{voice.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <BackIcon className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={() => onGenerate(selectedVoice)}
          disabled={!script}
          className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <MicIcon className="w-5 h-5" />
          Generate Voiceover
        </button>
      </div>
    </div>
  );
};

export default VoiceoverPanel;
