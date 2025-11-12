
import React, { useState, useEffect, useRef } from 'react';
import { EditedClip, VideoSettings, AspectRatioOption } from '../types';
import { DownloadIcon, ReplayIcon, VideoIcon } from './icons';
import { renderVideo } from '../services/videoService';

interface PreviewPanelProps {
  editedClips: EditedClip[];
  audioBlob: Blob | null;
  onReset: () => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ editedClips, audioBlob, onReset }) => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    resolution: '1080p',
    fps: 30,
    aspectRatio: '16:9',
    transition: 'fade',
    animation: 'zoom',
  });

  // Clean up video object URL when component unmounts or videoUrl changes
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);
  
  const handleSettingChange = (setting: keyof VideoSettings, value: string | number) => {
    const finalValue = setting === 'fps' ? Number(value) : value;
    setVideoSettings(prev => ({ ...prev, [setting]: finalValue as any }));
  };

  const handleRenderVideo = async () => {
    if (!audioBlob || editedClips.length === 0) {
      alert('Missing audio or clip information to render the video.');
      return;
    }
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStatus('Starting render process...');
    setVideoUrl(null); // Revokes old URL via useEffect cleanup
    try {
      const videoBlob = await renderVideo(
        editedClips, 
        audioBlob,
        setRenderProgress, 
        setRenderStatus,
        videoSettings
      );
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
    } catch (error) {
      console.error("Error during video rendering:", error);
      alert("Failed to render video. An error occurred. Please check the developer console for more details.");
      setRenderStatus('An error occurred during rendering.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = 'manhwa-video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  const getAspectRatioClass = (aspectRatio: AspectRatioOption) => {
    switch (aspectRatio) {
      case '9:16': return 'aspect-[9/16]';
      case '1:1': return 'aspect-square';
      case '4:3': return 'aspect-[4/3]';
      case '16:9':
      default:
        return 'aspect-video';
    }
  };

  return (
    <div className="space-y-6 flex flex-col items-center">
      <h3 className="text-xl font-semibold text-white">Preview & Export</h3>
      
      <div className={`w-full max-w-2xl ${getAspectRatioClass(videoSettings.aspectRatio)} bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center border border-gray-700 transition-all duration-300`}>
        {videoUrl ? (
          <video ref={videoRef} src={videoUrl} controls className="w-full h-full" />
        ) : isRendering ? (
          <div className="text-center p-4">
            <p className="text-lg text-white mb-4">{renderStatus}</p>
            <div className="w-64 bg-gray-700 rounded-full h-2.5">
              <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${renderProgress}%` }}></div>
            </div>
            <p className="text-sm text-gray-400 mt-2">{renderProgress > 0 ? `${renderProgress}% complete` : 'Please wait...'}</p>
          </div>
        ) : (
          <div className="text-center text-gray-400 p-8">
             <VideoIcon className="w-16 h-16 mx-auto text-gray-500 mb-4" />
             <h4 className="text-lg font-semibold text-white">Your Video Is Ready to Be Rendered</h4>
             <p className="mt-2 text-sm">
               The AI has automatically edited your panels. Adjust the final settings below, then click "Render Video".
             </p>
          </div>
        )}
      </div>

      {!isRendering && !videoUrl && (
        <div className="w-full max-w-2xl mt-4">
          <h4 className="text-lg font-semibold text-white mb-3">Video Settings</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
            <div>
              <label htmlFor="resolution" className="block text-sm font-medium text-gray-300 mb-1">Resolution</label>
              <select
                id="resolution"
                value={videoSettings.resolution}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSettingChange('resolution', e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="1440p">1440p</option>
              </select>
            </div>
            <div>
              <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
              <select
                id="aspectRatio"
                value={videoSettings.aspectRatio}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSettingChange('aspectRatio', e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="9:16">9:16 (Vertical)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="4:3">4:3 (Classic)</option>
              </select>
            </div>
             <div>
              <label htmlFor="transition" className="block text-sm font-medium text-gray-300 mb-1">Transition</label>
              <select
                id="transition"
                value={videoSettings.transition}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSettingChange('transition', e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="cut">Cut (Instant)</option>
                <option value="fade">Fade</option>
                <option value="slideleft">Slide Left</option>
                <option value="slideright">Slide Right</option>
              </select>
            </div>
            <div>
              <label htmlFor="animation" className="block text-sm font-medium text-gray-300 mb-1">Animation Style</label>
              <select
                id="animation"
                value={videoSettings.animation}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSettingChange('animation', e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="zoom">Slow Zoom</option>
                <option value="pan_down">Pan Down</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center items-center gap-4 pt-4">
        {!isRendering && !videoUrl && (
          <button
            onClick={handleRenderVideo}
            disabled={!audioBlob || editedClips.length === 0}
            className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <VideoIcon className="w-5 h-5" />
            Render Video
          </button>
        )}
        
        {videoUrl && (
          <>
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <DownloadIcon className="w-5 h-5" />
              Download MP4
            </button>
             <button
              onClick={onReset}
              className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ReplayIcon className="w-5 h-5" />
              Start Over
            </button>
          </>
        )}
         {isRendering && (
            <p className="text-sm text-gray-400 w-full text-center">Please keep this tab open while the video is rendering. This process happens in your browser.</p>
         )}
      </div>
    </div>
  );
};

export default PreviewPanel;
