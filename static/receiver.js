// var socket = io.connect('https://' + document.domain + ':' + location.port);
var socket = io('http://127.0.0.1:5000');
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
            console.log(event.streams);
            console.log(event.streams[0]);
            audio.srcObject = event.streams[0];
            audio.autoplay = true;
            audio.controls = true;
            document.getElementById('audio-container').appendChild(audio);
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
