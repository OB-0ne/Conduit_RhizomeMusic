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
        { urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302'] }
    ]
};

const aud_effect_constraints = {
    echoCancellation : false
};

async function sendAudioStream() {
    // access the default mic of the device
    let stream;
    
    try{
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    }
    catch
    {
        console.log("Mic Permission dismissed");
        return;
    }
    
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