// var socket = io('http://127.0.0.1:5000');           // ONLY FOR DEV TESTING
var socket = io.connect(window.location.origin);

let peerConnections = {}; // Store peer connections keyed by socket ID

// STUN Server for NAT traversal
const rtcConfig = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302'] }]
};


function playStream() {
    
    socket.on('offer', async ({ offer, senderId }) => {
        const peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnections[senderId] = peerConnection;
        console.log(senderId);

        console.log('Received Stream');
        console.log(peerConnections);
        console.log(peerConnection) ;

        // Send ICE candidates to the sender
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('candidate', { candidate: event.candidate, senderId });
            }
        };

        // Handle incoming audio stream
        peerConnection.ontrack = event => {
            const audio = document.createElement('audio');
            const remoteStream = event.streams[0];
            // console.log(event.streams);
            // console.log(event.streams[0]);
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.controls = true;
            document.getElementById('audio-container').appendChild(audio);

            // add the visualizer element
            process_audio(audio.srcObject, audio);
        };

        // Set remote description and send answer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer, senderId });
    });

    // Handle incoming ICE candidates
    socket.on('candidate', ({ candidate, senderId }) => {
        const peerConnection = peerConnections[senderId];
        if (peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });   
    

}

function process_audio(stream_source, audio){
    // Define an audio context for the mixer visualization
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Lower values give a smoother visualization
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const source = audioContext.createMediaStreamSource(stream_source);
    source.connect(analyser);
    
    visualize(analyser,dataArray, audio);
}

function visualize(analyser, dataArray, audio) {

    requestAnimationFrame(() => visualize(analyser,dataArray, audio));
    analyser.getByteTimeDomainData(dataArray);

    const slider_temp = document.getElementById("test-slide");

    // Compute volume level (RMS - Root Mean Square)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += Math.pow(dataArray[i] - 128, 2);  // Normalize around 128
    }
    let stream_volume = Math.sqrt(sum / dataArray.length) * audio.volume;  // RMS value
   
    // assign the slider with the volume value
    slider_temp.value = stream_volume.toFixed(0);
}