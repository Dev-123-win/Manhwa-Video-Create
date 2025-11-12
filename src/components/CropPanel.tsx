
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { EditedClip, CropRect } from '../types';
import { BackIcon } from './icons';

interface CropPanelProps {
  clips: EditedClip[];
  onClipsChange: (clips: EditedClip[]) => void;
  onBack: () => void;
  onNext: () => void;
}

const CropPanel: React.FC<CropPanelProps> = ({ clips, onClipsChange, onBack, onNext }) => {
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);

  const activeClip = clips[activeClipIndex];
  
  const handleCropChange = (clipIndex: number, newCrops: CropRect[]) => {
    const newClips = [...clips];
    newClips[clipIndex] = { ...newClips[clipIndex], crops: newCrops };
    onClipsChange(newClips);
  };

  const handleNextClip = () => {
    if (activeClipIndex < clips.length - 1) {
      setActiveClipIndex(activeClipIndex + 1);
    }
  };

  const handlePrevClip = () => {
    if (activeClipIndex > 0) {
      setActiveClipIndex(activeClipIndex - 1);
    }
  };

  if (!activeClip) {
    return (
        <div className="text-center">
            <p>No clips to edit. You can proceed to the next step.</p>
            <div className="flex justify-between items-center pt-4">
                <button onClick={onBack} className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors flex items-center gap-2">
                    <BackIcon className="w-5 h-5" /> Back
                </button>
                <button onClick={onNext} className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors">
                    Next: Preview Video
                </button>
            </div>
        </div>
    );
  }

  // Memoize imageUrl to prevent re-renders of the image and CropEditor
  const imageUrl = useMemo(() => `data:${activeClip.mimeType};base64,${activeClip.inpaintedImageBase64}`, [activeClip.mimeType, activeClip.inpaintedImageBase64]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white">Step 4: Adjust AI-Generated Crops</h3>
        <p className="text-sm text-gray-400 mt-1">
          The AI has identified key subjects. Drag and resize the boxes to perfect the framing for each shot. These will be animated side-by-side.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 my-4">
          <button onClick={handlePrevClip} disabled={activeClipIndex === 0} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">Prev</button>
          <span>Clip {activeClipIndex + 1} of {clips.length} (Time: {activeClip.startTime.toFixed(2)}s - {(activeClip.startTime + activeClip.duration).toFixed(2)}s)</span>
          <button onClick={handleNextClip} disabled={activeClipIndex >= clips.length - 1} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">Next</button>
      </div>

      <div className="relative w-full max-w-2xl mx-auto select-none" style={{ aspectRatio: 'auto' }}>
        <img ref={imageRef} src={imageUrl} alt="Panel to crop" className="w-full h-auto rounded-md" />
        {imageRef.current && (
           <CropEditor
              imageEl={imageRef.current}
              crops={activeClip.crops}
              onCropsChange={(newCrops) => handleCropChange(activeClipIndex, newCrops)}
            />
        )}
      </div>

      <div className="flex justify-between items-center pt-4">
        <button onClick={onBack} className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors flex items-center gap-2">
            <BackIcon className="w-5 h-5" /> Back
        </button>
        <button onClick={onNext} className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors">
          Next: Preview Video
        </button>
      </div>
    </div>
  );
};

// --- Interactive Crop Editor Component ---

interface CropEditorProps {
    imageEl: HTMLImageElement;
    crops: CropRect[];
    onCropsChange: (crops: CropRect[]) => void;
}

const CropEditor: React.FC<CropEditorProps> = ({ imageEl, crops, onCropsChange }) => {
    const [draggingInfo, setDraggingInfo] = useState<{ id: string; type: 'move' | 'resize'; startX: number; startY: number; cropStart: CropRect } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, crop: CropRect, type: 'move' | 'resize') => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingInfo({
            id: crop.id,
            type,
            startX: e.clientX,
            startY: e.clientY,
            cropStart: { ...crop }
        });
    };
    
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingInfo || !containerRef.current || !imageEl.naturalWidth) return;

            const { naturalWidth, naturalHeight } = imageEl;
            const { width, height } = containerRef.current.getBoundingClientRect();
            const scaleX = naturalWidth / width;
            const scaleY = naturalHeight / height;

            const dx = (e.clientX - draggingInfo.startX) * scaleX;
            const dy = (e.clientY - draggingInfo.startY) * scaleY;
            const { cropStart } = draggingInfo;

            const newCrops = crops.map(c => {
                if (c.id === draggingInfo.id) {
                    let { x, y, w, h } = cropStart;
                    if (draggingInfo.type === 'move') {
                        x = Math.max(0, Math.min(naturalWidth - w, cropStart.x + dx));
                        y = Math.max(0, Math.min(naturalHeight - h, cropStart.y + dy));
                    } else { // resize
                        w = Math.max(50, Math.min(naturalWidth - x, cropStart.w + dx));
                        h = Math.max(50, Math.min(naturalHeight - y, cropStart.h + dy));
                    }
                    return { ...c, x, y, w, h };
                }
                return c;
            });
            onCropsChange(newCrops);
        };
        
        const handleMouseUp = () => {
            setDraggingInfo(null);
        };

        if (draggingInfo) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

    }, [draggingInfo, crops, onCropsChange, imageEl]);

    if (!imageEl.naturalWidth) return null; // Wait for image to load

    const { naturalWidth, naturalHeight } = imageEl;
    const { width, height } = imageEl.getBoundingClientRect();
    const scaleX = width / naturalWidth;
    const scaleY = height / naturalHeight;

    return (
        <div ref={containerRef} className="absolute inset-0">
            {crops.map(crop => (
                <div
                    key={crop.id}
                    className="absolute border-2 border-purple-500 bg-purple-500/20"
                    style={{
                        transform: `translate(${crop.x * scaleX}px, ${crop.y * scaleY}px)`,
                        width: `${crop.w * scaleX}px`,
                        height: `${crop.h * scaleY}px`,
                        cursor: 'move',
                    }}
                    onMouseDown={(e) => handleMouseDown(e, crop, 'move')}
                >
                    <div
                        className="absolute bottom-[-4px] right-[-4px] w-4 h-4 bg-purple-500 cursor-se-resize border-2 border-white rounded-full"
                        onMouseDown={(e) => handleMouseDown(e, crop, 'resize')}
                    />
                </div>
            ))}
        </div>
    );
};

export default CropPanel;
