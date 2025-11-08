
import React from 'react';

export const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  />
);

export const MicrophoneIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Icon {...props}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </Icon>
);

export const StopIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Icon {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
  </Icon>
);

export const BrainCircuitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Icon {...props}>
    <path d="M12 5a3 3 0 1 0-5.993.296" />
    <path d="M12 5a3 3 0 1 0 5.993.296" />
    <path d="M15 13a3 3 0 1 0-5.993.296" />
    <path d="M15 13a3 3 0 1 0 5.993.296" />
    <path d="M9 13a3 3 0 1 0-5.993.296" />
    <path d="M9 13a3 3 0 1 0 5.993.296" />
    <path d="M6 8.27V5" />
    <path d="M18 8.27V5" />
    <path d="m10.64 15.35 2.72 2.72" />
    <path d="m13.36 15.35-2.72 2.72" />
    <path d="M12 22v-3" />
  </Icon>
);

export const ActivityIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Icon>
);

export const BotIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}>
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </Icon>
);

export const FileTextIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
    </Icon>
);

export const RefreshCwIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
    </Icon>
);

