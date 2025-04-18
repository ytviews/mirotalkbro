'use strict';

const broadcastID = new URLSearchParams(window.location.search).get('id');
const username = new URLSearchParams(window.location.search).get('name');

console.log('Viewer', {
    username: username,
    roomId: broadcastID,
});

const body = document.querySelector('body');

const awaitingBroadcaster = document.getElementById('awaitingBroadcaster');
const viewerForm = document.getElementById('viewerForm');
const viewerFormHeader = document.getElementById('viewerFormHeader');
const viewerButtons = document.getElementById('viewerButtons');
const myName = document.getElementById('myName');
const sessionTime = document.getElementById('sessionTime');
const video = document.querySelector('video');
const videoOff = document.getElementById('videoOff');

const enableAudio = document.getElementById('enableAudio');
const disableAudio = document.getElementById('disableAudio');
const videoBtn = document.getElementById('videoBtn');
const recordingStart = document.getElementById('recordingStart');
const recordingStop = document.getElementById('recordingStop');
const recordingLabel = document.getElementById('recordingLabel');
const recordingTime = document.getElementById('recordingTime');
const snapshot = document.getElementById('snapshot');
const fullScreenOn = document.getElementById('fullScreenOn');
const fullScreenOff = document.getElementById('fullScreenOff');
const togglePIP = document.getElementById('togglePIP');
const leave = document.getElementById('leave');
const messagesBtn = document.getElementById('messagesBtn');
const messagesForm = document.getElementById('messagesForm');
const messageInput = document.getElementById('messageInput');
const messageSend = document.getElementById('messageSend');

const userAgent = navigator.userAgent;
const parser = new UAParser(userAgent);
const result = parser.getResult();
const deviceType = result.device.type || 'desktop';
const isMobileDevice = deviceType === 'mobile';

// =====================================================
// Body on Load
// =====================================================

body.onload = onBodyLoad;

function onBodyLoad() {
    loadViewerToolTip();
    toggleMessages();
}

// =====================================================
// Handle theme
// =====================================================

const getMode = window.localStorage.mode || 'dark';
const dark = getMode === 'dark';
if (dark) body.classList.toggle('dark');

// =====================================================
// Handle ToolTips
// =====================================================

function loadViewerToolTip() {
    const viewerTooltips = [
        { element: enableAudio, text: 'Enable your audio', position: 'top' },
        { element: disableAudio, text: 'Disable your audio', position: 'top' },
        { element: videoBtn, text: 'Toggle your video', position: 'top' },
        { element: recordingStart, text: 'Start recording', position: 'top' },
        { element: recordingStop, text: 'Stop recording', position: 'top' },
        { element: snapshot, text: 'Take a snapshot', position: 'top' },
        { element: togglePIP, text: 'Toggle picture in picture', position: 'top' },
        { element: messagesBtn, text: 'Toggle messages', position: 'top' },
        { element: fullScreenOn, text: 'Enable full screen', position: 'top' },
        { element: fullScreenOff, text: 'Disable full screen', position: 'top' },
        { element: leave, text: 'Disconnect', position: 'top' },
    ];

    viewerTooltips.forEach(({ element, text, position }) => {
        setTippy(element, text, position);
    });
}

let zoom = 1;
let messagesFormOpen = true;
let recording = null;
let recordingTimer = null;
let sessionTimer = null;

myName.innerText = username;

// =====================================================
// Handle RTC Peer Connection
// =====================================================

let peerConnection;
let dataChannel;
let viewerStream;

const socket = io.connect(window.location.origin);

socket.on('offer', async (id, description, iceServers) => {
    peerConnection = new RTCPeerConnection({ iceServers: iceServers });

    handleDataChannel();

    peerConnection.onconnectionstatechange = (event) => {
        console.log('RTCPeerConnection', {
            connectionStatus: event.currentTarget.connectionState,
            signalingState: event.currentTarget.signalingState,
        });
    };

    if (viewerStream) {
        viewerStream.getTracks().forEach((track) => peerConnection.addTrack(track, viewerStream));
    }

    peerConnection.ontrack = (event) => {
        saveRecording();
        attachStream(event.streams[0]);
        hideElement(awaitingBroadcaster);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', id, event.candidate);
        }
    };

    peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => socket.emit('answer', id, peerConnection.localDescription))
        .catch(handleError);
});

socket.on('candidate', (id, candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(handleError);
});

socket.on('connect', async () => {
    await checkViewerAudioVideo();

    socket.emit('viewer', broadcastID, username);
});

socket.on('broadcaster', () => {
    socket.emit('viewer', broadcastID, username);
});

socket.on('broadcasterDisconnect', () => {
    location.reload();
});

function handleError(error) {
    console.error('Error', error);
}

// =====================================================
// Check Viewer Audio/Video
// =====================================================

async function checkViewerAudioVideo() {
    if (broadcastSettings.options.show_viewers && (viewerSettings.buttons.audio || viewerSettings.buttons.video)) {
        viewerStream = await getStream();
        if (viewerSettings.buttons.audio) disableAudio.click();
        if (viewerSettings.buttons.video) videoBtn.click();
    }
}

// =====================================================
// Handle RTC Data Channel
// =====================================================

function handleDataChannel() {
    dataChannel = peerConnection.createDataChannel('mt_bro_dc');
    dataChannel.binaryType = 'arraybuffer'; // blob
    dataChannel.onopen = (event) => {
        console.log('DataChannel open', event);
    };
    dataChannel.onclose = (event) => {
        console.log('DataChannel close', event);
    };
    dataChannel.onerror = (event) => {
        console.log('DataChannel error', event);
    };
    peerConnection.ondatachannel = (event) => {
        event.channel.onmessage = (message) => {
            let data = {};
            try {
                data = JSON.parse(message.data);
                handleDataChannelMessage(data);
                console.log('Incoming dc data', data);
            } catch (err) {
                console.log('Datachannel error', err);
            }
        };
    };
}

function handleDataChannelMessage(data) {
    switch (data.method) {
        case 'mute':
            if (disableAudio.style.display !== 'none') {
                disableAudio.click();
                popupMessage('toast', 'Broadcaster', 'Broadcaster muted your microphone', 'top');
            }
            break;
        case 'hide':
            if (videoBtn.style.color !== 'red') {
                videoBtn.click();
                popupMessage('toast', 'Broadcaster', 'Broadcaster hide your camera', 'top');
            }
            break;
        case 'disconnect':
            openURL(viewerSettings.options.disconnect_url);
            break;
        case 'video':
            videoOff.style.visibility = data.action.visibility;
            break;
        case 'audio':
            popupMessage(
                'toast',
                'Broadcaster',
                `Broadcaster audio ${data.action.enable ? 'enabled' : 'disabled'}`,
                'top',
            );
            break;
        //...
        default:
            console.error('Data channel message not handled', data);
            break;
    }
}

function sendToBroadcasterDataChannel(method, action = {}) {
    if (!peerConnection || !dataChannel) return;

    if (dataChannel.readyState !== 'open') {
        console.warn('DataChannel is not open. Current state:', dataChannel.readyState);
        return;
    }

    dataChannel.send(
        JSON.stringify({
            method: method,
            action: action,
        }),
    );
}

// =====================================================
// Handle element display
// =====================================================

elementDisplay(fullScreenOff, false);
elementDisplay(disableAudio, broadcastSettings.options.show_viewers && viewerSettings.buttons.audio);
elementDisplay(enableAudio, broadcastSettings.options.show_viewers && viewerSettings.buttons.audio && false);
elementDisplay(videoBtn, broadcastSettings.options.show_viewers && viewerSettings.buttons.video);
elementDisplay(recordingLabel, false);
elementDisplay(recordingStop, false);
elementDisplay(snapshot, viewerSettings.buttons.snapshot);
elementDisplay(recordingStart, viewerSettings.buttons.recordingStart);
elementDisplay(fullScreenOn, viewerSettings.buttons.fullScreenOn && isFullScreenSupported());
elementDisplay(togglePIP, viewerSettings.buttons.pictureInPicture && isPIPSupported());
elementDisplay(leave, viewerSettings.buttons.close);

messageDisplay(viewerSettings.buttons.message);

function messageDisplay(display) {
    elementDisplay(messagesBtn, display);
    elementDisplay(messagesForm, display, display ? 'grid' : 'none');
    elementDisplay(messageInput, display);
    elementDisplay(messageSend, display);
}

if (viewerSettings.options.start_full_screen) {
    viewerForm.classList.remove(...viewerForm.classList);
    viewerForm.classList.add('full-screen');
    elementDisplay(viewerFormHeader, false);
    elementDisplay(viewerButtons, false);
    elementDisplay(messagesForm, false);
}

// =====================================================
// Handle session timer
// =====================================================

startSessionTime();

function startSessionTime() {
    let sessionElapsedTime = 0;
    sessionTimer = setInterval(function printTime() {
        sessionElapsedTime++;
        sessionTime.innerText = secondsToHms(sessionElapsedTime);
    }, 1000);
}

function stopSessionTime() {
    clearInterval(sessionTimer);
}

// if (!isMobileDevice) makeDraggable(viewerForm, viewerFormHeader);

// =====================================================
// Handle messages
// =====================================================

messagesBtn.addEventListener('click', toggleMessages);

function toggleMessages() {
    const display = messagesFormOpen ? false : true;
    const mode = messagesFormOpen ? 'none' : 'grid';
    elementDisplay(messagesForm, display, mode);
    messagesFormOpen = !messagesFormOpen;
}

// =====================================================
// Handle audio stream
// =====================================================

enableAudio.addEventListener('click', () => toggleAudio(true));
disableAudio.addEventListener('click', () => toggleAudio(false));

function toggleAudio(enabled) {
    if (!viewerStream) return;

    viewerStream.getAudioTracks()[0].enabled = !viewerStream.getAudioTracks()[0].enabled;

    elementDisplay(enableAudio, !enabled);
    elementDisplay(disableAudio, enabled && viewerSettings.buttons.audio);

    sendToBroadcasterDataChannel('audio', {
        id: socket.id,
        username: username,
        enabled: enabled,
    });

    checkTrackAndPopup(viewerStream);
}

// =====================================================
// Handle video stream
// =====================================================

videoBtn.addEventListener('click', toggleVideo);

function toggleVideo() {
    if (!viewerStream) return;

    viewerStream.getVideoTracks()[0].enabled = !viewerStream.getVideoTracks()[0].enabled;

    const color = getMode === 'dark' ? 'white' : 'black';
    const enabled = videoBtn.style.color !== 'red';
    videoBtn.style.color = enabled ? 'red' : color;

    sendToBroadcasterDataChannel('video', {
        id: socket.id,
        username: username,
        enabled: !enabled,
    });

    checkTrackAndPopup(viewerStream);
}

// =====================================================
// Handle video
// =====================================================

video.addEventListener('click', toggleFullScreen);
video.addEventListener('wheel', handleZoom);

function toggleFullScreen() {
    if (isMobileDevice) return;
    isFullScreen() ? goOutFullscreen(video) : goInFullscreen(video);
}

function handleZoom(e) {
    e.preventDefault();
    if (!video.srcObject || !viewerSettings.options.zoom_video) return;
    const delta = e.wheelDelta ? e.wheelDelta : -e.deltaY;
    delta > 0 ? (zoom *= 1.2) : (zoom /= 1.2);
    if (zoom < 1) zoom = 1;
    video.style.scale = zoom;
}

// =====================================================
// Handle stream
// =====================================================

function attachStream(stream) {
    video.srcObject = stream;
    video.playsInline = true;
    video.autoplay = true;
    video.controls = false;
}

async function getStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: viewerSettings.buttons.video,
            audio: viewerSettings.buttons.audio,
        });
        return stream;
    } catch (error) {
        console.error('Failed to access media devices:', error.message);
        handleMediaStreamError(error);
        hideVideoAudioButtons();
        return null;
    }
}

function hideVideoAudioButtons() {
    elementDisplay(disableAudio, false);
    elementDisplay(enableAudio, false);
    elementDisplay(videoBtn, false);
}

video.addEventListener('loadeddata', () => {
    video.play().catch((error) => {
        console.error('Autoplay failed', error.message);
        popupEnableAutoPlay();
    });
});

// =====================================================
// Handle recording
// =====================================================

recordingStart.addEventListener('click', toggleRecording);
recordingStop.addEventListener('click', toggleRecording);

function toggleRecording() {
    recording && recording.isStreamRecording() ? stopRecording() : startRecording();
}

function startRecording() {
    if (!video.srcObject) {
        return popupMessage('toast', 'Video', "There isn't a video stream to recording", 'top');
    } else {
        recording = new Recording(video.srcObject, recordingLabel, recordingTime, recordingStop, recordingStart);
        recording.start();
    }
}
function stopRecording() {
    recording.stop();
}

function startRecordingTimer() {
    let recElapsedTime = 0;
    recordingTimer = setInterval(function printTime() {
        if (recording.isStreamRecording()) {
            recElapsedTime++;
            recordingTime.innerText = secondsToHms(recElapsedTime);
        }
    }, 1000);
}
function stopRecordingTimer() {
    clearInterval(recordingTimer);
}

function saveRecording() {
    if (recording && recording.isStreamRecording()) stopRecording();
}

// =====================================================
// Handle Snapshot
// =====================================================

snapshot.addEventListener('click', gotSnapshot);

function gotSnapshot() {
    if (!video.srcObject) {
        return popupMessage('toast', 'Video', "There isn't a video stream to capture", 'top');
    }
    playSound('snapshot');
    let context, canvas, width, height, dataURL;
    width = video.videoWidth;
    height = video.videoHeight;
    canvas = canvas || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);
    dataURL = canvas.toDataURL('image/png'); // or image/jpeg
    saveDataToFile(dataURL, getDataTimeString() + '-snapshot.png');
}

// =====================================================
// Handle picture in picture
// =====================================================

togglePIP.addEventListener('click', handleVideoPIP);

handleVideoPIPonExit();

function handleVideoPIP() {
    if (!video.srcObject) {
        popupMessage('toast', 'Picture-in-Picture', 'There is no video for PIP', 'top');
    } else {
        togglePictureInPicture(video);
    }
}

// =====================================================
// Handle full screen mode
// =====================================================

fullScreenOn.addEventListener('click', toggleFullScreenDoc);
fullScreenOff.addEventListener('click', toggleFullScreenDoc);

function toggleFullScreenDoc() {
    const isDocFullScreen = isFullScreen();
    isDocFullScreen ? goOutFullscreen() : goInFullscreen(document.documentElement);
    elementDisplay(fullScreenOn, isDocFullScreen);
    elementDisplay(fullScreenOff, !isDocFullScreen);
}

// =====================================================
// Handle leave room
// =====================================================

leave.addEventListener('click', disconnectMe);

function disconnectMe() {
    stopSessionTime();
    openURL(viewerSettings.options.redirect_url);
}

// =====================================================
// Handle messages
// =====================================================

messageSend.addEventListener('click', sendMessage);

messageInput.onkeydown = (e) => {
    if (e.code === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        messageSend.click();
    }
};

messageInput.oninput = function () {
    const chatInputEmoji = {
        '<3': '❤️',
        '</3': '💔',
        ':D': '😀',
        ':)': '😃',
        ';)': '😉',
        ':(': '😒',
        ':p': '😛',
        ';p': '😜',
        ":'(": '😢',
        ':+1:': '👍',
        ':*': '😘',
        ':O': '😲',
        ':|': '😐',
        ':*(': '😭',
        XD: '😆',
        ':B': '😎',
        ':P': '😜',
        '<(': '👎',
        '>:(': '😡',
        ':S': '😟',
        ':X': '🤐',
        ';(': '😥',
        ':T': '😖',
        ':@': '😠',
        ':$': '🤑',
        ':&': '🤗',
        ':#': '🤔',
        ':!': '😵',
        ':W': '😷',
        ':%': '🤒',
        ':*!': '🤩',
        ':G': '😬',
        ':R': '😋',
        ':M': '🤮',
        ':L': '🥴',
        ':C': '🥺',
        ':F': '🥳',
        ':Z': '🤢',
        ':^': '🤓',
        ':K': '🤫',
        ':D!': '🤯',
        ':H': '🧐',
        ':U': '🤥',
        ':V': '🤪',
        ':N': '🥶',
        ':J': '🥴',
    };
    for (let i in chatInputEmoji) {
        let regex = new RegExp(escapeSpecialChars(i), 'gim');
        this.value = this.value.replace(regex, chatInputEmoji[i]);
    }
};

function sendMessage() {
    if (peerConnection && messageInput.value != '') {
        sendToBroadcasterDataChannel('message', {
            id: socket.id,
            username: username,
            message: messageInput.value,
        });
    } else {
        popupMessage('toast', 'Video', 'There is no broadcast connected', 'top');
    }
    messageInput.value = '';
}

// =====================================================
// Handle window exit
// =====================================================

window.onbeforeunload = () => {
    socket.close();
    if (peerConnection) {
        peerConnection.close();
    }
    stopSessionTime();
    saveRecording();
    return undefined;
};
