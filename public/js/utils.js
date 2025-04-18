'use strict';

function openURL(url, blank = false) {
    blank ? window.open(url, '_blank') : (window.location.href = url);
}

function elementDisplay(element, display, mode = 'block') {
    element.style.display = display ? mode : 'none';
}

function elementDisable(element, disable) {
    element.disabled = disable;
}

function elementSetColor(elem, color) {
    elem.style.color = color;
}

function getTime() {
    const date = new Date();
    return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
}

function getDataTimeString() {
    const d = new Date();
    const date = d.toISOString().split('T')[0];
    const time = d.toTimeString().split(' ')[0];
    return `${date}-${time}`;
}

function secondsToHms(d) {
    d = Number(d);
    let h = Math.floor(d / 3600);
    let m = Math.floor((d % 3600) / 60);
    let s = Math.floor((d % 3600) % 60);
    let hDisplay = h > 0 ? h + 'h' : '';
    let mDisplay = m > 0 ? m + 'm' : '';
    let sDisplay = s > 0 ? s + 's' : '';
    return hDisplay + ' ' + mDisplay + ' ' + sDisplay;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function isPIPSupported() {
    return !isMobileDevice && document.pictureInPictureEnabled;
}

function setTippy(elem, content, placement) {
    if (isMobileDevice) return;
    try {
        tippy(elem, {
            content: content,
            placement: placement,
        });
    } catch (err) {
        console.error('setTippy error', err.message);
    }
}

function getPeerId(id) {
    return id.split('___')[0];
}

function getPeerName(id) {
    return id.split('___')[1];
}

function getUUID4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
    );
}

function hasVideoOrAudioTracks(mediaStream) {
    const hasVideo = mediaStream && mediaStream.getVideoTracks().length > 0;
    const hasAudio = mediaStream && mediaStream.getAudioTracks().length > 0;
    return { hasVideo, hasAudio };
}

function hasAudioTrack(mediaStream) {
    return mediaStream && mediaStream.getAudioTracks().length > 0;
}

function hasVideoTrack(mediaStream) {
    return mediaStream && mediaStream.getVideoTracks().length > 0;
}

function stopTracks(mediaStream) {
    if (mediaStream) {
        mediaStream.getTracks().forEach((track) => {
            track.stop();
        });
    }
}

function stopAudioTrack(mediaStream) {
    if (mediaStream) {
        mediaStream.getAudioTracks().forEach((audioTrack) => {
            audioTrack.stop();
        });
    }
}

function stopVideoTrack(mediaStream) {
    if (mediaStream) {
        mediaStream.getVideoTracks().forEach((videoTrack) => {
            videoTrack.stop();
        });
    }
}

function checkTrackAndPopup(mediaStream) {
    let message = '';

    const audioTrack = mediaStream.getAudioTracks()[0];
    const videoTrack = mediaStream.getVideoTracks()[0];

    const on = '<span class="color-green">on</span>';
    const off = '<span class="color-red">off</span>';

    if (audioTrack) {
        const audioEnabled = audioTrack.enabled;
        message = `Your microphone is ${audioEnabled ? on : off}`;
    }

    if (videoTrack) {
        const videoEnabled = videoTrack.enabled;
        const videoMessage = `Your camera is ${videoEnabled ? on : off}`;
        message = message ? `${message}, ${videoMessage}` : videoMessage;
    }

    popupMessage('toast', 'Microphone/Camera', message, 'top');
}

function handleMediaStreamError(error) {
    let errorMessage = error;
    let shouldHandleGetUserMediaError = true;

    switch (error.name) {
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            errorMessage = 'Required track is missing';
            break;
        case 'NotReadableError':
        case 'TrackStartError':
            errorMessage = 'Device is already in use';
            break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
            errorMessage = 'Constraints cannot be satisfied by available devices';
            break;
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            errorMessage = 'Permission denied in browser';
            break;
        case 'AbortError':
            errorMessage = 'Operation aborted unexpectedly';
            break;
        case 'SecurityError':
            errorMessage = 'Security error: Check your connection or browser settings';
            break;
        default:
            errorMessage = "Can't get stream, make sure you are in a secure TLS context (HTTPS) and try again";
            shouldHandleGetUserMediaError = false;
            break;
    }

    if (shouldHandleGetUserMediaError) {
        errorMessage += `
        Check the common <a href="https://blog.addpipe.com/common-getusermedia-errors" target="_blank">getUserMedia errors</a></li>`;
    }
    popupMessage('warning', 'Ops', errorMessage, 'center');
}

function saveDataToFile(dataURL, fileName) {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = dataURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(dataURL);
    }, 100);
}

function saveAllMessages(messages) {
    const fileName = getDataTimeString() + '-messages.txt';
    let a = document.createElement('a');
    a.style.display = 'none';
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(messages, null, 1));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    playSound('download');
}

function saveAllViewers(messages) {
    const fileName = getDataTimeString() + '-viewers.txt';
    let a = document.createElement('a');
    a.style.display = 'none';
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(messages, null, 1));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    playSound('download');
}

function copyRoomURL() {
    const tmpInput = document.createElement('input');
    document.body.appendChild(tmpInput);
    tmpInput.style.display = 'none';
    tmpInput.value = roomURL;
    tmpInput.select();
    tmpInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(tmpInput.value).then(() => {
        document.body.removeChild(tmpInput);
        popupMessage('toast', 'Invite viewer', 'Viewer invite link copied', 'top', 2000);
    });
}

function shareRoomQR() {
    popupMessage(
        'clean',
        'Invite viewers',
        `<div class="qrRoomContainer">
            <canvas id="qrRoom"></canvas>
        </div>
        <p>No need for apps, simply capture the QR code with your mobile camera Or Invite viewers to join your live broadcast by sending them the following URL</p>
        <p style="color:#2196f3;">${roomURL}</p>`,
    );
    makeRoomQR();
}

function makeRoomQR() {
    let qr = new QRious({
        element: document.getElementById('qrRoom'),
        value: roomURL,
    });
    qr.set({
        size: 256,
    });
}

async function shareRoomNavigator() {
    try {
        await navigator.share({ url: roomURL });
    } catch (err) {
        console.error('[Error] navigator share, falling back to QR', err);

        if (!isMobileDevice) shareRoomQR();
    }
}

function isFullScreenSupported() {
    return (
        document.fullscreenEnabled ||
        document.mozFullScreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.msFullscreenEnabled
    );
}

function isFullScreen() {
    const elementFullScreen =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        null;
    if (elementFullScreen === null) return false;
    return true;
}

function handleVideoPIPonExit() {
    video.addEventListener('leavepictureinpicture', (event) => {
        console.log('Exited PiP mode');
        if (video.paused) {
            video.play().catch((error) => {
                console.error('Error playing video after exit PIP mode', error);
            });
        }
    });
}

function togglePictureInPicture(element) {
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
        element.requestPictureInPicture().catch((error) => {
            console.error('Failed to enter Picture-in-Picture mode', error);
            popupMessage('warning', 'PIP', error.message);
            elementDisplay(element, false);
        });
    }
}

function goInFullscreen(element) {
    if (element.requestFullscreen) element.requestFullscreen();
    else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
    else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
    else if (element.msRequestFullscreen) element.msRequestFullscreen();
    else popupMessage('info', 'Full screen', 'Full screen mode not supported by this browser on this device.');
}

function goOutFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
}

function logStreamSettingsInfo(stream) {
    const streamInfo = [];
    if (stream.getVideoTracks()[0]) {
        streamInfo.push({
            video: {
                label: stream.getVideoTracks()[0].label,
                settings: stream.getVideoTracks()[0].getSettings(),
            },
        });
    }
    if (stream.getAudioTracks()[0]) {
        streamInfo.push({
            audio: {
                label: stream.getAudioTracks()[0].label,
                settings: stream.getAudioTracks()[0].getSettings(),
            },
        });
    }
    console.log('StreamInfo', streamInfo);
}

function escapeSpecialChars(regex) {
    return regex.replace(/([()[{*+.$^\\|?])/g, '\\$1');
}

function makeDraggable(element, dragObj) {
    let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
    if (dragObj) {
        dragObj.onmousedown = dragMouseDown;
    } else {
        element.onmousedown = dragMouseDown;
    }
    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = element.offsetTop - pos2 + 'px';
        element.style.left = element.offsetLeft - pos1 + 'px';
    }
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function hideElement(element) {
    if (!element.classList.contains('hidden')) {
        element.classList.add('hidden');
    }
}

async function playSound(name) {
    const sound = '../assets/sounds/' + name + '.mp3';
    const audioToPlay = new Audio(sound);
    try {
        audioToPlay.volume = 0.5;
        await audioToPlay.play();
    } catch (e) {
        return false;
    }
}
