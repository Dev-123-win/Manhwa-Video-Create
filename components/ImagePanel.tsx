// Fix: Implement the ImagePanel component for uploading and managing images.
import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { ManhwaPanel } from '../types';
import { UploadIcon, TrashIcon, EyeIcon } from './icons';

interface ImagePreviewModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) {
    return null;
  }

  // Add keydown listener for escape key
  useEffect(() => {
    // Fix: Use 'any' for the event type to access 'key' property, resolving TS error when 'dom' lib is not included.
    const handleKeyDown = (event: any) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    // Fix: Cast window to 'any' to use addEventListener/removeEventListener, resolving TS error when 'dom' lib is not included.
    (window as any).addEventListener('keydown', handleKeyDown);
    return () => {
      (window as any).removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-title"
    >
      <div 
        className="relative max-w-4xl max-h-[90vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="image-preview-title" className="sr-only">Image Preview</h2>
        <img src={imageUrl} alt="Panel Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
      </div>
       <button 
        onClick={onClose} 
        className="absolute top-4 right-4 text-white text-4xl leading-none font-bold hover:text-gray-300 transition-colors"
        aria-label="Close image preview"
      >
        &times;
      </button>
    </div>
  );
};


interface ImagePanelProps {
  panels: ManhwaPanel[];
  onPanelsChange: (panels: ManhwaPanel[]) => void;
  onNext: () => void;
}

const ImagePanel: React.FC<ImagePanelProps> = ({ panels, onPanelsChange, onNext }) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [viewingPanelUrl, setViewingPanelUrl] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newPanels: ManhwaPanel[] = acceptedFiles.map(file => ({
      // Fix: Cast window to 'any' to access crypto, resolving TS error when 'dom' lib is not included.
      id: (window as any).crypto.randomUUID(),
      file,
      // Fix: Cast window to 'any' to access URL.createObjectURL, resolving TS error when 'dom' lib is not included.
      preview: (window as any).URL.createObjectURL(file),
    }));
    onPanelsChange([...panels, ...newPanels]);
  }, [panels, onPanelsChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.gif', '.bmp', '.webp', '.jpg'] },
  });
  
  const removePanel = (id: string) => {
    const panelToRemove = panels.find(p => p.id === id);
    if(panelToRemove) {
      // Fix: Cast window to 'any' to access URL.revokeObjectURL, resolving TS error when 'dom' lib is not included.
      (window as any).URL.revokeObjectURL(panelToRemove.preview);
    }
    onPanelsChange(panels.filter(p => p.id !== id));
  };
  
  useEffect(() => {
    // Clean up object URLs when component unmounts
    return () => {
        // Fix: Cast window to 'any' to access URL.revokeObjectURL, resolving TS error when 'dom' lib is not included.
        panels.forEach(panel => (window as any).URL.revokeObjectURL(panel.preview));
    }
  }, [panels]);

  // Fix: Use 'any' for event target type to resolve 'Cannot find name HTMLDivElement' error when 'dom' lib is not included.
  const handleDragStart = (e: React.DragEvent<any>, panel: ManhwaPanel) => {
    setDraggedItemId(panel.id);
    // Fix: Cast dataTransfer to 'any' to set 'effectAllowed', resolving TS error for incomplete type definition.
    (e.dataTransfer as any).effectAllowed = 'move';
  };

  // Fix: Use 'any' for event target type to resolve 'Cannot find name HTMLDivElement' error when 'dom' lib is not included.
  const handleDragOver = (e: React.DragEvent<any>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  // Fix: Use 'any' for event target type to resolve 'Cannot find name HTMLDivElement' error when 'dom' lib is not included.
  const handleDropOnPanel = (e: React.DragEvent<any>, targetPanel: ManhwaPanel) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetPanel.id) return;

    const newPanels = [...panels];
    const draggedIndex = newPanels.findIndex(p => p.id === draggedItemId);
    const targetIndex = newPanels.findIndex(p => p.id === targetPanel.id);
    
    // Remove dragged item
    const [draggedItem] = newPanels.splice(draggedIndex, 1);
    // Insert it at the new position
    newPanels.splice(targetIndex, 0, draggedItem);

    onPanelsChange(newPanels);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white">Step 1: Upload Your Manhwa Panels</h3>
        <p className="text-sm text-gray-400 mt-1">
          Drag and drop your image files below, or click to select them. Make sure they are in the correct chronological order. You can drag to reorder them after uploading.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600 hover:border-gray-500'
        }`}
      >
        <input {...getInputProps()} />
        <UploadIcon className="w-12 h-12 mx-auto text-gray-500" />
        <p className="mt-4 text-gray-300">
          {isDragActive ? 'Drop the files here...' : "Drag 'n' drop some files here, or click to select files"}
        </p>
        <p className="text-xs text-gray-500 mt-1">Supported formats: PNG, JPG, GIF, WEBP</p>
      </div>

      {panels.length > 0 && (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <div className="flex overflow-x-auto space-x-4 pb-4">
                {panels.map((panel, index) => (
                    <div
                    key={panel.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, panel)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnPanel(e, panel)}
                    onDragEnd={handleDragEnd}
                    className={`relative group w-36 flex-shrink-0 aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-move transition-opacity ${draggedItemId === panel.id ? 'opacity-50' : 'opacity-100'}`}
                    >
                    <img src={panel.preview} alt={`Panel ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                        <button
                        onClick={() => setViewingPanelUrl(panel.preview)}
                        className="absolute top-2 left-2 p-1.5 bg-gray-800/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700"
                        aria-label="View panel"
                        >
                        <EyeIcon className="w-5 h-5" />
                        </button>
                        <button
                        onClick={() => removePanel(panel.id)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        aria-label="Remove panel"
                        >
                        <TrashIcon className="w-5 h-5" />
                        </button>
                        <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-sm font-bold rounded-md">
                        {index + 1}
                        </span>
                    </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={panels.length === 0}
          className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          Next: Generate Script
        </button>
      </div>
      <ImagePreviewModal imageUrl={viewingPanelUrl} onClose={() => setViewingPanelUrl(null)} />
    </div>
  );
};

export default ImagePanel;