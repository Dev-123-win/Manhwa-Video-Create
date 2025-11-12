import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { ManhwaPanel, PanelTiming, VideoSettings, TransitionOption } from '../types';

const FFMPEG_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

let ffmpeg: FFmpeg | null = null;

const getDimensions = (
  resolution: VideoSettings['resolution'], 
  aspectRatio: VideoSettings['aspectRatio']
): { width: number; height: number } => {
    const dimensions = {
        '16:9': { '720p': {width: 1280, height: 720}, '1080p': {width: 1920, height: 1080}, '1440p': {width: 2560, height: 1440} },
        '9:16': { '720p': {width: 720, height: 1280}, '1080p': {width: 1080, height: 1920}, '1440p': {width: 1440, height: 2560} },
        '1:1': { '720p': {width: 720, height: 720}, '1080p': {width: 1080, height: 1080}, '1440p': {width: 1440, height: 1440} },
        '4:3': { '720p': {width: 960, height: 720}, '1080p': {width: 1440, height: 1080}, '1440p': {width: 1920, height: 1440} },
    };
    // @ts-ignore - Indexing with union types can be tricky for TS, but this is safe.
    return dimensions[aspectRatio]?.[resolution] || { width: 1920, height: 1080 };
};

const getXfadeTransitionName = (transition: TransitionOption): string => {
    const mapping: Record<TransitionOption, string> = {
        cut: 'custom', // This is handled by a different logic path
        fade: 'fade',
        slideleft: 'slideleft',
        slideright: 'slideright',
        wipeleft: 'wipeleft',
        wipedown: 'wipedown',
    };
    return mapping[transition] || 'fade';
};

async function loadFFmpeg(onLogMessage: (message: string) => void, onProgress: (progress: number) => void): Promise<FFmpeg> {
    if (ffmpeg && ffmpeg.loaded) {
        return ffmpeg;
    }
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      console.log(`[FFMPEG]: ${message}`);
    });
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });
    onLogMessage('Loading FFmpeg core. This may take a minute...');
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
}

const renderWithConcat = async (
    ffmpeg: FFmpeg,
    panels: ManhwaPanel[],
    audioBlob: Blob,
    audioDuration: number,
    panelTimings: PanelTiming[],
    settings: VideoSettings,
    onLogMessage: (message: string) => void
) => {
    await ffmpeg.writeFile('audio.wav', await fetchFile(audioBlob));

    const panelFileNames = new Map<string, string>();
    for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const fileName = `img${String(i).padStart(3, '0')}.png`; // Use a consistent extension
        await ffmpeg.writeFile(fileName, await fetchFile(panel.file));
        panelFileNames.set(panel.id, fileName);
    }
    
    onLogMessage('Generating video timeline...');
    let concatFileContent = 'ffconcat version 1.0\n';
    if (panelTimings.length > 0) {
        for (let i = 0; i < panelTimings.length; i++) {
            const timing = panelTimings[i];
            const panelIndex = timing.panel - 1;
            if (panelIndex < 0 || panelIndex >= panels.length) continue;

            const panel = panels[panelIndex];
            const fileName = panelFileNames.get(panel.id);
            if (!fileName) continue;

            const nextStartTime = (i + 1 < panelTimings.length) ? panelTimings[i+1].startTime : audioDuration;
            const duration = nextStartTime - timing.startTime;

            if (duration > 0.01) {
                concatFileContent += `file ${fileName}\n`;
                concatFileContent += `duration ${duration.toFixed(4)}\n`;
            }
        }
    }

    await ffmpeg.writeFile('concat.txt', concatFileContent);

    const { width, height } = getDimensions(settings.resolution, settings.aspectRatio);
    const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`;

    const command = [
        '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
        '-i', 'audio.wav',
        '-vf', videoFilter,
        '-r', `${settings.fps}`,
        '-c:v', 'libx264', '-c:a', 'aac', '-shortest',
        'output.mp4'
    ];

    onLogMessage('Rendering video... (This is the longest step)');
    await ffmpeg.exec(command);
};

const renderWithTransitions = async (
    ffmpeg: FFmpeg,
    panels: ManhwaPanel[],
    audioBlob: Blob,
    audioDuration: number,
    panelTimings: PanelTiming[],
    settings: VideoSettings,
    onLogMessage: (message: string) => void
) => {
    const transitionDuration = 0.7; // seconds
    
    // 1. Prepare timeline and unique inputs
    const timelineItems = panelTimings.map((timing, i) => {
        const nextStartTime = (i + 1 < panelTimings.length) ? panelTimings[i+1].startTime : audioDuration;
        return {
            panel: panels[timing.panel - 1],
            duration: nextStartTime - timing.startTime,
        };
    }).filter(item => item.duration > 0.01);

    const uniquePanels = Array.from(new Map(timelineItems.map(item => [item.panel.id, item.panel])).values());
    const panelIdToInputIndex = new Map(uniquePanels.map((panel, i) => [panel.id, i]));
    
    // 2. Write files and build command start
    const command: string[] = [];
    for(let i = 0; i < uniquePanels.length; i++) {
        const panel = uniquePanels[i];
        const fileName = `input${i}.png`;
        await ffmpeg.writeFile(fileName, await fetchFile(panel.file));
        command.push('-loop', '1', '-framerate', `${settings.fps}`, '-i', fileName);
    }
    await ffmpeg.writeFile('audio.wav', await fetchFile(audioBlob));
    command.push('-i', 'audio.wav');
    
    // 3. Build filter_complex string
    let filterGraph = '';
    const { width, height } = getDimensions(settings.resolution, settings.aspectRatio);
    const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,trim=duration=`;

    // Part A: Pre-process all unique inputs based on their duration in the timeline
    let streamCounter = 0;
    const clipStreams: string[] = [];

    timelineItems.forEach((item, i) => {
        const inputIndex = panelIdToInputIndex.get(item.panel.id);
        filterGraph += `[${inputIndex}:v]${videoFilter}${item.duration}[clip${streamCounter}];`;
        clipStreams.push(`[clip${streamCounter}]`);
        streamCounter++;
    });

    // Part B: Chain transitions
    let lastStream = clipStreams[0];
    for (let i = 1; i < clipStreams.length; i++) {
        const currentStream = clipStreams[i];
        const transitionName = getXfadeTransitionName(settings.transition);
        const outputStream = (i === clipStreams.length - 1) ? '[vout]' : `[vt${i}]`;
        filterGraph += `${lastStream}${currentStream}xfade=transition=${transitionName}:duration=${transitionDuration}${outputStream};`;
        lastStream = outputStream;
    }
    
    if (timelineItems.length === 1) {
        // If only one item, just map it directly
        filterGraph += `${lastStream}null[vout]`;
    }

    command.push(
        '-filter_complex', filterGraph,
        '-map', timelineItems.length > 1 ? '[vout]' : lastStream,
        '-map', `${uniquePanels.length}:a`, // Map audio stream
        '-c:v', 'libx264', '-c:a', 'aac',
        '-r', `${settings.fps}`,
        '-t', audioDuration.toFixed(4),
        '-movflags', '+faststart',
        'output.mp4'
    );
    
    onLogMessage('Rendering video with transitions... (This is the longest step)');
    await ffmpeg.exec(command);
};


export async function renderVideo(
  panels: ManhwaPanel[],
  audioBlob: Blob,
  audioDuration: number,
  panelTimings: PanelTiming[],
  onProgress: (progress: number) => void,
  onLogMessage: (message: string) => void,
  settings: VideoSettings
): Promise<Blob> {
    onLogMessage('Initializing rendering engine...');
    const ffmpegInstance = await loadFFmpeg(onLogMessage, onProgress);
    
    onProgress(0);
    onLogMessage('Preparing assets (images and audio)...');
    
    if(settings.transition === 'cut' || panelTimings.length <= 1) {
        await renderWithConcat(ffmpegInstance, panels, audioBlob, audioDuration, panelTimings, settings, onLogMessage);
    } else {
        await renderWithTransitions(ffmpegInstance, panels, audioBlob, audioDuration, panelTimings, settings, onLogMessage);
    }
    
    onProgress(100);
    onLogMessage('Finalizing video file...');
    const data = await ffmpegInstance.readFile('output.mp4');

    onLogMessage('Cleaning up temporary files...');
    // A bit of a broad cleanup, but safer than tracking every single file name
    try {
        const files = await ffmpegInstance.listDir('.');
        for (const file of files) {
            if (!file.isDir && (file.name.endsWith('.png') || file.name.endsWith('.wav') || file.name.endsWith('.txt') || file.name === 'output.mp4')) {
                await ffmpegInstance.deleteFile(file.name);
            }
        }
    } catch(e) {
        console.error("Could not clean up all files, but proceeding.", e);
    }
    

    // Fix: Cast window to 'any' to access Blob, resolving TS error when 'dom' lib is not included.
    return new (window as any).Blob([data], { type: 'video/mp4' });
}