
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { EditedClip, VideoSettings, TransitionOption } from '../types';

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
    return (dimensions[aspectRatio]?.[resolution] || dimensions['16:9']['1080p']);
};

const getXfadeTransitionName = (transition: TransitionOption): string => {
    const mapping: Record<string, string> = {
        cut: 'custom',
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
      // Suppress verbose logs unless they contain errors to keep console clean
      if(message.toLowerCase().includes('error')) {
        console.error(`[FFMPEG]: ${message}`);
      } else {
        console.log(`[FFMPEG]: ${message}`);
      }
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

export async function renderVideo(
  editedClips: EditedClip[],
  audioBlob: Blob,
  onProgress: (progress: number) => void,
  onLogMessage: (message: string) => void,
  settings: VideoSettings
): Promise<Blob> {
    onLogMessage('Initializing rendering engine...');
    const ffmpegInstance = await loadFFmpeg(onLogMessage, onProgress);
    
    onProgress(0);
    onLogMessage('Preparing assets for unified render...');

    const command: string[] = [];

    // --- 1. Prepare inputs and map them ---
    const uniquePanels = new Map<string, { base64: string; mime: string }>();
    editedClips.forEach(clip => {
        if (!uniquePanels.has(clip.panelId)) {
            uniquePanels.set(clip.panelId, { base64: clip.inpaintedImageBase64, mime: clip.mimeType });
        }
    });

    const panelIdToInputIndex = new Map<string, number>();
    let inputIndex = 0;
    for (const panelId of uniquePanels.keys()) {
        const panelData = uniquePanels.get(panelId)!;
        const fileName = `input_${inputIndex}.png`;
        const fetchResponse = await fetch(`data:${panelData.mime};base64,${panelData.base64}`);
        await ffmpegInstance.writeFile(fileName, new Uint8Array(await fetchResponse.arrayBuffer()));
        
        command.push('-i', fileName);
        panelIdToInputIndex.set(panelId, inputIndex);
        inputIndex++;
    }

    const audioInputIndex = inputIndex;
    await ffmpegInstance.writeFile('audio.wav', await fetchFile(audioBlob));
    command.push('-i', 'audio.wav');
    
    // --- 2. Build the complex filter graph ---
    onLogMessage('Constructing advanced filter graph...');
    let filterGraph = '';
    const clipVideoStreams: string[] = [];
    const { width, height } = getDimensions(settings.resolution, settings.aspectRatio);
    const totalDuration = editedClips.reduce((sum, clip) => sum + clip.duration, 0);

    // Pre-process each clip's visual elements
    editedClips.forEach((clip, i) => {
        const clipOutputStream = `[v_clip_${i}]`;
        const numFrames = Math.max(1, Math.ceil(clip.duration * settings.fps));
        
        // Create an animated stream for each crop
        const animatedCropStreams = clip.crops.map((crop, j) => {
            const sourceInputIndex = panelIdToInputIndex.get(clip.panelId)!;
            const animStream = `[anim_${i}_${j}]`;
            
            let zoompanFilter = '';
            if (settings.animation === 'pan_down') {
                zoompanFilter = `zoompan=z=1.1:d=${numFrames}:x='iw/2-(iw/zoom/2)':y='(ih-ih/1.1)*t/${clip.duration}':s=${crop.w}x${crop.h}:fps=${settings.fps}`;
            } else if (settings.animation === 'zoom') {
                const zoomRate = 0.1 / clip.duration; // Total zoom over clip duration
                zoompanFilter = `zoompan=z='min(zoom+${zoomRate}*t, 1.1)':d=${numFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${crop.w}x${crop.h}:fps=${settings.fps}`;
            } else { // 'none'
                zoompanFilter = `scale=${crop.w}:${crop.h}`;
            }

            filterGraph += `[${sourceInputIndex}:v]crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},${zoompanFilter},setpts=PTS-STARTPTS[${animStream}];`;
            return animStream;
        });
        
        // Layout the animated crops side-by-side
        if(animatedCropStreams.length > 1) {
            const hstackInputStream = animatedCropStreams.join('');
            filterGraph += `${hstackInputStream}hstack=inputs=${animatedCropStreams.length}[hstack_${i}];`;
            filterGraph += `[hstack_${i}]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,trim=duration=${clip.duration},setpts=PTS-STARTPTS${clipOutputStream};`;
        } else if (animatedCropStreams.length === 1) {
            filterGraph += `${animatedCropStreams[0]}scale=${width}:${height},trim=duration=${clip.duration},setpts=PTS-STARTPTS${clipOutputStream};`;
        }
        
        clipVideoStreams.push(clipOutputStream);
    });

    // --- 3. Concatenate or crossfade the final clip streams ---
    let finalVideoStream = '[vout]';
    if (editedClips.length === 1) {
        filterGraph += `${clipVideoStreams[0]}null${finalVideoStream};`;
    } else if (settings.transition === 'cut') {
        const concatStreams = clipVideoStreams.join('');
        filterGraph += `${concatStreams}concat=n=${clipVideoStreams.length}:v=1:a=0${finalVideoStream}`;
    } else {
        let lastStream = clipVideoStreams[0];
        let cumulativeDuration = 0;
        for (let i = 1; i < clipVideoStreams.length; i++) {
            cumulativeDuration += editedClips[i - 1].duration;
            const currentStream = clipVideoStreams[i];
            const transitionName = getXfadeTransitionName(settings.transition);
            const transitionDuration = 0.5;
            const outputStream = (i === clipVideoStreams.length - 1) ? finalVideoStream : `[vt${i}]`;
            
            filterGraph += `${lastStream}${currentStream}xfade=transition=${transitionName}:duration=${transitionDuration}:offset=${cumulativeDuration - transitionDuration}${outputStream};`;
            lastStream = outputStream;
        }
    }

    // --- 4. Assemble and execute the final command ---
    command.push(
        '-filter_complex', filterGraph,
        '-map', finalVideoStream.replace(/\[|\]/g, ''),
        '-map', `${audioInputIndex}:a`,
        '-c:v', 'libx264',
        // PERFORMANCE BOOST: Use 'ultrafast' preset for much faster encoding.
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-r', `${settings.fps}`,
        '-t', totalDuration.toFixed(4),
        '-shortest',
        'output.mp4'
    );
    
    onLogMessage('Rendering unified video... (This will be much faster now)');
    await ffmpegInstance.exec(command);
    
    onProgress(100);
    onLogMessage('Finalizing video file...');
    const data = await ffmpegInstance.readFile('output.mp4');

    onLogMessage('Cleaning up temporary files...');
    try {
        const files = await ffmpegInstance.listDir('.');
        for (const file of files) {
            if (!file.isDir) {
                await ffmpegInstance.deleteFile(file.name);
            }
        }
    } catch(e) {
        console.error("Could not clean up all files, but proceeding.", e);
    }
    
    // Create a new Uint8Array from the data. This creates a copy with a
    // standard ArrayBuffer, resolving the strict type mismatch with the
    // Blob constructor that occurs in some build environments.
    const blobData = new Uint8Array(data as Uint8Array);
    return new Blob([blobData], { type: 'video/mp4' });
}
