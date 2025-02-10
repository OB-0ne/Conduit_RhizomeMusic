// var socket = io('http://127.0.0.1:5000');       // ONLY FOR DEV TESTING
var socket = io.connect(window.location.origin);

// STUN Server for NAT traversal
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const aud_effect_constraints = {
    echoCancellation : false
};

async function getAudioStream(params) {
    // access the default mic of the device
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });    

    // make a p2p connection
    const peerConnection = new RTCPeerConnection(rtcConfig);
    stream.getTracks().forEach(track => {
        track.applyConstraints(aud_effect_constraints);
        peerConnection.addTrack(track, stream);
    });
    
    // send the input audio as an offer
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, senderId: socket.id });
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', {offer, senderId: socket.id });

    socket.on('answer', async ({ answer, remoteSenderID }) => {
        if(remoteSenderID = socket.id){
            // Set the remote description with the answer received from the receiver
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

}