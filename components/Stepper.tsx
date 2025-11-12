
import React from 'react';
import { UploadIcon, ScriptIcon, MicIcon, PlayIcon } from './icons';

interface StepperProps {
  currentStep: number;
}

const steps = [
  { id: 1, name: 'Upload Panels', icon: UploadIcon },
  { id: 2, name: 'Generate Script', icon: ScriptIcon },
  { id: 3, name: 'Create Voiceover', icon: MicIcon },
  { id: 4, name: 'Preview & Export', icon: PlayIcon },
];

const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} flex-1`}>
            {step.id < currentStep ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-purple-600" />
                </div>
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 hover:bg-purple-700">
                  <step.icon className="h-5 w-5 text-white" />
                </div>
              </>
            ) : step.id === currentStep ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-600" />
                </div>
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-purple-600 bg-gray-800">
                  <step.icon className="h-5 w-5 text-purple-500" />
                </div>
                <span className="absolute top-10 w-max text-center text-xs text-purple-400 sm:text-sm">{step.name}</span>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-600" />
                </div>
                <div className="group relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-600 bg-gray-800 hover:border-gray-400">
                   <step.icon className="h-5 w-5 text-gray-500 group-hover:text-gray-300" />
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Stepper;
