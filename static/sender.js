var socket = io.connect(window.location.origin);

// global mic activateion flag
let micActive = false;

function updateMicInfo(){
    if (micActive){
        // change the mic icon and info to show that audio is being tranfer
        document.getElementById('MicIcon').setAttribute('src','static/img/mic_icon_on.png');
        document.getElementById('MicInfo').innerHTML = '(Microphone is ON)';
    } else {
        // change the mic icon and info to show that audio is being tranfer
        document.getElementById('MicIcon').setAttribute('src','static/img/mic_icon_off.png');
        document.getElementById('MicInfo').innerHTML = '(Microphone is OFF)';
    }
}

// STUN Server for NAT traversal
const rtcConfig = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302'] },
        {
            urls: "turn:relay.backups.cz", // Free TURN server (temporary)
            username: "webrtc",
            credential: "webrtc"
        }
    ]
};

const aud_effect_constraints = {
    echoCancellation : false
};

async function sendAudioStream() {
    // access the default mic of the device
    let stream;
    
    console.log('0 - Function started');
    try{
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    }
    catch
    {
        console.log("Mic Permission dismissed");
        return;
    }
    
    console.log('1 - Audio found and added to stream');
    
    // make a p2p connection
    const peerConnection = new RTCPeerConnection(rtcConfig);
    stream.getTracks().forEach(track => {
        track.applyConstraints(aud_effect_constraints);
        peerConnection.addTrack(track, stream);
    });

    console.log('2 - PeerConnection variable made and stream added to it');

    
    // send the input audio as an offer
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, senderId: socket.id });
            // console.log(event.candidate);
            console.log('? - socket candidate emitted');

        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('3 - Offer generated');
    socket.emit('offer', {offer, senderId: socket.id });
    console.log('4 - socket Offer emitted');

    
    socket.on('answer', async ({ answer, remoteSenderID }) => {
        console.log(remoteSenderID, socket.id,remoteSenderID == socket.id);
        if(remoteSenderID == socket.id){
            // Set the remote description with the answer received from the receiver
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('? - anser received and added for peer connection');
        }
    });

    // update mic info
    micActive = true;
    updateMicInfo();

}

// Random message generator for each used on Arrival
const welcomeMsgs = [
    'here/there',
    'you are remote',
    'miles of line'
];

function generate_welcomeMsg(){
    
    let msg_len = welcomeMsgs.length;
    let rand_msg;

    // generate a random number
    rand_msg = welcomeMsgs[Math.floor(Math.random()*msg_len)];
    // update the welcome text with random number
    document.getElementById('sender_welcome').innerHTML = rand_msg;

}