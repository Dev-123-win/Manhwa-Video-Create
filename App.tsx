import React, { useState, useCallback } from 'react';
import { ManhwaPanel, VoiceOption, PanelTiming } from './types';
import { generateScript, generateVoiceover, generateTimings } from './services/geminiService';
import Stepper from './components/Stepper';
import ImagePanel from './components/ImagePanel';
import ScriptPanel from './components/ScriptPanel';
import VoiceoverPanel from './components/VoiceoverPanel';
import PreviewPanel from './components/PreviewPanel';
import Spinner from './components/Spinner';

const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [panels, setPanels] = useState<ManhwaPanel[]>([]);
  const [script, setScript] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [panelTimings, setPanelTimings] = useState<PanelTiming[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');

  const handlePanelsChange = (newPanels: ManhwaPanel[]) => {
    setPanels(newPanels);
    // When panels change, invalidate the generated script and subsequent steps
    // to ensure data consistency.
    setScript('');
    setAudioUrl(null);
    setAudioBlob(null);
    setPanelTimings([]);
  };
  
  const handleNextToScript = () => {
    if (panels.length > 0) {
      setStep(2);
    } else {
      // Fix: Cast window to 'any' to access alert, resolving TS error when 'dom' lib is not included.
      (window as any).alert("Please upload at least one image panel.");
    }
  };

  const handleGenerateScript = useCallback(async (selectedLanguage: string) => {
    if (panels.length === 0) return;
    setIsLoading(true);
    setLoadingMessage('Initializing script generation...');
    try {
      const generatedScript = await generateScript(panels, (message) => {
        setLoadingMessage(message);
      }, selectedLanguage);
      setScript(generatedScript);
      setStep(3);
    } catch (error) {
      console.error("Error generating script:", error);
      // Fix: Cast window to 'any' to access alert, resolving TS error when 'dom' lib is not included.
      (window as any).alert("Failed to generate script. Please check the console for details.");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [panels]);

  const handleGenerateVoiceover = useCallback(async (voice: VoiceOption) => {
    if (!script) return;
    setIsLoading(true);
    setLoadingMessage('Generating voiceover... This may take a moment.');
    try {
      const { audioBlob: blob, audioUrl: url } = await generateVoiceover(script, voice);
      setAudioUrl(url);
      setAudioBlob(blob);

      // New step: Generate timings after getting the audio duration
      setLoadingMessage('Synchronizing audio and images...');
      // Fix: Cast window to 'any' to construct an Audio object, resolving TS error when 'dom' lib is not included.
      const audio = new (window as any).Audio(url);
      audio.onloadedmetadata = async () => {
        try {
          const duration = audio.duration;
          const timings = await generateTimings(script, panels.length, duration);
          setPanelTimings(timings);
          setStep(4);
        } catch (timingError) {
            console.error("Error generating timings:", timingError);
            // Fix: Cast window to 'any' to access alert, resolving TS error when 'dom' lib is not included.
            (window as any).alert("Failed to generate timings. Please check the console for details.");
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
      };
      audio.onerror = () => {
        setIsLoading(false);
        // Fix: Cast window to 'any' to access alert, resolving TS error when 'dom' lib is not included.
        (window as any).alert("Could not load audio metadata to generate timings.");
      }

    } catch (error) {
      console.error("Error generating voiceover:", error);
      // Fix: Cast window to 'any' to access alert, resolving TS error when 'dom' lib is not included.
      (window as any).alert("Failed to generate voiceover. Please check the console for details.");
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [script, panels.length]);
  
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  const handleReset = () => {
    setStep(1);
    setPanels([]);
    setScript('');
    setAudioUrl(null);
    setAudioBlob(null);
    setPanelTimings([]);
  };
  
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return <ImagePanel panels={panels} onPanelsChange={handlePanelsChange} onNext={handleNextToScript} />;
      case 2:
        return <ScriptPanel script={script} setScript={setScript} onGenerate={handleGenerateScript} onBack={handleBack} language={language} setLanguage={setLanguage} />;
      case 3:
        return <VoiceoverPanel script={script} onGenerate={handleGenerateVoiceover} onBack={handleBack} />;
      case 4:
        return <PreviewPanel panels={panels} audioUrl={audioUrl} audioBlob={audioBlob} panelTimings={panelTimings} onReset={handleReset} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {isLoading && <Spinner message={loadingMessage} />}
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Manhwa Video Creator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Turn your favorite manhwa panels into stunning explanation videos with AI.
          </p>
        </header>

        <main className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-purple-500/10 p-6 sm:p-8 border border-gray-700">
          <Stepper currentStep={step} />
          <div className="mt-8">
            {renderStepContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;